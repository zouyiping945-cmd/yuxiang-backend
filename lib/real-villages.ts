import type {
  DesignationType,
  FoodOption,
  RealVillageData,
  RouteOption,
  StayOption,
  VillageDesignation
} from "@/lib/types";

const SOURCE_NAME = "附录1 河南省乡村旅游地名单";

function designation(type: DesignationType, note = "V0.6 seed 样本，来源条目来自河南省乡村旅游地名单，具体服务信息后续人工核验。"): VillageDesignation {
  return {
    type,
    sourceName: SOURCE_NAME,
    note
  };
}

function routeOptions(driveTitle: string, driveSubtitle: string, publicTitle: string, publicSubtitle: string): RouteOption[] {
  return [
    {
      title: driveTitle,
      subtitle: driveSubtitle,
      icon: "车"
    },
    {
      title: publicTitle,
      subtitle: publicSubtitle,
      icon: "巴"
    }
  ];
}

function foods(primaryTag = "需提前确认", extra: FoodOption[] = []): FoodOption[] {
  return [
    {
      name: "附近农家菜",
      desc: "本地家常菜 / 时令蔬菜",
      priceText: "人均约 ¥45",
      tag: primaryTag
    },
    {
      name: "乡野小馆",
      desc: "家常小炒 / 地方风味简餐",
      priceText: "人均约 ¥40",
      tag: "适合简餐"
    },
    {
      name: "田园茶点",
      desc: "手作点心 / 花茶",
      priceText: "人均约 ¥35",
      tag: "适合歇脚"
    },
    ...extra
  ];
}

function stays(primaryTag = "需提前确认", extra: StayOption[] = []): StayOption[] {
  return [
    {
      name: "乡野民宿",
      desc: "基础住宿 / 近村落",
      priceText: "¥198起",
      tag: primaryTag
    },
    {
      name: "近郊客栈",
      desc: "安静舒适 / 可停车",
      priceText: "¥238起",
      tag: "周末可选"
    },
    ...extra
  ];
}

const REVIEW_NOTES = ["seed 阶段数据，路线、餐饮、住宿需后续人工核验"];

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function parseRouteMinutes(routeTitle: string | undefined): number {
  if (!routeTitle) {
    return 90;
  }

  const hourMatch = routeTitle.match(/(\d+(?:\.\d+)?)\s*时/);
  if (hourMatch) {
    return Math.round(Number(hourMatch[1]) * 60);
  }

  const minuteMatch = routeTitle.match(/(\d+)\s*分/);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  return 90;
}

function withQuality(village: RealVillageData): RealVillageData {
  const profileText = [
    village.name,
    village.fullName,
    village.description,
    ...village.tags,
    ...village.suitableFor,
    ...village.matchKeywords
  ].join(" ");
  const publicRouteText = [village.routeOptions[1]?.title ?? "", village.routeOptions[1]?.subtitle ?? ""].join(" ");
  const driveMinutes = parseRouteMinutes(village.routeOptions[0]?.title);
  const publicMinutes = parseRouteMinutes(village.routeOptions[1]?.title);
  const elderFriendly = village.suitableFor.includes("老人") || includesAny(profileText, ["父母", "老人", "长辈", "轻松", "不累", "康养"]);
  const kidFriendly = village.suitableFor.includes("亲子") || includesAny(profileText, ["亲子", "孩子", "小孩"]);
  const photoFriendly = includesAny(profileText, ["拍照", "出片", "风景", "自然风光", "山野"]);
  const foodFriendly = includesAny(profileText, ["农家菜", "美食", "吃饭", "家常菜"]);
  const cultureFriendly = includesAny(profileText, ["传统", "文化", "研学", "老街", "村落"]);
  const wellnessFriendly = includesAny(profileText, ["康养", "放松", "轻松", "慢游", "休闲"]);
  const selfDriveFriendly = village.suitableFor.includes("自驾") || includesAny(profileText, ["自驾", "近郊", "短途"]);
  const publicTransportFriendly = publicMinutes <= 120 && !includesAny(publicRouteText, ["需换乘", "换乘时间较长", "换乘较多", "建议提前确认班次", "不建议临时"]);
  const intensity: RealVillageData["intensity"] = includesAny(profileText, ["徒步"])
    ? "高"
    : includesAny(profileText, ["山野", "山村", "自然风光", "山乡"])
      ? "中"
      : "低";
  const visitDuration = driveMinutes >= 90
    ? "一日游"
    : cultureFriendly
      ? "半日游 / 一日游"
      : intensity === "低"
        ? "半日游"
        : "一日游";

  return {
    ...village,
    recommendedTransport: publicTransportFriendly ? ["自驾", "公共交通"] : ["自驾"],
    visitDuration,
    intensity,
    elderFriendly,
    kidFriendly,
    photoFriendly,
    foodFriendly,
    cultureFriendly,
    wellnessFriendly,
    selfDriveFriendly,
    publicTransportFriendly,
    dataReviewStatus: "needs_review",
    reviewNotes: REVIEW_NOTES
  };
}

