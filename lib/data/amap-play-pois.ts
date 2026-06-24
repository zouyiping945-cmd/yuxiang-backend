import type { PlayPlace } from "@/lib/types";
import { searchPoiAround, type AmapPoiItem } from "@/lib/data/amap-client";

export type AmapPlayPoi = PlayPlace & {
  poiId?: string;
  longitude?: number;
  latitude?: number;
  typeText?: string;
  distanceMeters?: number;
};

export type AmapPlayPoiSearchParams = {
  villageName: string;
  longitude: number;
  latitude: number;
  city?: string;
};

const PLAY_KEYWORD_SUFFIXES = [
  "农家乐",
  "采摘",
  "景区",
  "公园",
  "文化",
  "亲子",
  "垂钓",
  "老街",
  "美食",
  "民宿",
  "艺术"
];

const IRRELEVANT_POI_PATTERNS = [
  "停车场",
  "停车位",
  "公共厕所",
  "厕所",
  "卫生间",
  "银行",
  "政府",
  "委员会",
  "派出所",
  "公安",
  "法院",
  "检察院",
  "税务",
  "加油站",
  "收费站",
  "充电站",
  "服务区",
  "公司",
  "办事处"
];

function formatDistance(distanceMeters?: number): string | null {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    return null;
  }

  if (distanceMeters >= 1000) {
    return `约${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)}公里`;
  }

  return `约${Math.round(distanceMeters)}米`;
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function classifyPlayPoi(poi: AmapPoiItem, keyword: string): string {
  const text = `${poi.name} ${poi.typeText ?? ""} ${keyword}`;

  if (includesAny(text, ["童话", "乐园", "游乐", "亲子", "儿童"])) {
    return "亲子活动";
  }

  if (includesAny(text, ["农家乐", "饭庄", "大食堂", "餐饮", "饭店", "美食", "小吃", "地锅"])) {
    return "餐饮休闲";
  }

  if (includesAny(text, ["采摘", "果园", "樱桃", "葡萄", "草莓"])) {
    return "采摘体验";
  }

  if (includesAny(text, ["垂钓", "钓鱼", "鱼塘"])) {
    return "垂钓休闲";
  }

  if (includesAny(text, ["艺术", "公社", "园区", "文创"])) {
    return "艺术园区";
  }

  if (includesAny(text, ["文化", "老街", "街区", "传统", "博物", "展馆"])) {
    return "文化体验";
  }

  if (includesAny(text, ["景区", "风景", "旅游", "观光", "度假"])) {
    return "景区游览";
  }

  if (includesAny(text, ["公园", "广场", "绿地"])) {
    return "公园休闲";
  }

  if (includesAny(text, ["民宿", "客栈", "酒店", "住宿"])) {
    return "住宿休闲";
  }

  return "周边游玩";
}

function isRelevantPlayPoi(poi: AmapPoiItem): boolean {
  const name = poi.name.trim();
  if (!name) {
    return false;
  }

  const text = `${name} ${poi.address ?? ""} ${poi.typeText ?? ""}`;
  if (includesAny(text, IRRELEVANT_POI_PATTERNS)) {
    return false;
  }

  if (typeof poi.distanceMeters === "number" && poi.distanceMeters > 10000) {
    return false;
  }

  return true;
}

function toPlayPoi(poi: AmapPoiItem, keyword: string): AmapPlayPoi {
  const category = classifyPlayPoi(poi, keyword);

  return {
    poiId: poi.poiId,
    name: poi.name,
    category,
    address: poi.address ?? null,
    distanceText: formatDistance(poi.distanceMeters),
    reason: `${category}候选，来自高德周边搜索，出发前建议再次确认营业状态。`,
    source: "amap",
    longitude: poi.longitude,
    latitude: poi.latitude,
    typeText: poi.typeText,
    distanceMeters: poi.distanceMeters
  };
}

function rankPoi(poi: AmapPlayPoi): number {
  const categoryScore: Record<string, number> = {
    "亲子活动": 12,
    "景区游览": 11,
    "采摘体验": 10,
    "文化体验": 9,
    "艺术园区": 9,
    "垂钓休闲": 8,
    "餐饮休闲": 7,
    "公园休闲": 6,
    "住宿休闲": 4,
    "周边游玩": 3
  };

  const distancePenalty = typeof poi.distanceMeters === "number" ? Math.min(8, poi.distanceMeters / 1500) : 4;
  return (categoryScore[poi.category ?? "周边游玩"] ?? 3) - distancePenalty;
}

export async function getAmapPlayPoisForVillage(params: AmapPlayPoiSearchParams): Promise<AmapPlayPoi[]> {
  const villageName = params.villageName.trim();
  if (!villageName || !Number.isFinite(params.longitude) || !Number.isFinite(params.latitude)) {
    return [];
  }

  const keywordMap = new Map<string, string>();
  PLAY_KEYWORD_SUFFIXES.forEach((suffix) => {
    keywordMap.set(`${villageName} ${suffix}`, suffix);
  });

  try {
    const results = await Promise.all(
      Array.from(keywordMap.entries()).map(async ([keywords, suffix]) => {
        const result = await searchPoiAround({
          longitude: params.longitude,
          latitude: params.latitude,
          keywords,
          radius: 10000,
          city: params.city,
          category: "activity"
        });

        if (!result.ok) {
          console.warn(`[amap-play-pois] ${keywords}: ${result.error ?? "search failed"}`);
          return [];
        }

        return result.pois.slice(0, 5).map((poi) => ({ poi, keyword: suffix }));
      })
    );

    const deduped = new Map<string, AmapPlayPoi>();
    results.flat().forEach(({ poi, keyword }) => {
      if (!isRelevantPlayPoi(poi)) {
        return;
      }

      const key = poi.poiId || `${poi.name}_${poi.address ?? ""}`;
      if (!deduped.has(key)) {
        deduped.set(key, toPlayPoi(poi, keyword));
      }
    });

    return Array.from(deduped.values())
      .sort((a, b) => rankPoi(b) - rankPoi(a))
      .slice(0, 12);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.warn(`[amap-play-pois] fallback: ${reason}`);
    return [];
  }
}
