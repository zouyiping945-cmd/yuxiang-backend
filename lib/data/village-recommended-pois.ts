import { getSupabaseServerConfig } from "@/lib/supabase/server";
import type { AmapPoiCategory, RecommendedPoi, RecommendedPoisByCategory } from "@/lib/types";

type SupabaseRecommendedPoiRow = {
  village_id?: string;
  category?: string | null;
  name?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  distance_text?: string | null;
  distance_meters?: number | string | null;
  type_text?: string | null;
  tel?: string | null;
  rating?: string | null;
  price_text?: string | null;
  source?: string | null;
  data_review_status?: string | null;
  is_recommended?: boolean | null;
  poi_id?: string | null;
};

type SupabaseVillageLookupRow = {
  id?: string;
  village_code?: string | null;
  name?: string | null;
  full_name?: string | null;
};

type ResolvedVillagePoiLookup = {
  initialKeys: string[];
  lookupKeys: string[];
  queryVillageIds: string[];
  resolvedVillageId?: string;
  matchedKey?: string;
};

export type RecommendedPoiLookupInput = {
  villageId?: string | null;
  villageCode?: string | null;
  villageName?: string | null;
  fullName?: string | null;
  lookupKeys?: Array<string | null | undefined>;
};

const POI_CATEGORIES: AmapPoiCategory[] = ["activity", "food", "stay", "parking"];
const YINGTAOGOU_UUID = "15aa5739-bc81-4432-8193-d2a51e02459d";
const YINGTAOGOU_CODE = "zhengzhou_yingtaogou";
const YINGTAOGOU_NAME = "樱桃沟社区";
const YINGTAOGOU_ALIASES = [
  "樱桃沟",
  "樱桃沟社区",
  "郑州樱桃沟",
  "郑州市樱桃沟",
  "樱桃沟农家乐",
  YINGTAOGOU_CODE,
  YINGTAOGOU_UUID
];
const CATEGORY_LIMITS: Record<AmapPoiCategory, number> = {
  activity: 6,
  food: 5,
  stay: 4,
  parking: 2
};

function createEmptyRecommendedPois(): RecommendedPoisByCategory {
  return {
    activity: [],
    food: [],
    stay: [],
    parking: []
  };
}

function withLookupMeta(
  pois: RecommendedPoisByCategory,
  meta: {
    lookupKeys?: string[];
    queryVillageIds?: string[];
    resolvedVillageId?: string;
    matchedKey?: string;
    totalFound?: number;
    recommendedFound?: number;
    usedRecommended?: boolean;
    usedCandidateFallback?: boolean;
    error?: string;
  }
): RecommendedPoisByCategory {
  return {
    ...pois,
    lookupKeys: meta.lookupKeys,
    queryVillageIds: meta.queryVillageIds,
    resolvedVillageId: meta.resolvedVillageId,
    matchedKey: meta.matchedKey,
    lookupDebug: {
      totalFound: meta.totalFound ?? 0,
      recommendedFound: meta.recommendedFound ?? 0,
      usedRecommended: meta.usedRecommended ?? false,
      usedCandidateFallback: meta.usedCandidateFallback ?? false,
      error: meta.error
    }
  };
}

function isPoiCategory(value: string | null | undefined): value is AmapPoiCategory {
  return POI_CATEGORIES.includes(value as AmapPoiCategory);
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    )
  );
}

function normalizeLookupText(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\s+/g, "");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function includesYingtaogouAlias(keys: string[]): boolean {
  const text = keys.map(normalizeLookupText).join(" ");
  return YINGTAOGOU_ALIASES.some((alias) => text.includes(normalizeLookupText(alias)));
}

function getInitialLookupKeys(input: RecommendedPoiLookupInput): string[] {
  const keys = uniqueStrings([
    input.villageId,
    input.villageCode,
    input.villageName,
    input.fullName,
    ...(input.lookupKeys ?? [])
  ]);

  if (!includesYingtaogouAlias(keys)) {
    return keys;
  }

  return uniqueStrings([
    YINGTAOGOU_UUID,
    YINGTAOGOU_CODE,
    YINGTAOGOU_NAME,
    "樱桃沟",
    ...keys
  ]);
}

function getLookupNames(input: RecommendedPoiLookupInput): string[] {
  return uniqueStrings([input.villageName, input.fullName]);
}

function toRecommendedPoi(row: SupabaseRecommendedPoiRow): RecommendedPoi | null {
  const villageId = toNullableString(row.village_id);
  const name = toNullableString(row.name);
  const status = row.data_review_status;

  if (!villageId || !name || !isPoiCategory(row.category)) {
    return null;
  }

  if (status !== "verified" && status !== "needs_review") {
    return null;
  }

  return {
    villageId,
    category: row.category,
    name,
    address: toNullableString(row.address),
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    distanceText: toNullableString(row.distance_text),
    distanceMeters: toNullableNumber(row.distance_meters),
    typeText: toNullableString(row.type_text),
    tel: toNullableString(row.tel),
    rating: toNullableString(row.rating),
    priceText: toNullableString(row.price_text),
    source: toNullableString(row.source),
    dataReviewStatus: status,
    isRecommended: row.is_recommended === true,
    poiId: toNullableString(row.poi_id)
  };
}

