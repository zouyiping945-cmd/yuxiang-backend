import { NextRequest, NextResponse } from "next/server";
import { getPublishedVillages, type VillageFilters } from "@/lib/data";

type VillagesSuccessResponse = {
  ok: true;
  data: {
    source: "supabase" | "mock";
    count: number;
    items: Awaited<ReturnType<typeof getPublishedVillages>>["villages"];
  };
};

type VillagesErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

function parseBooleanParam(value: string | null): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filters: VillageFilters = {};

    const city = searchParams.get("city")?.trim();
    if (city) {
      filters.city = city;
    }

    filters.suitableForElders = parseBooleanParam(searchParams.get("suitable_for_elders"));
    filters.easyWalk = parseBooleanParam(searchParams.get("easy_walk"));
    filters.hasFarmFood = parseBooleanParam(searchParams.get("has_farm_food"));
    filters.hasStay = parseBooleanParam(searchParams.get("has_stay"));

    const result = await getPublishedVillages(filters);

    const response: VillagesSuccessResponse = {
      ok: true,
      data: {
        source: result.source,
        count: result.villages.length,
        items: result.villages
      }
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    const response: VillagesErrorResponse = {
      ok: false,
      error: {
        code: "VILLAGES_FETCH_FAILED",
        message: "获取村庄列表失败"
      }
    };

    return NextResponse.json(response, { status: 500 });
  }
}
