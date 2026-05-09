import "server-only";

import type { Village } from "@/lib/types";
import { villages } from "@/lib/mock-villages";
import { queryPublishedVillageRows } from "@/lib/supabase/server";

type VillagesReadResult = {
  villages: Village[];
  source: "supabase" | "mock";
};

export type VillageFilters = {
  city?: string;
  suitableForElders?: boolean;
  easyWalk?: boolean;
  hasFarmFood?: boolean;
  hasStay?: boolean;
};

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toBooleanValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapSupabaseVillageRow(row: Record<string, unknown>): Village | null {
  const id = toStringValue(row.id);
  const name = toStringValue(row.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    city: toStringValue(row.city, "unknown"),
    tags: toStringArray(row.tags),
    driveTimeMinutes: toNumberValue(row.drive_time_minutes ?? row.driveTimeMinutes, 60),
    suitableForElders: toBooleanValue(row.suitable_for_elders ?? row.suitableForElders, false),
    easyWalk: toBooleanValue(row.easy_walk ?? row.easyWalk, false),
    hasFarmFood: toBooleanValue(row.has_farm_food ?? row.hasFarmFood, false),
    hasStay: toBooleanValue(row.has_stay ?? row.hasStay, false),
    coverImage: toStringValue(row.cover_image ?? row.coverImage, villages[0]?.coverImage ?? ""),
    description: toStringValue(row.description, ""),
    rating: toStringValue(row.rating, "4.6"),
    distanceText: toStringValue(row.distance_text ?? row.distanceText, "10km")
  };
}

function normalizeCity(value: string): string {
  return value.trim().toLowerCase().replace(/shi$/, "");
}

function applyVillageFilters(villageList: Village[], filters?: VillageFilters): Village[] {
  if (!filters) {
    return villageList;
  }

  let result = villageList;

  if (filters.city) {
    const targetCity = normalizeCity(filters.city);
    result = result.filter((item) => normalizeCity(item.city) === targetCity);
  }

  if (typeof filters.suitableForElders === "boolean") {
    result = result.filter((item) => item.suitableForElders === filters.suitableForElders);
  }

  if (typeof filters.easyWalk === "boolean") {
    result = result.filter((item) => item.easyWalk === filters.easyWalk);
  }

  if (typeof filters.hasFarmFood === "boolean") {
    result = result.filter((item) => item.hasFarmFood === filters.hasFarmFood);
  }

  if (typeof filters.hasStay === "boolean") {
    result = result.filter((item) => item.hasStay === filters.hasStay);
  }

  return result;
}

export async function getPublishedVillages(filters?: VillageFilters): Promise<VillagesReadResult> {
  try {
    const rows = await queryPublishedVillageRows();
    const mappedVillages = rows
      .map((row) => mapSupabaseVillageRow(row))
      .filter((item): item is Village => item !== null);

    if (mappedVillages.length > 0) {
      return {
        villages: applyVillageFilters(mappedVillages, filters),
        source: "supabase"
      };
    }
  } catch {
    // fallback to local mock villages
  }

  return {
    villages: applyVillageFilters(villages, filters),
    source: "mock"
  };
}

export async function getPublishedVillageById(
  id: string
): Promise<{ village: Village | undefined; source: "supabase" | "mock" }> {
  const targetId = id.trim().toLowerCase();
  if (!targetId) {
    return {
      village: undefined,
      source: "mock"
    };
  }

  try {
    const rows = await queryPublishedVillageRows();
    const mappedVillages = rows
      .map((row) => mapSupabaseVillageRow(row))
      .filter((item): item is Village => item !== null);

    if (mappedVillages.length > 0) {
      const supabaseVillage = mappedVillages.find(
        (item) => item.id.trim().toLowerCase() === targetId
      );

      if (supabaseVillage) {
        return {
          village: supabaseVillage,
          source: "supabase"
        };
      }
    }
  } catch {
    // fallback to local mock villages
  }

  return {
    village: villages.find((item) => item.id.trim().toLowerCase() === targetId),
    source: "mock"
  };
}

export type VillageDetail = {
  id: string;
  name: string;
  district: string;
  rating: string;
  distance: string;
  cover: string;
  tags: string[];
};

function toVillageDetail(item: Village): VillageDetail {
  return {
    id: item.id,
    name: item.name,
    district: item.city,
    rating: item.rating,
    distance: item.distanceText,
    cover: item.coverImage,
    tags: item.tags.slice(0, 2)
  };
}

export const villageList: VillageDetail[] = villages.map((item) => toVillageDetail(item));

export async function getVillageList(): Promise<VillageDetail[]> {
  const result = await getPublishedVillages();
  return result.villages.map((item) => toVillageDetail(item));
}

export async function getVillageById(id: string): Promise<VillageDetail | undefined> {
  const result = await getPublishedVillageById(id);
  return result.village ? toVillageDetail(result.village) : undefined;
}
