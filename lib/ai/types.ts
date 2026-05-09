import type { PlanResult, PlanStep, TravelPreference, Village } from "@/lib/types";

export type RankedVillage = {
  village: Village;
  matchScore: number;
  reasons: string[];
  reasonSummary: string;
};

export type BuildPlanInput = {
  preference: TravelPreference;
  rankedVillages: RankedVillage[];
};

export type ProviderPlanInput = {
  preference: TravelPreference;
  topCandidates: RankedVillage[];
};

export type ProviderPlanOutput = {
  summary: string;
  reasons: string[];
  steps: PlanStep[];
};

export type PlanApiSuccess = {
  ok: true;
  data: PlanResult;
};

export type PlanApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export interface PlanTextProvider {
  readonly name: "mock" | "deepseek" | "doubao";
  /**
   * Provider only generates文案内容（summary/reasons/steps）.
   * 不能返回新的村庄ID，候选村庄只能来自 topCandidates。
   */
  generate(input: ProviderPlanInput): Promise<ProviderPlanOutput>;
}
