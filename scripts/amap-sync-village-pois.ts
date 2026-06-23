import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { searchPoiAround, type AmapPoiItem } from "../lib/data/amap-client";
import type { AmapPoiCategory } from "../lib/types";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type VillageGeoRow = {
  id: string;
  village_code: string;
  name: string;
  full_name?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type PoiCategoryConfig = {
  category: Extract<AmapPoiCategory, "food" | "stay" | "parking">;
  keywords: string[];
  types: string;
  radius: number;
};

type PoiCounts = {
  food: number;
  stay: number;
  parking: number;
  failed: number;
  skippedNoGeo: number;
};

type VillagePoiInsertRow = {
  village_id: string;
  poi_id: string;
  source: "amap";
  category: PoiCategoryConfig["category"];
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_meters: number | null;
  distance_text: string | null;
  type_text: string | null;
  tel: string | null;
  rating: string | null;
  price_text: string | null;
  raw: unknown | null;
  is_recommended: false;
  data_review_status: "needs_review";
  review_notes: string[];
  updated_at: string;
};

const DEFAULT_CITY = "\u90d1\u5dde\u5e02";
const POI_NOTE = "\u9ad8\u5fb7\u5468\u8fb9\u641c\u7d22\u5019\u9009\u7ed3\u679c\uff0c\u9700\u4eba\u5de5\u6838\u9a8c";

const CATEGORY_CONFIGS: PoiCategoryConfig[] = [
  {
    category: "food",
    keywords: ["\u519c\u5bb6\u83dc", "\u9910\u996e", "\u996d\u5e97", "\u571f\u83dc", "\u5bb6\u5e38\u83dc"],
    types: "050000",
    radius: 5000
  },
  {
    category: "stay",
    keywords: ["\u6c11\u5bbf", "\u9152\u5e97", "\u5ba2\u6808", "\u4f4f\u5bbf"],
    types: "100000",
    radius: 8000
  },
  {
    category: "parking",
    keywords: ["\u505c\u8f66\u573a"],
    types: "150900",
    radius: 3000
  }
];

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
  const amapKey = process.env.AMAP_WEB_SERVICE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Please check backend .env.local.");
  }

  if (!amapKey) {
    throw new Error("Missing AMAP_WEB_SERVICE_KEY. Please configure Amap Web Service Key in backend .env.local.");
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

async function requestNoContent(config: SupabaseConfig, path: string, init: RequestInit) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...getHeaders(config),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status} ${detail}`);
  }
}

async function getVerifiedPoiIds(config: SupabaseConfig, villageId: string, category: AmapPoiCategory): Promise<Set<string>> {
  const rows = await getJson<Array<{ poi_id: string }>>(
    config,
    `village_pois?select=poi_id&village_id=eq.${encodeURIComponent(villageId)}&category=eq.${category}&data_review_status=eq.verified`
  );

  return new Set(rows.map((row) => row.poi_id));
}

async function deleteUnreviewedPois(config: SupabaseConfig, villageId: string, category: AmapPoiCategory) {
  await requestNoContent(
    config,
    `village_pois?village_id=eq.${encodeURIComponent(villageId)}&category=eq.${category}&data_review_status=neq.verified`,
    {
      method: "DELETE",
      headers: getHeaders(config, "return=minimal")
    }
  );
}

function normalizeVillagePoiInsertRow(
  villageId: string,
  category: PoiCategoryConfig["category"],
  poi: AmapPoiItem
): VillagePoiInsertRow {
  const distanceMeters = typeof poi.distanceMeters === "number" ? poi.distanceMeters : null;

  return {
    village_id: villageId,
    poi_id: poi.poiId,
    source: "amap",
    category,
    name: poi.name || "\u672a\u547d\u540dPOI",
    address: poi.address ?? null,
    latitude: typeof poi.latitude === "number" ? poi.latitude : null,
    longitude: typeof poi.longitude === "number" ? poi.longitude : null,
    distance_meters: distanceMeters,
    distance_text: distanceMeters !== null ? `${distanceMeters}m` : null,
    type_text: poi.typeText ?? null,
    tel: poi.tel ?? null,
    rating: poi.rating ?? null,
    price_text: poi.priceText ?? null,
    raw: poi.raw ?? null,
    is_recommended: false,
    data_review_status: "needs_review",
    review_notes: [POI_NOTE],
    updated_at: new Date().toISOString()
  };
}

async function insertPois(config: SupabaseConfig, rows: VillagePoiInsertRow[]) {
  if (rows.length === 0) {
    return;
  }

  const expectedKeys = Object.keys(rows[0]).sort();
  rows.forEach((row, index) => {
    const rowKeys = Object.keys(row).sort();
    const keysMatch =
      rowKeys.length === expectedKeys.length &&
      rowKeys.every((key, keyIndex) => key === expectedKeys[keyIndex]);

    if (!keysMatch) {
      throw new Error(`village_pois row ${index} has inconsistent object keys.`);
    }

    const undefinedKeys = Object.keys(row).filter((key) => row[key as keyof VillagePoiInsertRow] === undefined);
    if (undefinedKeys.length > 0) {
      throw new Error(`village_pois row ${index} contains undefined fields: ${undefinedKeys.join(", ")}.`);
    }
  });

  await requestNoContent(config, "village_pois", {
    method: "POST",
    headers: getHeaders(config, "return=minimal"),
    body: JSON.stringify(rows)
  });
}

async function collectPois(village: VillageGeoRow, config: PoiCategoryConfig): Promise<AmapPoiItem[]> {
  const collected = new Map<string, AmapPoiItem>();

  for (const keyword of config.keywords) {
    if (collected.size >= 10) {
      break;
    }

    const result = await searchPoiAround({
      longitude: Number(village.longitude),
      latitude: Number(village.latitude),
      keywords: keyword,
      types: config.types,
      radius: config.radius,
      city: village.city || DEFAULT_CITY,
      category: config.category
    });

    if (!result.ok) {
      console.warn(`POI search failed: ${village.name} / ${config.category} / ${keyword} / ${result.error || "unknown"}`);
      continue;
    }

    for (const poi of result.pois) {
      if (!collected.has(poi.poiId)) {
        collected.set(poi.poiId, poi);
      }
      if (collected.size >= 10) {
        break;
      }
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
  }

  return [...collected.values()].slice(0, 10);
}

function hasGeo(village: VillageGeoRow): boolean {
  return typeof village.latitude === "number" && typeof village.longitude === "number";
}

async function main() {
  const config = getConfig();
  const villages = await getJson<VillageGeoRow[]>(
    config,
    "villages?select=id,village_code,name,full_name,city,latitude,longitude&order=created_at.asc"
  );
  const counts: PoiCounts = {
    food: 0,
    stay: 0,
    parking: 0,
    failed: 0,
    skippedNoGeo: 0
  };

  console.log(`Start Amap POI sync, total villages: ${villages.length}.`);

  for (const village of villages) {
    if (!hasGeo(village)) {
      counts.skippedNoGeo += 1;
      console.warn(`Skip village without geo: ${village.name} (${village.village_code})`);
      continue;
    }

    for (const categoryConfig of CATEGORY_CONFIGS) {
      try {
        const verifiedPoiIds = await getVerifiedPoiIds(config, village.id, categoryConfig.category);
        await deleteUnreviewedPois(config, village.id, categoryConfig.category);

        const pois = await collectPois(village, categoryConfig);
        const rows = pois
          .filter((poi) => !verifiedPoiIds.has(poi.poiId))
          .map((poi) => normalizeVillagePoiInsertRow(village.id, categoryConfig.category, poi));

        await insertPois(config, rows);
        counts[categoryConfig.category] += rows.length;
        console.log(`${village.name} / ${categoryConfig.category}: inserted ${rows.length}, kept verified ${verifiedPoiIds.size}.`);
      } catch (error) {
        counts.failed += 1;
        console.warn(`${village.name} / ${categoryConfig.category} sync failed: ${error instanceof Error ? error.message : error}`);
      }

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }
  }

  console.log("Amap POI sync finished:");
  console.log(`- food: ${counts.food}`);
  console.log(`- stay: ${counts.stay}`);
  console.log(`- parking: ${counts.parking}`);
  console.log(`- skipped no geo: ${counts.skippedNoGeo}`);
  console.log(`- failed tasks: ${counts.failed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
