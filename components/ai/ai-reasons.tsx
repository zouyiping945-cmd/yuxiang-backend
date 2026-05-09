type AiReasonsProps = {
  summary?: string;
  reasons: string[];
  providerUsed: "mock" | "deepseek" | "doubao";
  fallbackUsed: boolean;
  requestId: string;
  generatedAt: string;
};

export function AiReasons({
  summary,
  reasons,
  providerUsed,
  fallbackUsed,
  requestId,
  generatedAt
}: AiReasonsProps) {
  const sourceLabel = fallbackUsed ? "fallback(mock)" : providerUsed;
  const generatedAtText = generatedAt ? new Date(generatedAt).toLocaleString("zh-CN") : "-";

  return (
    <div className="mb-3 rounded-2xl rounded-tl-sm border border-emerald-100 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-emerald-700">推荐解释</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
          来源：{sourceLabel}
        </span>
      </div>
      {summary ? <p className="text-[13px] text-gray-700">{summary}</p> : null}
      <ul className="mt-2 space-y-1">
        {reasons.slice(0, 4).map((reason) => (
          <li key={reason} className="text-[12px] text-gray-600">
            • {reason}
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-gray-100 pt-2 text-[10px] text-gray-400">
        <p>requestId: {requestId}</p>
        <p>generatedAt: {generatedAtText}</p>
      </div>
    </div>
  );
}