function getCompletenessScore(poi: RecommendedPoi): number {
  return [
    poi.rating,
    poi.tel,
    poi.priceText
  ].filter(Boolean).length;
}

function sortRecommendedPois(a: RecommendedPoi, b: RecommendedPoi): number {
  if (a.isRecommended !== b.isRecommended) {
    return a.isRecommended ? -1 : 1;
  }

  if (a.dataReviewStatus !== b.dataReviewStatus) {
    return a.dataReviewStatus === "verified" ? -1 : 1;
  }

  const aDistance = typeof a.distanceMeters === "number" ? a.distanceMeters : Number.POSITIVE_INFINITY;
  const bDistance = typeof b.distanceMeters === "number" ? b.distanceMeters : Number.POSITIVE_INFINITY;
  if (aDistance !== bDistance) {
    return aDistance - bDistance;
  }

  const completenessDiff = getCompletenessScore(b) - getCompletenessScore(a);
  if (completenessDiff !== 0) {
    return completenessDiff;
  }

  return a.name.localeCompare(b.name, "zh-Hans-CN");
}

function getHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

function escapePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function fetchVillageLookupRows(
  config: { url: string; serviceRoleKey: string },
  lookupKeys: string[],
  lookupNames: string[]
): Promise<SupabaseVillageLookupRow[]> {
  const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/villages?select=id,village_code,name,full_name`, {
    method: "GET",
    headers: getHeaders(config.serviceRoleKey),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    console.warn(`[recommended-pois] village lookup failed: ${response.status} ${detail}`);
    return [];
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return [];
  }

  const keySet = new Set(lookupKeys);
  const nameSet = new Set(lookupNames);
  const normalizedKeys = lookupKeys.map(normalizeLookupText);

  return payload
    .filter((row): row is SupabaseVillageLookupRow => Boolean(row) && typeof row === "object")
    .filter((row) => {
      const id = toNullableString(row.id);
      const code = toNullableString(row.village_code);
      const name = toNullableString(row.name);
      const fullName = toNullableString(row.full_name);
      const normalizedName = normalizeLookupText(name);
      const normalizedFullName = normalizeLookupText(fullName);

      return Boolean(
        (id && keySet.has(id)) ||
          (code && keySet.has(code)) ||
          (name && (keySet.has(name) || nameSet.has(name))) ||
          (fullName && (keySet.has(fullName) || nameSet.has(fullName))) ||
          (name && normalizedKeys.some((key) => key.includes(normalizedName) || normalizedName.includes(key))) ||
          (fullName && normalizedKeys.some((key) => key.includes(normalizedFullName) || normalizedFullName.includes(key)))
      );
    });
}

function findMatchedVillageRow(
  rows: SupabaseVillageLookupRow[],
  initialKeys: string[]
): SupabaseVillageLookupRow | undefined {
  if (includesYingtaogouAlias(initialKeys)) {
    return rows.find((row) => row.id === YINGTAOGOU_UUID || row.village_code === YINGTAOGOU_CODE) ?? {
      id: YINGTAOGOU_UUID,
      village_code: YINGTAOGOU_CODE,
      name: YINGTAOGOU_NAME,
      full_name: "郑州市二七区侯寨乡樱桃沟社区"
    };
  }

  return rows[0];
}

async function resolveVillagePoiLookupKeys(
  config: { url: string; serviceRoleKey: string },
  input: RecommendedPoiLookupInput
): Promise<ResolvedVillagePoiLookup> {
  const initialKeys = getInitialLookupKeys(input);
  const lookupNames = getLookupNames(input);

  if (initialKeys.length === 0 && lookupNames.length === 0) {
    return {
      initialKeys,
      lookupKeys: [],
      queryVillageIds: []
    };
  }

  const villageRows = await fetchVillageLookupRows(config, initialKeys, lookupNames);
  const matchedRow = findMatchedVillageRow(villageRows, initialKeys);
  const resolvedVillageId = toNullableString(matchedRow?.id) ?? undefined;
  const matchedKey = toNullableString(matchedRow?.village_code) ??
    toNullableString(matchedRow?.name) ??
    resolvedVillageId;

  const lookupKeys = uniqueStrings([
    resolvedVillageId,
    toNullableString(matchedRow?.village_code),
    toNullableString(matchedRow?.name),
    toNullableString(matchedRow?.full_name),
    ...villageRows.flatMap((row) => [
      toNullableString(row.id),
      toNullableString(row.village_code)
    ]),
    ...initialKeys
  ]);
  const queryVillageIds = uniqueStrings([
    resolvedVillageId,
    ...villageRows.map((row) => toNullableString(row.id)),
    ...initialKeys.filter(isUuid)
  ]).filter(isUuid);

  return {
    initialKeys,
    lookupKeys,
    queryVillageIds,
    resolvedVillageId,
    matchedKey
  };
}

function pickCategoryPois(pois: RecommendedPoi[], category: AmapPoiCategory): RecommendedPoi[] {
  const categoryPois = pois.filter((poi) => poi.category === category).sort(sortRecommendedPois);
  const recommended = categoryPois.filter((poi) => poi.isRecommended);
  const source = recommended.length > 0
    ? recommended
    : categoryPois.filter((poi) => poi.dataReviewStatus === "needs_review");

  return source.slice(0, CATEGORY_LIMITS[category]);
}

function groupRecommendedPois(pois: RecommendedPoi[]): RecommendedPoisByCategory {
  return {
    activity: pickCategoryPois(pois, "activity"),
    food: pickCategoryPois(pois, "food"),
    stay: pickCategoryPois(pois, "stay"),
    parking: pickCategoryPois(pois, "parking")
  };
}

async function fetchPoiRowsByVillageIds(
  config: { url: string; serviceRoleKey: string },
  villageIds: string[],
  onlyRecommended: boolean
): Promise<SupabaseRecommendedPoiRow[]> {
  const uuidVillageIds = villageIds.filter(isUuid);
  if (uuidVillageIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams();
  params.set(
    "select",
    [
      "village_id",
      "category",
      "name",
      "address",
      "latitude",
      "longitude",
      "distance_text",
      "distance_meters",
      "type_text",
      "tel",
      "rating",
      "price_text",
      "source",
      "data_review_status",
      "is_recommended",
      "poi_id"
    ].join(",")
  );
  params.set("village_id", `in.(${uuidVillageIds.map(escapePostgrestValue).join(",")})`);
  params.set("data_review_status", "in.(verified,needs_review)");
  if (onlyRecommended) {
    params.set("is_recommended", "eq.true");
  }

  const endpoint = `${config.url.replace(/\/$/, "")}/rest/v1/village_pois?${params.toString()}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: getHeaders(config.serviceRoleKey),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    console.warn(`[recommended-pois] query failed: ${response.status} ${detail}`);
    return [];
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    console.warn("[recommended-pois] invalid payload, fallback to seed data.");
    return [];
  }

  return payload.filter((row): row is SupabaseRecommendedPoiRow => Boolean(row) && typeof row === "object");
}

