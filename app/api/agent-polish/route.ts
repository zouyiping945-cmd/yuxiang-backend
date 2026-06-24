import { NextResponse } from "next/server";
import { polishAgentInput } from "@/lib/ai/deepseek-provider";

export const runtime = "nodejs";

type PolishRequestBody = {
  inputText?: unknown;
  selectedTags?: unknown;
  preference?: unknown;
};

const TAG_RULES: Array<{
  tag: string;
  required: RegExp;
  append: string;
}> = [
  { tag: "带父母", required: /父母|长辈|老人/, append: "同行对象为带父母或长辈同行" },
  { tag: "亲子短途", required: /亲子|孩子|儿童/, append: "适合亲子短途出行" },
  { tag: "不想太累", required: /轻松|低强度|不赶|不太累|舒缓/, append: "行程节奏轻松、步行强度低" },
  { tag: "农家菜", required: /农家菜/, append: "希望品尝当地农家菜" },
  { tag: "拍照出片", required: /拍照|出片/, append: "希望安排适合拍照出片的乡村体验" },
  { tag: "住一晚", required: /住一晚|过夜|住宿/, append: "可安排住一晚或过夜停留" },
  { tag: "周末近郊", required: /周末|近郊/, append: "偏好周末近郊短途" },
  { tag: "轻松慢游", required: /轻松|慢游|慢节奏|舒缓/, append: "偏好轻松慢游" }
];

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function stripEnding(text: string) {
  return text.trim().replace(/[。！？；;,.，\s]+$/g, "");
}

function appendClause(text: string, clause: string) {
  const base = stripEnding(text);
  if (!base) return `${clause}。`;
  return `${base}，${clause}。`;
}

function buildRuleBasedPolish(inputText: string, selectedTags: string[]) {
  let text = stripEnding(inputText) || "计划进行一次乡村旅行";

  for (const rule of TAG_RULES) {
    if (selectedTags.includes(rule.tag) && !rule.required.test(text)) {
      text = appendClause(text, rule.append);
    }
  }

  return text.endsWith("。") ? text : `${text}。`;
}

function validatePolishedTextAgainstTags(polishedText: string, selectedTags: string[], inputText: string) {
  let text = polishedText.trim() || buildRuleBasedPolish(inputText, selectedTags);
  const hasElderTag = selectedTags.includes("带父母");
  const inputExplicitPersonal = /个人|独自|单人/.test(inputText);

  if (hasElderTag && !inputExplicitPersonal) {
    text = text
      .replace(/个人或小团体/g, "带父母或长辈同行")
      .replace(/个人出行/g, "带父母或长辈同行")
      .replace(/独自出行/g, "带父母同行")
      .replace(/单人出行/g, "带父母同行");
  }

  for (const rule of TAG_RULES) {
    if (selectedTags.includes(rule.tag) && !rule.required.test(text)) {
      text = appendClause(text, rule.append);
    }
  }

  return text.endsWith("。") || text.endsWith("！") || text.endsWith("？") ? text : `${text}。`;
}

export async function POST(request: Request) {
  let inputText = "";
  let selectedTags: string[] = [];

  try {
    const body = (await request.json()) as PolishRequestBody;
    inputText = typeof body.inputText === "string" ? body.inputText.trim() : "";
    selectedTags = normalizeTags(body.selectedTags);

    if (!inputText) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            polishedText: "",
            providerUsed: "fallback",
            fallbackUsed: true,
            changed: false
          }
        },
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        }
      );
    }

    const result = await polishAgentInput(inputText, {
      selectedTags,
      preference: body.preference
    });
    const rawPolishedText = result.polishedText || inputText;
    const polishedText = validatePolishedTextAgainstTags(
      result.fallbackUsed ? buildRuleBasedPolish(inputText, selectedTags) : rawPolishedText,
      selectedTags,
      inputText
    );
    const changed = polishedText.trim() !== inputText.trim();

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...result,
          polishedText,
          changed
        }
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown route error";
    console.warn(`agent-polish fallback reason: ${reason}`);
    const polishedText = validatePolishedTextAgainstTags(buildRuleBasedPolish(inputText, selectedTags), selectedTags, inputText);

    return NextResponse.json(
      {
        ok: true,
        data: {
          polishedText,
          providerUsed: "fallback",
          fallbackUsed: true,
          changed: polishedText.trim() !== inputText.trim()
        }
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  }
}
