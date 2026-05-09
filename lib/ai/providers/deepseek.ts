import "server-only";
import type { PlanTextProvider, ProviderPlanInput, ProviderPlanOutput } from "@/lib/ai/types";

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string;
  }>;
};

const STEP_KIND_SET = new Set(["walk", "food", "stay", "photo", "activity", "transport"]);

function buildPrompt(input: ProviderPlanInput) {
  const candidates = input.topCandidates.map((candidate, index) => ({
    rank: index + 1,
    id: candidate.village.id,
    name: candidate.village.name,
    city: candidate.village.city,
    tags: candidate.village.tags,
    driveTimeMinutes: candidate.village.driveTimeMinutes,
    suitableForElders: candidate.village.suitableForElders,
    easyWalk: candidate.village.easyWalk,
    hasFarmFood: candidate.village.hasFarmFood,
    hasStay: candidate.village.hasStay,
    description: candidate.village.description,
    matchScore: candidate.matchScore
  }));

  return {
    system: `You are a travel-planning text generator.
Output MUST be valid json only.
You can only use the provided topCandidates and cannot invent or introduce any new village.
Return JSON with this schema:
{
  "summary": "string",
  "reasons": ["string", "string"],
  "steps": [
    { "time": "HH:mm", "title": "string", "detail": "string", "kind": "walk|food|stay|photo|activity|transport" }
  ]
}`,
    user: JSON.stringify(
      {
        task: "根据用户偏好和候选村庄，生成精炼中文文案",
        constraint: "只能基于 topCandidates 输出文案，不得创建新村庄",
        preference: input.preference,
        topCandidates: candidates
      },
      null,
      2
    )
  };
}

function normalizeProviderOutput(raw: unknown): ProviderPlanOutput {
  if (!raw || typeof raw !== "object") {
    throw new Error("DEEPSEEK_INVALID_JSON");
  }

  const data = raw as {
    summary?: unknown;
    reasons?: unknown;
    steps?: unknown;
  };

  const summary = typeof data.summary === "string" ? data.summary.trim() : "";
  const reasons = Array.isArray(data.reasons)
    ? data.reasons.filter((item): item is string => typeof item === "string").slice(0, 6)
    : [];
  const steps = Array.isArray(data.steps)
    ? data.steps
        .map((step) => {
          if (!step || typeof step !== "object") {
            return null;
          }

          const normalized = step as {
            time?: unknown;
            title?: unknown;
            detail?: unknown;
            kind?: unknown;
          };

          if (
            typeof normalized.time !== "string" ||
            typeof normalized.title !== "string" ||
            typeof normalized.detail !== "string" ||
            typeof normalized.kind !== "string" ||
            !STEP_KIND_SET.has(normalized.kind)
          ) {
            return null;
          }

          return {
            time: normalized.time,
            title: normalized.title,
            detail: normalized.detail,
            kind: normalized.kind as ProviderPlanOutput["steps"][number]["kind"]
          };
        })
        .filter((item): item is ProviderPlanOutput["steps"][number] => item !== null)
    : [];

  if (!summary) {
    throw new Error("DEEPSEEK_EMPTY_SUMMARY");
  }
  if (reasons.length === 0) {
    throw new Error("DEEPSEEK_EMPTY_REASONS");
  }
  if (steps.length === 0) {
    throw new Error("DEEPSEEK_EMPTY_STEPS");
  }

  return {
    summary,
    reasons,
    steps
  };
}

export class DeepSeekProvider implements PlanTextProvider {
  readonly name = "deepseek" as const;

  constructor(private readonly apiKey: string | undefined) {}

  async generate(input: ProviderPlanInput): Promise<ProviderPlanOutput> {
    if (!this.apiKey) {
      throw new Error("DEEPSEEK_API_KEY_MISSING");
    }

    if (!input.topCandidates[0]) {
      throw new Error("NO_CANDIDATES");
    }

    const prompt = buildPrompt(input);
    const endpoint = `${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`;
    const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: prompt.system
          },
          {
            role: "user",
            content: prompt.user
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`DEEPSEEK_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as DeepSeekResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("DEEPSEEK_EMPTY_CONTENT");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("DEEPSEEK_JSON_PARSE_FAILED");
    }

    return normalizeProviderOutput(parsed);
  }
}
