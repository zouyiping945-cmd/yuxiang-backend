import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type PoiCategory = "activity" | "food" | "stay" | "parking";

type VillageRow = {
  id: string;
  village_code: string;
  name: string;
};

type VillagePoiRow = {
  id?: string;
  village_id: string;
  poi_id: string;
  category: PoiCategory | string;
  name: string;
  address?: string | null;
  distance_meters?: number | null;
  type_text?: string | null;
  tel?: string | null;
  rating?: string | null;
  price_text?: string | null;
  data_review_status?: "needs_review" | "verified" | "rejected" | string | null;
  is_recommended?: boolean | null;
  review_notes?: string[] | string | null;
};

type CategoryLimit = {
  min: number;
  max: number;
};

type RankedPoi = {
  poi: VillagePoiRow;
  score: number;
  excludedByKeyword: boolean;
};

type VillageSummary = {
  villageName: string;
  villageCode: string;
  recommended: Record<PoiCategory, number>;
  warnings: string[];
};

const CATEGORY_LIMITS: Record<PoiCategory, CategoryLimit> = {
  activity: { min: 4, max: 6 },
  food: { min: 3, max: 5 },
  stay: { min: 2, max: 4 },
  parking: { min: 1, max: 2 }
};

const CATEGORY_ORDER: PoiCategory[] = ["activity", "food", "stay", "parking"];
const AUTO_RANK_NOTE = "auto_ranked";

const EXCLUDE_KEYWORDS = [
  "厕所",
  "银行",
  "政府",
  "加油站",
  "学校",
  "医院",
  "派出所",
  "公司",
  "小区",
  "住宅",
  "充电站",
  "维修",
  "快递"
];

