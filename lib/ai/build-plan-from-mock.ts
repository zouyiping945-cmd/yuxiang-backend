import type { BuildPlanInput, ProviderPlanOutput } from "@/lib/ai/types";
import { generateDeepSeekPlanEnhancement } from "@/lib/ai/deepseek-provider";
import { getSupabaseVillages } from "@/lib/data/supabase-villages";
import { villages as fallbackVillages } from "@/lib/mock-villages";
import { REAL_VILLAGES } from "@/lib/real-villages";
import type { FoodOption, PlanAlternative, PlanResult, PlanStep, RealVillageData, RouteOption, StayOption, Village } from "@/lib/types";

const ALLOWED_STEP_KINDS = new Set([
  "walk",
  "food",
  "stay",
  "photo",
  "activity",
  "transport"
] as const);

function buildDefaultSteps(villageName: string, hasFarmFood: boolean, hasStay: boolean): PlanStep[] {
  const steps: PlanStep[] = [
    {
      time: "09:30",
      title: "交通出发",
      detail: "建议错峰出行，沿推荐路线前往目的地。",
      kind: "transport"
    },
    {
      time: "10:30",
      title: "栈道慢步",
      detail: `在${villageName}进行轻松步行，节奏舒适不赶路。`,
      kind: "walk"
    },
    {
      time: "12:30",
      title: hasFarmFood ? "农家午餐" : "本地简餐",
      detail: hasFarmFood ? "可安排农家菜，口味清淡。 " : "村口简餐点可快速补给。",
      kind: "food"
    },
    {
      time: "14:00",
      title: "田园活动",
      detail: "可体验采摘或手作等轻互动项目。",
      kind: "activity"
    },
    {
      time: "16:00",
      title: hasStay ? "入住休息" : "返程准备",
      detail: hasStay ? "可就近入住民宿，安排慢节奏夜间活动。" : "拍照打卡后返程。",
      kind: hasStay ? "stay" : "photo"
    }
  ];

  return steps;
}

function sanitizeSteps(steps: PlanStep[] | undefined, fallback: PlanStep[]): PlanStep[] {
  if (!steps || steps.length === 0) {
    return fallback;
  }

  const valid = steps.filter((step) => ALLOWED_STEP_KINDS.has(step.kind));
  return valid.length > 0 ? valid : fallback;
}

function clampMatchScore(score: number): number {
  return Math.max(88, Math.min(96, Math.round(score)));
}

function hasText(inputText: string | undefined, keywords: string[]): boolean {
  const text = inputText ?? "";
  return keywords.some((keyword) => text.includes(keyword));
}

function buildSummary(village: Village, input: BuildPlanInput, inputText?: string): string {
  const reasons: string[] = [];

  if (input.preference.easyWalkRequired || hasText(inputText, ["轻松", "不累", "不爬山", "慢游"])) {
    reasons.push("轻松慢游");
  }

  if (input.preference.farmFoodPreferred || hasText(inputText, ["农家菜", "吃饭", "美食", "地锅鸡"])) {
    reasons.push("想吃农家菜");
  }

  if (input.preference.travelWithElders || hasText(inputText, ["父母", "老人", "长辈"])) {
    reasons.push("带长辈出行");
  }

  if (input.preference.travelWithKids || hasText(inputText, ["亲子", "孩子", "小孩"])) {
    reasons.push("亲子出游");
  }

  const reasonText = reasons.length > 0 ? reasons.join("、") : "周边短途和舒适体验";
  return `根据你选择的${reasonText}，我更推荐 ${village.name} 作为本次乡村目的地。这里距离适中，适合半天到一天的慢节奏游玩，也方便安排散步、用餐和轻量体验。`;
}

function buildRouteOptions(village: Village): RouteOption[] {
  const driveMinutes = Number.isFinite(village.driveTimeMinutes) ? village.driveTimeMinutes : 45;
  const publicMinutes = Math.max(70, driveMinutes + 45);

  return [
    {
      title: `自驾约${driveMinutes}分`,
      subtitle: "停车较方便，适合家庭同行",
      icon: "车"
    },
    {
      title: publicMinutes >= 60 ? `公交约${Math.round(publicMinutes / 60 * 10) / 10}时` : `公交约${publicMinutes}分`,
      subtitle: "建议提前查看班次",
      icon: "巴"
    }
  ];
}

