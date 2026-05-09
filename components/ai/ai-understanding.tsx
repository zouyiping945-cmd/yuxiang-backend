import type { TravelPreference } from "@/lib/types";

type AiUnderstandingProps = {
  preference: TravelPreference;
  inputText: string;
};

function renderTags(tags: string[]) {
  if (tags.length === 0) {
    return <span className="text-[12px] text-gray-400">未选择</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-md border border-emerald-100/60 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function AiUnderstanding({ preference, inputText }: AiUnderstandingProps) {
  return (
    <div className="mb-3 rounded-2xl rounded-tl-sm border border-emerald-100 bg-white px-4 py-3 shadow-sm">
      <h4 className="mb-2 text-[12px] font-semibold text-emerald-700">AI 已理解你的需求</h4>
      <div className="space-y-2">
        <div>
          <p className="text-[11px] text-gray-400">同行人员</p>
          {renderTags(preference.companions)}
        </div>
        <div>
          <p className="text-[11px] text-gray-400">核心诉求</p>
          {renderTags(preference.demands)}
        </div>
        <div>
          <p className="text-[11px] text-gray-400">自由输入</p>
          <p className="text-[12px] text-gray-700">{inputText || "（无）"}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-gray-50 px-2 py-1 text-center">
            <p className="text-[10px] text-gray-400">带老人</p>
            <p className="text-[11px] font-medium text-gray-700">
              {preference.travelWithElders ? "是" : "否"}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-1 text-center">
            <p className="text-[10px] text-gray-400">带孩子</p>
            <p className="text-[11px] font-medium text-gray-700">
              {preference.travelWithKids ? "是" : "否"}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-1 text-center">
            <p className="text-[10px] text-gray-400">轻松步行</p>
            <p className="text-[11px] font-medium text-gray-700">
              {preference.easyWalkRequired ? "是" : "否"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
