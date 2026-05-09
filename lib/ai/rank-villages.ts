import type { TravelPreference, Village } from "@/lib/types";
import type { RankedVillage } from "@/lib/ai/types";

function scoreVillage(village: Village, preference: TravelPreference) {
  let score = 60;
  const reasons: string[] = [];

  if (preference.travelWithElders) {
    if (village.suitableForElders) {
      score += 16;
      reasons.push("长辈友好");
    } else {
      score -= 16;
    }
  }

  if (preference.travelWithKids && village.easyWalk) {
    score += 8;
    reasons.push("亲子行走负担低");
  }

  if (preference.easyWalkRequired) {
    if (village.easyWalk) {
      score += 14;
      reasons.push("步道平缓");
    } else {
      score -= 14;
    }
  }

  if (preference.farmFoodPreferred) {
    if (village.hasFarmFood) {
      score += 10;
      reasons.push("可安排农家菜");
    } else {
      score -= 10;
    }
  }

  if (preference.needStay) {
    if (village.hasStay) {
      score += 10;
      reasons.push("可住一晚");
    } else {
      score -= 8;
    }
  }

  reasons.push(`车程约 ${village.driveTimeMinutes} 分钟`);

  return {
    matchScore: Math.max(1, Math.min(99, score)),
    reasons
  };
}

function baseFilter(village: Village, preference: TravelPreference) {
  if (preference.easyWalkRequired && !village.easyWalk) {
    return false;
  }
  if (preference.travelWithElders && !village.suitableForElders) {
    return false;
  }
  if (preference.needStay && !village.hasStay) {
    return false;
  }

  return true;
}

type RankOptions = {
  excludeVillageIds?: string[];
};

export function rankVillages(
  villageList: Village[],
  preference: TravelPreference,
  options?: RankOptions
): RankedVillage[] {
  const excluded = new Set((options?.excludeVillageIds ?? []).filter(Boolean));
  const availableVillages = villageList.filter((village) => !excluded.has(village.id));
  if (availableVillages.length === 0) {
    return [];
  }

  const filtered = availableVillages.filter((village) => baseFilter(village, preference));
  const candidates = filtered.length > 0 ? filtered : availableVillages;
  const candidateIdSet = new Set(candidates.map((item) => item.id));
  const supplements = availableVillages.filter((village) => !candidateIdSet.has(village.id));
  const mergedCandidates = [...candidates, ...supplements];

  return mergedCandidates
    .map((village) => {
      const scored = scoreVillage(village, preference);

      return {
        village,
        matchScore: scored.matchScore,
        reasons: scored.reasons,
        reasonSummary: scored.reasons.slice(0, 2).join("，")
      };
    })
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }

      return a.village.driveTimeMinutes - b.village.driveTimeMinutes;
    });
}
