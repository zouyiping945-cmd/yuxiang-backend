import {
  authErrorResponse,
  getAuthenticatedUser,
  getServiceRestConfig,
  readJsonBody
} from "@/lib/auth/session";

type TripPayload = {
  planId?: string;
  title?: string;
  tripDate?: string;
  status?: string;
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
    `${service.baseUrl}/rest/v1/user_trips?select=*` +
    `&auth_user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: service.headers,
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json({ ok: false, error: "TRIPS_QUERY_FAILED" }, { status: 500 });
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

  const body = await readJsonBody<TripPayload>(request);
  const row = {
    auth_user_id: auth.user.id,
    plan_id: body.planId || null,
    title: body.title || "AI 乡旅行程",
    trip_date: body.tripDate || null,
    status: body.status || "planned",
    payload: body.payload ?? null,
    updated_at: new Date().toISOString()
  };

  const response = await fetch(`${service.baseUrl}/rest/v1/user_trips`, {
    method: "POST",
    headers: {
      ...service.headers,
      Prefer: "return=representation"
    },
    body: JSON.stringify(row),
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json({ ok: false, error: "TRIP_SAVE_FAILED" }, { status: 500 });
  }

  const rows = (await response.json()) as unknown[];
  return Response.json({ ok: true, data: rows[0] ?? null });
}
