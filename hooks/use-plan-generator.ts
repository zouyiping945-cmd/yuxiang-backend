"use client";

import { useRef, useState } from "react";
import { villages } from "@/lib/mock-villages";
import type { PlanResult, PlanStatus, TravelPreference, Village } from "@/lib/types";

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

function normalizeMatchScore(value: unknown, fallback = 88): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeAlternatives(alternatives: PlanResult["alternatives"]): PlanResult["alternatives"] {
  return alternatives.map((item) => ({
    ...item,
    matchScore: normalizeMatchScore(item.matchScore, 88)
  }));
}

function normalizePlanResult(plan: PlanResult, fallback = 88): PlanResult {
  const matchScore = normalizeMatchScore(plan.matchScore, fallback);

  return {
    ...plan,
    matchScore,
    alternatives: normalizeAlternatives(plan.alternatives)
  };
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

          const mergedReasons = [next.reasonSummary, ...prev.reasons].filter(Boolean).slice(0, 4);
          const fallbackMatchScore = normalizeMatchScore(prev.matchScore, 88);

          return {
            ...prev,
            recommended: village,
            matchScore: normalizeMatchScore(next.matchScore, fallbackMatchScore),
            summary: `已切换到备选推荐：${village.city}·${village.name}`,
            reasons: mergedReasons,
            alternatives: normalizeAlternatives(alternatives.slice(1))
          };
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