function buildFoods(input: BuildPlanInput, inputText?: string): FoodOption[] {
  const wantsFarmFood = input.preference.farmFoodPreferred || hasText(inputText, ["农家菜", "吃饭", "美食", "地锅鸡"]);
  const leadTag = wantsFarmFood ? "查看美食推荐" : "顺路用餐";

  return [
    {
      name: "附近农家菜",
      desc: "本地家常菜 / 时令蔬菜",
      priceText: "人均约 ¥45",
      tag: leadTag
    },
    {
      name: "山野小院",
      desc: "柴火饭 / 农家小炒",
      priceText: "人均约 ¥58",
      tag: "适合家庭聚餐"
    },
    {
      name: "田园茶点",
      desc: "手作点心 / 花茶",
      priceText: "人均约 ¥35",
      tag: "适合休闲歇脚"
    },
    {
      name: "老灶台饭庄",
      desc: "地锅鸡 / 手擀面",
      priceText: "人均约 ¥62",
      tag: "热门农家味"
    },
    {
      name: "果园小食铺",
      desc: "鲜榨果汁 / 烤红薯",
      priceText: "人均约 ¥28",
      tag: "适合亲子停留"
    },
    {
      name: "村口小馆",
      desc: "家常小炒 / 时令野菜",
      priceText: "人均约 ¥40",
      tag: "距离较近"
    }
  ];
}

function buildStays(village: Village): StayOption[] {
  const prefix = village.hasStay ? "可就近入住" : "周边可选";

  return [
    {
      name: "星空民宿",
      desc: `${prefix} / 独立庭院 / 落地窗`,
      priceText: "¥288起",
      tag: "舒适首选"
    },
    {
      name: "溪边小院",
      desc: "亲子房 / 近步道",
      priceText: "¥238起",
      tag: "适合亲子"
    },
    {
      name: "田园客栈",
      desc: "安静舒适 / 可停车",
      priceText: "¥198起",
      tag: "性价比"
    },
    {
      name: "山居小筑",
      desc: "山景房 / 早餐",
      priceText: "¥268起",
      tag: "慢住体验"
    },
    {
      name: "老屋民宿",
      desc: "传统院落 / 适合家庭",
      priceText: "¥218起",
      tag: "乡村院落"
    }
  ];
}

function buildAlternativeSummary(village: Village): string {
  return `${village.city}·${village.name} 也适合作为备选，特点是${village.tags.slice(0, 2).join("、") || "乡村慢游"}。`;
}

function isLocalImagePath(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value.startsWith("/") || value.startsWith("./") || value.startsWith("../");
}

function toSafeVillage(village: Village): Village {
  return {
    ...village,
    coverImage: isLocalImagePath(village.coverImage) ? village.coverImage : ""
  };
}

function toAlternative(village: Village, matchScore?: number, reasonSummary?: string) {
  return {
    id: village.id,
    name: village.name,
    city: village.city,
    rating: village.rating,
    tags: village.tags,
    description: village.description,
    distanceText: village.distanceText,
    summary: buildAlternativeSummary(village),
    matchScore: clampMatchScore(matchScore ?? 88),
    reasonSummary: reasonSummary ?? buildAlternativeSummary(village)
  };
}

