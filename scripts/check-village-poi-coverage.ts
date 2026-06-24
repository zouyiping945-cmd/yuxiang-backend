import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type VillageRow = {
  id: string;
  village_code: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
};

type PoiRow = {
  village_id: string;
  category: "activity" | "food" | "stay" | "parking" | string;
  data_review_status?: "needs_review" | "verified" | "rejected" | string | null;
  is_recommended?: boolean | null;
};

type CategoryCounts = Record<"activity" | "food" | "stay" | "parking", number>;

const MIN_COVERAGE: CategoryCounts = {
  activity: 4,
  food: 3,
  stay: 2,
  parking: 1
};

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    const rawValue = trimmed.slice(equalIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getConfig(): SupabaseConfig {
  loadEnvFile();

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Please check backend .env.local.");
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey
  };
}

function getHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

async function getJson<T>(config: SupabaseConfig, path: string): Promise<T> {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: "GET",
    headers: getHeaders(config),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GET ${path} failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as T;
}

function hasGeo(village: VillageRow): boolean {
  return typeof village.latitude === "number" && typeof village.longitude === "number";
}

function createEmptyCounts(): CategoryCounts {
  return {
    activity: 0,
    food: 0,
    stay: 0,
    parking: 0
  };
}

function formatCoverage(counts: CategoryCounts): string {
  return [
    `activity ${counts.activity}/${MIN_COVERAGE.activity}`,
    `food ${counts.food}/${MIN_COVERAGE.food}`,
    `stay ${counts.stay}/${MIN_COVERAGE.stay}`,
    `parking ${counts.parking}/${MIN_COVERAGE.parking}`
  ].join(", ");
}

async function main() {
  const config = getConfig();
  const villages = await getJson<VillageRow[]>(
    config,
    "villages?select=id,village_code,name,latitude,longitude&order=created_at.asc"
  );
  const pois = await getJson<PoiRow[]>(
    config,
    "village_pois?select=village_id,category,data_review_status,is_recommended"
  );

  const countsByVillage = new Map<string, CategoryCounts>();
  const verifiedByVillage = new Map<string, number>();
  const recommendedByVillage = new Map<string, number>();
  const totalCounts = createEmptyCounts();
  const reviewStatusCounts = new Map<string, number>();

  villages.forEach((village) => {
    countsByVillage.set(village.id, createEmptyCounts());
    verifiedByVillage.set(village.id, 0);
    recommendedByVillage.set(village.id, 0);
  });

  pois.forEach((poi) => {
    const counts = countsByVillage.get(poi.village_id);
    if (counts && poi.category in counts) {
      const category = poi.category as keyof CategoryCounts;
      counts[category] += 1;
      totalCounts[category] += 1;
    }

    const status = poi.data_review_status || "unknown";
    reviewStatusCounts.set(status, (reviewStatusCounts.get(status) ?? 0) + 1);

    if (poi.data_review_status === "verified") {
      verifiedByVillage.set(poi.village_id, (verifiedByVillage.get(poi.village_id) ?? 0) + 1);
    }

    if (poi.is_recommended === true) {
      recommendedByVillage.set(poi.village_id, (recommendedByVillage.get(poi.village_id) ?? 0) + 1);
    }
  });

  const insufficient = villages.filter((village) => {
    const counts = countsByVillage.get(village.id) ?? createEmptyCounts();
    return (
      counts.activity < MIN_COVERAGE.activity ||
      counts.food < MIN_COVERAGE.food ||
      counts.stay < MIN_COVERAGE.stay ||
      counts.parking < MIN_COVERAGE.parking
    );
  });

  console.log("V1.1 POI coverage check:");
  console.log(`- villages total: ${villages.length}`);
  console.log(`- villages with geo: ${villages.filter(hasGeo).length}`);
  console.log(`- villages missing geo: ${villages.filter((village) => !hasGeo(village)).length}`);
  console.log(`- activity total: ${totalCounts.activity}`);
  console.log(`- food total: ${totalCounts.food}`);
  console.log(`- stay total: ${totalCounts.stay}`);
  console.log(`- parking total: ${totalCounts.parking}`);
  console.log("");

  console.log("Insufficient coverage:");
  if (insufficient.length === 0) {
    console.log("- none");
  } else {
    insufficient.forEach((village) => {
      const counts = countsByVillage.get(village.id) ?? createEmptyCounts();
      console.log(`- ${village.name}: ${formatCoverage(counts)}`);
    });
  }
  console.log("");

  console.log("Review status:");
  ["needs_review", "verified", "rejected", "unknown"].forEach((status) => {
    console.log(`- ${status}: ${reviewStatusCounts.get(status) ?? 0}`);
  });
  const recommendedTotal = pois.filter((poi) => poi.is_recommended === true).length;
  console.log(`- recommended: ${recommendedTotal}`);
  console.log("");

  console.log("Per village verified / recommended:");
  villages.forEach((village) => {
    console.log(
      `- ${village.name}: verified ${verifiedByVillage.get(village.id) ?? 0}, recommended ${recommendedByVillage.get(village.id) ?? 0}`
    );
  });
  console.log("");

  if (insufficient.length === 0) {
    console.log("PASS: all villages reached minimum POI candidate coverage.");
  } else {
    console.log("WARN: some villages are below minimum coverage; consider manual supplement or larger search radius.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
