import Link from "next/link";
import { Car, Flame, LocateFixed } from "lucide-react";
import { AiReasons } from "@/components/ai/ai-reasons";
import { AiUnderstanding } from "@/components/ai/ai-understanding";
import type { PlanResult } from "@/lib/types";

type AiResultCardProps = {
  result: PlanResult;
  onSwitchRecommendation: () => void;
  switching?: boolean;
};

export function AiResultCard({ result, onSwitchRecommendation, switching }: AiResultCardProps) {
  const walkStep = result.steps.find((step) => step.kind === "walk") ?? result.steps[0];
  const foodStep = result.steps.find((step) => step.kind === "food") ?? result.steps[1];

  return (
    <div className="fade-in-up flex items-start gap-2.5 pb-6">
      <img
        src="https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=10b981"
        alt="AI 助手"
        className="h-8 w-8 shrink-0 rounded-full bg-emerald-500 shadow-sm"
      />
      <div className="relative w-full">
        <AiUnderstanding preference={result.preference} inputText={result.inputText} />
        <AiReasons
          summary={result.summary}
          reasons={result.reasons}
          providerUsed={result.providerUsed}
          fallbackUsed={result.fallbackUsed}
          requestId={result.requestId}
          generatedAt={result.generatedAt}
        />
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
          <div className="relative h-44">
            <img
              src={result.recommended.coverImage}
              alt={result.recommended.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute right-3 top-3 rounded-lg border border-white/20 bg-black/40 px-2 py-1 text-center text-white backdrop-blur-md">
              <div className="text-[16px] font-bold text-orange-400">{result.matchScore}%</div>
              <div className="text-[8px]">AI 匹配度</div>
            </div>
            <div className="absolute bottom-3 left-4 right-4 text-white">
              <h3 className="mb-1 text-xl font-bold shadow-sm">{result.recommended.name}</h3>
              <div className="flex gap-1.5">
                {result.recommended.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded bg-emerald-500/80 px-2 py-0.5 text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-gray-50/50 p-4">
            <h4 className="mb-4 border-l-4 border-emerald-500 pl-2 text-[14px] font-bold text-gray-800">
              专属行程推荐
            </h4>
            <div className="relative space-y-5 before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-[2px] before:-translate-x-px before:bg-emerald-100">
              <div className="relative flex items-start gap-3">
                <span className="z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-4 ring-white">
                  <Car size={10} />
                </span>
                <div className="flex-1 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <h5 className="text-[13px] font-bold text-gray-800">
                    {walkStep?.time ?? "10:00"} | {walkStep?.title ?? "栈道慢步"}
                  </h5>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {walkStep?.detail ?? "步道平缓，适合轻松出行。"}
                  </p>
                </div>
              </div>
              <div className="relative flex items-start gap-3">
                <span className="z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-400 text-white shadow-sm ring-4 ring-white">
                  <Flame size={10} />
                </span>
                <div className="flex-1 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <h5 className="text-[13px] font-bold text-gray-800">
                    {foodStep?.time ?? "12:30"} | {foodStep?.title ?? "农家午餐"}
                  </h5>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {foodStep?.detail ?? "推荐本地农家菜，口味清淡。"}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onSwitchRecommendation}
                disabled={switching}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-[13px] text-gray-700 disabled:opacity-70"
              >
                {switching ? "切换中..." : "换一个推荐"}
              </button>
              <Link
                href={`/village/${result.recommended.id}`}
                className="flex flex-[2] items-center justify-center rounded-xl bg-emerald-500 py-2.5 text-[13px] font-bold text-white shadow-lg"
              >
                <LocateFixed size={14} className="mr-1.5" />
                去景区详情
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
