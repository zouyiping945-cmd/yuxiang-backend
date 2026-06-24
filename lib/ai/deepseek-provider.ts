import "server-only";
import type { BuildPlanInput } from "@/lib/ai/types";
import type { PlanResult, PlayHighlight, PlayPlace, RealVillageData } from "@/lib/types";

export type DeepSeekPlanEnhancement = {
  summary: string;
  reasonTags: string[];
  reasonSummary: string;
  travelTips: string[];
  playPlaces: PlayPlace[];
  playHighlights: PlayHighlight[];
};

export type AgentPolishResult = {
  polishedText: string;
  providerUsed: "deepseek" | "fallback";
  fallbackUsed: boolean;
  changed: boolean;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

const DEEPSEEK_TIMEOUT_MS = 12000;
const POLISH_TIMEOUT_MS = 8000;
const HIGHLIGHT_SOURCES: Array<NonNullable<PlayHighlight["source"]>> = [
  "profile",
  "route",
  "food",
  "stay",
  "ai"
];

function isDeepSeekEnabled(): boolean {
  return (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase() === "deepseek";
}

function getDeepSeekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat"
  };
}

function normalizeString(value: unknown, maxLength = 240): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeStringArray(value: unknown, limit: number, maxLength = 80): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item, maxLength))
    .filter((item) => item.length > 0)
    .slice(0, limit);
}

function normalizePlayHighlights(value: unknown): PlayHighlight[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): PlayHighlight | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const data = item as { title?: unknown; desc?: unknown; source?: unknown };
      const title = normalizeString(data.title, 28);
      const desc = normalizeString(data.desc, 90);
      const source: NonNullable<PlayHighlight["source"]> = typeof data.source === "string" && HIGHLIGHT_SOURCES.includes(data.source as NonNullable<PlayHighlight["source"]>)
        ? (data.source as NonNullable<PlayHighlight["source"]>)
        : "ai";

      return title && desc ? { title, desc, source } : null;
    })
    .filter((item): item is PlayHighlight => item !== null)
    .slice(0, 5);
}

function normalizePlayPlaces(value: unknown): PlayPlace[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): PlayPlace | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const data = item as {
        name?: unknown;
        category?: unknown;
        reason?: unknown;
      };
      const name = normalizeString(data.name, 60);
      const category = normalizeString(data.category, 32);
      const reason = normalizeString(data.reason, 120);

      if (!name || !reason) {
        return null;
      }

      return {
        name,
        category: category || undefined,
        address: null,
        distanceText: null,
        reason,
        source: "fallback"
      };
    })
    .filter((item): item is PlayPlace => item !== null)
    .slice(0, 6);
}

function normalizeEnhancement(raw: unknown): DeepSeekPlanEnhancement | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as {
    summary?: unknown;
    reasonTags?: unknown;
    reasonSummary?: unknown;
    travelTips?: unknown;
    playPlaces?: unknown;
    playHighlights?: unknown;
  };

  const summary = normalizeString(data.summary, 180);
  const reasonSummary = normalizeString(data.reasonSummary, 120);
  const reasonTags = normalizeStringArray(data.reasonTags, 5, 20);
  const travelTips = normalizeStringArray(data.travelTips, 4, 70);
  const playPlaces = normalizePlayPlaces(data.playPlaces);
  const playHighlights = normalizePlayHighlights(data.playHighlights);

  if (!summary || !reasonSummary || reasonTags.length === 0) {
    return null;
  }

  return {
    summary,
    reasonTags,
    reasonSummary,
    travelTips,
    playPlaces,
    playHighlights
  };
}

