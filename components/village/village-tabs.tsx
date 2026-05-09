"use client";

import { useState } from "react";
import { Bus, Car, Ear, LocateFixed, Map as MapIcon } from "lucide-react";

type TabKey = "route" | "food" | "stay";

const tabClass =
  "flex-1 rounded-full py-2 text-[13px] transition-colors";

export function VillageTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>("route");

  return (
    <>
      <div className="sticky top-0 z-30 mt-2 bg-gray-50/90 px-4 pb-3 pt-5 backdrop-blur-md">
        <div className="flex justify-between rounded-full border border-gray-100 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("route")}
            className={`${tabClass} ${
              activeTab === "route"
                ? "bg-emerald-500 font-bold text-white"
                : "font-medium text-gray-500"
            }`}
          >
            查路线
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("food")}
            className={`${tabClass} ${
              activeTab === "food"
                ? "bg-emerald-500 font-bold text-white"
                : "font-medium text-gray-500"
            }`}
          >
            觅美食
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stay")}
            className={`${tabClass} ${
              activeTab === "stay"
                ? "bg-emerald-500 font-bold text-white"
                : "font-medium text-gray-500"
            }`}
          >
            寻住处
          </button>
        </div>
      </div>

      <div className="mt-2 px-4">
        {activeTab === "route" ? (
          <section className="tab-content space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl border border-emerald-500/20 bg-emerald-50 p-3 text-center">
                <Car size={18} className="mx-auto mb-1 text-emerald-500" />
                <p className="text-xs font-bold text-emerald-700">自驾约45分</p>
              </div>
              <div className="flex-1 rounded-xl border border-gray-100 bg-white p-3 text-center">
                <Bus size={18} className="mx-auto mb-1 text-gray-400" />
                <p className="text-xs text-gray-600">公交约1.5时</p>
              </div>
            </div>
            <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-gray-200">
              <img
                src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=800"
                alt="地图预览"
                className="h-full w-full object-cover opacity-60"
              />
              <div className="absolute rounded-full bg-white/90 px-4 py-2 text-sm font-bold shadow-md">
                <MapIcon size={15} className="mr-2 inline text-emerald-500" />
                查看高清地图
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "food" ? (
          <section className="tab-content space-y-3">
            <div className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=300"
                alt="老槐树地锅鸡"
                className="h-24 w-24 rounded-xl object-cover"
              />
              <div className="flex-1 py-1">
                <h4 className="text-[15px] font-bold">老槐树地锅鸡</h4>
                <p className="my-1 text-[10px] text-gray-400">4.9分 | 人均 ¥55</p>
                <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-600">
                  招牌推荐
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "stay" ? (
          <section className="tab-content space-y-3">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&q=80&w=600"
                alt="星空民宿"
                className="h-32 w-full object-cover"
              />
              <div className="p-3">
                <h4 className="text-[15px] font-bold">星空民宿</h4>
                <p className="text-[11px] text-gray-400">独立庭院 / 落地窗</p>
                <p className="text-right font-bold text-red-500">¥288起</p>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-40 flex gap-3 border-t border-gray-100 bg-white px-4 pb-6 py-3">
        <button
          type="button"
          className="flex flex-[1.5] items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-[13px] font-bold text-emerald-600"
        >
          <Ear size={14} className="mr-1.5" />
          AI伴游
        </button>
        <button
          type="button"
          className="flex flex-[2] items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-2.5 text-[13px] font-bold text-white shadow-lg"
        >
          <LocateFixed size={14} className="mr-1.5" />
          去这里
        </button>
      </div>
    </>
  );
}
