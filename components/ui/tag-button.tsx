"use client";

type TagButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

export function TagButton({ label, active, onClick }: TagButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] transition-all ${
        active
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-gray-200 bg-gray-50 text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}