async function requestDeepSeekJson(
  messages: ChatMessage[],
  options: {
    timeoutMs: number;
    temperature: number;
    maxTokens: number;
    logPrefix: string;
  }
): Promise<unknown | null> {
  const config = getDeepSeekConfig();
  if (!config) {
    console.warn(`[${options.logPrefix}] fallback: DEEPSEEK_API_KEY is missing.`);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format: { type: "json_object" },
        messages
      })
    });

    if (!response.ok) {
      console.warn(`[${options.logPrefix}] fallback: HTTP ${response.status}.`);
      return null;
    }

    const payload = (await response.json()) as DeepSeekResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[${options.logPrefix}] fallback: empty response content.`);
      return null;
    }

    try {
      return JSON.parse(content);
    } catch {
      console.warn(`[${options.logPrefix}] fallback: JSON parse failed.`);
      return null;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.warn(`[${options.logPrefix}] fallback: ${reason}.`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildKnowledgePayload(plan: PlanResult, knowledgeContext?: RealVillageData, amapPlayPois: PlayPlace[] = []) {
  return {
    recommended: {
      id: plan.recommended.id,
      name: plan.recommended.name,
      city: plan.recommended.city,
      tags: plan.recommended.tags,
      description: plan.recommended.description,
      rating: plan.recommended.rating,
      distanceText: plan.recommended.distanceText
    },
    structuredVillageData: knowledgeContext
      ? {
          id: knowledgeContext.id,
          name: knowledgeContext.name,
          fullName: knowledgeContext.fullName,
          city: knowledgeContext.city,
          district: knowledgeContext.district,
          town: knowledgeContext.town,
          village: knowledgeContext.village,
          tags: knowledgeContext.tags,
          suitableFor: knowledgeContext.suitableFor,
          matchKeywords: knowledgeContext.matchKeywords,
          description: knowledgeContext.description,
          designations: knowledgeContext.designations.map((item) => ({
            type: item.type,
            sourceName: item.sourceName,
            note: item.note
          })),
          routeOptions: knowledgeContext.routeOptions,
          foods: knowledgeContext.foods,
          stays: knowledgeContext.stays,
          recommendedTransport: knowledgeContext.recommendedTransport,
          visitDuration: knowledgeContext.visitDuration,
          intensity: knowledgeContext.intensity,
          dataReviewStatus: knowledgeContext.dataReviewStatus,
          sourceConfidence: knowledgeContext.sourceConfidence,
          dataStatus: knowledgeContext.dataStatus
        }
      : null,
    alternatives: plan.alternatives.map((item) => ({
      id: item.id,
      name: item.name,
      city: item.city,
      tags: item.tags,
      description: item.description,
      distanceText: item.distanceText,
      matchScore: item.matchScore
    })),
    routeOptions: plan.routeOptions,
    foods: plan.foods,
    stays: plan.stays,
    amapPlayPois: amapPlayPois.map((item) => ({
      name: item.name,
      category: item.category,
      address: item.address,
      distanceText: item.distanceText,
      source: item.source
    })),
    existingPlayHighlights: plan.playHighlights ?? []
  };
}

function buildMessages(
  input: BuildPlanInput,
  plan: PlanResult,
  knowledgeContext?: RealVillageData,
  amapPlayPois: PlayPlace[] = []
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是乡村旅游规划助手，只负责基于后端已经选出的方案进行整理和解释。",
        "你只能基于 user 消息里的真实候选地点 amapPlayPois、structuredVillageData、recommended、routeOptions、foods、stays 输出内容。",
        "你只能基于传入的真实候选地点生成“这里可以怎么玩”。严禁编造未提供的景点、商家、民宿、餐厅或活动名称。",
        "playPlaces.name 必须逐字来自 amapPlayPois 候选列表；如果候选地点不足，请基于已有村庄 tags 和路线建议输出 playHighlights 体验类型，但不要伪造具体名称。",
        "不要更换 recommended.id，不要新增候选村庄。",
        "输出必须是 JSON，不要 markdown，不要额外解释。",
        "JSON schema: {\"summary\":\"80-140字方案摘要\",\"reasonTags\":[\"3-5个短标签\"],\"reasonSummary\":\"一句话匹配解释\",\"travelTips\":[\"2-4条提醒\"],\"playPlaces\":[{\"name\":\"候选列表中真实存在的地点名\",\"category\":\"亲子活动 / 农家乐 / 采摘 / 文化体验 / 餐饮休闲\",\"reason\":\"为什么适合用户需求\"}],\"playHighlights\":[{\"title\":\"体验类型\",\"desc\":\"仅在没有足够真实地点时使用\",\"source\":\"profile|route|food|stay|ai\"}]}"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          inputText: plan.inputText,
          companions: input.preference.companions,
          demands: input.preference.demands,
          knowledge: buildKnowledgePayload(plan, knowledgeContext, amapPlayPois),
          constraints: [
            "playPlaces 最多输出 4-6 条",
            "playPlaces.name 必须从 amapPlayPois.name 中选择，不能改名、扩写或新增",
            "address 和 distanceText 不需要输出，后端会从原始候选补回",
            "如果 amapPlayPois 为空或不足，只输出 playHighlights 体验类型，不要伪造具体地点",
            "不要输出不存在的店铺、景区、天气、地图或活动名称"
          ]
        },
        null,
        2
      )
    }
  ];
}

export async function generateDeepSeekPlanEnhancement(
  input: BuildPlanInput,
  plan: PlanResult,
  knowledgeContext?: RealVillageData,
  amapPlayPois: PlayPlace[] = []
): Promise<DeepSeekPlanEnhancement | null> {
  if (!isDeepSeekEnabled()) {
    return null;
  }

  const parsed = await requestDeepSeekJson(buildMessages(input, plan, knowledgeContext, amapPlayPois), {
    timeoutMs: DEEPSEEK_TIMEOUT_MS,
    temperature: 0.32,
    maxTokens: 1000,
    logPrefix: "deepseek-agent"
  });

  const enhancement = normalizeEnhancement(parsed);
  if (!enhancement) {
    console.warn("[deepseek-agent] fallback: invalid JSON shape.");
    return null;
  }

  console.info("[deepseek-agent] success.");
  return enhancement;
}

function buildPolishMessages(inputText: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是乡村旅行 AI Agent 的需求润色器。",
        "你的任务是把用户的口语化需求整理成更适合乡村旅游规划 Agent 理解的输入，不是营销文案。",
        "必须保留用户原始意图，并尽量明确：出行对象、出行节奏、餐饮偏好、体力约束、目的地偏好。",
        "如果原文已经清楚，也要稍微整理为更完整的规划输入，不要原样返回。",
        "不要新增用户没有表达的硬性要求。",
        "不要编造具体城市、村庄、景点、店铺、价格、天气或不存在的活动。",
        "控制在 60-100 个中文字符左右，用自然中文一句话或两句话。",
        "语气自然、清晰、可执行，不要营销腔。",
        "输出必须是 JSON，不要 markdown。",
        "JSON schema: {\"polishedText\":\"润色后的规划需求\"}",
        "示例：原文“周末带父母出去走走，想吃农家菜，不想太累”可整理为“周末想带父母进行一次轻松的近郊乡村游，希望行程不要太赶、步行强度低，可以品尝地道农家菜，并适合半日到一日的短途停留。”"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({ inputText }, null, 2)
    }
  ];
}

function logAgentPolishFallback(reason: string) {
  console.warn(`agent-polish fallback reason: ${reason}`);
}

function isTooSimilarText(original: string, polished: string): boolean {
  const normalize = (value: string) => value.replace(/[\s，。；、,.!?！？]/g, "");
  const originalText = normalize(original);
  const polishedText = normalize(polished);

  if (!originalText || !polishedText) {
    return true;
  }

  return originalText === polishedText || polishedText.length <= originalText.length + 6;
}

function includesAnyText(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function buildStructuredPolishFromOriginal(original: string): string {
  const clauses: string[] = [];
  const text = original.trim();
  const timeText = includesAnyText(text, ["周末", "周六", "周日"])
    ? "周末"
    : includesAnyText(text, ["半日", "一天", "一日"])
      ? "半日到一日内"
      : "";
  const companionText = includesAnyText(text, ["父母", "爸妈", "老人", "长辈"])
    ? "带父母或长辈"
    : includesAnyText(text, ["亲子", "孩子", "小孩"])
      ? "带孩子进行亲子出行"
      : includesAnyText(text, ["朋友", "同学", "同事"])
        ? "和朋友同行"
        : "";

  const leadText = [timeText, companionText].filter(Boolean).join("，");

  if (leadText) {
    clauses.push(`${leadText}想进行一次乡村旅行`);
  } else {
    clauses.push("希望根据当前需求规划一次乡村旅行");
  }

  if (includesAnyText(text, ["不想太累", "不累", "轻松", "慢游", "少走路"])) {
    clauses.push("行程不要太赶，步行强度尽量低");
  }

  if (includesAnyText(text, ["农家菜", "家常菜", "吃饭", "美食"])) {
    clauses.push("希望能品尝本地农家菜或家常风味");
  }

  if (includesAnyText(text, ["拍照", "出片", "风景", "风光"])) {
    clauses.push("同时适合看风景和拍照停留");
  }

  if (includesAnyText(text, ["住一晚", "住宿", "民宿", "过夜"])) {
    clauses.push("可以考虑住一晚并放慢节奏");
  }

  if (includesAnyText(text, ["近郊", "短途", "半日", "一天", "一日", "周末"])) {
    clauses.push("偏好近郊短途或半日到一日停留");
  }

  if (clauses.length === 1) {
    clauses.push(`请围绕“${text}”匹配合适的村庄、路线节奏和吃住建议`);
  }

  return `${clauses.join("，")}。`;
}

export async function polishAgentInput(inputText: string): Promise<AgentPolishResult> {
  const original = inputText.trim();
  if (!original) {
    return {
      polishedText: "",
      providerUsed: "fallback",
      fallbackUsed: true,
      changed: false
    };
  }

  if (!getDeepSeekConfig()) {
    logAgentPolishFallback("DEEPSEEK_API_KEY is missing");
    return {
      polishedText: original,
      providerUsed: "fallback",
      fallbackUsed: true,
      changed: false
    };
  }

  const parsed = await requestDeepSeekJson(buildPolishMessages(original), {
    timeoutMs: POLISH_TIMEOUT_MS,
    temperature: 0.2,
    maxTokens: 420,
    logPrefix: "agent-polish"
  });

  if (!parsed || typeof parsed !== "object") {
    logAgentPolishFallback("deepseek response unavailable");
    return {
      polishedText: original,
      providerUsed: "fallback",
      fallbackUsed: true,
      changed: false
    };
  }

  const polishedText = normalizeString((parsed as { polishedText?: unknown }).polishedText, 180);
  if (!polishedText) {
    logAgentPolishFallback("invalid polishedText");
    return {
      polishedText: original,
      providerUsed: "fallback",
      fallbackUsed: true,
      changed: false
    };
  }

  const finalText = isTooSimilarText(original, polishedText)
    ? buildStructuredPolishFromOriginal(original)
    : polishedText;
  const changed = finalText.trim() !== original;

  console.info("agent-polish deepseek success");

  return {
    polishedText: finalText,
    providerUsed: "deepseek",
    fallbackUsed: false,
    changed
  };
}