export async function getRecommendedPoisForVillage(input: RecommendedPoiLookupInput): Promise<RecommendedPoisByCategory> {
  const empty = createEmptyRecommendedPois();
  const config = getSupabaseServerConfig();
  if (!config) {
    return empty;
  }

  const resolved = await resolveVillagePoiLookupKeys(config, input);
  const { initialKeys, lookupKeys, queryVillageIds, resolvedVillageId, matchedKey } = resolved;
  if (queryVillageIds.length === 0) {
    console.warn("[recommended-pois] empty uuid lookup keys", { initialKeys, lookupKeys });
    return withLookupMeta(empty, {
      lookupKeys,
      queryVillageIds,
      resolvedVillageId,
      matchedKey,
      error: "no_uuid_lookup_key"
    });
  }

  try {
    const recommendedRows = await fetchPoiRowsByVillageIds(config, queryVillageIds, true);
    const recommendedPois = recommendedRows
      .map(toRecommendedPoi)
      .filter((poi): poi is RecommendedPoi => poi !== null);
    const candidateRows = recommendedPois.length > 0
      ? []
      : await fetchPoiRowsByVillageIds(config, queryVillageIds, false);
    const candidatePois = candidateRows
      .map(toRecommendedPoi)
      .filter((poi): poi is RecommendedPoi => poi !== null);
    const usedCandidateFallback = recommendedPois.length === 0 && candidatePois.length > 0;
    const pois = recommendedPois.length > 0 ? recommendedPois : candidatePois;

    console.warn("[recommended-pois] lookup result", {
      initialKeys,
      lookupKeys,
      queryVillageIds,
      resolvedVillageId,
      matchedKey,
      poiCount: pois.length,
      recommendedCount: recommendedPois.length,
      usedCandidateFallback
    });

    return withLookupMeta(groupRecommendedPois(pois), {
      lookupKeys,
      queryVillageIds,
      resolvedVillageId,
      matchedKey,
      totalFound: pois.length,
      recommendedFound: recommendedPois.length,
      usedRecommended: recommendedPois.length > 0,
      usedCandidateFallback
    });
  } catch (error) {
    console.warn("[recommended-pois] query failed, fallback to seed data.", error);
    return withLookupMeta(empty, {
      lookupKeys,
      queryVillageIds,
      resolvedVillageId,
      matchedKey,
      error: error instanceof Error ? error.message : "unknown_error"
    });
  }
}
