import { NextResponse } from "next/server";
import { normalizePreference } from "@/lib/ai/normalize-preference";
import { rankVillages } from "@/lib/ai/rank-villages";
import { buildPlanFromMock } from "@/lib/ai/build-plan-from-mock";
import { getPlanProvider } from "@/lib/ai/providers";
import { villages as fallbackVillages } from "@/lib/mock-villages";
import type { PlanApiError, PlanApiSuccess, RankedVillage } from "@/lib/ai/types";
import type { PlanRequestPayload, PlanResult } from "@/lib/types";

const MOJIBAKE_PATTERN = /[\u00c0-\u00ff]/;

function repairMojibakeString(value: string): string {
  if (!MOJIBAKE_PATTERN.test(value)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

    return decoded.includes("�") ? value : decoded;
  } catch {
    return value;
  }
}

function repairMojibakeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return repairMojibakeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => repairMojibakeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, repairMojibakeValue(item)])
    );
  }

  return value;
}

function errorResponse(
  code: string,
  message: string,
  status: number
): NextResponse<PlanApiError> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message
      }
    },
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    }
  );
}

export async function POST(request: Request) {
  try {
    let rawBody: PlanRequestPayload = {};
    try {
      rawBody = (await request.json()) as PlanRequestPayload;
    } catch {
      rawBody = {};
    }

    const repairedBody = repairMojibakeValue(rawBody ?? {}) as PlanRequestPayload;
    const preference = normalizePreference(repairedBody ?? {});
    const inputText = typeof repairedBody.inputText === "string" ? repairedBody.inputText.trim() : "";
    const excludeVillageIds = Array.isArray(repairedBody.excludeVillageIds)
      ? repairedBody.excludeVillageIds.filter((item): item is string => typeof item === "string")
      : [];

    let rankedVillages: RankedVillage[] = rankVillages(fallbackVillages, preference, { excludeVillageIds });
    if (rankedVillages.length === 0) {
      rankedVillages = rankVillages(fallbackVillages, preference);
    }

    if (rankedVillages.length === 0) {
      return errorResponse("NO_VILLAGE_FOUND", "暂时未找到可推荐的村庄", 404);
    }

    let finalResult: PlanResult;
    const provider = getPlanProvider();
    let providerUsed: "mock" | "deepseek" | "doubao" = "mock";

    if (provider) {
      providerUsed = provider.name;
      try {
        const providerOutput = await provider.generate({
          preference,
          topCandidates: rankedVillages.slice(0, 3)
        });

        finalResult = await buildPlanFromMock(
          {
            preference,
            rankedVillages
          },
          providerOutput,
          {
            inputText,
            providerUsed,
            fallbackUsed: false
          }
        );
      } catch {
        finalResult = await buildPlanFromMock(
          {
            preference,
            rankedVillages
          },
          undefined,
          {
            inputText,
            providerUsed: "mock",
            fallbackUsed: true
          }
        );
      }
    } else {
      finalResult = await buildPlanFromMock(
        {
          preference,
          rankedVillages
        },
        undefined,
        {
          inputText,
          providerUsed: "mock",
          fallbackUsed: false
        }
      );
    }

    const response: PlanApiSuccess = {
      ok: true,
      data: repairMojibakeValue(finalResult) as typeof finalResult
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  } catch {
    return errorResponse("PLAN_BUILD_FAILED", "生成方案失败，请稍后重试", 500);
  }
}
