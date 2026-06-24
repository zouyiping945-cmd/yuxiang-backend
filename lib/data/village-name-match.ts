import type { RealVillageData } from "@/lib/types";

export type ExplicitVillageMatch = {
  village: RealVillageData;
  matchedBy: string;
};

const MANUAL_ALIAS_TO_VILLAGE_CODE: Record<string, string> = {
  樱桃沟: "zhengzhou_yingtaogou",
  樱桃沟社区: "zhengzhou_yingtaogou",
  郑州樱桃沟: "zhengzhou_yingtaogou",
  郑州市樱桃沟: "zhengzhou_yingtaogou",
  樱桃沟农家乐: "zhengzhou_yingtaogou"
};

function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\s+/g, "");
}

function readStringField(source: RealVillageData, key: string): string {
  const value = (source as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function buildVillageSearchTerms(village: RealVillageData): string[] {
  const terms = [
    village.id,
    village.name,
    village.fullName,
    village.village,
    village.city && village.name ? `${village.city}${village.name}` : "",
    village.city && village.village ? `${village.city}${village.village}` : "",
    readStringField(village, "village_code"),
    readStringField(village, "villageCode"),
    readStringField(village, "code"),
    readStringField(village, "village_name")
  ];

  return Array.from(new Set(terms.map(normalizeText).filter(Boolean)));
}

export function findExplicitVillageMatch(
  inputText: string | undefined,
  villages: RealVillageData[]
): ExplicitVillageMatch | null {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) {
    return null;
  }

  for (const [alias, villageCode] of Object.entries(MANUAL_ALIAS_TO_VILLAGE_CODE)) {
    if (!normalizedInput.includes(normalizeText(alias))) {
      continue;
    }

    const village = villages.find((item) => item.id === villageCode || readStringField(item, "village_code") === villageCode);
    if (village) {
      return {
        village,
        matchedBy: alias
      };
    }
  }

  for (const village of villages) {
    const terms = buildVillageSearchTerms(village)
      .filter((term) => term.length >= 2)
      .sort((a, b) => b.length - a.length);

    const matchedBy = terms.find((term) => normalizedInput.includes(term));
    if (matchedBy) {
      return {
        village,
        matchedBy
      };
    }
  }

  return null;
}
