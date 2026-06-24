export type AmapRouteMode = "driving" | "walking" | "transit";

export type AmapRoutePoint = {
  longitude: number;
  latitude: number;
};

export type AmapRoutePlanParams = {
  origin: AmapRoutePoint;
  destination: AmapRoutePoint;
  mode: AmapRouteMode;
};

export type AmapRoutePlanResult =
  | {
      ok: true;
      distanceMeters: number;
      durationSeconds: number;
      distanceText: string;
      durationText: string;
    }
  | {
      ok: false;
      error: string;
    };

type AmapDrivingPayload = {
  status?: string;
  info?: string;
  route?: {
    paths?: Array<{
      distance?: string;
      duration?: string;
    }>;
  };
};

const AMAP_DRIVING_URL = "https://restapi.amap.com/v3/direction/driving";
const ROUTE_TIMEOUT_MS = 10000;

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return "路线信息暂不可用";
  }

  if (meters < 1000) {
    return `${Math.round(meters)}米`;
  }

  const kilometers = (meters / 1000).toFixed(1).replace(/\.0$/, "");
  return `约${kilometers}公里`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "建议提前确认";
  }

  const totalMinutes = Math.max(1, Math.ceil(seconds / 60));
  if (totalMinutes < 60) {
    return `约${totalMinutes}分钟`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `约${hours}小时${minutes}分钟` : `约${hours}小时`;
}

export async function planAmapRoute(params: AmapRoutePlanParams): Promise<AmapRoutePlanResult> {
  const key = process.env.AMAP_WEB_SERVICE_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      error: "missing AMAP_WEB_SERVICE_KEY"
    };
  }

  if (params.mode !== "driving") {
    return {
      ok: false,
      error: `${params.mode} route is not implemented in V1.4`
    };
  }

  const url = new URL(AMAP_DRIVING_URL);
  url.searchParams.set("key", key);
  url.searchParams.set("origin", `${params.origin.longitude},${params.origin.latitude}`);
  url.searchParams.set("destination", `${params.destination.longitude},${params.destination.latitude}`);
  url.searchParams.set("extensions", "base");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `AMAP_ROUTE_HTTP_${response.status}`
      };
    }

    const payload = (await response.json()) as AmapDrivingPayload;
    if (payload.status !== "1") {
      return {
        ok: false,
        error: payload.info || "Amap route status is not successful"
      };
    }

    const path = payload.route?.paths?.[0];
    const distanceMeters = Number(path?.distance);
    const durationSeconds = Number(path?.duration);

    if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
      return {
        ok: false,
        error: "Amap route does not contain a valid path"
      };
    }

    return {
      ok: true,
      distanceMeters,
      durationSeconds,
      distanceText: formatDistance(distanceMeters),
      durationText: formatDuration(durationSeconds)
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Amap route request failed"
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
