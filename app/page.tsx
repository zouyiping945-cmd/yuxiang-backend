import Link from "next/link";
import { HomeCard } from "@/components/home/home-card";
import { HomeCategoryGrid } from "@/components/home/home-category-grid";
import { HomeHeader } from "@/components/home/home-header";
import { HomeTabs } from "@/components/home/home-tabs";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { villageList } from "@/lib/data";

export default function HomePage() {
  return (
    <MobileFrame>
      <HomeHeader />

      <div className="no-scrollbar -mt-4 flex-1 overflow-y-auto px-4 pb-24 pt-6">
        <div className="relative mb-6 h-36 w-full cursor-pointer overflow-hidden rounded-2xl shadow-sm">
          <img
            src="https://images.unsplash.com/photo-1543097692-f0462002324f?auto=format&fit=crop&q=80&w=800"
            alt="豫见最美乡村"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-4">
            <h3 className="font-bold tracking-wide text-white">豫见最美乡村</h3>
            <p className="mt-1 text-xs text-white/80">探索隐藏在河南山水间的诗意</p>
          </div>
        </div>

        <Link
          href="/ai?q=%E5%B8%A6%E7%88%B6%E6%AF%8D%E5%8E%BB%E5%93%AA%E9%87%8C"
          className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-emerald-700">AI 试试：带父母去哪里</p>
            <p className="mt-1 text-[11px] text-gray-500">一键进入智能推荐，快速出行规划</p>
          </div>
          <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-medium text-white">
            去试试
          </span>
        </Link>

        <HomeCategoryGrid />
        <HomeTabs />

        <div className="space-y-4">
          {villageList.map((village) => (
            <HomeCard
              key={village.id}
              id={village.id}
              name={village.name}
              rating={village.rating}
              reviews={1256}
              distance={village.distance}
              image={village.cover}
              tags={village.tags}
            />
          ))}
        </div>

        <div className="mb-4 mt-6 text-center text-xs text-gray-400">- 已经到底啦 -</div>
      </div>

      <BottomNav active="home" />
    </MobileFrame>
  );
}
