import { NextResponse } from "next/server";
import { polishAgentInput } from "@/lib/ai/deepseek-provider";

export const runtime = "nodejs";

type PolishRequestBody = {
  inputText?: unknown;
};

export async function POST(request: Request) {
  let inputText = "";

  try {
    const body = (await request.json()) as PolishRequestBody;
    inputText = typeof body.inputText === "string" ? body.inputText.trim() : "";

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

    const result = await polishAgentInput(inputText);
    const polishedText = result.polishedText || inputText;
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

    return NextResponse.json(
      {
        ok: true,
        data: {
          polishedText: inputText,
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
}
