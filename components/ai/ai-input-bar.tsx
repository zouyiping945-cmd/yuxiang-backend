"use client";

import type { KeyboardEvent } from "react";
import { Mic, SendHorizontal } from "lucide-react";

type AiInputBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

export function AiInputBar({ value, onChange, onSend, disabled }: AiInputBarProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center gap-3 bg-white px-4 pb-6 py-3 shadow-2xl">
      <button type="button" className="h-9 w-9 rounded-full bg-gray-100 text-gray-500">
        <Mic size={16} className="mx-auto" />
      </button>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="对结果不满意？直接告诉我..."
        disabled={disabled}
        className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-[13px] outline-none disabled:opacity-70"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={disabled}
        className="h-9 w-9 rounded-full bg-emerald-500 text-white disabled:opacity-70"
      >
        <SendHorizontal size={16} className="mx-auto" />
      </button>
    </div>
  );
}
