import "server-only";

type SupabaseServerConfig = {
  url: string;
  serviceRoleKey: string;
};

export function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url,
    serviceRoleKey
  };
}

export async function queryPublishedVillageRows(): Promise<Record<string, unknown>[]> {
  const config = getSupabaseServerConfig();
  if (!config) {
    return [];
  }

  const endpoint =
    `${config.url.replace(/\/$/, "")}/rest/v1/villages` +
    "?select=id,name,city,tags,drive_time_minutes,suitable_for_elders,easy_walk,has_farm_food,has_stay,cover_image,description,rating,distance_text,published" +
    "&published=eq.true";

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`SUPABASE_VILLAGE_QUERY_FAILED_${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("SUPABASE_VILLAGE_PAYLOAD_INVALID");
  }

  return payload.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object"
  );
}
