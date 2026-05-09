import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REAL_VILLAGES } from "../lib/real-villages";
import type { RealVillageData } from "../lib/types";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type VillageRow = {
  village_code: string;
  name: string;
  province: string;
  city: string;
  district: string;
  town?: string;
  village?: string;
  full_name: string;
  place_level: string;
  rating: string;
  distance_text: string;
  description: string;
  visit_duration?: string;
  intensity?: string;
  source_confidence: string;
  data_status: string;
  data_review_status?: string;
  review_notes?: string[];
};

type MigrationCounts = {
  villages: number;
  profiles: number;
  designations: number;
  routes: number;
  foods: number;
  stays: number;
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

async function requestJson<T>(config: SupabaseConfig, path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...getHeaders(config),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as T;
}

async function requestNoContent(config: SupabaseConfig, path: string, init: RequestInit) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...getHeaders(config),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status} ${detail}`);
  }
}

function mapVillageRow(village: RealVillageData): VillageRow {
  return {
    village_code: village.id,
    name: village.name,
    province: village.province,
    city: village.city,
    district: village.district,
    town: village.town,
    village: village.village,
    full_name: village.fullName,
    place_level: village.placeLevel,
    rating: village.rating,
    distance_text: village.distanceText,
    description: village.description,
    visit_duration: village.visitDuration,
    intensity: village.intensity,
    source_confidence: village.sourceConfidence,
    data_status: village.dataStatus,
    data_review_status: village.dataReviewStatus,
    review_notes: village.reviewNotes
  };
}

function mapProfileRow(villageId: string, village: RealVillageData) {
  return {
    village_id: villageId,
    tags: village.tags,
    suitable_for: village.suitableFor,
    match_keywords: village.matchKeywords,
    recommended_transport: village.recommendedTransport,
    elder_friendly: Boolean(village.elderFriendly),
    kid_friendly: Boolean(village.kidFriendly),
    photo_friendly: Boolean(village.photoFriendly),
    food_friendly: Boolean(village.foodFriendly),
    culture_friendly: Boolean(village.cultureFriendly),
    wellness_friendly: Boolean(village.wellnessFriendly),
    self_drive_friendly: Boolean(village.selfDriveFriendly),
    public_transport_friendly: Boolean(village.publicTransportFriendly)
  };
}

async function upsertVillage(config: SupabaseConfig, village: RealVillageData): Promise<string> {
  const rows = await requestJson<Array<{ id: string }>>(
    config,
    "villages?on_conflict=village_code",
    {
      method: "POST",
      headers: getHeaders(config, "resolution=merge-duplicates,return=representation"),
      body: JSON.stringify([mapVillageRow(village)])
    }
  );

  const id = rows[0]?.id;
  if (!id) {
    throw new Error(`villages upsert 未返回 id：${village.id}`);
  }

  return id;
}

async function upsertProfile(config: SupabaseConfig, villageId: string, village: RealVillageData) {
  const profileRows = await requestJson<Array<{ id: string }>>(
    config,
    `village_profiles?select=id&village_id=eq.${encodeURIComponent(villageId)}&limit=1`,
    {
      method: "GET"
    }
  );
  const row = mapProfileRow(villageId, village);
  const existingId = profileRows[0]?.id;

  if (existingId) {
    await requestJson(
      config,
      `village_profiles?id=eq.${encodeURIComponent(existingId)}`,
      {
        method: "PATCH",
        headers: getHeaders(config, "return=representation"),
        body: JSON.stringify(row)
      }
    );
    return;
  }

  await requestJson(
    config,
    "village_profiles",
    {
      method: "POST",
      headers: getHeaders(config, "return=representation"),
      body: JSON.stringify(row)
    }
  );
}

async function replaceRows(config: SupabaseConfig, tableName: string, villageId: string, rows: Array<Record<string, unknown>>) {
  await requestNoContent(config, `${tableName}?village_id=eq.${encodeURIComponent(villageId)}`, {
    method: "DELETE",
    headers: getHeaders(config, "return=minimal")
  });

  if (rows.length === 0) {
    return;
  }

  await requestNoContent(config, tableName, {
    method: "POST",
    headers: getHeaders(config, "return=minimal"),
    body: JSON.stringify(rows)
  });
}

async function migrateVillage(config: SupabaseConfig, village: RealVillageData, counts: MigrationCounts) {
  const villageId = await upsertVillage(config, village);
  counts.villages += 1;

  await upsertProfile(config, villageId, village);
  counts.profiles += 1;

  await replaceRows(
    config,
    "village_designations",
    villageId,
    village.designations.map((designation, index) => ({
      village_id: villageId,
      designation_type: designation.type,
      source_name: designation.sourceName,
      source_index: designation.sourceIndex ?? index,
      note: designation.note
    }))
  );
  counts.designations += village.designations.length;

  await replaceRows(
    config,
    "village_routes",
    villageId,
    village.routeOptions.map((route, index) => ({
      village_id: villageId,
      title: route.title,
      subtitle: route.subtitle,
      icon: route.icon,
      sort_order: index
    }))
  );
  counts.routes += village.routeOptions.length;

  await replaceRows(
    config,
    "village_foods",
    villageId,
    village.foods.map((food, index) => ({
      village_id: villageId,
      name: food.name,
      desc: food.desc,
      price_text: food.priceText,
      tag: food.tag,
      sort_order: index
    }))
  );
  counts.foods += village.foods.length;

  await replaceRows(
    config,
    "village_stays",
    villageId,
    village.stays.map((stay, index) => ({
      village_id: villageId,
      name: stay.name,
      desc: stay.desc,
      price_text: stay.priceText,
      tag: stay.tag,
      sort_order: index
    }))
  );
  counts.stays += village.stays.length;
}

async function main() {
  const config = getConfig();
  const counts: MigrationCounts = {
    villages: 0,
    profiles: 0,
    designations: 0,
    routes: 0,
    foods: 0,
    stays: 0
  };

  console.log(`开始迁移 REAL_VILLAGES，共 ${REAL_VILLAGES.length} 条。`);

  for (const village of REAL_VILLAGES) {
    try {
      await migrateVillage(config, village, counts);
      console.log(`已迁移：${village.fullName} (${village.id})`);
    } catch (error) {
      console.error(`迁移失败：${village.fullName} (${village.id})`);
      throw error;
    }
  }

  console.log("迁移完成：");
  console.log(`- villages: ${counts.villages}`);
  console.log(`- village_profiles: ${counts.profiles}`);
  console.log(`- village_designations: ${counts.designations}`);
  console.log(`- village_routes: ${counts.routes}`);
  console.log(`- village_foods: ${counts.foods}`);
  console.log(`- village_stays: ${counts.stays}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
