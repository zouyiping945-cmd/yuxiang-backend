import {
  authErrorResponse,
  getAuthenticatedUser,
  getServiceRestConfig,
  readJsonBody
} from "@/lib/auth/session";

type ProfilePayload = {
  nickname?: string;
  avatar_url?: string;
};

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.ok) {
    return authErrorResponse(auth);
  }

  const service = getServiceRestConfig();
  if (!service) {
    return Response.json({ ok: false, error: "SUPABASE_NOT_CONFIGURED" }, { status: 500 });
  }

  const endpoint =
    `${service.baseUrl}/rest/v1/user_profiles?select=*` +
    `&auth_user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: service.headers,
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json({ ok: false, error: "PROFILE_QUERY_FAILED" }, { status: 500 });
  }

  const rows = (await response.json()) as unknown[];
  return Response.json({ ok: true, data: rows[0] ?? null });
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.ok) {
    return authErrorResponse(auth);
  }

  const service = getServiceRestConfig();
  if (!service) {
    return Response.json({ ok: false, error: "SUPABASE_NOT_CONFIGURED" }, { status: 500 });
  }

  const body = await readJsonBody<ProfilePayload>(request);
  const row = {
    auth_user_id: auth.user.id,
    phone: auth.user.phone ?? null,
    nickname: body.nickname ?? (auth.user.user_metadata?.name as string | undefined) ?? null,
    avatar_url: body.avatar_url ?? (auth.user.user_metadata?.avatar_url as string | undefined) ?? null,
    updated_at: new Date().toISOString()
  };

  const response = await fetch(`${service.baseUrl}/rest/v1/user_profiles?on_conflict=auth_user_id`, {
    method: "POST",
    headers: {
      ...service.headers,
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(row),
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json({ ok: false, error: "PROFILE_UPSERT_FAILED" }, { status: 500 });
  }

  const rows = (await response.json()) as unknown[];
  return Response.json({ ok: true, data: rows[0] ?? null });
}
