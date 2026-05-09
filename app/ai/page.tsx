"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AiChatHeader } from "@/components/ai/ai-chat-header";
import { AiInputBar } from "@/components/ai/ai-input-bar";
import { AiPreferenceForm } from "@/components/ai/ai-preference-form";
import { AiResultCard } from "@/components/ai/ai-result-card";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { ThinkingDots } from "@/components/ui/thinking-dots";
import { usePlanGenerator } from "@/hooks/use-plan-generator";

const peopleTags = ["👨‍👩‍👧‍👦 带父母", "👶 亲子遛娃"];
const demandTags = ["🍲 吃农家菜", "🌳 不爬山"];

function AiPageContent() {
  const searchParams = useSearchParams();
  const [selectedPeople, setSelectedPeople] = useState<string[]>([peopleTags[0]]);
  const [selectedDemands, setSelectedDemands] = useState<string[]>(demandTags);
  const [inputText, setInputText] = useState("");

  const {
    status,
    result,
    errorMessage,
    lastUserText,
    regeneratingHint,
    generatePlan,
    switchRecommendation
  } = usePlanGenerator();

  const isBusy = status === "submitting" || status === "thinking" || status === "regenerating";

  useEffect(() => {
    const q = searchParams.get("q")?.trim() ?? "";
    if (q && !inputText) {
      setInputText(q);
    }
  }, [inputText, searchParams]);

  const userSentence = useMemo(() => {
    const tagText = [selectedPeople.join("、"), selectedDemands.join("、")]
      .filter(Boolean)
      .join("，");
    const text = lastUserText || inputText.trim();
    return [tagText, text].filter(Boolean).join("；");
  }, [inputText, lastUserText, selectedDemands, selectedPeople]);

  const togglePeople = (value: string) => {
    setSelectedPeople((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const toggleDemands = (value: string) => {
    setSelectedDemands((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleGenerate = async () => {
    await generatePlan({
      companions: selectedPeople,
      demands: selectedDemands,
      inputText
    });
  };

  const handleSendFromInput = async () => {
    if (!inputText.trim() && selectedPeople.length === 0 && selectedDemands.length === 0) {
      return;
    }

    await handleGenerate();
  };

  return (
    <MobileFrame>
      <AiChatHeader />

      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto p-4 pb-28">
        <div className="fade-in-up mt-2 flex items-start gap-2.5">
          <img
            src="https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=10b981"
            alt="AI 助手"
            className="h-8 w-8 rounded-full bg-emerald-500 shadow-sm"
          />
          <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-[14px] leading-relaxed text-gray-700">
              你好！我是专属规划师。可以点选偏好，也可以直接输入你的需求。👇
            </p>
          </div>
        </div>

        <AiPreferenceForm
          peopleTags={peopleTags}
          selectedPeople={selectedPeople}
          onTogglePeople={togglePeople}
          demandTags={demandTags}
          selectedDemands={selectedDemands}
          onToggleDemand={toggleDemands}
          onGenerate={handleGenerate}
          status={status}
        />

        {status !== "idle" ? (
          <div className="fade-in-up mt-4 flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-500 px-4 py-3 text-white shadow-sm">
              <p className="text-[14px] leading-relaxed">{userSentence || "请帮我推荐一个轻松的乡旅行程"}</p>
            </div>
          </div>
        ) : null}

        {status === "submitting" || status === "thinking" || status === "regenerating" ? (
          <div className="fade-in-up mt-4 flex items-start gap-2.5">
            <img
              src="https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=10b981"
              alt="AI 助手"
              className="h-8 w-8 rounded-full bg-emerald-500"
            />
            <div className="flex h-10 items-center rounded-2xl rounded-tl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm">
              <ThinkingDots />
              <span className="ml-2 text-xs font-medium text-emerald-600">
                {status === "submitting"
                  ? "提交偏好..."
                  : status === "thinking"
                    ? "检索数据库..."
                    : regeneratingHint || "切换推荐中..."}
              </span>
            </div>
          </div>
        ) : null}

        {(status === "success" || status === "regenerating") && result ? (
          <AiResultCard
            result={result}
            onSwitchRecommendation={switchRecommendation}
            switching={status === "regenerating"}
          />
        ) : null}

        {status === "error" ? (
          <div className="fade-in-up mt-4 flex items-start gap-2.5">
            <img
              src="https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=10b981"
              alt="AI 助手"
              className="h-8 w-8 rounded-full bg-emerald-500"
            />
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-red-100 bg-red-50 px-4 py-3 shadow-sm">
              <p className="text-[13px] text-red-600">
                <AlertCircle size={14} className="mr-1.5 inline" />
                {errorMessage || "生成失败，请稍后重试"}
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-medium text-red-600"
              >
                重新生成
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <AiInputBar
        value={inputText}
        onChange={setInputText}
        onSend={handleSendFromInput}
        disabled={isBusy}
      />
    </MobileFrame>
  );
}

export default function AiPage() {
  return (
    <Suspense
      fallback={
        <MobileFrame>
          <div className="flex flex-1 items-center justify-center p-4 text-[13px] text-gray-500">
            加载中...
          </div>
        </MobileFrame>
      }
    >
      <AiPageContent />
    </Suspense>
  );
}
