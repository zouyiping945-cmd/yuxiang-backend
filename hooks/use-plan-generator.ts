"use client";

import { useRef, useState } from "react";
import { villages } from "@/lib/mock-villages";
import type { PlanAlternative, PlanResult, PlanStatus, TravelPreference, Village } from "@/lib/types";

type PlanApiSuccess = {
  ok: true;
  data: PlanResult;
};

type PlanApiError = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
};

type GenerateOptions = {
  companions: string[];
  demands: string[];
  inputText: string;
  mode?: "generate" | "regenerate";
  excludeVillageIds?: string[];
  regeneratingHint?: string;
};

type LastRequestPayload = {
  companions: string[];
  demands: string[];
  inputText: string;
};

function buildPreference(payload: LastRequestPayload): TravelPreference {
  const inputText = payload.inputText.trim();
  const travelWithElders =
    payload.companions.includes("👨‍👩‍👧‍👦 带父母") ||
    inputText.includes("父母") ||
    inputText.includes("长辈");
  const travelWithKids =
    payload.companions.includes("👶 亲子遛娃") ||
    inputText.includes("亲子") ||
    inputText.includes("小孩") ||
    inputText.includes("孩子");
  const easyWalkRequired =
    payload.demands.includes("🌳 不爬山") ||
    inputText.includes("不爬山") ||
    inputText.includes("轻松") ||
    inputText.includes("慢游");
  const farmFoodPreferred =
    payload.demands.includes("🍲 吃农家菜") ||
    inputText.includes("农家菜") ||
    inputText.includes("地锅鸡") ||
    inputText.includes("美食");
  const needStay = inputText.includes("住") || inputText.includes("民宿") || inputText.includes("过夜");

  return {
    companions: payload.companions,
    demands: payload.demands,
    travelWithElders,
    travelWithKids,
    easyWalkRequired,
    farmFoodPreferred,
    needStay
  };
}

function findVillageById(id: string): Village | undefined {
  return villages.find((item) => item.id === id);
}

const fallbackVillage: Village = villages[0] ?? {
  id: "fallback-village",
  name: "推荐目的地",
  city: "郑州",
  tags: [],
  driveTimeMinutes: 0,
  suitableForElders: false,
  easyWalk: false,
  hasFarmFood: false,
  hasStay: false,
  coverImage: "",
  description: "",
  rating: "4.8",
  distanceText: ""
};

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeNumber(value: unknown, fallback = 88): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  const source = normalizeArray<unknown>(value, fallback);
  return source.filter((item): item is string => typeof item === "string");
}

function normalizeProviderUsed(value: unknown, fallback: PlanResult["providerUsed"] = "mock"): PlanResult["providerUsed"] {
  return value === "mock" || value === "deepseek" || value === "doubao" ? value : fallback;
}

function normalizePreference(value: unknown): TravelPreference {
  const source = value && typeof value === "object" ? (value as Partial<TravelPreference>) : {};

  return {
    companions: normalizeStringArray(source.companions),
    demands: normalizeStringArray(source.demands),
    travelWithElders: normalizeBoolean(source.travelWithElders),
    travelWithKids: normalizeBoolean(source.travelWithKids),
    easyWalkRequired: normalizeBoolean(source.easyWalkRequired),
    farmFoodPreferred: normalizeBoolean(source.farmFoodPreferred),
    needStay: normalizeBoolean(source.needStay)
  };
}

function normalizeVillage(value: unknown, fallback: Village = fallbackVillage): Village {
  const source = value && typeof value === "object" ? (value as Partial<Village>) : {};

  return {
    ...fallback,
    id: normalizeString(source.id, fallback.id),
    name: normalizeString(source.name, fallback.name),
    city: normalizeString(source.city, fallback.city),
    tags: normalizeStringArray(source.tags, fallback.tags),
    driveTimeMinutes: normalizeNumber(source.driveTimeMinutes, fallback.driveTimeMinutes),
    suitableForElders: normalizeBoolean(source.suitableForElders, fallback.suitableForElders),
    easyWalk: normalizeBoolean(source.easyWalk, fallback.easyWalk),
    hasFarmFood: normalizeBoolean(source.hasFarmFood, fallback.hasFarmFood),
    hasStay: normalizeBoolean(source.hasStay, fallback.hasStay),
    coverImage: normalizeString(source.coverImage, fallback.coverImage),
    description: normalizeString(source.description, fallback.description),
    rating: normalizeString(source.rating, fallback.rating),
    distanceText: normalizeString(source.distanceText, fallback.distanceText)
  };
}

function normalizeAlternatives(alternatives: unknown, fallback: PlanAlternative[] = []): PlanAlternative[] {
  const source = normalizeArray<PlanAlternative>(alternatives, fallback);

  return source.map((item) => ({
    ...item,
    id: normalizeString(item.id),
    name: normalizeString(item.name),
    city: normalizeString(item.city),
    rating: normalizeString(item.rating, "4.8"),
    tags: normalizeStringArray(item.tags),
    description: normalizeString(item.description),
    distanceText: normalizeString(item.distanceText),
    summary: normalizeString(item.summary),
    reasonSummary: normalizeString(item.reasonSummary),
    matchScore: normalizeNumber(item.matchScore, 88)
  }));
}

function normalizeMatchScore(value: unknown, fallback = 88): number {
  return normalizeNumber(value, fallback);
}

