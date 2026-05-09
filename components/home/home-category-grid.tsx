import {
  BookOpen,
  House,
  Map,
  Route,
  ShoppingBag,
  Sparkles,
  Users,
  UtensilsCrossed
} from "lucide-react";

const categoryItems = [
  { name: "预村况", icon: Map, iconClass: "text-blue-500 bg-blue-50" },
  { name: "查路线", icon: Route, iconClass: "text-emerald-500 bg-emerald-50" },
  { name: "寻住处", icon: House, iconClass: "text-orange-500 bg-orange-50" },
  { name: "觅美食", icon: UtensilsCrossed, iconClass: "text-red-500 bg-red-50" },
  { name: "找搭子", icon: Users, iconClass: "text-purple-500 bg-purple-50" },
  { name: "享特色", icon: Sparkles, iconClass: "text-pink-500 bg-pink-50" },
  { name: "探研学", icon: BookOpen, iconClass: "text-cyan-500 bg-cyan-50" },
  { name: "助农集", icon: ShoppingBag, iconClass: "text-green-500 bg-green-50" }
];

export function HomeCategoryGrid() {
  return (
    <div className="mb-6 grid grid-cols-4 gap-x-2 gap-y-5 rounded-2xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      {categoryItems.map((item) => {
        const Icon = item.icon;

        return (
          <button key={item.name} type="button" className="group flex flex-col items-center">
            <span
              className={`mb-1.5 flex h-11 w-11 items-center justify-center rounded-full transition-transform group-hover:scale-105 ${item.iconClass}`}
            >
              <Icon size={18} />
            </span>
            <span className="text-[11px] font-medium text-gray-700">{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}
