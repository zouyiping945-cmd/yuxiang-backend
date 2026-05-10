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
};

export type StayOption = {
  name: string;
  desc: string;
  priceText: string;
  tag?: string;
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
  sourceConfidence: "高" | "中" | "低";
  dataStatus: "seed" | "enriched" | "verified";
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
  reasons: string[];
  reasonTags?: string[];
  reasonSummary?: string;
  travelTips?: string[];
  steps: PlanStep[];
  summary?: string;
};
