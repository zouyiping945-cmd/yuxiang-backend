import "server-only";
import type { BuildPlanInput } from "@/lib/ai/types";
import type { PlanResult } from "@/lib/types";

export type DeepSeekPlanEnhancement = {
  summary: string;
  reasonTags: string[];
  reasonSummary: string;
  travelTips: string[];
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const DEEPSEEK_TIMEOUT_MS = 12000;

function isDeepSeekEnabled(): boolean {
  return (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase() === "deepseek";
}

function normalizeStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, limit);
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
  };

  const summary = typeof data.summary === "string" ? data.summary.trim() : "";
  const reasonSummary = typeof data.reasonSummary === "string" ? data.reasonSummary.trim() : "";
  const reasonTags = normalizeStringArray(data.reasonTags, 5);
  const travelTips = normalizeStringArray(data.travelTips, 4);

  if (!summary || !reasonSummary || reasonTags.length === 0) {
    return null;
  }

  return {
    summary,
    reasonTags,
    reasonSummary,
    travelTips
  };
}

function buildMessages(input: BuildPlanInput, plan: PlanResult) {
  return [
    {
      role: "system",
      content: [
        "你是一个乡村旅游规划智能体。",
        "你只能基于后端提供的候选村庄生成推荐解释。",
        "不要编造不存在的村庄、商家、价格、路线。",
        "如果信息不确定，用“建议提前确认”。",
        "输出必须是 JSON。",
        "不要输出 markdown。",
        "不要输出多余解释。",
        "JSON schema: {\"summary\":\"80-140字推荐理由\",\"reasonTags\":[\"3-5个标签\"],\"reasonSummary\":\"一句话匹配解释\",\"travelTips\":[\"2-4条提示\"]}"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          inputText: plan.inputText,
          companions: input.preference.companions,
          demands: input.preference.demands,
          recommended: {
            id: plan.recommended.id,
            name: plan.recommended.name,
            city: plan.recommended.city,
            tags: plan.recommended.tags,
            description: plan.recommended.description,
            rating: plan.recommended.rating,
            distanceText: plan.recommended.distanceText
          },
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
          constraint: "recommended 和 alternatives 均由后端规则/数据库提供。你不能更换 recommended.id，也不能新增候选村庄。"
        },
        null,
        2
      )
    }
  ];
}

export async function generateDeepSeekPlanEnhancement(
  input: BuildPlanInput,
  plan: PlanResult
): Promise<DeepSeekPlanEnhancement | null> {
  if (!isDeepSeekEnabled()) {
    return null;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[deepseek-agent] fallback: DEEPSEEK_API_KEY is missing.");
    return null;
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: buildMessages(input, plan)
      })
    });

    if (!response.ok) {
      console.warn(`[deepseek-agent] fallback: HTTP ${response.status}.`);
      return null;
    }

    const payload = (await response.json()) as DeepSeekResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.warn("[deepseek-agent] fallback: empty response content.");
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn("[deepseek-agent] fallback: JSON parse failed.");
      return null;
    }

    const enhancement = normalizeEnhancement(parsed);
    if (!enhancement) {
      console.warn("[deepseek-agent] fallback: invalid JSON shape.");
      return null;
    }

    console.info("[deepseek-agent] success.");
    return enhancement;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.warn(`[deepseek-agent] fallback: ${reason}.`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
