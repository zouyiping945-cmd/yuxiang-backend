import "server-only";

import { getSupabaseServerConfig } from "@/lib/supabase/server";
import type {
  DesignationType,
  FoodOption,
  RealVillageData,
  RouteOption,
  StayOption,
  VillageDesignation
} from "@/lib/types";

type SupabaseRow = Record<string, unknown>;

type VillageRow = SupabaseRow & {
  id: string;
  village_code: string;
  name: string;
  province: string;
  city: string;
  district: string;
  full_name: string;
};

const PLACE_LEVELS = new Set(["village", "community", "town", "scenic_area", "unknown"]);
const DESIGNATION_TYPES = new Set(["乡村旅游重点村", "美丽休闲乡村", "传统村落", "康养旅游村"]);
const SOURCE_CONFIDENCE = new Set(["高", "中", "低"]);
const DATA_STATUS = new Set(["seed", "enriched", "verified"]);
const DATA_REVIEW_STATUS = new Set(["seed", "needs_review", "verified"]);

function isObject(value: unknown): value is SupabaseRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function groupByVillageId<T extends SupabaseRow>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  rows.forEach((row) => {
    const villageId = asString(row.village_id);
    if (!villageId) {
      return;
    }

    const current = grouped.get(villageId) ?? [];
    current.push(row);
    grouped.set(villageId, current);
  });

  return grouped;
}

function sortRows<T extends SupabaseRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const left = typeof a.sort_order === "number" ? a.sort_order : 0;
    const right = typeof b.sort_order === "number" ? b.sort_order : 0;
    return left - right;
  });
}

function getHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

async function fetchRows(config: { url: string; serviceRoleKey: string }, path: string): Promise<SupabaseRow[]> {
  const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${path}`, {
    method: "GET",
    headers: getHeaders(config.serviceRoleKey),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`SUPABASE_${path}_QUERY_FAILED_${response.status}_${detail}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error(`SUPABASE_${path}_PAYLOAD_INVALID`);
  }

  return payload.filter(isObject);
}

function isVillageRow(row: SupabaseRow): row is VillageRow {
  return Boolean(
    asString(row.id) &&
      asString(row.village_code) &&
      asString(row.name) &&
      asString(row.province) &&
      asString(row.city) &&
      asString(row.district) &&
      asString(row.full_name)
  );
}

function mapDesignations(rows: SupabaseRow[]): VillageDesignation[] {
  return sortRows(rows).map((row, index) => {
    const rawType = asString(row.designation_type, "乡村旅游重点村");
    const type = DESIGNATION_TYPES.has(rawType) ? rawType : "乡村旅游重点村";

    return {
      type: type as DesignationType,
      sourceName: asString(row.source_name, "附录1 河南省乡村旅游地名单"),
      sourceIndex: typeof row.source_index === "number" ? row.source_index : index,
      note: asString(row.note)
    };
  });
}

function mapRoutes(rows: SupabaseRow[]): RouteOption[] {
  return sortRows(rows).map((row) => ({
    title: asString(row.title),
    subtitle: asString(row.subtitle),
    icon: asString(row.icon)
  })).filter((row) => row.title);
}

function mapFoods(rows: SupabaseRow[]): FoodOption[] {
  return sortRows(rows).map((row) => ({
    name: asString(row.name),
    desc: asString(row.desc),
    priceText: asString(row.price_text),
    tag: asString(row.tag)
  })).filter((row) => row.name);
}

function mapStays(rows: SupabaseRow[]): StayOption[] {
  return sortRows(rows).map((row) => ({
    name: asString(row.name),
    desc: asString(row.desc),
    priceText: asString(row.price_text),
    tag: asString(row.tag)
  })).filter((row) => row.name);
}

