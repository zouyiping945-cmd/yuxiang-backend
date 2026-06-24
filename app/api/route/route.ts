import { NextResponse } from "next/server";
import {
  planAmapRoute,
  type AmapRouteMode,
  type AmapRoutePoint
} from "@/lib/data/amap-route";
import { getSupabaseServerConfig } from "@/lib/supabase/server";

type RoutePointInput = {
  longitude?: unknown;
  latitude?: unknown;
  name?: unknown;
};

type RouteRequestBody = {
  villageId?: unknown;
  destination?: RoutePointInput;
  origin?: RoutePointInput;
  mode?: unknown;
};

type OriginUsed = AmapRoutePoint & {
  source: "user" | "default";
};

type DestinationUsed = AmapRoutePoint & {
  name?: string;
};

type VillageGeoRow = {
  id?: unknown;
  village_code?: unknown;
  name?: unknown;
  full_name?: unknown;
  longitude?: unknown;
  latitude?: unknown;
};

const DEFAULT_ORIGIN: OriginUsed = {
  longitude: 113.625368,
  latitude: 34.746599,
  source: "default"
};

function isFiniteCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function parsePoint(value: RoutePointInput | undefined): AmapRoutePoint | null {
  if (
    !value ||
    !isFiniteCoordinate(value.longitude, -180, 180) ||
    !isFiniteCoordinate(value.latitude, -90, 90)
  ) {
    return null;
  }

  return {
    longitude: value.longitude,
    latitude: value.latitude
  };
}

function parseName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseMode(value: unknown): AmapRouteMode {
  return value === "walking" || value === "transit" || value === "driving" ? value : "driving";
}

function getModeLabel(mode: AmapRouteMode): string {
  if (mode === "walking") {
    return "步行";
  }
  if (mode === "transit") {
    return "公交";
  }
  return "自驾";
}

function routeFallback(
  mode: AmapRouteMode,
  reason: string,
  originUsed?: OriginUsed,
  destinationUsed?: DestinationUsed
) {
  console.warn(`[api/route] amap route fallback reason: ${reason}`);

  return NextResponse.json(
    {
      ok: true,
      data: {
        provider: "fallback",
        mode,
        ...(originUsed ? { originUsed } : {}),
        ...(destinationUsed ? { destinationUsed } : {}),
        distanceText: "路线信息暂不可用",
        durationText: "建议提前确认",
        summary: "当前路线规划暂不可用，建议使用地图 App 搜索目的地后前往。",
        tips: ["建议出发前再次确认路线与停车信息"],
        fallbackUsed: true
      }
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    }
  );
}

async function fetchVillageByField(field: "id" | "village_code", value: string): Promise<VillageGeoRow | null> {
  const config = getSupabaseServerConfig();
  if (!config) {
    throw new Error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const url = new URL(`${config.url.replace(/\/$/, "")}/rest/v1/villages`);
  url.searchParams.set("select", "id,village_code,name,full_name,longitude,latitude");
  url.searchParams.set(field, `eq.${value}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`SUPABASE_ROUTE_VILLAGE_QUERY_FAILED_${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const row = payload[0];
  return row && typeof row === "object" ? row as VillageGeoRow : null;
}

async function resolveVillageDestination(villageId: string): Promise<DestinationUsed | null> {
  const normalizedId = villageId.trim();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(normalizedId)) {
    return null;
  }

  let row = await fetchVillageByField("village_code", normalizedId);
  if (!row && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedId)) {
    row = await fetchVillageByField("id", normalizedId);
  }

  if (
    !row ||
    !isFiniteCoordinate(row.longitude, -180, 180) ||
    !isFiniteCoordinate(row.latitude, -90, 90)
  ) {
    return null;
  }

  return {
    longitude: row.longitude,
    latitude: row.latitude,
    name: parseName(row.full_name) || parseName(row.name)
  };
}

export async function POST(request: Request) {
  let body: RouteRequestBody = {};
  try {
    body = (await request.json()) as RouteRequestBody;
  } catch {
    return routeFallback("driving", "invalid JSON body");
  }

  const mode = parseMode(body.mode);
  const requestOrigin = parsePoint(body.origin);
  const originUsed: OriginUsed = requestOrigin
    ? { ...requestOrigin, source: "user" }
    : DEFAULT_ORIGIN;

  let destinationUsed: DestinationUsed | null = null;

  try {
    const requestDestination = parsePoint(body.destination);
    if (requestDestination) {
      destinationUsed = {
        ...requestDestination,
        name: parseName(body.destination?.name)
      };
    } else {
      const villageId = parseName(body.villageId);
      if (!villageId) {
        return routeFallback(mode, "missing destination and villageId", originUsed);
      }
      destinationUsed = await resolveVillageDestination(villageId);
    }

    if (!destinationUsed) {
      return routeFallback(mode, "destination coordinates are unavailable", originUsed);
    }

    const result = await planAmapRoute({
      origin: originUsed,
      destination: destinationUsed,
      mode
    });

    if (!result.ok) {
      return routeFallback(mode, result.error, originUsed, destinationUsed);
    }

    const modeLabel = getModeLabel(mode);
    console.info(
      `[api/route] amap route success: ${mode} ${result.distanceMeters}m ${result.durationSeconds}s`
    );

    return NextResponse.json(
      {
        ok: true,
        data: {
          provider: "amap",
          mode,
          originUsed,
          destinationUsed,
          distanceMeters: result.distanceMeters,
          distanceText: result.distanceText,
          durationSeconds: result.durationSeconds,
          durationText: result.durationText,
          summary: `建议${modeLabel}前往，全程${result.distanceText}，预计${result.durationText}。周末建议错峰出发，抵达前确认停车位置。`,
          tips: [
            "建议提前确认停车点",
            "老人同行建议减少夜间山路驾驶"
          ],
          fallbackUsed: false
        }
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        }
      }
    );
  } catch (error) {
    return routeFallback(
      mode,
      error instanceof Error ? error.message : "route planning failed",
      originUsed,
      destinationUsed ?? undefined
    );
  }
}
