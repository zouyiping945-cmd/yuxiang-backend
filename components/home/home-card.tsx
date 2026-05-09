import Link from "next/link";
import { ChevronRight, MapPin, Sparkles, Star } from "lucide-react";

type HomeCardProps = {
  id: string;
  name: string;
  rating: string;
  reviews: number;
  distance: string;
  image: string;
  tags: string[];
};

export function HomeCard({
  id,
  name,
  rating,
  reviews,
  distance,
  image,
  tags
}: HomeCardProps) {
  return (
    <Link
      href={`/village/${id}`}
      className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl">
        <img src={image} alt={name} className="h-full w-full object-cover" />
        <div className="absolute left-0 top-0 flex items-center rounded-br-lg bg-gradient-to-r from-emerald-500 to-emerald-400 px-1.5 py-0.5 text-[9px] font-bold text-white">
          <Sparkles size={8} className="mr-1" />
          AI 甄选
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between py-0.5">
        <div>
          <h4 className="text-[15px] font-bold text-gray-800">{name}</h4>
          <div className="mt-1 text-xs text-gray-400">
            <Star size={10} className="mr-1 inline text-orange-400" />
            <span className="mr-1 font-bold text-orange-500">{rating}</span>({reviews}条点评)
          </div>
          <div className="mt-2 flex gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-emerald-100/50 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center">
            <MapPin size={11} className="mr-1" />
            距您 {distance}
          </span>
          <ChevronRight size={12} />
        </div>
      </div>
    </Link>
  );
}
