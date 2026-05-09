import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { VillageHero } from "@/components/village/village-hero";
import { VillageInfoCard } from "@/components/village/village-info-card";
import { VillageTabs } from "@/components/village/village-tabs";
import { getPublishedVillageById } from "@/lib/data";

type VillagePageProps = {
  params: {
    id: string;
  };
};

export default async function VillagePage({ params }: VillagePageProps) {
  const result = await getPublishedVillageById(params.id);
  const village = result.village;

  if (!village) {
    notFound();
  }

  return (
    <MobileFrame>
      <div className="no-scrollbar relative flex-1 overflow-y-auto pb-24">
        <VillageHero
          title={village.name}
          district={village.city}
          image={village.coverImage}
          rating={village.rating}
        />
        <VillageInfoCard />
        <VillageTabs />
      </div>
    </MobileFrame>
  );
}