function buildPreferenceText(input: BuildPlanInput, inputText?: string): string {
  const companions = input.preference.companions ?? [];
  const demands = input.preference.demands ?? [];
  return [inputText ?? "", ...companions, ...demands].join(" ");
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

type DemandHits = {
  hitElder: boolean;
  hitKid: boolean;
  hitFood: boolean;
  hitPhoto: boolean;
  hitCulture: boolean;
  hitWellness: boolean;
  hitShortTrip: boolean;
  hitEasy: boolean;
  hitFriend: boolean;
  hitSelfDrive: boolean;
};

function analyzeDemand(input: BuildPlanInput, text: string): DemandHits {
  return {
    hitElder: input.preference.travelWithElders || includesAny(text, ["父母", "老人", "长辈", "爸妈"]),
    hitKid: input.preference.travelWithKids || includesAny(text, ["亲子", "孩子", "小孩", "带娃"]),
    hitFood: input.preference.farmFoodPreferred || includesAny(text, ["农家菜", "吃饭", "美食", "家常菜", "地锅鸡"]),
    hitPhoto: includesAny(text, ["拍照", "出片", "风景", "好看", "打卡"]),
    hitCulture: includesAny(text, ["研学", "文化", "传统", "传统村落", "历史", "村落"]),
    hitWellness: includesAny(text, ["康养", "放松", "休息", "散心", "安静"]),
    hitShortTrip: includesAny(text, ["周末", "短途", "近郊", "半日", "一天"]),
    hitEasy: input.preference.easyWalkRequired || includesAny(text, ["轻松", "不累", "不爬山", "慢游", "走走", "散步"]),
    hitFriend: includesAny(text, ["朋友", "情侣", "同学", "同事"]),
    hitSelfDrive: includesAny(text, ["自驾", "开车", "驾车", "开车去", "开车转转"])
  };
}

function buildDemandText(hits: DemandHits): string {
  const demands: string[] = [];

  if (hits.hitElder) {
    demands.push("带父母或长辈同行");
  }

  if (hits.hitKid) {
    demands.push("亲子周末出游");
  }

  if (hits.hitFriend) {
    demands.push("和朋友一起出游");
  }

  if (hits.hitEasy) {
    demands.push("希望轻松、不太累");
  }

  if (hits.hitFood) {
    demands.push("想吃农家菜");
  }

  if (hits.hitPhoto) {
    demands.push("想拍照看风景");
  }

  if (hits.hitCulture) {
    demands.push("想看传统村落和乡村文化");
  }

  if (hits.hitWellness) {
    demands.push("希望放松或康养休闲");
  }

  if (hits.hitShortTrip) {
    demands.push("偏好周末近郊短途");
  }

  if (hits.hitSelfDrive) {
    demands.push("希望自驾出行");
  }

  return demands.slice(0, 4).join("、") || "想做一次郑州近郊乡村休闲";
}

function buildReasonTags(real: RealVillageData, hits: DemandHits): string[] {
  const tags: string[] = [];

  if (hits.hitElder && real.suitableFor.includes("老人")) {
    tags.push("适合父母");
  }

  if (hits.hitKid && (real.suitableFor.includes("亲子") || real.tags.some((tag) => tag.includes("亲子")))) {
    tags.push("亲子友好");
  }

  if (hits.hitEasy && real.tags.some((tag) => tag.includes("轻松") || tag.includes("慢游"))) {
    tags.push("轻松不累");
  }

  if (hits.hitFood && real.tags.some((tag) => tag.includes("农家菜"))) {
    tags.push("农家菜友好");
  }

  if (hits.hitPhoto && real.tags.some((tag) => tag.includes("拍照") || tag.includes("风光"))) {
    tags.push("适合拍照");
  }

  if (hits.hitCulture && real.tags.some((tag) => tag.includes("传统") || tag.includes("文化") || tag.includes("研学"))) {
    tags.push("文化走看");
  }

  if (hits.hitWellness && real.tags.some((tag) => tag.includes("康养") || tag.includes("慢游"))) {
    tags.push("放松休闲");
  }

  if (hits.hitShortTrip && real.tags.some((tag) => tag.includes("近郊") || tag.includes("短途"))) {
    tags.push("周末短途");
  }

  if (hits.hitSelfDrive && (real.suitableFor.includes("自驾") || real.tags.some((tag) => tag.includes("自驾") || tag.includes("近郊") || tag.includes("短途")))) {
    tags.push("自驾友好");
  }

  return Array.from(new Set(tags.length > 0 ? tags : real.tags.slice(0, 3))).slice(0, 4);
}

function buildReasonSummary(hits: DemandHits, reasonTags: string[]): string {
  const demandText = buildDemandText(hits);
  return `匹配你提出的${demandText}需求，对应${reasonTags.join("、")}等推荐理由。`;
}

function parseDriveMinutes(routeTitle: string | undefined): number {
  if (!routeTitle) {
    return 45;
  }

  const hourMatch = routeTitle.match(/(\d+(?:\.\d+)?)\s*时/);
  if (hourMatch) {
    return Math.round(Number(hourMatch[1]) * 60);
  }

  const minuteMatch = routeTitle.match(/(\d+)\s*分/);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  return 45;
}

function realToVillage(real: RealVillageData): Village {
  return {
    id: real.id,
    name: real.name,
    city: real.city,
    tags: real.tags,
    driveTimeMinutes: parseDriveMinutes(real.routeOptions[0]?.title),
    suitableForElders: real.suitableFor.includes("老人"),
    easyWalk: real.tags.some((tag) => tag.includes("轻松") || tag.includes("慢游") || tag.includes("康养") || tag.includes("近郊")),
    hasFarmFood: real.tags.some((tag) => tag.includes("农家菜")),
    hasStay: real.stays.length > 0,
    coverImage: "",
    description: real.description,
    rating: real.rating,
    distanceText: real.distanceText
  };
}

function buildRealReasons(real: RealVillageData, hits: DemandHits): string[] {
  const reasons: string[] = [];

  if (hits.hitElder || hits.hitEasy) {
    if (real.suitableFor.includes("老人") || real.tags.some((tag) => tag.includes("轻松") || tag.includes("慢游") || tag.includes("康养"))) {
      reasons.push("适合带父母或长辈轻松慢游");
    }
  }

  if (hits.hitKid) {
    if (real.suitableFor.includes("亲子") || real.tags.some((tag) => tag.includes("亲子"))) {
      reasons.push("适合亲子周末短途");
    }
  }

  if (hits.hitFood) {
    if (real.tags.some((tag) => tag.includes("农家菜"))) {
      reasons.push("方便安排农家菜和本地家常菜");
    }
  }

  if (hits.hitPhoto) {
    if (real.tags.some((tag) => tag.includes("拍照") || tag.includes("风光"))) {
      reasons.push("具备拍照出片和自然风光体验");
    }
  }

  if (hits.hitCulture) {
    if (real.tags.some((tag) => tag.includes("研学") || tag.includes("文化") || tag.includes("传统"))) {
      reasons.push("适合乡村文化、传统村落和轻量研学");
    }
  }

  if (hits.hitWellness && real.tags.some((tag) => tag.includes("康养") || tag.includes("放松"))) {
    reasons.push("适合放松休闲和康养慢游");
  }

  if (hits.hitShortTrip && real.tags.some((tag) => tag.includes("近郊") || tag.includes("短途"))) {
    reasons.push("适合周末近郊短途安排");
  }

  if (hits.hitSelfDrive && (real.suitableFor.includes("自驾") || real.tags.some((tag) => tag.includes("自驾") || tag.includes("近郊") || tag.includes("短途")))) {
    reasons.push("适合自驾前往，节奏更灵活");
  }

  if (reasons.length === 0) {
    reasons.push(`匹配${real.tags.slice(0, 2).join("、") || "乡村休闲"}需求`);
  }

  return reasons.slice(0, 4);
}

function scoreRealVillage(real: RealVillageData, input: BuildPlanInput, text: string, hits: DemandHits, index: number) {
  let score = 0;

  real.matchKeywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      score += 12;
    }
  });

  real.tags.forEach((tag) => {
    if (text.includes(tag)) {
      score += 10;
    }
  });

  input.preference.companions.forEach((companion) => {
    real.suitableFor.forEach((target) => {
      if (companion.includes(target) || target.includes(companion)) {
        score += 10;
      }
    });
  });

  if (hits.hitElder || hits.hitEasy) {
    if (real.suitableFor.includes("老人") || real.tags.some((tag) => tag.includes("轻松") || tag.includes("慢游") || tag.includes("康养"))) {
      score += 15;
    }
  }

  if (hits.hitKid) {
    if (real.suitableFor.includes("亲子") || real.tags.some((tag) => tag.includes("亲子"))) {
      score += 15;
    }
  }

  if (hits.hitFood) {
    if (real.tags.some((tag) => tag.includes("农家菜"))) {
      score += 15;
    }
  }

  if (hits.hitPhoto) {
    if (real.tags.some((tag) => tag.includes("拍照") || tag.includes("风光"))) {
      score += 15;
    }
  }

  if (hits.hitWellness) {
    if (real.tags.some((tag) => tag.includes("康养") || tag.includes("放松"))) {
      score += 15;
    }
  }

  if (hits.hitCulture) {
    if (real.tags.some((tag) => tag.includes("研学") || tag.includes("文化") || tag.includes("传统"))) {
      score += 15;
    }
  }

  if (hits.hitShortTrip && real.tags.some((tag) => tag.includes("近郊") || tag.includes("短途"))) {
    score += 10;
  }

  if (hits.hitSelfDrive && (real.suitableFor.includes("自驾") || real.tags.some((tag) => tag.includes("自驾") || tag.includes("近郊") || tag.includes("短途")))) {
    score += 10;
  }

  if ((hits.hitElder || hits.hitEasy) && real.elderFriendly) {
    score += 10;
  }

  if ((hits.hitElder || hits.hitEasy) && real.intensity === "低") {
    score += 8;
  }

  if (hits.hitEasy && real.intensity === "高") {
    score -= 10;
  }

  if (hits.hitKid && real.kidFriendly) {
    score += 10;
  }

  if (hits.hitFood && real.foodFriendly) {
    score += 10;
  }

  if (hits.hitPhoto && real.photoFriendly) {
    score += 10;
  }

  if (hits.hitCulture && real.cultureFriendly) {
    score += 10;
  }

  if (hits.hitWellness && real.wellnessFriendly) {
    score += 10;
  }

  if ((hits.hitSelfDrive || hits.hitShortTrip) && real.selfDriveFriendly) {
    score += 10;
  }

  if (real.designations.length > 1) {
    score += 5;
  }

  return {
    village: real,
    score,
    reasons: buildRealReasons(real, hits),
    index
  };
}

