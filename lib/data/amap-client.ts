import type { AmapPoiCategory } from "../types";

type AmapLocation = {
  longitude: number;
  latitude: number;
};

export type AmapGeocodeResult = {
  ok: boolean;
  location?: AmapLocation;
  formattedAddress?: string;
  adcode?: string;
  district?: string;
  level?: string;
  raw?: unknown;
  error?: string;
};

export type AmapPoiItem = {
  poiId: string;
  name: string;
  address?: string;
  longitude?: number;
  latitude?: number;
  distanceMeters?: number;
  typeText?: string;
  tel?: string;
  rating?: string;
  priceText?: string;
  raw?: unknown;
};

export type AmapPoiSearchParams = {
  longitude: number;
  latitude: number;
  keywords?: string;
  types?: string;
  radius?: number;
  city?: string;
  category: AmapPoiCategory;
};

export type AmapPoiSearchResult = {
  ok: boolean;
  pois: AmapPoiItem[];
  error?: string;
};

type AmapGeocodePayload = {
  status?: string;
  info?: string;
  geocodes?: Array<{
    formatted_address?: string;
    adcode?: string;
    district?: string;
    level?: string;
    location?: string;
  }>;
};

type AmapPoiPayload = {
  status?: string;
  info?: string;
  pois?: Array<{
    id?: string;
    name?: string;
    address?: string | string[];
    location?: string;
    distance?: string;
    type?: string;
    tel?: string | string[];
    biz_ext?: {
      rating?: string;
      cost?: string;
    };
  }>;
};

const AMAP_BASE_URL = "https://restapi.amap.com/v3";
const DEFAULT_TIMEOUT_MS = 12000;

function getAmapKey(): string | null {
  return process.env.AMAP_WEB_SERVICE_KEY?.trim() || null;
}

function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(`${AMAP_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AMAP_HTTP_${response.status}_${detail}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseLocation(location?: string): AmapLocation | undefined {
  if (!location) {
    return undefined;
  }

  const [longitudeText, latitudeText] = location.split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return undefined;
  }

  return { longitude, latitude };
}

function normalizeText(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("?") || undefined;
  }
  return value || undefined;
}

export async function geocodeAddress(address: string, city = "\u90d1\u5dde\u5e02"): Promise<AmapGeocodeResult> {
  const key = getAmapKey();
  if (!key) {
    return { ok: false, error: "Missing AMAP_WEB_SERVICE_KEY. Please configure backend .env.local." };
  }

  if (!address.trim()) {
    return { ok: false, error: "Missing address for Amap geocoding." };
  }

  try {
    const url = buildUrl("/geocode/geo", {
      key,
      address,
      city
    });
    const payload = await fetchJson<AmapGeocodePayload>(url);

    if (payload.status !== "1") {
      return { ok: false, raw: payload, error: payload.info || "Amap geocoding failed." };
    }

    const first = payload.geocodes?.[0];
    const location = parseLocation(first?.location);
    if (!first || !location) {
      return { ok: false, raw: payload, error: "Amap did not return a valid location." };
    }

    return {
      ok: true,
      location,
      formattedAddress: first.formatted_address,
      adcode: first.adcode,
      district: first.district,
      level: first.level,
      raw: payload
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Amap geocoding request failed."
    };
  }
}

export async function searchPoiAround(params: AmapPoiSearchParams): Promise<AmapPoiSearchResult> {
  const key = getAmapKey();
  if (!key) {
    return { ok: false, pois: [], error: "Missing AMAP_WEB_SERVICE_KEY. Please configure backend .env.local." };
  }

  if (!Number.isFinite(params.longitude) || !Number.isFinite(params.latitude)) {
    return { ok: false, pois: [], error: "Missing valid longitude/latitude for Amap POI search." };
  }

  try {
    const url = buildUrl("/place/around", {
      key,
      location: `${params.longitude},${params.latitude}`,
      keywords: params.keywords,
      types: params.types,
      radius: params.radius ?? 5000,
      city: params.city,
      offset: 10,
      page: 1,
      extensions: "all"
    });
    const payload = await fetchJson<AmapPoiPayload>(url);

    if (payload.status !== "1") {
      return { ok: false, pois: [], error: payload.info || "Amap POI search failed." };
    }

    const pois = (payload.pois ?? []).map((poi): AmapPoiItem | null => {
      const location = parseLocation(poi.location);
      const poiId = poi.id?.trim();
      const name = poi.name?.trim();

      if (!poiId || !name) {
        return null;
      }

      const distanceMeters = poi.distance ? Number(poi.distance) : undefined;
      const priceText = poi.biz_ext?.cost ? `\u4eba\u5747\u7ea6 \u00a5${poi.biz_ext.cost}` : undefined;

      return {
        poiId,
        name,
        address: normalizeText(poi.address),
        longitude: location?.longitude,
        latitude: location?.latitude,
        distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : undefined,
        typeText: poi.type,
        tel: normalizeText(poi.tel),
        rating: poi.biz_ext?.rating,
        priceText,
        raw: poi
      };
    }).filter((poi): poi is AmapPoiItem => Boolean(poi));

    return { ok: true, pois };
  } catch (error) {
    return {
      ok: false,
      pois: [],
      error: error instanceof Error ? error.message : "Amap POI request failed."
    };
  }
}
