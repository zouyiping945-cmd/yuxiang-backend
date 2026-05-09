"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, MapPin, Search, Sun } from "lucide-react";

export function HomeHeader() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");

  const goToAi = () => {
    const q = searchText.trim();
    router.push(q ? `/ai?q=${encodeURIComponent(q)}` : "/ai");
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      goToAi();
    }
  };

  return (
    <header className="z-10 shrink-0 rounded-b-[24px] bg-gradient-to-br from-emerald-400 to-emerald-500 px-4 pb-5 pt-12 shadow-sm">
      <div className="mb-4 flex items-center justify-between text-white">
        <div className="flex items-center space-x-3">
          <button type="button" className="flex items-center font-medium">
            <MapPin size={16} className="mr-1.5" />
            <span className="text-sm tracking-wide">郑州市</span>
          </button>
          <button
            type="button"
            className="flex items-center rounded-full bg-white/20 px-2 py-1 text-xs backdrop-blur-sm"
          >
            <Sun size={14} className="mr-1 text-yellow-300" />
            <span>26°C 晴</span>
          </button>
        </div>
        <button type="button" className="relative">
          <Bell size={20} />
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-emerald-500 bg-red-500" />
        </button>
      </div>
      <div
        onClick={goToAi}
        className="flex cursor-pointer items-center rounded-2xl bg-white px-4 py-2.5 shadow-lg shadow-emerald-600/20"
      >
        <Search size={16} className="mr-2 shrink-0 text-gray-400" />
        <input
          type="text"
          value={searchText}
          placeholder="搜索目的地 / 村落 / 美食..."
          onChange={(event) => setSearchText(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={handleInputKeyDown}
          className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />
        <span className="mx-2 h-4 w-px bg-gray-200" />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            goToAi();
          }}
          className="whitespace-nowrap text-xs font-medium text-emerald-500"
        >
          搜索
        </button>
      </div>
    </header>
  );
}