function scoreToMatchScore(score: number): number {
  return clampMatchScore(88 + Math.min(8, Math.floor(score / 15)));
}

function buildRealSummary(real: RealVillageData, hits: DemandHits, reasonTags: string[]): string {
  const demandText = buildDemandText(hits);
  const arrangement = real.tags.includes("传统村落") || real.tags.includes("乡村文化")
    ? "慢步行、文化走看和短暂停留"
    : real.tags.includes("自然风光") || real.tags.includes("拍照出片")
      ? "看风景、拍照和轻量步行"
      : real.tags.includes("农家菜")
        ? "短途散步、农家菜和家庭休闲"
        : "轻松散步、休息和近郊慢游";

  return `你提到${demandText}。${real.name}更适合作为${real.tags.slice(0, 2).join("、")}目的地，匹配${reasonTags.join("、")}。建议按半日到一日安排，重点放在${arrangement}。`;
}

function toRealAlternative(real: RealVillageData, score: number, reasons: string[], hits: DemandHits): PlanAlternative {
  const reasonTags = buildReasonTags(real, hits);
  const focus = reasonTags[0] ?? real.tags[0] ?? "乡村休闲";
  const summary = `如果你更看重${real.tags.slice(0, 2).join("、")}，${real.name}也适合作为备选；它与${focus}需求有一定匹配，适合做周末乡村游的替代方案。`;

  return {
    id: real.id,
    name: real.name,
    city: real.city,
    rating: real.rating,
    tags: real.tags,
    description: real.description,
    distanceText: real.distanceText,
    summary,
    matchScore: scoreToMatchScore(score),
    reasonSummary: reasons[0] ?? summary
  };
}

