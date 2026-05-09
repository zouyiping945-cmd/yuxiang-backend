import "server-only";
import type { PlanTextProvider, ProviderPlanInput, ProviderPlanOutput } from "@/lib/ai/types";

export class DoubaoProvider implements PlanTextProvider {
  readonly name = "doubao" as const;

  constructor(private readonly apiKey: string | undefined) {}

  async generate(input: ProviderPlanInput): Promise<ProviderPlanOutput> {
    if (!this.apiKey) {
      throw new Error("DOUBAO_API_KEY_MISSING");
    }

    const top = input.topCandidates[0];
    if (!top) {
      throw new Error("NO_CANDIDATES");
    }

    return {
      summary: `豆包占位结果：已根据筛选候选生成规划说明，推荐 ${top.village.city}·${top.village.name}。`,
      reasons: top.reasons.slice(0, 4),
      steps: [
        {
          time: "09:30",
          title: "交通出发",
          detail: "占位实现：后续接入真实 provider。",
          kind: "transport"
        },
        {
          time: "11:00",
          title: "村内活动",
          detail: "占位实现：仅对候选村庄生成文案。",
          kind: "activity"
        }
      ]
    };
  }
}
