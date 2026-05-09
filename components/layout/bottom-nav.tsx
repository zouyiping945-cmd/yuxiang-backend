import Link from "next/link";
import { Compass, House, MessageCircle, Plus, UserRound } from "lucide-react";

type NavKey = "home" | "discover" | "message" | "me";

type BottomNavProps = {
  active?: NavKey;
};

const itemClass = "flex flex-col items-center text-[10px]";

export function BottomNav({ active = "home" }: BottomNavProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 rounded-b-[24px] border-t border-gray-100 bg-white px-6 pb-6 pt-2">
      <div className="relative flex items-center justify-between">
        <Link
          href="/"
          className={`${itemClass} ${active === "home" ? "text-emerald-500" : "text-gray-400"}`}
        >
          <House size={22} />
          <span className={`mt-1 ${active === "home" ? "font-bold" : "font-medium"}`}>首页</span>
        </Link>
        <button
          type="button"
          className={`${itemClass} ${active === "discover" ? "text-emerald-500" : "text-gray-400"}`}
        >
          <Compass size={22} />
          <span className={`mt-1 ${active === "discover" ? "font-bold" : "font-medium"}`}>
            发现
          </span>
        </button>
        <button type="button" className="relative -top-5 flex flex-col items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-1 ring-gray-100">
            <Plus size={22} />
          </span>
          <span className="mt-1 text-[10px] font-medium text-gray-500">发布</span>
        </button>
        <button
          type="button"
          className={`${itemClass} ${active === "message" ? "text-emerald-500" : "text-gray-400"}`}
        >
          <MessageCircle size={22} />
          <span className={`mt-1 ${active === "message" ? "font-bold" : "font-medium"}`}>
            消息
          </span>
        </button>
        <button
          type="button"
          className={`${itemClass} ${active === "me" ? "text-emerald-500" : "text-gray-400"}`}
        >
          <UserRound size={22} />
          <span className={`mt-1 ${active === "me" ? "font-bold" : "font-medium"}`}>我的</span>
        </button>
      </div>
    </div>
  );
}