async function getPlanSeedVillages(): Promise<RealVillageData[]> {
  const supabaseVillages = await getSupabaseVillages();
  if (supabaseVillages.length > 0) {
    return supabaseVillages;
  }

  return REAL_VILLAGES;
}

function isDeepSeekRequested(): boolean {
  return (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase() === "deepseek";
}

async function enhancePlanWithDeepSeek(input: BuildPlanInput, plan: PlanResult): Promise<PlanResult> {
  const enhancement = await generateDeepSeekPlanEnhancement(input, plan);
  if (!enhancement) {
    return isDeepSeekRequested() ? { ...plan, fallbackUsed: true } : plan;
  }

  return {
    ...plan,
    providerUsed: "deepseek",
    fallbackUsed: false,
    summary: enhancement.summary,
    reasonTags: enhancement.reasonTags,
    reasonSummary: enhancement.reasonSummary,
    travelTips: enhancement.travelTips
  };
}

async function buildPlanFromRealVillages(
  input: BuildPlanInput,
  metadata?: {
    inputText?: string;
    providerUsed?: "mock" | "deepseek" | "doubao";
    fallbackUsed?: boolean;
  }
): Promise<PlanResult | null> {
  const seedVillages = await getPlanSeedVillages();
  if (seedVillages.length === 0) {
    return null;
  }

  const inputText = metadata?.inputText ?? "";
  const text = buildPreferenceText(input, inputText);
  const hits = analyzeDemand(input, text);
  const ranked = seedVillages.map((village, index) => scoreRealVillage(village, input, text, hits, index)).sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.village.designations.length !== a.village.designations.length) {
      return b.village.designations.length - a.village.designations.length;
    }

    return a.index - b.index;
  });

  const top = ranked[0];
  const recommended = realToVillage(top.village);
  const fallbackSteps = buildDefaultSteps(recommended.name, recommended.hasFarmFood, recommended.hasStay);
  const matchScore = scoreToMatchScore(top.score);
  const reasonTags = buildReasonTags(top.village, hits);
  const reasonSummary = buildReasonSummary(hits, reasonTags);
  const alternatives = ranked.slice(1, 4).map((item) => toRealAlternative(item.village, item.score, item.reasons, hits));

  const rulePlan: PlanResult = {
    requestId: `plan_${Date.now()}`,
    generatedAt: new Date().toISOString(),
    preference: input.preference,
    inputText,
    providerUsed: "mock",
    fallbackUsed: Boolean(metadata?.fallbackUsed),
    recommended: toSafeVillage(recommended),
    alternatives,
    routeOptions: top.village.routeOptions,
    foods: top.village.foods,
    stays: top.village.stays,
    matchScore,
    reasons: top.reasons,
    reasonTags,
    reasonSummary,
    steps: sanitizeSteps(undefined, fallbackSteps),
    summary: buildRealSummary(top.village, hits, reasonTags)
  };

  return enhancePlanWithDeepSeek(input, rulePlan);
}

