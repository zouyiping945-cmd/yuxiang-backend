import type { TravelPreference } from "@/lib/types";

type RawPreference = Partial<TravelPreference> & {
  companions?: unknown;
  demands?: unknown;
  inputText?: unknown;
};

export function normalizePreference(input: RawPreference): TravelPreference {
  const companions = Array.isArray(input.companions)
    ? input.companions.filter((item): item is string => typeof item === "string")
    : [];
  const demands = Array.isArray(input.demands)
    ? input.demands.filter((item): item is string => typeof item === "string")
    : [];
  const inputText = typeof input.inputText === "string" ? input.inputText : "";

  const hasEldersTag = companions.some((item) => item.includes("父母") || item.includes("长辈"));
  const hasKidsTag = companions.some((item) => item.includes("亲子") || item.includes("遛娃"));
  const hasEasyWalkTag = demands.some((item) => item.includes("不爬山") || item.includes("轻松"));
  const hasFarmFoodTag = demands.some((item) => item.includes("农家菜") || item.includes("美食"));
  const hasStayTag = demands.some((item) => item.includes("住") || item.includes("民宿"));
  const textNeedsElders = inputText.includes("父母") || inputText.includes("长辈");
  const textNeedsKids =
    inputText.includes("亲子") || inputText.includes("遛娃") || inputText.includes("小孩");
  const textNeedsEasyWalk = inputText.includes("不爬山") || inputText.includes("轻松");
  const textNeedsFarmFood = inputText.includes("农家菜") || inputText.includes("美食");
  const textNeedsStay = inputText.includes("民宿") || inputText.includes("住") || inputText.includes("过夜");

  return {
    companions,
    demands,
    travelWithElders: Boolean(input.travelWithElders) || hasEldersTag || textNeedsElders,
    travelWithKids: Boolean(input.travelWithKids) || hasKidsTag || textNeedsKids,
    easyWalkRequired: Boolean(input.easyWalkRequired) || hasEasyWalkTag || textNeedsEasyWalk,
    farmFoodPreferred: Boolean(input.farmFoodPreferred) || hasFarmFoodTag || textNeedsFarmFood,
    needStay: Boolean(input.needStay) || hasStayTag || textNeedsStay
  };
}
