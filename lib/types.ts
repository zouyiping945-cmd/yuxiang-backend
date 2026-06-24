export type PlanStatus =
  | "idle"
  | "submitting"
  | "thinking"
  | "regenerating"
  | "success"
  | "error";

export type TravelPreference = {
  companions: string[];
  demands: string[];
  travelWithElders: boolean;
  travelWithKids: boolean;
  easyWalkRequired: boolean;
  farmFoodPreferred: boolean;
  needStay: boolean;
};

export type PlanRequestPayload = Partial<TravelPreference> & {
  inputText?: string;
  excludeVillageIds?: string[];
  preferredVillageId?: string;
  preferredVillageName?: string;
  preferredVillageCode?: string;
};

export type Village = {
  id: string;
  name: string;
  city: string;
  tags: string[];
  driveTimeMinutes: number;
  suitableForElders: boolean;
  easyWalk: boolean;
  hasFarmFood: boolean;
  hasStay: boolean;
  coverImage: string;
  description: string;
  rating: string;
  distanceText: string;
  address?: string;
  fullName?: string;
  latitude?: number;
  longitude?: number;
};

export type PlanStep = {
  time: string;
  title: string;
  detail: string;
  kind: "walk" | "food" | "stay" | "photo" | "activity" | "transport";
};

export type PlanAlternative = {
  id: string;
  name: string;
  city: string;
  rating: string;
  tags: string[];
  description?: string;
  distanceText?: string;
  summary?: string;
  matchScore?: number;
  reasonSummary?: string;
};

export type RouteOption = {
  title: string;
  subtitle: string;
  icon?: string;
};

export type FoodOption = {
  name: string;
  desc: string;
  priceText: string;
  tag?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  poiId?: string | null;
};

export type StayOption = {
  name: string;
  desc: string;
  priceText: string;
  tag?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  poiId?: string | null;
};

export type PlayHighlight = {
  title: string;
  desc: string;
  source?: "profile" | "route" | "food" | "stay" | "ai";
};

export type PlayPlace = {
  name: string;
  category?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceText?: string | null;
  reason: string;
  source: "amap" | "supabase" | "manual" | "seed" | "fallback";
};

export type DesignationType =
  | "乡村旅游重点村"
  | "美丽休闲乡村"
  | "传统村落"
  | "康养旅游村";

export type VillageDesignation = {
  type: DesignationType;
  sourceName: string;
  sourceIndex?: number;
  note?: string;
};

export type RealVillageData = {
  id: string;
  name: string;
  province: string;
  city: string;
  district: string;
  town?: string;
  village?: string;
  fullName: string;
  placeLevel: "village" | "community" | "town" | "scenic_area" | "unknown";
  rating: string;
  distanceText: string;
  tags: string[];
  suitableFor: string[];
  matchKeywords: string[];
  description: string;
  designations: VillageDesignation[];
  routeOptions: RouteOption[];
  foods: FoodOption[];
  stays: StayOption[];
  recommendedTransport?: string[];
  visitDuration?: string;
  intensity?: "低" | "中" | "高";
  elderFriendly?: boolean;
  kidFriendly?: boolean;
  photoFriendly?: boolean;
  foodFriendly?: boolean;
  cultureFriendly?: boolean;
  wellnessFriendly?: boolean;
  selfDriveFriendly?: boolean;
  publicTransportFriendly?: boolean;
  dataReviewStatus?: "seed" | "needs_review" | "verified";
  reviewNotes?: string[];
  address?: string;
  latitude?: number;
  longitude?: number;
  adcode?: string;
  amapPoiId?: string;
  geoSource?: string;
  geoReviewStatus?: "needs_review" | "verified" | "rejected";
  geoReviewNotes?: string[];
  sourceConfidence: "高" | "中" | "低";
  dataStatus: "seed" | "enriched" | "verified";
};

export type AmapPoiCategory = "food" | "stay" | "parking" | "activity";

export type VillagePoi = {
  id?: string;
  villageId: string;
  poiId: string;
  source: "amap" | "manual" | "seed";
  category: AmapPoiCategory;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  distanceText?: string;
  typeText?: string;
  tel?: string;
  rating?: string;
  priceText?: string;
  raw?: unknown;
  isRecommended?: boolean;
  dataReviewStatus?: "needs_review" | "verified" | "rejected";
  reviewNotes?: string[];
};

export type VillagePoiCoverageLevel = "strong" | "usable" | "excluded";

export type VillagePoiCoverage = {
  villageId: string;
  activityCount: number;
  foodCount: number;
  stayCount: number;
  parkingCount: number;
  coverageLevel: VillagePoiCoverageLevel;
};

export type RecommendedPoiReviewStatus = "needs_review" | "verified";

export type RecommendedPoi = {
  villageId: string;
  category: AmapPoiCategory;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceText?: string | null;
  distanceMeters?: number | null;
  typeText?: string | null;
  tel?: string | null;
  rating?: string | null;
  priceText?: string | null;
  source?: string | null;
  dataReviewStatus: RecommendedPoiReviewStatus;
  isRecommended: boolean;
  poiId?: string | null;
};

export type RecommendedPoisByCategory = {
  activity: RecommendedPoi[];
  food: RecommendedPoi[];
  stay: RecommendedPoi[];
  parking: RecommendedPoi[];
  lookupKeys?: string[];
  queryVillageIds?: string[];
  resolvedVillageId?: string;
  matchedKey?: string;
  lookupDebug?: {
    totalFound: number;
    recommendedFound: number;
    usedRecommended: boolean;
    usedCandidateFallback: boolean;
    error?: string;
  };
};

export type PlanDataQuality = {
  poiCoverageLevel: "strong" | "usable" | "fallback";
  poiSource?: "verified" | "auto_ranked" | "candidate" | "fallback";
  activityCount?: number;
  foodCount?: number;
  stayCount?: number;
  parkingCount?: number;
  recommendedPoiCounts?: {
    activity: number;
    food: number;
    stay: number;
    parking: number;
  };
  poiLookupKeys?: string[];
  poiQueryVillageIds?: string[];
  poiResolvedVillageId?: string;
  poiLookupMatchedKey?: string;
  poiLookupDebug?: {
    totalFound: number;
    recommendedFound: number;
    usedRecommended: boolean;
    usedCandidateFallback: boolean;
    error?: string;
  };
  explicitVillageMatched?: boolean;
  explicitVillageMatchName?: string;
};

export type PlanResult = {
  requestId: string;
  generatedAt: string;
  preference: TravelPreference;
  inputText: string;
  providerUsed: "mock" | "deepseek" | "doubao";
  fallbackUsed: boolean;
  recommended: Village;
  alternatives: PlanAlternative[];
  routeOptions: RouteOption[];
  foods: FoodOption[];
  stays: StayOption[];
  matchScore: number;
  dataQuality?: PlanDataQuality;
  reasons: string[];
  reasonTags?: string[];
  reasonSummary?: string;
  travelTips?: string[];
  playPlaces?: PlayPlace[];
  playHighlights?: PlayHighlight[];
  steps: PlanStep[];
  summary?: string;
};
