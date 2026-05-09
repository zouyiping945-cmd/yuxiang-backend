import { Sparkles, SquareParking, Sun, Users } from "lucide-react";

export function VillageInfoCard() {
  return (
    <section className="relative z-20 -mt-4 px-4">
      <div className="rounded-2xl border border-emerald-50 bg-white p-4 shadow-lg">
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="text-center">
            <span className="text-[10px] text-gray-400">今日天气</span>
            <div className="text-sm font-bold text-gray-700">
              <Sun size={14} className="mr-1 inline text-yellow-400" />
              26°C
            </div>
          </div>
          <span className="h-6 w-px bg-gray-100" />
          <div className="text-center">
            <span className="text-[10px] text-gray-400">停车指数</span>
            <div className="text-sm font-bold text-emerald-500">
              <SquareParking size={14} className="mr-1 inline" />
              充足
            </div>
          </div>
          <span className="h-6 w-px bg-gray-100" />
          <div className="text-center">
            <span className="text-[10px] text-gray-400">实时客流</span>
            <div className="text-sm font-bold text-orange-500">
              <Users size={14} className="mr-1 inline" />
              适中
            </div>
          </div>
        </div>
        <div className="relative flex gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-50 to-white p-3">
          <span className="absolute bottom-0 left-0 top-0 w-1 bg-emerald-400" />
          <Sparkles size={15} className="mt-0.5 text-emerald-500" />
          <div>
            <h4 className="mb-1 text-[12px] font-bold text-emerald-700">AI 村况速递</h4>
            <p className="text-[11px] text-gray-600">
              周末天气极佳，2号停车场空位多。建议穿平底鞋游览木栈道。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
