import Link from "next/link";
import { ChevronLeft, History, Sparkles } from "lucide-react";

export function AiChatHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-white/80 px-4 pb-3 pt-12 shadow-sm backdrop-blur-md">
      <Link href="/" className="-ml-2 p-2 text-gray-600">
        <ChevronLeft size={18} />
      </Link>
      <div className="flex items-center">
        <span className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">
          <Sparkles size={12} />
        </span>
        <h2 className="text-[16px] font-bold text-gray-800">AI 乡旅智选</h2>
      </div>
      <button type="button" className="-mr-2 p-2 text-gray-400">
        <History size={16} />
      </button>
    </header>
  );
}
