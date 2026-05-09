"use client";

import { SlidersHorizontal, Sparkles } from "lucide-react";
import { TagButton } from "@/components/ui/tag-button";
import type { PlanStatus } from "@/lib/types";

type AiPreferenceFormProps = {
  peopleTags: string[];
  selectedPeople: string[];
  onTogglePeople: (value: string) => void;
  demandTags: string[];
  selectedDemands: string[];
  onToggleDemand: (value: string) => void;
  onGenerate: () => void;
  status: PlanStatus;
};

export function AiPreferenceForm({
  peopleTags,
  selectedPeople,
  onTogglePeople,
  demandTags,
  selectedDemands,
  onToggleDemand,
  onGenerate,
  status
}: AiPreferenceFormProps) {
  const isLoading = status === "submitting" || status === "thinking" || status === "regenerating";
  const buttonText =
    status === "submitting"
      ? "提交偏好..."
      : status === "thinking"
        ? "生成中..."
        : status === "regenerating"
          ? "切换推荐中..."
        : status === "success"
          ? "重新生成方案"
          : status === "error"
            ? "重试生成"
            : "一键生成方案";

  return (
    <div className="fade-in-up flex items-start gap-2.5">
      <div className="w-8 shrink-0" />
      <div className="w-full overflow-hidden rounded-2xl border border-emerald-100/60 bg-white shadow-sm">
        <div className="border-b border-emerald-50 bg-emerald-50/50 px-4 py-3">
          <h3 className="text-[13px] font-bold text-emerald-700">
            <SlidersHorizontal size={14} className="mr-1.5 inline" />
            定制专属行程
          </h3>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-xs font-bold text-gray-500">同行人员</p>
            <div className="flex flex-wrap gap-2">
              {peopleTags.map((tag) => (
                <TagButton
                  key={tag}
                  label={tag}
                  active={selectedPeople.includes(tag)}
                  onClick={() => onTogglePeople(tag)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-gray-500">核心诉求 (可多选)</p>
            <div className="flex flex-wrap gap-2">
              {demandTags.map((tag) => (
                <TagButton
                  key={tag}
                  label={tag}
                  active={selectedDemands.includes(tag)}
                  onClick={() => onToggleDemand(tag)}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-3 text-[14px] font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-75"
          >
            <Sparkles size={15} className="mr-2" />
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
