import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type VillageRow = {
  id: string;
  village_code: string;
  name: string;
};

type PoiRow = {
  village_id: string;
  category: string;
  name: string;
  address?: string | null;
  distance_meters?: number | null;
  distance_text?: string | null;
  type_text?: string | null;
  tel?: string | null;
  rating?: string | null;
  price_text?: string | null;
  data_review_status?: string | null;
  is_recommended?: boolean | null;
  review_notes?: string[] | string | null;
  source?: string | null;
  poi_id?: string | null;
};

const CSV_HEADERS = [
  "village_name",
  "village_code",
  "category",
  "name",
  "address",
  "distance_text",
  "type_text",
  "tel",
  "rating",
  "price_text",
  "data_review_status",
  "is_recommended",
  "review_notes",
  "source",
  "poi_id"
];

const CATEGORY_ORDER = new Map([
  ["activity", 1],
  ["food", 2],
  ["stay", 3],
  ["parking", 4]
]);

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

function getHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json"
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

function formatReviewNotes(value: PoiRow["review_notes"]): string {
  if (Array.isArray(value)) {
    return value.join("；");
  }

  return value ?? "";
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

async function main() {
  const config = getConfig();
  const villages = await getJson<VillageRow[]>(
    config,
    "villages?select=id,village_code,name"
  );
  const pois = await getJson<PoiRow[]>(
    config,
    [
      "village_pois?select=",
      [
        "village_id",
        "category",
        "name",
        "address",
        "distance_meters",
        "distance_text",
        "type_text",
        "tel",
        "rating",
        "price_text",
        "data_review_status",
        "is_recommended",
        "review_notes",
        "source",
        "poi_id"
      ].join(",")
    ].join("")
  );

  const villageMap = new Map(villages.map((village) => [village.id, village]));
  const sortedPois = [...pois].sort((a, b) => {
    const villageA = villageMap.get(a.village_id);
    const villageB = villageMap.get(b.village_id);
    const villageCompare = (villageA?.name ?? "").localeCompare(villageB?.name ?? "", "zh-Hans-CN");
    if (villageCompare !== 0) {
      return villageCompare;
    }

    const categoryCompare = (CATEGORY_ORDER.get(a.category) ?? 99) - (CATEGORY_ORDER.get(b.category) ?? 99);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    const distanceA = typeof a.distance_meters === "number" ? a.distance_meters : Number.POSITIVE_INFINITY;
    const distanceB = typeof b.distance_meters === "number" ? b.distance_meters : Number.POSITIVE_INFINITY;
    return distanceA - distanceB;
  });

  const lines = [toCsvRow(CSV_HEADERS)];
  sortedPois.forEach((poi) => {
    const village = villageMap.get(poi.village_id);
    lines.push(
      toCsvRow([
        village?.name ?? "",
        village?.village_code ?? "",
        poi.category,
        poi.name,
        poi.address ?? "",
        poi.distance_text ?? "",
        poi.type_text ?? "",
        poi.tel ?? "",
        poi.rating ?? "",
        poi.price_text ?? "",
        poi.data_review_status ?? "",
        poi.is_recommended === true ? "true" : "false",
        formatReviewNotes(poi.review_notes),
        poi.source ?? "",
        poi.poi_id ?? ""
      ])
    );
  });

  const outputDir = resolve(process.cwd(), "docs", "review");
  mkdirSync(outputDir, { recursive: true });

  const outputPath = resolve(outputDir, "village-poi-review.csv");
  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Exported POI review CSV: ${outputPath}`);
  console.log(`- villages: ${villages.length}`);
  console.log(`- pois: ${sortedPois.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
