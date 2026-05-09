import "server-only";
import type { PlanTextProvider } from "@/lib/ai/types";
import { DeepSeekProvider } from "@/lib/ai/providers/deepseek";
import { DoubaoProvider } from "@/lib/ai/providers/doubao";

export function getPlanProvider(): PlanTextProvider | null {
  const provider = (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase();

  if (provider === "deepseek") {
    return new DeepSeekProvider(process.env.DEEPSEEK_API_KEY);
  }

  if (provider === "doubao") {
    return new DoubaoProvider(process.env.DOUBAO_API_KEY);
  }

  return null;
}
