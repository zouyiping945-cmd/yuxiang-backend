import {
  authErrorResponse,
  getAuthenticatedUser,
  getServiceRestConfig,
  readJsonBody
} from "@/lib/auth/session";

type SavePlanPayload = {
  title?: string;
  inputText?: string;
  planPayload?: {
    recommended?: {
      id?: string;
      name?: string;
    };
    [key: string]: unknown;
  };
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
    `${service.baseUrl}/rest/v1/user_plans?select=*` +
    `&auth_user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: service.headers,
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json({ ok: false, error: "PLANS_QUERY_FAILED" }, { status: 500 });
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

  const body = await readJsonBody<SavePlanPayload>(request);
  if (!body.planPayload) {
    return Response.json({ ok: false, error: "MISSING_PLAN_PAYLOAD" }, { status: 400 });
  }

  const villageName = body.planPayload.recommended?.name ?? "AI 乡旅方案";
  const row = {
    auth_user_id: auth.user.id,
    title: body.title || `${villageName} AI 方案`,
    input_text: body.inputText || null,
    recommended_village_id: body.planPayload.recommended?.id || null,
    recommended_village_name: body.planPayload.recommended?.name || null,
    plan_payload: body.planPayload,
    updated_at: new Date().toISOString()
  };

  const response = await fetch(`${service.baseUrl}/rest/v1/user_plans`, {
    method: "POST",
    headers: {
      ...service.headers,
      Prefer: "return=representation"
    },
    body: JSON.stringify(row),
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json({ ok: false, error: "PLAN_SAVE_FAILED" }, { status: 500 });
  }

  const rows = (await response.json()) as unknown[];
  return Response.json({ ok: true, data: rows[0] ?? null });
}
