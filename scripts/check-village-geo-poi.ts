import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type VillageCheckRow = {
  id: string;
  name: string;
  village_code: string;
  latitude?: number | null;
  longitude?: number | null;
  adcode?: string | null;
  geo_review_status?: string | null;
};

type PoiCheckRow = {
  village_id: string;
  category: string;
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

function getHeaders(config: SupabaseConfig, prefer?: string): HeadersInit {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {})
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

function hasGeo(village: VillageCheckRow): boolean {
  return typeof village.latitude === "number" && typeof village.longitude === "number";
}

function countBy<T extends string>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

function getPoiCountsForVillage(pois: PoiCheckRow[], villageId: string) {
  const rows = pois.filter((poi) => poi.village_id === villageId);
  return {
    food: rows.filter((poi) => poi.category === "food").length,
    stay: rows.filter((poi) => poi.category === "stay").length,
    parking: rows.filter((poi) => poi.category === "parking").length
  };
}

async function main() {
  const config = getConfig();
  const villages = await getJson<VillageCheckRow[]>(
    config,
    "villages?select=id,village_code,name,latitude,longitude,adcode,geo_review_status&order=created_at.asc"
  );
  const pois = await getJson<PoiCheckRow[]>(
    config,
    "village_pois?select=village_id,category"
  );

  const villagesWithGeo = villages.filter(hasGeo);
  const missingGeo = villages.length - villagesWithGeo.length;
  const geoMissingRate = villages.length > 0 ? missingGeo / villages.length : 0;
  const statusDistribution = countBy(villages.map((village) => village.geo_review_status || "empty"));
  const poiDistribution = countBy(pois.map((poi) => poi.category || "empty"));

  console.log("V1.3 village geo and POI check:");
  console.log(`- villages total: ${villages.length}`);
  console.log(`- villages with geo: ${villagesWithGeo.length}`);
  console.log(`- villages missing geo: ${missingGeo}`);
  console.log("- geo_review_status distribution:", statusDistribution);
  console.log(`- village_pois total: ${pois.length}`);
  console.log("- POI category distribution:", poiDistribution);

  if (geoMissingRate > 0.2) {
    console.warn(`Warning: geo missing rate ${(geoMissingRate * 100).toFixed(1)}%, greater than 20%.`);
  }

  console.log("First 5 villages overview:");
  for (const village of villages.slice(0, 5)) {
    const counts = getPoiCountsForVillage(pois, village.id);
    console.log(`- ${village.name} (${village.village_code})`);
    console.log(`  geo: ${village.longitude ?? "-"},${village.latitude ?? "-"}; adcode: ${village.adcode ?? "-"}`);
    console.log(`  food: ${counts.food}, stay: ${counts.stay}, parking: ${counts.parking}`);
  }

  for (const village of villages) {
    const counts = getPoiCountsForVillage(pois, village.id);
    if (counts.food === 0 && counts.stay === 0) {
      console.warn(`Warning: ${village.name} has 0 food and 0 stay POI candidates.`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