export async function buildPlanFromMock(
  input: BuildPlanInput,
  providerOutput?: ProviderPlanOutput,
  metadata?: {
    inputText?: string;
    providerUsed?: "mock" | "deepseek" | "doubao";
    fallbackUsed?: boolean;
  }
): Promise<PlanResult> {
  const realPlan = await buildPlanFromRealVillages(input, metadata);
  if (realPlan) {
    return realPlan;
  }

  const top = input.rankedVillages[0];
  if (!top) {
    throw new Error("NO_VILLAGE_FOUND");
  }

  const fallbackSteps = buildDefaultSteps(top.village.name, top.village.hasFarmFood, top.village.hasStay);
  const reasons = (providerOutput?.reasons?.length ? providerOutput.reasons : top.reasons).slice(0, 4);
  const inputText = metadata?.inputText ?? "";
  const normalizedMatchScore = clampMatchScore(top.matchScore);
  const alternativeMap = new Map<string, ReturnType<typeof toAlternative>>();
  input.rankedVillages.slice(1).forEach((item) => {
    alternativeMap.set(item.village.id, toAlternative(item.village, item.matchScore, item.reasonSummary));
  });
  fallbackVillages
    .filter((village) => village.id !== top.village.id)
    .forEach((village) => {
      if (!alternativeMap.has(village.id)) {
        alternativeMap.set(village.id, toAlternative(village));
      }
    });
  const alternatives = Array.from(alternativeMap.values()).slice(0, 3);

  const rulePlan: PlanResult = {
    requestId: `plan_${Date.now()}`,
    generatedAt: new Date().toISOString(),
    preference: input.preference,
    inputText,
    providerUsed: "mock",
    fallbackUsed: Boolean(metadata?.fallbackUsed),
    recommended: toSafeVillage(top.village),
    alternatives,
    routeOptions: buildRouteOptions(top.village),
    foods: buildFoods(input, inputText),
    stays: buildStays(top.village),
    matchScore: normalizedMatchScore,
    reasons,
    steps: sanitizeSteps(providerOutput?.steps, fallbackSteps),
    summary: providerOutput?.summary ?? buildSummary(top.village, input, inputText)
  };

  return enhancePlanWithDeepSeek(input, rulePlan);
}
