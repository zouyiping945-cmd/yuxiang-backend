import { getSupabaseServerConfig } from "@/lib/supabase/server";
import type { VillagePoiCoverage } from "@/lib/types";

type SupabasePoiCoverageRow = {
  village_id?: string;
  category?: string | null;
};

type CoverageCounts = {
  activityCount: number;
  foodCount: number;
  stayCount: number;
  parkingCount: number;
};

function createEmptyCounts(): CoverageCounts {
  return {
    activityCount: 0,
    foodCount: 0,
    stayCount: 0,
    parkingCount: 0
  };
}

function getCoverageLevel(counts: CoverageCounts): VillagePoiCoverage["coverageLevel"] {
  if (
    counts.activityCount >= 4 &&
    counts.foodCount >= 3 &&
    counts.stayCount >= 2 &&
    counts.parkingCount >= 1
  ) {
    return "strong";
  }

  if (
    counts.activityCount >= 1 &&
    counts.foodCount >= 3 &&
    counts.stayCount >= 2
  ) {
    return "usable";
  }

  return "excluded";
}

export async function getVillagePoiCoverage(): Promise<VillagePoiCoverage[]> {
  const config = getSupabaseServerConfig();
  if (!config) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }

  const endpoint =
    `${config.url.replace(/\/$/, "")}/rest/v1/village_pois` +
    "?select=village_id,category";

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
    const detail = await response.text();
    throw new Error(`SUPABASE_POI_COVERAGE_QUERY_FAILED_${response.status}_${detail}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("SUPABASE_POI_COVERAGE_PAYLOAD_INVALID");
  }

  const countsByVillage = new Map<string, CoverageCounts>();

  payload.forEach((row) => {
    if (!row || typeof row !== "object") {
      return;
    }

    const item = row as SupabasePoiCoverageRow;
    if (!item.village_id) {
      return;
    }

    const counts = countsByVillage.get(item.village_id) ?? createEmptyCounts();

    if (item.category === "activity") {
      counts.activityCount += 1;
    } else if (item.category === "food") {
      counts.foodCount += 1;
    } else if (item.category === "stay") {
      counts.stayCount += 1;
    } else if (item.category === "parking") {
      counts.parkingCount += 1;
    }

    countsByVillage.set(item.village_id, counts);
  });

  return Array.from(countsByVillage.entries()).map(([villageId, counts]) => ({
    villageId,
    ...counts,
    coverageLevel: getCoverageLevel(counts)
  }));
}
