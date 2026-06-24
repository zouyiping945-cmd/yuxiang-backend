import {
  authErrorResponse,
  getAuthenticatedUser,
  getServiceRestConfig,
  readJsonBody
} from "@/lib/auth/session";

type FavoritePayload = {
  id?: string;
  favoriteType?: "village" | "plan" | "poi";
  targetId?: string;
  targetName?: string;
  payload?: unknown;
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
    `${service.baseUrl}/rest/v1/user_favorites?select=*` +
    `&auth_user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: service.headers,
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json({ ok: false, error: "FAVORITES_QUERY_FAILED" }, { status: 500 });
  }

  return Response.json({ ok: true, data: await response.json() });
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

  const body = await readJsonBody<FavoritePayload>(request);
  const row = {
    auth_user_id: auth.user.id,
    favorite_type: body.favoriteType || "plan",
    target_id: body.targetId || null,
    target_name: body.targetName || null,
    payload: body.payload ?? null
  };

  const response = await fetch(`${service.baseUrl}/rest/v1/user_favorites`, {
    method: "POST",
    headers: {
      ...service.headers,
      Prefer: "return=representation"
    },
    body: JSON.stringify(row),
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json({ ok: false, error: "FAVORITE_SAVE_FAILED" }, { status: 500 });
  }

  const rows = (await response.json()) as unknown[];
  return Response.json({ ok: true, data: rows[0] ?? null });
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.ok) {
    return authErrorResponse(auth);
  }

  const service = getServiceRestConfig();
  if (!service) {
    return Response.json({ ok: false, error: "SUPABASE_NOT_CONFIGURED" }, { status: 500 });
  }

  const url = new URL(request.url);
  const body = await readJsonBody<FavoritePayload>(request);
  const id = url.searchParams.get("id") || body.id;
  if (!id) {
    return Response.json({ ok: false, error: "MISSING_FAVORITE_ID" }, { status: 400 });
  }

  const endpoint =
    `${service.baseUrl}/rest/v1/user_favorites?id=eq.${encodeURIComponent(id)}` +
    `&auth_user_id=eq.${encodeURIComponent(auth.user.id)}`;

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: service.headers,
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json({ ok: false, error: "FAVORITE_DELETE_FAILED" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