function normalizePlanResult(plan: PlanResult, fallback = 88): PlanResult {
  const source = plan as Partial<PlanResult>;
  const matchScore = normalizeNumber(source.matchScore, fallback);

  return {
    requestId: normalizeString(source.requestId, `plan_${Date.now()}`),
    generatedAt: normalizeString(source.generatedAt, new Date().toISOString()),
    preference: normalizePreference(source.preference),
    inputText: normalizeString(source.inputText),
    providerUsed: normalizeProviderUsed(source.providerUsed),
    fallbackUsed: normalizeBoolean(source.fallbackUsed),
    recommended: normalizeVillage(source.recommended),
    alternatives: normalizeAlternatives(source.alternatives),
    routeOptions: normalizeArray<PlanResult["routeOptions"][number]>(source.routeOptions),
    foods: normalizeArray<PlanResult["foods"][number]>(source.foods),
    stays: normalizeArray<PlanResult["stays"][number]>(source.stays),
    matchScore,
    reasons: normalizeStringArray(source.reasons),
    reasonTags: normalizeStringArray(source.reasonTags),
    reasonSummary: normalizeString(source.reasonSummary),
    steps: normalizeArray<PlanResult["steps"][number]>(source.steps),
    summary: normalizeString(source.summary)
  };
}

function normalizeResultUpdate(plan: PlanResult, fallback = 88): PlanResult {
  return normalizePlanResult(plan, fallback);
}

export function usePlanGenerator() {
  const [status, setStatus] = useState<PlanStatus>("idle");
  const [result, setResult] = useState<PlanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUserText, setLastUserText] = useState("");
  const [regeneratingHint, setRegeneratingHint] = useState("");

  const pendingThinkingTimer = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const lastRequestRef = useRef<LastRequestPayload | null>(null);
  const excludedIdsRef = useRef<string[]>([]);

  const clearThinkingTimer = () => {
    if (pendingThinkingTimer.current) {
      window.clearTimeout(pendingThinkingTimer.current);
      pendingThinkingTimer.current = null;
    }
  };

  const requestPlan = async (options: GenerateOptions) => {
    const mode = options.mode ?? "generate";
    const requestId = ++requestIdRef.current;
    clearThinkingTimer();
    setErrorMessage("");

    if (mode === "regenerate") {
      setStatus("regenerating");
      setRegeneratingHint(options.regeneratingHint ?? "正在切换推荐...");
    } else {
      setStatus("submitting");
      setRegeneratingHint("");
      pendingThinkingTimer.current = window.setTimeout(() => {
        if (requestIdRef.current === requestId) {
          setStatus("thinking");
        }
      }, 220);
    }

    const inputText = options.inputText.trim();
    const payloadForRef: LastRequestPayload = {
      companions: options.companions,
      demands: options.demands,
      inputText
    };
    lastRequestRef.current = payloadForRef;
    setLastUserText(inputText);

    const preference = buildPreference(payloadForRef);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...preference,
          inputText,
          excludeVillageIds: options.excludeVillageIds ?? []
        })
      });

      const payload = (await response.json()) as PlanApiSuccess | PlanApiError;
      if (!response.ok || !payload.ok) {
        const message =
          payload.ok === false
            ? payload.error?.message ?? "生成失败，请稍后重试"
            : "生成失败，请稍后重试";
        throw new Error(message);
      }

      if (requestIdRef.current !== requestId) {
        return;
      }

      setResult(normalizePlanResult(payload.data));
      setStatus("success");
      setRegeneratingHint("");
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setResult(null);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "生成失败，请稍后重试");
      setRegeneratingHint("");
    } finally {
      clearThinkingTimer();
    }
  };

  const generatePlan = async (options: Omit<GenerateOptions, "mode" | "excludeVillageIds">) => {
    excludedIdsRef.current = [];
    return requestPlan({
      ...options,
      mode: "generate",
      excludeVillageIds: []
    });
  };

  const switchRecommendation = async () => {
    if (!result) {
      return;
    }

    const alternatives = result.alternatives;
    if (alternatives.length > 0) {
      const next = alternatives[0];
      const village = findVillageById(next.id);

      if (village) {
        setStatus("regenerating");
        setRegeneratingHint("正在切换到备选推荐...");
        await new Promise((resolve) => {
          setTimeout(resolve, 320);
        });
        setResult((prev) => {
          if (!prev) {
            return prev;
          }

          const mergedReasons = normalizeStringArray([
            next.reasonSummary,
            ...normalizeStringArray(prev.reasons)
          ]).slice(0, 4);
          const fallbackMatchScore = normalizeMatchScore(prev.matchScore, 88);

          return normalizeResultUpdate({
            ...prev,
            recommended: village,
            matchScore: normalizeMatchScore(next.matchScore, fallbackMatchScore),
            summary: `已切换到备选推荐：${village.city}·${village.name}`,
            reasons: mergedReasons,
            alternatives: normalizeAlternatives(alternatives.slice(1))
          }, fallbackMatchScore);
        });
        setStatus("success");
        setRegeneratingHint("");
        return;
      }
    }

    const lastRequest = lastRequestRef.current;
    if (!lastRequest) {
      return;
    }

    const updatedExclude = Array.from(new Set([...excludedIdsRef.current, result.recommended.id]));
    excludedIdsRef.current = updatedExclude;

    return requestPlan({
      ...lastRequest,
      mode: "regenerate",
      excludeVillageIds: updatedExclude,
      regeneratingHint: "正在重新生成更多推荐..."
    });
  };

  return {
    status,
    result,
    errorMessage,
    lastUserText,
    regeneratingHint,
    generatePlan,
    switchRecommendation
  };
}
