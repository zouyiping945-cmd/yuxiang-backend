import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { geocodeAddress } from "../lib/data/amap-client";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type VillageGeoRow = {
  id: string;
  village_code: string;
  name: string;
  province?: string;
  city?: string;
  district?: string;
  town?: string;
  village?: string;
  full_name?: string;
  latitude?: number | null;
  longitude?: number | null;
  geo_review_status?: string | null;
};

type GeocodeCounts = {
  total: number;
  success: number;
  failed: number;
  skippedVerified: number;
};

const DEFAULT_CITY = "\u90d1\u5dde\u5e02";
const GEOCODE_NOTE = "\u9ad8\u5fb7\u5730\u7406\u7f16\u7801\u5019\u9009\u7ed3\u679c\uff0c\u9700\u4eba\u5de5\u6838\u9a8c";
const GEOCODE_FAILED_PREFIX = "\u9ad8\u5fb7\u5730\u7406\u7f16\u7801\u5931\u8d25\uff1a";

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

async function patchVillage(config: SupabaseConfig, villageId: string, body: Record<string, unknown>) {
  const response = await fetch(`${config.url}/rest/v1/villages?id=eq.${encodeURIComponent(villageId)}`, {
    method: "PATCH",
    headers: getHeaders(config, "return=minimal"),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PATCH villages ${villageId} failed: ${response.status} ${detail}`);
  }
}

function compact(parts: Array<string | undefined | null>): string[] {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
}

function buildAddress(village: VillageGeoRow): string {
  const fullName = village.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  return compact([
    village.province,
    village.city,
    village.district,
    village.town,
    village.village || village.name
  ]).join("");
}

function canSkipVerified(village: VillageGeoRow): boolean {
  return village.geo_review_status === "verified" &&
    typeof village.latitude === "number" &&
    typeof village.longitude === "number";
}

async function main() {
  const config = getConfig();
  const villages = await getJson<VillageGeoRow[]>(
    config,
    "villages?select=id,village_code,name,province,city,district,town,village,full_name,latitude,longitude,geo_review_status&order=created_at.asc"
  );

  const counts: GeocodeCounts = {
    total: villages.length,
    success: 0,
    failed: 0,
    skippedVerified: 0
  };

  console.log(`Start Amap geocoding candidates, total villages: ${villages.length}.`);

  for (const village of villages) {
    const address = buildAddress(village);

    if (canSkipVerified(village)) {
      counts.skippedVerified += 1;
      console.log(`Skip verified geo: ${village.name} (${village.village_code})`);
      continue;
    }

    const result = await geocodeAddress(address, village.city || DEFAULT_CITY);

    if (result.ok && result.location) {
      await patchVillage(config, village.id, {
        address: result.formattedAddress || address,
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        adcode: result.adcode,
        geo_source: "amap",
        geo_review_status: "needs_review",
        geo_review_notes: [GEOCODE_NOTE]
      });

      counts.success += 1;
      console.log(`Success: ${village.name} | ${result.formattedAddress || address} | ${result.location.longitude},${result.location.latitude} | adcode=${result.adcode || "-"}`);
    } else {
      await patchVillage(config, village.id, {
        geo_review_status: "needs_review",
        geo_review_notes: [`${GEOCODE_FAILED_PREFIX}${result.error || "unknown"}`]
      });

      counts.failed += 1;
      console.warn(`Failed: ${village.name} | ${address} | ${result.error || "unknown"}`);
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  console.log("Amap geocoding finished:");
  console.log(`- total: ${counts.total}`);
  console.log(`- success: ${counts.success}`);
  console.log(`- failed: ${counts.failed}`);
  console.log(`- skipped verified: ${counts.skippedVerified}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