const VILLAGE_SEEDS: RealVillageData[] = [
  {
    id: "zhengzhou_yingtaogou",
    name: "樱桃沟社区",
    province: "河南省",
    city: "郑州市",
    district: "二七区",
    town: "侯寨乡",
    village: "樱桃沟社区",
    fullName: "郑州市二七区侯寨乡樱桃沟社区",
    placeLevel: "community",
    rating: "4.8",
    distanceText: "距郑州市区约 18km",
    tags: ["近郊短途", "亲子休闲", "农家菜", "轻松慢游", "家庭出游"],
    suitableFor: ["老人", "亲子", "家庭", "朋友", "自驾"],
    matchKeywords: ["父母", "老人", "长辈", "孩子", "亲子", "不累", "轻松", "慢慢走", "农家菜", "吃饭", "美食", "周末", "短途", "近郊", "采摘", "家庭", "自驾"],
    description:
      "樱桃沟社区是郑州近郊辨识度较高的乡旅目的地，适合周末短途和家庭同行。这里更适合轻松慢游、亲子休闲和农家菜体验，不需要把行程安排得太满。带父母或孩子出行时，可以把重点放在散步、用餐和短暂停留。",
    designations: [designation("乡村旅游重点村", "V0.6 保留原有 seed 样本，具体名单批次后续人工核验。")],
    routeOptions: routeOptions("自驾约45分", "适合家庭同行，建议上午错峰出发。", "公交约1.5时", "建议提前确认班次，预留换乘时间。"),
    foods: foods("适合家庭聚餐", [
      {
        name: "果园小食",
        desc: "应季水果 / 简单小食",
        priceText: "人均约 ¥28",
        tag: "适合亲子"
      }
    ]),
    stays: stays("周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "zhengzhou_shenxiandong",
    name: "神仙洞村",
    province: "河南省",
    city: "郑州市",
    district: "新密市",
    town: "伏羲山风景区管委会",
    village: "神仙洞村",
    fullName: "郑州市新密市伏羲山风景区管委会神仙洞村",
    placeLevel: "village",
    rating: "4.7",
    distanceText: "郑州周边山野短途",
    tags: ["自然风光", "拍照出片", "山野轻徒步", "朋友出游", "周末短途"],
    suitableFor: ["朋友", "情侣", "家庭", "自驾"],
    matchKeywords: ["朋友", "情侣", "拍照", "出片", "风景", "自然", "山", "山野", "徒步", "周末", "短途", "好看", "空气", "放松", "自驾"],
    description:
      "神仙洞村位于伏羲山片区，更适合想看自然风景、拍照出片和轻量山野体验的用户。相比纯休闲村落，它的出游感更强，适合朋友或情侣周末出发。若同行有老人或低龄儿童，建议提前控制步行强度。",
    designations: [designation("乡村旅游重点村", "神仙洞村不同名单写法合并为同一条 seed，避免重复建库。")],
    routeOptions: routeOptions("自驾约1.5时", "山路路段建议提前规划，避开返程高峰。", "公共交通约2.5时", "换乘时间较长，建议优先自驾或拼车。"),
    foods: foods("徒步后补给"),
    stays: stays("周边可选", [
      {
        name: "山居小筑",
        desc: "山景房 / 安静休息",
        priceText: "¥268起",
        tag: "需提前确认"
      }
    ]),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "zhengzhou_taishan",
    name: "泰山村",
    province: "河南省",
    city: "郑州市",
    district: "新郑市",
    town: "龙湖镇",
    village: "泰山村",
    fullName: "郑州市新郑市龙湖镇泰山村",
    placeLevel: "village",
    rating: "4.7",
    distanceText: "郑州南部近郊",
    tags: ["近郊休闲", "亲子短途", "农家菜", "轻松游玩", "家庭出游"],
    suitableFor: ["亲子", "家庭", "朋友", "自驾"],
    matchKeywords: ["亲子", "孩子", "小孩", "家庭", "周末", "短途", "轻松", "不累", "农家菜", "吃饭", "近郊", "南边", "休闲", "自驾"],
    description:
      "泰山村适合郑州南部近郊周末休闲，整体定位更偏家庭和亲子短途。它适合不想走太远、又希望有乡村氛围和农家菜选择的用户。行程建议控制在半天到一天，节奏轻一些更合适。",
    designations: [designation("美丽休闲乡村")],
    routeOptions: routeOptions("自驾约50分", "适合周末短途，建议避开午后返程拥堵。", "公共交通约1.5时", "建议提前确认站点和末班时间。"),
    foods: foods("适合亲子用餐"),
    stays: stays("近郊可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "gongyi_nanling",
    name: "南岭新村",
    province: "河南省",
    city: "郑州市",
    district: "巩义市",
    town: "小关镇",
    village: "南岭新村",
    fullName: "郑州市巩义市小关镇南岭新村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "巩义近郊山村",
    tags: ["山村慢游", "康养休闲", "轻松慢游", "自然风光", "家庭出游"],
    suitableFor: ["老人", "家庭", "朋友", "自驾"],
    matchKeywords: ["父母", "老人", "长辈", "康养", "放松", "山村", "慢游", "轻松", "不累", "自然", "空气", "家庭", "周末", "自驾"],
    description:
      "南岭新村更适合想要山村氛围、康养休闲和慢节奏体验的用户。这里的推荐重点不是打卡式游玩，而是放松、散步和短暂停留。带父母出行时，可以把它作为相对安静的周末乡村目的地。",
    designations: [designation("康养旅游村")],
    routeOptions: routeOptions("自驾约1.3时", "适合家庭同行，山区路段建议白天出发。", "公共交通需换乘", "建议提前确认换乘班次，不建议临时出发。"),
    foods: foods("适合清淡家常"),
    stays: stays("康养休闲", [
      {
        name: "山居小筑",
        desc: "山景房 / 早餐",
        priceText: "¥268起",
        tag: "需提前确认"
      }
    ]),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "gongyi_haishangqiao",
    name: "海上桥村",
    province: "河南省",
    city: "郑州市",
    district: "巩义市",
    town: "大峪沟镇",
    village: "海上桥村",
    fullName: "郑州市巩义市大峪沟镇海上桥村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "巩义周边传统村落",
    tags: ["传统村落", "乡村文化", "轻松走看", "周末短途", "家庭出游"],
    suitableFor: ["老人", "家庭", "朋友", "自驾"],
    matchKeywords: ["传统", "传统村落", "文化", "乡村文化", "村落", "走走", "看看", "散步", "父母", "老人", "周末", "历史", "慢游", "自驾"],
    description:
      "海上桥村更适合想找传统村落感觉、慢慢走看和体验乡村文化的用户。它的优势在于村落氛围和文化感，适合家庭或朋友做轻量半日游。建议把行程安排得松一点，留出散步和拍照时间。",
    designations: [designation("传统村落")],
    routeOptions: routeOptions("自驾约1.2时", "适合周末走看，建议提前确认停车点。", "公共交通需换乘", "建议提前规划返程时间。"),
    foods: foods("适合周末简餐"),
    stays: stays("周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "gongyi_mingyue",
    name: "明月村",
    province: "河南省",
    city: "郑州市",
    district: "巩义市",
    town: "米河镇",
    village: "明月村",
    fullName: "郑州市巩义市米河镇明月村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "巩义周边乡村休闲",
    tags: ["乡村休闲", "农家菜", "家庭短途", "朋友出游", "周末短途"],
    suitableFor: ["家庭", "朋友", "亲子", "自驾"],
    matchKeywords: ["农家菜", "吃饭", "美食", "家庭", "朋友", "亲子", "孩子", "周末", "短途", "乡村", "休闲", "轻松", "自驾"],
    description:
      "明月村适合家庭、朋友或亲子做周末乡村休闲。它的推荐重点是农家菜、短途放松和基础乡村体验，适合不想安排复杂行程的用户。建议以吃饭、散步和短暂停留为主。",
    designations: [designation("美丽休闲乡村")],
    routeOptions: routeOptions("自驾约1.1时", "适合朋友或家庭短途，建议午前出发。", "公共交通需换乘", "建议提前确认班次和返程时间。"),
    foods: foods("适合朋友聚餐", [
      {
        name: "时令家常菜",
        desc: "家常小炒 / 时令野菜",
        priceText: "人均约 ¥40",
        tag: "距离较近"
      }
    ]),
    stays: stays("需提前确认"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "dengfeng_xuantianmiao",
    name: "玄天庙村",
    province: "河南省",
    city: "郑州市",
    district: "登封市",
    town: "少林街道",
    village: "玄天庙村",
    fullName: "郑州市登封市少林街道玄天庙村",
    placeLevel: "village",
    rating: "4.7",
    distanceText: "登封文化乡村",
    tags: ["传统村落", "乡村文化", "研学体验", "拍照出片", "朋友出游"],
    suitableFor: ["朋友", "亲子", "研学", "家庭", "自驾"],
    matchKeywords: ["传统", "传统村落", "文化", "历史", "研学", "亲子", "孩子", "拍照", "出片", "朋友", "走走", "看看", "登封", "自驾"],
    description:
      "玄天庙村更适合想兼顾传统村落感、乡村文化和轻量研学的用户。它适合朋友拍照，也适合亲子做文化走看。相比单纯休闲村落，这里更适合把行程主题放在文化体验和慢步行上。",
    designations: [
      designation("传统村落"),
      designation("乡村旅游重点村", "样本具备文化和研学推荐价值，具体名单类别后续核验。")
    ],
    routeOptions: routeOptions("自驾约1.4时", "适合文化走看，建议预留完整半天。", "公共交通约2.5时", "换乘时间较长，建议提前确认线路。"),
    foods: foods("适合简餐补给"),
    stays: stays("周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "huiji_sunzhuang",
    name: "孙庄村",
    province: "河南省",
    city: "郑州市",
    district: "惠济区",
    town: "古荥镇",
    village: "孙庄村",
    fullName: "郑州市惠济区古荥镇孙庄村",
    placeLevel: "village",
    rating: "4.7",
    distanceText: "郑州北部近郊",
    tags: ["近郊休闲", "康养放松", "轻松慢游", "周末短途", "家庭出游"],
    suitableFor: ["老人", "家庭", "朋友", "自驾"],
    matchKeywords: ["近郊", "父母", "老人", "长辈", "康养", "放松", "轻松", "不累", "周末", "短途", "家庭", "散步", "北边", "自驾"],
    description:
      "孙庄村适合郑州北部近郊的轻松慢游和家庭周末出行。它更适合带父母、想放松、不希望行程太累的用户。建议以短途散步、休息和简单乡村体验为主，不必安排过多项目。",
    designations: [designation("康养旅游村")],
    routeOptions: routeOptions("自驾约40分", "适合近郊短途，建议错峰出发。", "公交约1.2时", "建议提前确认班次和步行距离。"),
    foods: foods("适合家庭简餐"),
    stays: stays("周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "gongyi_shigu",
    name: "石鼓村",
    province: "河南省",
    city: "郑州市",
    district: "巩义市",
    town: "竹林镇",
    village: "石鼓村",
    fullName: "郑州市巩义市竹林镇石鼓村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "巩义竹林镇周边",
    tags: ["山村慢游", "康养休闲", "乡村文化", "自驾短途", "家庭出游"],
    suitableFor: ["老人", "家庭", "朋友", "自驾"],
    matchKeywords: ["竹林", "石鼓", "山村", "康养", "老人", "父母", "放松", "轻松", "周末", "自驾", "短途", "文化"],
    description:
      "石鼓村位于巩义竹林镇片区，适合作为郑州西部方向的周末山村慢游补充样本。这里更适合家庭、自驾和轻松走看的需求，当前餐饮住宿仍按 seed 阶段保守配置。后续可继续补充停车点、坐标和真实服务信息。",
    designations: [designation("乡村旅游重点村")],
    routeOptions: routeOptions("自驾约1.2时", "适合周末自驾，建议白天错峰出发。", "公共交通需换乘", "建议提前确认镇区换乘班次。"),
    foods: foods("适合家庭简餐"),
    stays: stays("需提前确认"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "xinmi_zhujiaan",
    name: "朱家庵村",
    province: "河南省",
    city: "郑州市",
    district: "新密市",
    town: "米村镇",
    village: "朱家庵村",
    fullName: "郑州市新密市米村镇朱家庵村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "新密近郊乡村",
    tags: ["近郊短途", "乡村休闲", "农家菜", "家庭出游", "轻松慢游"],
    suitableFor: ["家庭", "朋友", "亲子", "自驾"],
    matchKeywords: ["新密", "米村", "朱家庵", "近郊", "农家菜", "家庭", "亲子", "轻松", "不累", "周末", "短途", "自驾"],
    description:
      "朱家庵村适合作为新密方向的近郊乡村休闲样本，适合周末短途、家庭同行和基础农家菜体验。它更偏轻松停留，不建议把行程安排得过满。当前服务信息为 seed 阶段，适合做推荐候选而非精确商家导流。",
    designations: [designation("美丽休闲乡村")],
    routeOptions: routeOptions("自驾约1时", "适合周末短途，建议上午出发。", "公共交通约2时", "换乘时间较长，建议提前确认班次。"),
    foods: foods("适合家庭聚餐"),
    stays: stays("近郊可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "gongyi_minquan",
    name: "民权村",
    province: "河南省",
    city: "郑州市",
    district: "巩义市",
    town: "大峪沟镇",
    village: "民权村",
    fullName: "郑州市巩义市大峪沟镇民权村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "巩义大峪沟周边",
    tags: ["乡村文化", "周末短途", "轻松走看", "农家菜", "家庭出游"],
    suitableFor: ["老人", "家庭", "朋友", "自驾"],
    matchKeywords: ["民权", "大峪沟", "文化", "走走", "看看", "父母", "老人", "农家菜", "周末", "自驾", "短途"],
    description:
      "民权村可作为巩义大峪沟方向的乡村文化和周末短途补充样本。它更适合轻松走看、家庭同行和顺路用餐，整体不强调高强度游玩。后续需要进一步核验具体停车、餐饮和住宿承接能力。",
    designations: [designation("乡村旅游重点村")],
    routeOptions: routeOptions("自驾约1.2时", "适合家庭自驾，建议提前确认停车位置。", "公共交通需换乘", "建议提前规划返程时间。"),
    foods: foods("适合周末简餐"),
    stays: stays("周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "dengfeng_zhaidong",
    name: "寨东村",
    province: "河南省",
    city: "郑州市",
    district: "登封市",
    town: "白坪乡",
    village: "寨东村",
    fullName: "郑州市登封市白坪乡寨东村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "登封山乡周边",
    tags: ["山野慢游", "自然风光", "康养休闲", "自驾短途", "朋友出游"],
    suitableFor: ["朋友", "家庭", "情侣", "自驾"],
    matchKeywords: ["寨东", "白坪", "登封", "风景", "自然", "山野", "拍照", "放松", "康养", "周末", "自驾"],
    description:
      "寨东村适合登封方向的山乡慢游和自然风光需求，更适合朋友、情侣或家庭自驾。它可以作为想看山野、放松和拍照用户的备选。当前仍是 seed 数据，路线与服务细节需后续人工补齐。",
    designations: [designation("乡村旅游重点村")],
    routeOptions: routeOptions("自驾约1.5时", "山乡路段建议白天出发，避开返程高峰。", "公共交通约2.5时", "换乘时间较长，建议提前确认班次。"),
    foods: foods("适合简餐补给"),
    stays: stays("山乡可选", [
      {
        name: "山居小筑",
        desc: "山景房 / 需提前确认",
        priceText: "¥268起",
        tag: "周边可选"
      }
    ]),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "dengfeng_dajindian_oldstreet",
    name: "大金店老街",
    province: "河南省",
    city: "郑州市",
    district: "登封市",
    town: "大金店镇",
    village: "大金店老街",
    fullName: "郑州市登封市大金店镇大金店老街",
    placeLevel: "unknown",
    rating: "4.7",
    distanceText: "登封传统街区",
    tags: ["乡村文化", "传统街区", "轻松走看", "拍照出片", "研学体验"],
    suitableFor: ["朋友", "亲子", "研学", "家庭", "自驾"],
    matchKeywords: ["大金店", "老街", "传统", "文化", "历史", "走走", "看看", "拍照", "出片", "研学", "亲子", "自驾"],
    description:
      "大金店老街更适合想看传统街区、乡村文化和轻量研学的用户。它不按普通自然村处理，而是作为登封文化走看类 seed 目的地保留。推荐时更适合文化、拍照和短暂停留场景。",
    designations: [designation("传统村落", "名单条目为大金店老街，placeLevel 暂标记为 unknown，后续核验行政层级。")],
    routeOptions: routeOptions("自驾约1.3时", "适合文化走看，建议预留半天。", "公共交通约2.3时", "建议提前确认登封方向班次。"),
    foods: foods("适合街区简餐"),
    stays: stays("登封周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "dengfeng_yuanqiao",
    name: "袁桥村",
    province: "河南省",
    city: "郑州市",
    district: "登封市",
    town: "大金店镇",
    village: "袁桥村",
    fullName: "郑州市登封市大金店镇袁桥村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "登封大金店周边",
    tags: ["传统村落", "乡村文化", "轻松走看", "周末短途", "家庭出游"],
    suitableFor: ["老人", "家庭", "朋友", "研学", "自驾"],
    matchKeywords: ["袁桥", "大金店", "传统", "村落", "文化", "历史", "父母", "老人", "走走", "看看", "周末", "自驾"],
    description:
      "袁桥村适合作为登封传统文化走看类目的地的补充样本。它更适合家庭、老人和朋友做轻量走看，不适合过度紧凑的打卡行程。当前服务信息采用保守 seed 文案，后续需要补充实地核验。",
    designations: [designation("传统村落")],
    routeOptions: routeOptions("自驾约1.3时", "适合传统村落走看，建议错峰出发。", "公共交通约2.4时", "换乘较多，建议提前确认线路。"),
    foods: foods("适合家常简餐"),
    stays: stays("周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "dengfeng_angou",
    name: "安沟村",
    province: "河南省",
    city: "郑州市",
    district: "登封市",
    town: "徐庄镇",
    village: "安沟村",
    fullName: "郑州市登封市徐庄镇安沟村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "登封徐庄镇周边",
    tags: ["山野慢游", "自然风光", "拍照出片", "自驾短途", "朋友出游"],
    suitableFor: ["朋友", "情侣", "家庭", "自驾"],
    matchKeywords: ["安沟", "徐庄", "登封", "风景", "拍照", "出片", "自然", "山野", "朋友", "情侣", "自驾", "周末"],
    description:
      "安沟村适合登封徐庄镇方向的山野慢游和拍照需求。它可作为朋友出游、自然风光和自驾短途的候选，不建议把它定位成重度商业化目的地。当前餐饮住宿信息为通用 seed 文案。",
    designations: [designation("乡村旅游重点村")],
    routeOptions: routeOptions("自驾约1.5时", "适合朋友自驾，建议提前查看天气。", "公共交通约2.5时", "建议提前确认班次并预留换乘时间。"),
    foods: foods("适合山野补给"),
    stays: stays("山乡可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "dengfeng_baishiya",
    name: "柏石崖村",
    province: "河南省",
    city: "郑州市",
    district: "登封市",
    town: "徐庄镇",
    village: "柏石崖村",
    fullName: "郑州市登封市徐庄镇柏石崖村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "登封山村短途",
    tags: ["自然风光", "山村慢游", "拍照出片", "周末短途", "自驾友好"],
    suitableFor: ["朋友", "情侣", "家庭", "自驾"],
    matchKeywords: ["柏石崖", "徐庄", "风景", "拍照", "出片", "山村", "自然", "周末", "短途", "自驾", "朋友"],
    description:
      "柏石崖村更适合想找山村自然感、拍照和周末短途的用户。它适合作为登封方向自驾游的备选，节奏建议轻一点。服务承接信息仍需核验，因此当前不写具体商家名。",
    designations: [designation("乡村旅游重点村")],
    routeOptions: routeOptions("自驾约1.5时", "适合周末自驾，山区路段建议白天通行。", "公共交通约2.6时", "换乘较长，建议提前确认班次。"),
    foods: foods("适合简餐补给"),
    stays: stays("需提前确认", [
      {
        name: "山居小筑",
        desc: "山景房 / 早餐",
        priceText: "¥268起",
        tag: "周边可选"
      }
    ]),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "dengfeng_yanglin",
    name: "杨林村",
    province: "河南省",
    city: "郑州市",
    district: "登封市",
    town: "徐庄镇",
    village: "杨林村",
    fullName: "郑州市登封市徐庄镇杨林村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "登封徐庄镇周边",
    tags: ["乡村休闲", "自然风光", "轻松走看", "家庭出游", "自驾短途"],
    suitableFor: ["家庭", "朋友", "老人", "自驾"],
    matchKeywords: ["杨林", "徐庄", "乡村", "自然", "轻松", "走走", "看看", "父母", "老人", "家庭", "自驾", "周末"],
    description:
      "杨林村适合登封徐庄镇片区的乡村休闲和轻松走看需求。它可以作为家庭或朋友自驾短途的补充候选，整体更偏保守、慢节奏。后续可根据实地资料补充更清晰的特色点。",
    designations: [designation("美丽休闲乡村")],
    routeOptions: routeOptions("自驾约1.4时", "适合家庭自驾，建议错峰出发。", "公共交通约2.4时", "建议提前确认镇区换乘。"),
    foods: foods("适合家庭简餐"),
    stays: stays("周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "xinmi_chaohua",
    name: "超化村",
    province: "河南省",
    city: "郑州市",
    district: "新密市",
    town: "超化镇",
    village: "超化村",
    fullName: "郑州市新密市超化镇超化村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "新密超化镇周边",
    tags: ["乡村文化", "近郊短途", "农家菜", "轻松慢游", "家庭出游"],
    suitableFor: ["老人", "家庭", "朋友", "自驾"],
    matchKeywords: ["超化", "新密", "文化", "近郊", "短途", "农家菜", "父母", "老人", "轻松", "不累", "家庭", "自驾"],
    description:
      "超化村适合新密方向的近郊乡村文化和轻松短途体验。它适合家庭、父母同行和想吃农家菜的用户，行程不宜安排得过重。当前 seed 重点是补充郑州西南方向的推荐覆盖。",
    designations: [designation("乡村旅游重点村")],
    routeOptions: routeOptions("自驾约1时", "适合近郊自驾，建议错峰出发。", "公共交通约2时", "建议提前确认班次和步行距离。"),
    foods: foods("适合家庭聚餐"),
    stays: stays("近郊可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "xinmi_dawei",
    name: "大隗村",
    province: "河南省",
    city: "郑州市",
    district: "新密市",
    town: "大隗镇",
    village: "大隗村",
    fullName: "郑州市新密市大隗镇大隗村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "新密大隗镇周边",
    tags: ["近郊休闲", "乡村文化", "农家菜", "周末短途", "自驾友好"],
    suitableFor: ["家庭", "朋友", "老人", "自驾"],
    matchKeywords: ["大隗", "新密", "近郊", "周末", "短途", "农家菜", "文化", "轻松", "家庭", "父母", "自驾"],
    description:
      "大隗村更适合新密方向的周末自驾和基础乡村休闲。它可以承接想轻松转转、吃家常菜、不过度爬山的需求。当前仍为 seed 阶段，适合做备选推荐而非精确路线产品。",
    designations: [designation("美丽休闲乡村")],
    routeOptions: routeOptions("自驾约1时", "适合周末自驾，建议午前出发。", "公共交通约2时", "换乘时间较长，建议提前确认。"),
    foods: foods("适合家常简餐"),
    stays: stays("需提前确认"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "xinmi_lvlou",
    name: "吕楼村",
    province: "河南省",
    city: "郑州市",
    district: "新密市",
    town: "刘寨镇",
    village: "吕楼村",
    fullName: "郑州市新密市刘寨镇吕楼村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "新密刘寨镇周边",
    tags: ["近郊短途", "亲子休闲", "家庭出游", "农家菜", "轻松慢游"],
    suitableFor: ["亲子", "家庭", "老人", "自驾"],
    matchKeywords: ["吕楼", "刘寨", "新密", "亲子", "孩子", "家庭", "父母", "老人", "轻松", "不累", "农家菜", "周末", "自驾"],
    description:
      "吕楼村适合作为新密刘寨镇方向的亲子和家庭短途补充样本。它更适合轻松出行、简单用餐和周末休闲，不强调强景区属性。后续可补充具体活动点和停车信息。",
    designations: [designation("美丽休闲乡村")],
    routeOptions: routeOptions("自驾约55分", "适合亲子和家庭同行，建议错峰出发。", "公共交通约1.8时", "建议提前确认班次。"),
    foods: foods("适合亲子用餐"),
    stays: stays("近郊可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "xingyang_shidonggou",
    name: "石洞沟村",
    province: "河南省",
    city: "郑州市",
    district: "荥阳市",
    town: "高山镇",
    village: "石洞沟村",
    fullName: "郑州市荥阳市高山镇石洞沟村",
    placeLevel: "village",
    rating: "4.7",
    distanceText: "荥阳高山镇周边",
    tags: ["自然风光", "拍照出片", "山野慢游", "朋友出游", "自驾短途"],
    suitableFor: ["朋友", "情侣", "家庭", "自驾"],
    matchKeywords: ["石洞沟", "荥阳", "高山", "风景", "拍照", "出片", "自然", "山野", "朋友", "情侣", "周末", "自驾"],
    description:
      "石洞沟村适合作为郑州西部拍照、自然风光和山野慢游方向的新增样本。它更适合朋友或情侣自驾短途，也可以作为想看风景用户的备选。当前不引入远程图片，前端继续使用本地视觉占位。",
    designations: [designation("乡村旅游重点村")],
    routeOptions: routeOptions("自驾约1.1时", "适合周末自驾，建议提前查看天气。", "公共交通约2.2时", "换乘时间较长，建议提前确认。"),
    foods: foods("适合山野补给"),
    stays: stays("周边可选", [
      {
        name: "山居小筑",
        desc: "山景房 / 需提前确认",
        priceText: "¥268起",
        tag: "慢住可选"
      }
    ]),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "zhengzhou_madu",
    name: "马渡村",
    province: "河南省",
    city: "郑州市",
    district: "金水区",
    town: "兴达路街道",
    village: "马渡村",
    fullName: "郑州市金水区兴达路街道马渡村",
    placeLevel: "village",
    rating: "4.7",
    distanceText: "郑州市区近郊",
    tags: ["城市近郊", "轻松慢游", "亲子休闲", "周末短途", "家庭出游"],
    suitableFor: ["老人", "亲子", "家庭", "朋友", "自驾"],
    matchKeywords: ["马渡", "金水", "市区", "近郊", "亲子", "孩子", "父母", "老人", "轻松", "不累", "周末", "短途", "自驾"],
    description:
      "马渡村更适合希望离市区近、轻松出行和周末短暂停留的用户。它在郑州近郊样本中有较好的通勤友好度，适合亲子、老人和家庭。当前推荐以轻松慢游和基础乡村休闲为主。",
    designations: [designation("美丽休闲乡村")],
    routeOptions: routeOptions("自驾约35分", "适合市区近郊短途，建议错峰出发。", "公交约1时", "公共交通相对友好，仍建议提前查班次。"),
    foods: foods("适合家庭简餐"),
    stays: stays("周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "xingyang_zaoshugou",
    name: "枣树沟村",
    province: "河南省",
    city: "郑州市",
    district: "荥阳市",
    town: "高村乡",
    village: "枣树沟村",
    fullName: "郑州市荥阳市高村乡枣树沟村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "荥阳乡村周边",
    tags: ["乡村休闲", "亲子休闲", "农家菜", "周末短途", "轻松慢游"],
    suitableFor: ["亲子", "家庭", "老人", "自驾"],
    matchKeywords: ["枣树沟", "荥阳", "高村", "亲子", "孩子", "家庭", "农家菜", "轻松", "不累", "周末", "短途", "自驾"],
    description:
      "枣树沟村适合荥阳方向的亲子、家庭和轻松乡村休闲需求。它可以作为不想跑太远、希望周末吃饭散步的备选。当前不写具体采摘或商家信息，避免未核验内容过度具体化。",
    designations: [designation("美丽休闲乡村")],
    routeOptions: routeOptions("自驾约1时", "适合家庭自驾，建议午前出发。", "公共交通约2时", "建议提前确认换乘和返程时间。"),
    foods: foods("适合家庭聚餐"),
    stays: stays("近郊可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  },
  {
    id: "zhongmu_beidi",
    name: "北堤村",
    province: "河南省",
    city: "郑州市",
    district: "中牟县",
    town: "狼城岗镇",
    village: "北堤村",
    fullName: "郑州市中牟县狼城岗镇北堤村",
    placeLevel: "village",
    rating: "4.6",
    distanceText: "中牟近郊乡村",
    tags: ["近郊短途", "轻松慢游", "农家菜", "家庭出游", "自驾友好"],
    suitableFor: ["老人", "家庭", "朋友", "自驾"],
    matchKeywords: ["北堤", "中牟", "狼城岗", "近郊", "短途", "轻松", "不累", "农家菜", "父母", "老人", "家庭", "自驾"],
    description:
      "北堤村适合作为郑州东部和中牟方向的近郊轻松慢游样本。它更适合家庭、自驾和想吃家常农家菜的用户，整体建议以短途停留为主。当前路线和服务细节仍需后续核验。",
    designations: [designation("乡村旅游重点村")],
    routeOptions: routeOptions("自驾约1时", "适合东部近郊自驾，建议错峰出行。", "公共交通约2时", "建议提前确认班次。"),
    foods: foods("适合家庭简餐"),
    stays: stays("周边可选"),
    sourceConfidence: "中",
    dataStatus: "seed"
  }
];

export const REAL_VILLAGES: RealVillageData[] = VILLAGE_SEEDS.map(withQuality);
