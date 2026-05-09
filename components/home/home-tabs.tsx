"use client";

import { useState } from "react";

const tabs = ["推荐", "附近", "最新"] as const;

export function HomeTabs() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("推荐");

  return (
    <div className="mb-4 flex space-x-6 border-b border-gray-100 px-1">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`relative pb-2 text-sm font-bold ${isActive ? "text-gray-800" : "text-gray-400"}`}
          >
            {tab}
            {isActive ? (
              <span className="absolute bottom-0 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full bg-emerald-500" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
