import "server-only";

import { getSupabaseServerConfig } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  phone?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

export type AuthSuccess = {
  ok: true;
  user: AuthenticatedUser;
  token: string;
};

export type AuthFailure = {
  ok: false;
  status: number;
  error: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

export function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export function getServiceRestConfig() {
  const config = getSupabaseServerConfig();
  if (!config) {
    return null;
  }

  const baseUrl = config.url.replace(/\/$/, "");
  return {
    baseUrl,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    }
  };
}

export async function getAuthenticatedUser(request: Request): Promise<AuthResult> {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return { ok: false, status: 500, error: "SUPABASE_NOT_CONFIGURED" };
  }

  const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response || !response.ok) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const user = (await response.json()) as AuthenticatedUser;
  if (!user?.id) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  return { ok: true, user, token };
}

export function authErrorResponse(auth: AuthFailure) {
  return Response.json({ ok: false, error: auth.error }, { status: auth.status });
}

export async function readJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}