const CATEGORY_KEYWORDS: Record<PoiCategory, string[]> = {
  activity: [
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
    "田园",
    "大食堂",
    "乐园",
    "营地"
  ],
  food: [
    "农家",
    "饭店",
    "餐厅",
    "大食堂",
    "烩面",
    "土鸡",
    "烧烤",
    "家常菜"
  ],
  stay: [
    "民宿",
    "酒店",
    "客栈",
    "山居",
    "度假",
    "农家院"
  ],
  parking: [
    "停车场",
    "停车点"
  ]
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

async function patchNoContent(config: SupabaseConfig, path: string, body: Record<string, unknown>) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: getHeaders(config, "return=minimal"),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PATCH ${path} failed: ${response.status} ${detail}`);
  }
}

function isPoiCategory(value: string): value is PoiCategory {
  return value === "activity" || value === "food" || value === "stay" || value === "parking";
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeNotes(value: VillagePoiRow["review_notes"]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function withAutoRankNote(value: VillagePoiRow["review_notes"]): string[] {
  const notes = normalizeNotes(value);
  return notes.includes(AUTO_RANK_NOTE) ? notes : [...notes, AUTO_RANK_NOTE];
}

function distanceScore(distanceMeters: number | null | undefined): number {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    return 0;
  }

  if (distanceMeters <= 500) {
    return 24;
  }

  if (distanceMeters <= 1000) {
    return 20;
  }

  if (distanceMeters <= 3000) {
    return 14;
  }

  if (distanceMeters <= 5000) {
    return 8;
  }

  if (distanceMeters <= 10000) {
    return 4;
  }

  return -12;
}

function matchedKeywordCount(text: string, keywords: string[]): number {
  return keywords.filter((keyword) => text.includes(keyword)).length;
}

function scorePoi(poi: VillagePoiRow, village: VillageRow): RankedPoi {
  const category = isPoiCategory(poi.category) ? poi.category : null;
  const text = `${poi.name ?? ""} ${poi.address ?? ""} ${poi.type_text ?? ""}`;
  const excludedByKeyword = includesAny(text, EXCLUDE_KEYWORDS);

  if (!category || excludedByKeyword) {
    return {
      poi,
      score: -999,
      excludedByKeyword: true
    };
  }

  let score = 0;

  score += distanceScore(poi.distance_meters);

  if (poi.tel) {
    score += 6;
  }

  if (poi.rating) {
    score += 8;
  }

  if (poi.price_text) {
    score += 4;
  }

  const keywordMatches = matchedKeywordCount(text, CATEGORY_KEYWORDS[category]);
  score += keywordMatches * 8;

  if (keywordMatches > 0) {
    score += 8;
  }

  if (poi.type_text && includesAny(poi.type_text, CATEGORY_KEYWORDS[category])) {
    score += 10;
  }

  if (poi.name?.includes(village.name) || poi.address?.includes(village.name)) {
    score += 6;
  }

  if (includesAny(text, ["附近", "周边", "村", "乡", "镇"])) {
    score += 3;
  }

  if (poi.data_review_status === "verified") {
    score += 30;
  }

  if (poi.is_recommended === true) {
    score += 12;
  }

  return {
    poi,
    score,
    excludedByKeyword: false
  };
}

function groupByVillageAndCategory(pois: VillagePoiRow[]) {
  const grouped = new Map<string, Map<PoiCategory, VillagePoiRow[]>>();

  pois.forEach((poi) => {
    if (!isPoiCategory(poi.category) || poi.data_review_status === "rejected") {
      return;
    }

    const villageGroup = grouped.get(poi.village_id) ?? new Map<PoiCategory, VillagePoiRow[]>();
    const categoryRows = villageGroup.get(poi.category) ?? [];
    categoryRows.push(poi);
    villageGroup.set(poi.category, categoryRows);
    grouped.set(poi.village_id, villageGroup);
  });

  return grouped;
}

function selectRecommendedPois(village: VillageRow, category: PoiCategory, pois: VillagePoiRow[]): VillagePoiRow[] {
  const limit = CATEGORY_LIMITS[category];
  const ranked = pois
    .map((poi) => scorePoi(poi, village))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const distanceA = typeof a.poi.distance_meters === "number" ? a.poi.distance_meters : Number.POSITIVE_INFINITY;
      const distanceB = typeof b.poi.distance_meters === "number" ? b.poi.distance_meters : Number.POSITIVE_INFINITY;
      return distanceA - distanceB;
    });

  const selected = new Map<string, VillagePoiRow>();

  ranked
    .filter((item) => item.poi.data_review_status === "verified" && item.poi.is_recommended === true)
    .forEach((item) => {
      selected.set(getPoiKey(item.poi), item.poi);
    });

  ranked
    .filter((item) => !item.excludedByKeyword)
    .forEach((item) => {
      if (selected.size >= limit.max) {
        return;
      }

      selected.set(getPoiKey(item.poi), item.poi);
    });

  return Array.from(selected.values());
}

function getPoiKey(poi: VillagePoiRow): string {
  return poi.id || `${poi.village_id}_${poi.poi_id}`;
}

function buildPatchPath(poi: VillagePoiRow): string {
  if (poi.id) {
    return `village_pois?id=eq.${encodeURIComponent(poi.id)}`;
  }

  return `village_pois?village_id=eq.${encodeURIComponent(poi.village_id)}&poi_id=eq.${encodeURIComponent(poi.poi_id)}`;
}

function shouldSkipUpdate(poi: VillagePoiRow, shouldRecommend: boolean): boolean {
  if (poi.data_review_status === "rejected") {
    return true;
  }

  if (poi.data_review_status === "verified" && poi.is_recommended === true) {
    return shouldRecommend && normalizeNotes(poi.review_notes).includes(AUTO_RANK_NOTE);
  }

  if (poi.data_review_status === "verified" && !shouldRecommend) {
    return true;
  }

  if (shouldRecommend) {
    return poi.is_recommended === true && normalizeNotes(poi.review_notes).includes(AUTO_RANK_NOTE);
  }

  return poi.is_recommended === false;
}

async function updatePoiRecommendation(config: SupabaseConfig, poi: VillagePoiRow, shouldRecommend: boolean) {
  if (shouldSkipUpdate(poi, shouldRecommend)) {
    return;
  }

  const body: Record<string, unknown> = shouldRecommend
    ? {
        is_recommended: true,
        review_notes: withAutoRankNote(poi.review_notes)
      }
    : {
        is_recommended: false
      };

  await patchNoContent(config, buildPatchPath(poi), body);
}

async function main() {
  const config = getConfig();
  const villages = await getJson<VillageRow[]>(
    config,
    "villages?select=id,village_code,name&order=created_at.asc"
  );
  const pois = await getJson<VillagePoiRow[]>(
    config,
    [
      "village_pois?select=",
      [
        "id",
        "village_id",
        "poi_id",
        "category",
        "name",
        "address",
        "distance_meters",
        "type_text",
        "tel",
        "rating",
        "price_text",
        "data_review_status",
        "is_recommended",
        "review_notes"
      ].join(",")
    ].join("")
  );

  const villageMap = new Map(villages.map((village) => [village.id, village]));
  const grouped = groupByVillageAndCategory(pois);
  const recommendedTotals: Record<PoiCategory, number> = {
    activity: 0,
    food: 0,
    stay: 0,
    parking: 0
  };
  const summaries: VillageSummary[] = [];

  console.log("Start POI auto ranking...");
  console.log(`- villages total: ${villages.length}`);
  console.log(`- total POIs scanned: ${pois.length}`);

  for (const village of villages) {
    const villageGroup = grouped.get(village.id) ?? new Map<PoiCategory, VillagePoiRow[]>();
    const summary: VillageSummary = {
      villageName: village.name,
      villageCode: village.village_code,
      recommended: {
        activity: 0,
        food: 0,
        stay: 0,
        parking: 0
      },
      warnings: []
    };

    for (const category of CATEGORY_ORDER) {
      const rows = villageGroup.get(category) ?? [];
      const selected = selectRecommendedPois(village, category, rows);
      const selectedKeys = new Set(selected.map(getPoiKey));

      for (const poi of rows) {
        const shouldRecommend = selectedKeys.has(getPoiKey(poi));
        await updatePoiRecommendation(config, poi, shouldRecommend);
      }

      summary.recommended[category] = selected.length;
      recommendedTotals[category] += selected.length;

      if (selected.length < CATEGORY_LIMITS[category].min) {
        summary.warnings.push(`${category} ${selected.length}/${CATEGORY_LIMITS[category].min}`);
      }
    }

    summaries.push(summary);
    console.log(
      `${village.name}: activity ${summary.recommended.activity}, food ${summary.recommended.food}, stay ${summary.recommended.stay}, parking ${summary.recommended.parking}`
    );

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
  }

  console.log("");
  console.log("POI auto ranking finished:");
  console.log(`- recommended activity count: ${recommendedTotals.activity}`);
  console.log(`- recommended food count: ${recommendedTotals.food}`);
  console.log(`- recommended stay count: ${recommendedTotals.stay}`);
  console.log(`- recommended parking count: ${recommendedTotals.parking}`);
  console.log("");
  console.log("Warnings for villages still below target:");

  const warnings = summaries.filter((summary) => summary.warnings.length > 0);
  if (warnings.length === 0) {
    console.log("- none");
  } else {
    warnings.forEach((summary) => {
      console.log(`- ${summary.villageName} (${summary.villageCode}): ${summary.warnings.join(", ")}`);
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
