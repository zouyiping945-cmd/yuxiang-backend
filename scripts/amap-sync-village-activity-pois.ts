import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { searchPoiAround, type AmapPoiItem } from "../lib/data/amap-client";

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

type VillagePoiInsertRow = {
  village_id: string;
  poi_id: string;
  source: "amap";
  category: "activity";
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

type SyncCounts = {
  activity: number;
  failed: number;
  skippedNoGeo: number;
};

const DEFAULT_CITY = "郑州市";
const SEARCH_RADIUS_METERS = 10000;
const MAX_POIS_PER_VILLAGE = 12;
const POI_NOTE = "高德周边搜索 activity 候选结果，需人工核验";
const ACTIVITY_KEYWORDS = [
  "景区",
  "公园",
  "采摘",
  "农家乐",
  "亲子",
  "文化",
  "老街",
  "垂钓",
  "艺术",
  "研学",
  "休闲",
  "田园"
];

const EXCLUDE_PATTERNS = [
  "停车场",
  "停车位",
  "公共厕所",
  "厕所",
  "卫生间",
  "银行",
  "政府",
  "委员会",
  "派出所",
  "公安",
  "法院",
  "检察院",
  "税务",
  "加油站",
  "收费站",
  "充电站",
  "服务区",
  "小区",
  "学校",
  "幼儿园",
  "医院",
  "诊所",
  "药店",
  "公司",
  "办事处",
  "营业厅"
];

const KEEP_PATTERNS = [
  "景区",
  "公园",
  "农家乐",
  "采摘",
  "果园",
  "垂钓",
  "钓鱼",
  "文化",
  "老街",
  "艺术",
  "亲子",
  "研学",
  "休闲",
  "田园",
  "乐园",
  "度假",
  "旅游",
  "观光",
  "大食堂",
  "美食",
  "民宿"
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

async function getVerifiedPoiIds(config: SupabaseConfig, villageId: string): Promise<Set<string>> {
  const rows = await getJson<Array<{ poi_id: string }>>(
    config,
    `village_pois?select=poi_id&village_id=eq.${encodeURIComponent(villageId)}&category=eq.activity&data_review_status=eq.verified`
  );

  return new Set(rows.map((row) => row.poi_id));
}

async function deleteUnreviewedActivityPois(config: SupabaseConfig, villageId: string) {
  await requestNoContent(
    config,
    `village_pois?village_id=eq.${encodeURIComponent(villageId)}&category=eq.activity&data_review_status=neq.verified`,
    {
      method: "DELETE",
      headers: getHeaders(config, "return=minimal")
    }
  );
}

function hasGeo(village: VillageGeoRow): boolean {
  return typeof village.latitude === "number" && typeof village.longitude === "number";
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function isRelevantActivityPoi(poi: AmapPoiItem): boolean {
  const name = poi.name?.trim();
  if (!name) {
    return false;
  }

  const distanceMeters = typeof poi.distanceMeters === "number" ? poi.distanceMeters : null;
  if (distanceMeters !== null && distanceMeters > SEARCH_RADIUS_METERS) {
    return false;
  }

  const text = `${name} ${poi.address ?? ""} ${poi.typeText ?? ""}`;
  if (includesAny(text, EXCLUDE_PATTERNS)) {
    return false;
  }

  return includesAny(text, KEEP_PATTERNS);
}

function dedupeKey(poi: AmapPoiItem): string {
  return poi.poiId || `${poi.name}_${poi.address ?? ""}`;
}

function normalizeVillagePoiInsertRow(villageId: string, poi: AmapPoiItem): VillagePoiInsertRow {
  const distanceMeters = typeof poi.distanceMeters === "number" ? poi.distanceMeters : null;

  return {
    village_id: villageId,
    poi_id: poi.poiId,
    source: "amap",
    category: "activity",
    name: poi.name || "未命名POI",
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

function assertConsistentRows(rows: VillagePoiInsertRow[]) {
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
}

async function insertPois(config: SupabaseConfig, rows: VillagePoiInsertRow[]) {
  if (rows.length === 0) {
    return;
  }

  assertConsistentRows(rows);

  await requestNoContent(config, "village_pois", {
    method: "POST",
    headers: getHeaders(config, "return=minimal"),
    body: JSON.stringify(rows)
  });
}

async function collectActivityPois(village: VillageGeoRow): Promise<AmapPoiItem[]> {
  const collected = new Map<string, AmapPoiItem>();

  for (const keyword of ACTIVITY_KEYWORDS) {
    if (collected.size >= MAX_POIS_PER_VILLAGE) {
      break;
    }

    const searchKeyword = `${village.name} ${keyword}`;
    const result = await searchPoiAround({
      longitude: Number(village.longitude),
      latitude: Number(village.latitude),
      keywords: searchKeyword,
      radius: SEARCH_RADIUS_METERS,
      city: village.city || DEFAULT_CITY,
      category: "activity"
    });

    if (!result.ok) {
      console.warn(`Activity POI search failed: ${village.name} / ${searchKeyword} / ${result.error || "unknown"}`);
      continue;
    }

    for (const poi of result.pois.slice(0, 5)) {
      if (!isRelevantActivityPoi(poi)) {
        continue;
      }

      const key = dedupeKey(poi);
      if (!collected.has(key)) {
        collected.set(key, poi);
      }

      if (collected.size >= MAX_POIS_PER_VILLAGE) {
        break;
      }
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
  }

  return [...collected.values()].slice(0, MAX_POIS_PER_VILLAGE);
}

async function main() {
  const config = getConfig();
  const villages = await getJson<VillageGeoRow[]>(
    config,
    "villages?select=id,village_code,name,full_name,city,latitude,longitude&order=created_at.asc"
  );
  const counts: SyncCounts = {
    activity: 0,
    failed: 0,
    skippedNoGeo: 0
  };

  console.log(`Start Amap activity POI sync, total villages: ${villages.length}.`);

  for (const village of villages) {
    if (!hasGeo(village)) {
      counts.skippedNoGeo += 1;
      console.warn(`Skip village without geo: ${village.name} (${village.village_code})`);
      continue;
    }

    try {
      const verifiedPoiIds = await getVerifiedPoiIds(config, village.id);
      await deleteUnreviewedActivityPois(config, village.id);

      const pois = await collectActivityPois(village);
      const rows = pois
        .filter((poi) => !verifiedPoiIds.has(poi.poiId))
        .map((poi) => normalizeVillagePoiInsertRow(village.id, poi));

      await insertPois(config, rows);
      counts.activity += rows.length;
      console.log(`${village.name} / activity: inserted ${rows.length}, kept verified ${verifiedPoiIds.size}.`);
    } catch (error) {
      counts.failed += 1;
      console.warn(`${village.name} / activity sync failed: ${error instanceof Error ? error.message : error}`);
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  console.log("Amap activity POI sync finished:");
  console.log(`- activity: ${counts.activity}`);
  console.log(`- skipped no geo: ${counts.skippedNoGeo}`);
  console.log(`- failed tasks: ${counts.failed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
