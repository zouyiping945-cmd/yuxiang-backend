import type { Village } from "@/lib/types";

export const villages: Village[] = [
  {
    id: "yingtaogou",
    name: "樱桃沟风景区",
    city: "郑州",
    tags: ["亲子游", "特色采摘", "轻松慢游"],
    driveTimeMinutes: 45,
    suitableForElders: true,
    easyWalk: true,
    hasFarmFood: true,
    hasStay: true,
    coverImage: "",
    description: "步道平缓，适合带父母或孩子轻松走走，也方便安排农家菜。",
    rating: "4.8",
    distanceText: "2.5km"
  },
  {
    id: "funiushan",
    name: "伏牛山营地",
    city: "洛阳",
    tags: ["露营", "观星", "山野徒步"],
    driveTimeMinutes: 120,
    suitableForElders: false,
    easyWalk: false,
    hasFarmFood: true,
    hasStay: true,
    coverImage: "",
    description: "更适合喜欢山野、露营和夜间观星的活力出游人群。",
    rating: "4.6",
    distanceText: "18km"
  },
  {
    id: "yunshuihe",
    name: "云水河慢村",
    city: "新乡",
    tags: ["慢游", "河畔步道", "手作体验"],
    driveTimeMinutes: 85,
    suitableForElders: true,
    easyWalk: true,
    hasFarmFood: true,
    hasStay: false,
    coverImage: "",
    description: "河畔步道轻松好走，适合慢节奏散步和轻量手作体验。",
    rating: "4.7",
    distanceText: "9km"
  },
  {
    id: "xingkongli",
    name: "星空里民宿村",
    city: "焦作",
    tags: ["民宿", "亲子友好", "农家菜"],
    driveTimeMinutes: 95,
    suitableForElders: true,
    easyWalk: true,
    hasFarmFood: true,
    hasStay: true,
    coverImage: "",
    description: "民宿、农家菜和亲子活动比较均衡，适合周末住一晚。",
    rating: "4.9",
    distanceText: "12km"
  }
];
