"use client";

export type SupabaseAuthUser = {
  id: string;
  phone?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

export type SupabaseAuthSession = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number;
  user: SupabaseAuthUser;
};

const STORAGE_KEY = "yujian_supabase_session";

function getClientConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    anonKey
  };
}

function getHeaders(anonKey: string, accessToken?: string): HeadersInit {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
    "Content-Type": "application/json"
  };
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(getClientConfig());
}

export function getStoredSession(): SupabaseAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SupabaseAuthSession;
    return parsed?.access_token && parsed?.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function getStoredAccessToken(): string {
  return getStoredSession()?.access_token ?? "";
}

export function storeSession(session: SupabaseAuthSession) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function sendPhoneOtp(phone: string): Promise<void> {
  const config = getClientConfig();
  if (!config) {
    throw new Error("SUPABASE_AUTH_NOT_CONFIGURED");
  }

  const response = await fetch(`${config.url}/auth/v1/otp`, {
    method: "POST",
    headers: getHeaders(config.anonKey),
    body: JSON.stringify({
      phone,
      create_user: true
    })
  });

  if (!response.ok) {
    throw new Error(`OTP_SEND_FAILED_${response.status}`);
  }
}

export async function sendEmailOtp(email: string, emailRedirectTo?: string): Promise<void> {
  const config = getClientConfig();
  if (!config) {
    throw new Error("SUPABASE_AUTH_NOT_CONFIGURED");
  }

  const response = await fetch(`${config.url}/auth/v1/otp`, {
    method: "POST",
    headers: getHeaders(config.anonKey),
    body: JSON.stringify({
      email,
      create_user: true,
      ...(emailRedirectTo
        ? {
            options: {
              email_redirect_to: emailRedirectTo
            }
          }
        : {})
    })
  });

  if (!response.ok) {
    throw new Error(`EMAIL_OTP_SEND_FAILED_${response.status}`);
  }
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<SupabaseAuthSession> {
  const config = getClientConfig();
  if (!config) {
    throw new Error("SUPABASE_AUTH_NOT_CONFIGURED");
  }

  const response = await fetch(`${config.url}/auth/v1/verify`, {
    method: "POST",
    headers: getHeaders(config.anonKey),
    body: JSON.stringify({
      phone,
      token,
      type: "sms"
    })
  });

  if (!response.ok) {
    throw new Error(`OTP_VERIFY_FAILED_${response.status}`);
  }

  const session = (await response.json()) as SupabaseAuthSession;
  if (!session.access_token || !session.user?.id) {
    throw new Error("OTP_VERIFY_INVALID_SESSION");
  }

  storeSession(session);
  return session;
}

export async function verifyEmailOtp(email: string, token: string): Promise<SupabaseAuthSession> {
  const config = getClientConfig();
  if (!config) {
    throw new Error("SUPABASE_AUTH_NOT_CONFIGURED");
  }

  const response = await fetch(`${config.url}/auth/v1/verify`, {
    method: "POST",
    headers: getHeaders(config.anonKey),
    body: JSON.stringify({
      email,
      token,
      type: "email"
    })
  });

  if (!response.ok) {
    throw new Error(`EMAIL_OTP_VERIFY_FAILED_${response.status}`);
  }

  const session = (await response.json()) as SupabaseAuthSession;
  if (!session.access_token || !session.user?.id) {
    throw new Error("EMAIL_OTP_VERIFY_INVALID_SESSION");
  }

  storeSession(session);
  return session;
}

async function fetchUserByAccessToken(accessToken: string): Promise<SupabaseAuthUser | null> {
  const config = getClientConfig();
  if (!config || !accessToken) {
    return null;
  }

  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: "GET",
    headers: getHeaders(config.anonKey, accessToken)
  });

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as SupabaseAuthUser;
  return user?.id ? user : null;
}

export async function consumeMagicLinkFromUrl(): Promise<SupabaseAuthSession | null> {
  if (typeof window === "undefined" || !window.location.hash) {
    return null;
  }

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  if (!accessToken) {
    return null;
  }

  const user = await fetchUserByAccessToken(accessToken);
  if (!user) {
    return null;
  }

  const expiresIn = Number(params.get("expires_in") || 0);
  const session: SupabaseAuthSession = {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") || undefined,
    token_type: params.get("token_type") || "bearer",
    expires_in: Number.isFinite(expiresIn) ? expiresIn : undefined,
    user
  };

  storeSession(session);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return session;
}

export async function fetchCurrentUser(): Promise<SupabaseAuthUser | null> {
  const config = getClientConfig();
  const session = getStoredSession();
  if (!config || !session?.access_token) {
    return null;
  }

  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: "GET",
    headers: getHeaders(config.anonKey, session.access_token)
  });

  if (!response.ok) {
    clearStoredSession();
    return null;
  }

  const user = (await response.json()) as SupabaseAuthUser;
  return user?.id ? user : null;
}

export async function signOut() {
  const config = getClientConfig();
  const session = getStoredSession();
  clearStoredSession();

  if (!config || !session?.access_token) {
    return;
  }

  await fetch(`${config.url}/auth/v1/logout`, {
    method: "POST",
    headers: getHeaders(config.anonKey, session.access_token)
  }).catch(() => undefined);
}
