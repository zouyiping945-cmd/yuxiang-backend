import Link from "next/link";
import { ChevronLeft, Heart, MapPin, Star } from "lucide-react";

type VillageHeroProps = {
  title: string;
  district: string;
  image: string;
  rating: string;
};

export function VillageHero({ title, district, image, rating }: VillageHeroProps) {
  return (
    <section className="relative h-64 w-full">
      <img src={image} alt={title} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
      <div className="absolute left-4 right-4 top-10 z-20 flex items-center justify-between">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md"
        >
          <ChevronLeft size={16} />
        </Link>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md"
        >
          <Heart size={16} />
        </button>
      </div>
      <div className="absolute bottom-6 left-5 right-5 z-20 text-white">
        <h1 className="mb-1 text-2xl font-bold tracking-wider">{title}</h1>
        <div className="text-sm text-white/90">
          <Star size={11} className="mr-1 inline text-orange-400" />
          {rating} | <MapPin size={11} className="mr-1 inline" />
          {district}
        </div>
      </div>
    </section>
  );
}