function mapVillage(
  villageRow: VillageRow,
  profileRow: SupabaseRow,
  designationRows: SupabaseRow[],
  routeRows: SupabaseRow[],
  foodRows: SupabaseRow[],
  stayRows: SupabaseRow[]
): RealVillageData | null {
  const routeOptions = mapRoutes(routeRows);
  const foods = mapFoods(foodRows);
  const stays = mapStays(stayRows);
  const designations = mapDesignations(designationRows);

  if (routeOptions.length === 0 || foods.length === 0 || stays.length === 0 || designations.length === 0) {
    console.warn(`[supabase-villages] ${villageRow.village_code} 子表数据不完整，触发本地 REAL_VILLAGES fallback。`);
    return null;
  }

  const placeLevel = asString(villageRow.place_level, "unknown");
  const sourceConfidence = asString(villageRow.source_confidence, "中");
  const dataStatus = asString(villageRow.data_status, "seed");
  const dataReviewStatus = asString(villageRow.data_review_status, "needs_review");
  const intensity = asString(villageRow.intensity);

  return {
    id: villageRow.village_code,
    name: villageRow.name,
    province: villageRow.province,
    city: villageRow.city,
    district: villageRow.district,
    town: asString(villageRow.town),
    village: asString(villageRow.village),
    fullName: villageRow.full_name,
    placeLevel: PLACE_LEVELS.has(placeLevel) ? placeLevel as RealVillageData["placeLevel"] : "unknown",
    rating: asString(villageRow.rating, "4.6"),
    distanceText: asString(villageRow.distance_text, "郑州周边"),
    tags: asStringArray(profileRow.tags),
    suitableFor: asStringArray(profileRow.suitable_for),
    matchKeywords: asStringArray(profileRow.match_keywords),
    description: asString(villageRow.description),
    designations,
    routeOptions,
    foods,
    stays,
    recommendedTransport: asStringArray(profileRow.recommended_transport),
    visitDuration: asString(villageRow.visit_duration),
    intensity: intensity === "低" || intensity === "中" || intensity === "高" ? intensity : undefined,
    elderFriendly: asBoolean(profileRow.elder_friendly),
    kidFriendly: asBoolean(profileRow.kid_friendly),
    photoFriendly: asBoolean(profileRow.photo_friendly),
    foodFriendly: asBoolean(profileRow.food_friendly),
    cultureFriendly: asBoolean(profileRow.culture_friendly),
    wellnessFriendly: asBoolean(profileRow.wellness_friendly),
    selfDriveFriendly: asBoolean(profileRow.self_drive_friendly),
    publicTransportFriendly: asBoolean(profileRow.public_transport_friendly),
    dataReviewStatus: DATA_REVIEW_STATUS.has(dataReviewStatus) ? dataReviewStatus as RealVillageData["dataReviewStatus"] : "needs_review",
    reviewNotes: asStringArray(villageRow.review_notes),
    sourceConfidence: SOURCE_CONFIDENCE.has(sourceConfidence) ? sourceConfidence as RealVillageData["sourceConfidence"] : "中",
    dataStatus: DATA_STATUS.has(dataStatus) ? dataStatus as RealVillageData["dataStatus"] : "seed"
  };
}

export async function getSupabaseVillages(): Promise<RealVillageData[]> {
  const config = getSupabaseServerConfig();
  if (!config) {
    console.warn("[supabase-villages] 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，使用本地 REAL_VILLAGES fallback。");
    return [];
  }

  try {
    const [villageRows, profileRows, designationRows, routeRows, foodRows, stayRows] = await Promise.all([
      fetchRows(config, "villages?select=*&order=created_at.asc"),
      fetchRows(config, "village_profiles?select=*"),
      fetchRows(config, "village_designations?select=*"),
      fetchRows(config, "village_routes?select=*"),
      fetchRows(config, "village_foods?select=*"),
      fetchRows(config, "village_stays?select=*")
    ]);

    const profilesByVillageId = groupByVillageId(profileRows);
    const designationsByVillageId = groupByVillageId(designationRows);
    const routesByVillageId = groupByVillageId(routeRows);
    const foodsByVillageId = groupByVillageId(foodRows);
    const staysByVillageId = groupByVillageId(stayRows);
    const villages: RealVillageData[] = [];

    for (const row of villageRows) {
      if (!isVillageRow(row)) {
        console.warn("[supabase-villages] villages 存在缺少必要字段的记录，使用本地 REAL_VILLAGES fallback。");
        return [];
      }

      const profiles = profilesByVillageId.get(row.id) ?? [];
      if (profiles.length === 0) {
        console.warn(`[supabase-villages] ${row.village_code} 缺少 village_profiles，使用本地 REAL_VILLAGES fallback。`);
        return [];
      }

      const village = mapVillage(
        row,
        profiles[0],
        designationsByVillageId.get(row.id) ?? [],
        routesByVillageId.get(row.id) ?? [],
        foodsByVillageId.get(row.id) ?? [],
        staysByVillageId.get(row.id) ?? []
      );

      if (!village) {
        return [];
      }

      villages.push(village);
    }

    if (villages.length === 0) {
      console.warn("[supabase-villages] Supabase villages 为空，使用本地 REAL_VILLAGES fallback。");
      return [];
    }

    return villages;
  } catch (error) {
    console.warn("[supabase-villages] Supabase 读取失败，使用本地 REAL_VILLAGES fallback。", error);
    return [];
  }
}
