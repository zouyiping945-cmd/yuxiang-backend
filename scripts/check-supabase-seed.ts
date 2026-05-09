import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type VillagePreview = {
  id: string;
  village_code: string;
  name: string;
  full_name: string;
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
    const value = rawValue.replace(/^['"]|['"]$/g, "");

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
    throw new Error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，请先检查 .env.local。");
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

async function getCount(config: SupabaseConfig, tableName: string, filter = ""): Promise<number> {
  const response = await fetch(`${config.url}/rest/v1/${tableName}?select=id${filter}`, {
    method: "GET",
    headers: {
      ...getHeaders(config, "count=exact"),
      Range: "0-0"
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`查询 ${tableName} 数量失败：${response.status} ${detail}`);
  }

  const contentRange = response.headers.get("content-range");
  const total = contentRange?.split("/")[1];
  if (total && total !== "*") {
    return Number(total);
  }

  const rows = (await response.json()) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function getJson<T>(config: SupabaseConfig, path: string): Promise<T> {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: "GET",
    headers: getHeaders(config)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GET ${path} failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as T;
}

async function main() {
  const config = getConfig();
  const tables = [
    "villages",
    "village_profiles",
    "village_designations",
    "village_routes",
    "village_foods",
    "village_stays"
  ];

  console.log("Supabase seed 数据数量：");
  const counts: Record<string, number> = {};
  for (const table of tables) {
    counts[table] = await getCount(config, table);
    console.log(`- ${table}: ${counts[table]}`);
  }

  if (counts.villages !== 24) {
    console.warn(`警告：villages 当前数量为 ${counts.villages}，预期为 24。`);
  }

  const villages = await getJson<VillagePreview[]>(
    config,
    "villages?select=id,village_code,name,full_name&order=created_at.asc&limit=3"
  );

  console.log("前 3 个村庄关联数据：");
  for (const village of villages) {
    const filter = `&village_id=eq.${encodeURIComponent(village.id)}`;
    const profileCount = await getCount(config, "village_profiles", filter);
    const routeCount = await getCount(config, "village_routes", filter);
    const foodCount = await getCount(config, "village_foods", filter);
    const stayCount = await getCount(config, "village_stays", filter);
    const designationCount = await getCount(config, "village_designations", filter);

    console.log(`- ${village.full_name} (${village.village_code})`);
    console.log(`  profiles: ${profileCount}, designations: ${designationCount}, routes: ${routeCount}, foods: ${foodCount}, stays: ${stayCount}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
