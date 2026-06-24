const body = {
  inputText: "我要去郑州市樱桃沟进行农家乐，请你为我推荐几个游玩的地方",
  companions: ["带父母"],
  demands: ["农家菜", "轻松慢游", "不想太累"]
};

const res = await fetch("http://127.0.0.1:3000/api/plan", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body)
});

const json = await res.json();
const d = json.data || json;

const summary = {
  ok: json.ok,
  recommendedName: d.recommended?.name,
  recommendedId: d.recommended?.id,
  dataQuality: d.dataQuality,
  playPlaces: (d.playPlaces || []).map(x => ({
    name: x.name,
    category: x.category,
    source: x.source,
    distanceText: x.distanceText
  })),
  foods: (d.foods || []).map(x => ({
    name: x.name,
    desc: x.desc,
    priceText: x.priceText,
    tag: x.tag
  })),
  stays: (d.stays || []).map(x => ({
    name: x.name,
    desc: x.desc,
    priceText: x.priceText,
    tag: x.tag
  })),
  travelTips: d.travelTips
};

console.log(JSON.stringify(summary, null, 2));
