# Web V1.2 /api/plan 优先读取 Supabase 推荐 POI

## 1. 目标

Web V1.1.2 已经通过 `scripts/auto-rank-village-pois.ts` 为 `village_pois` 自动标记 `is_recommended = true`。V1.2 的目标是让 `/api/plan` 在推荐村庄后，优先读取这些推荐 POI，减少对 seed 数据和临时高德检索结果的依赖。

本阶段不修改 `/api/plan` 请求结构，不修改 `/api/route`，不改 Supabase schema，也不改前端页面。

## 2. 新增读取方法

新增：

```ts
lib/data/village-recommended-pois.ts
```

核心方法：

```ts
getRecommendedPoisForVillage({
  villageId,
  villageCode,
  villageName,
  fullName,
  lookupKeys
})
```

读取 `village_pois`：

- `village_id = 当前推荐村庄 id`
- `is_recommended = true`
- `data_review_status in ("verified", "needs_review")`

返回：

```ts
{
  activity: RecommendedPoi[],
  food: RecommendedPoi[],
  stay: RecommendedPoi[],
  parking: RecommendedPoi[]
}
```

查询失败时只打印 `console.warn`，返回空数组，不让 `/api/plan` 500。

## 3. 排序规则

读取后的 POI 在服务端排序：

1. `verified` 优先于 `needs_review`
2. 同类别内 `distance_meters` 越小越靠前
3. 有 `rating` / `tel` / `price_text` 的候选更靠前

当前 verified 仍为 0 是正常状态，因此线上主要会使用：

```txt
needs_review + is_recommended = true
```

并在前端标签中体现为“自动预筛”。

## 4. 字段映射

### activity → playPlaces

```ts
{
  name: poi.name,
  category: poi.typeText || "乡村体验",
  address: poi.address,
  distanceText: poi.distanceText,
  reason: "基于用户需求生成的简短说明",
  source: poi.source || "supabase"
}
```

如果存在推荐 activity POI，则 `/api/plan` 优先使用这些真实候选；只有没有推荐 activity 时，才回退到现有高德临时游玩点。

### food → foods

```ts
{
  name: poi.name,
  desc: poi.typeText || poi.address || "周边餐饮候选",
  priceText: poi.priceText || "价格请出发前确认",
  tag: poi.dataReviewStatus === "verified" ? "已核验" : "自动预筛"
}
```

### stay → stays

```ts
{
  name: poi.name,
  desc: poi.typeText || poi.address || "周边住宿候选",
  priceText: poi.priceText || "价格请出发前确认",
  tag: poi.dataReviewStatus === "verified" ? "已核验" : "自动预筛"
}
```

### parking → travelTips

如果存在 parking 推荐 POI，会追加：

```txt
附近有停车候选点：xxx，建议出发前再次确认车位和开放情况。
```

## 5. DeepSeek 真实 POI 上下文

V1.2 会把推荐 POI 作为上下文传入 DeepSeek：

- activity names
- food names
- stay names
- parking names
- needs_review POI names

DeepSeek 只能基于这些传入名称生成解释，不允许新增未提供的景点、餐厅、民宿或停车点。

对于 `needs_review` POI，prompt 要求使用“候选”“建议出发前确认”等表达。

后端仍会对白名单做保护：

- `playPlaces.name` 必须来自真实候选名称
- `foods` / `stays` 由规则层直接从 Supabase 推荐 POI 映射，不由 DeepSeek 编造
- DeepSeek 失败时保留规则层结果

## 6. fallback 优先级

POI 使用优先级：

1. Supabase `verified + is_recommended`
2. Supabase `needs_review + is_recommended`
3. 当前高德临时 activity 候选
4. 原 seed foods / stays
5. 友好兜底

即使 Supabase 查询失败或某个类别为空，`/api/plan` 也会继续返回可用方案。

## 7. dataQuality

`dataQuality` 新增：

```ts
poiSource?: "verified" | "auto_ranked" | "fallback"
```

规则：

- 使用 verified POI：`verified`
- 使用 needs_review + is_recommended：`auto_ranked`
- 使用 seed / fallback：`fallback`

前端暂不展示该字段，仅用于后续诊断和数据质量治理。

## 8. 验收建议

本地启动后访问：

```txt
http://localhost:3000/agent
```

测试输入：

```txt
我要去郑州市樱桃沟进行农家乐，请你为我推荐几个游玩的地方
```

预期：

- 推荐村庄不应是 activity=0 的村庄
- “这里可以怎么玩”优先展示 `village_pois.is_recommended=true` 的 activity POI
- “觅美食”优先展示推荐 food POI
- “寻住处”优先展示推荐 stay POI
- `travelTips` 可出现停车候选提醒
- DeepSeek 不编造候选外地点
- `/api/plan` 不报 500

注意：本轮开发不运行 npm；构建验收可在上线前执行 `npm run build`。

## 9. Web V1.2.1 修正：村庄精确命中与 POI lookup key

V1.2.1 修复两个关键问题：

1. 用户明确输入村庄名称或别名时，推荐逻辑必须优先命中该村庄。
2. `village_pois.village_id` 可能存的是 Supabase `villages.id`，而推荐链路里的 `recommended.id` 可能是 `village_code`，因此不能只用单一 id 查询 POI。

### 9.1 樱桃沟精确命中

新增：

```txt
lib/data/village-name-match.ts
```

当输入包含以下别名时，会优先命中 `zhengzhou_yingtaogou`：

- 樱桃沟
- 樱桃沟社区
- 郑州樱桃沟
- 郑州市樱桃沟
- 樱桃沟农家乐

点名村庄优先级高于标签匹配和 POI 覆盖过滤。也就是说，用户说“我要去郑州市樱桃沟进行农家乐”，`recommended` 应优先为“樱桃沟社区”，而不是被其他高分村庄替代。

### 9.2 POI lookup key 修正

`getRecommendedPoisForVillage` 改为接收对象：

```ts
getRecommendedPoisForVillage({
  villageId,
  villageCode,
  villageName,
  fullName,
  lookupKeys
})
```

查询前会生成 lookupKeys：

- `recommended.id`
- `villageCode`
- `name`
- `fullName`
- `village`
- 从 `villages` 表反查得到的真实 UUID `id`
- 从 `villages` 表反查得到的 `village_code`

V1.2.3 后最终查询只使用解析出的 UUID：

```txt
village_pois.village_id in poiQueryVillageIds
```

`lookupKeys` 仅作为调试和反查 `villages.id` 使用，不再直接用于查询 `village_pois.village_id`。

### 9.3 candidate 兜底

POI 读取优先级调整为：

1. `verified + is_recommended = true`
2. `needs_review + is_recommended = true`
3. 同村同类别 `needs_review` 近距离候选
4. seed / fallback

因此 `verified = 0` 不再代表没有真实 POI。当前自动预筛阶段主要展示 `needs_review + is_recommended = true`，标签为“自动预筛”。

### 9.4 dataQuality 调试字段

`dataQuality` 增加：

```ts
recommendedPoiCounts?: {
  activity: number;
  food: number;
  stay: number;
  parking: number;
};
explicitVillageMatched?: boolean;
explicitVillageMatchName?: string;
```

`poiSource` 增加：

```ts
"candidate"
```

用于区分“同村 needs_review 候选兜底”和 seed fallback。

## 10. Web V1.2.2 修正：强制使用 Supabase UUID 对齐 village_pois

V1.2.2 根据线上诊断进一步确认：`樱桃沟社区` 在 `villages` 表中的真实 UUID 为：

```txt
15aa5739-bc81-4432-8193-d2a51e02459d
```

而 `village_pois.village_id` 使用的正是这个 UUID。此前 `/api/plan` 推荐结果中的 `recommended.id` 可能仍是业务 code：

```txt
zhengzhou_yingtaogou
```

因此即使 POI 数据存在，也可能因为查询 key 不一致而读取不到。

### 10.1 UUID 优先解析

`getRecommendedPoisForVillage()` 内部新增标准化解析：

```txt
resolveVillagePoiLookupKeys(input)
```

处理顺序：

1. 收集 `villageId / villageCode / villageName / fullName / lookupKeys`
2. 查询 `villages` 表
3. 将匹配到的 Supabase UUID `villages.id` 放到 `lookupKeys` 最前面
4. 再用 `village_pois.village_id in poiQueryVillageIds` 查询 POI

也就是说，长期方案是：只要传入的是 `village_code` 或中文名，就先反查 `villages.id`，再用 UUID 查 `village_pois`。

### 10.2 樱桃沟演示兜底

为了保证当前演示链路稳定，如果 lookup key 中包含：

- `zhengzhou_yingtaogou`
- `樱桃沟`
- `樱桃沟社区`
- `郑州樱桃沟`
- `郑州市樱桃沟`
- `樱桃沟农家乐`

会强制追加：

```txt
15aa5739-bc81-4432-8193-d2a51e02459d
zhengzhou_yingtaogou
樱桃沟社区
```

这是短期演示兜底；长期仍应统一使用 Supabase UUID 作为 POI 外键。

### 10.3 推荐 POI 主查询

主查询只读取：

```txt
is_recommended = true
data_review_status in ("verified", "needs_review")
```

如果主查询为空，才读取同村 `needs_review` 候选作为 `candidate` fallback。

### 10.4 dataQuality 调试字段

`dataQuality` 新增：

```ts
poiLookupKeys?: string[];
poiResolvedVillageId?: string;
poiLookupMatchedKey?: string;
poiLookupDebug?: {
  totalFound: number;
  recommendedFound: number;
  usedRecommended: boolean;
  usedCandidateFallback: boolean;
};
```

樱桃沟测试时，预期：

```txt
poiResolvedVillageId = 15aa5739-bc81-4432-8193-d2a51e02459d
recommendedPoiCounts.activity > 0
recommendedPoiCounts.food > 0
recommendedPoiCounts.stay > 0
recommendedPoiCounts.parking > 0
poiSource = auto_ranked
```

### 10.5 seed fallback 收紧

如果 Supabase 推荐 POI 查询到了任何类别数据：

- `activity > 0`：`playPlaces` 来自 activity POI
- `food > 0`：`foods` 来自 food POI
- `stay > 0`：`stays` 来自 stay POI
- `parking > 0`：`travelTips` 追加停车候选点

只有当推荐 POI 查询结果完全为空时，才允许使用 seed / fallback。

## 11. Web V1.2.3 修正：village_pois 只使用 UUID 查询

V1.2.3 进一步确认：`village_pois.village_id` 是 UUID 类型。如果在 `village_id in (...)` 中混入 `village_code` 或中文名，PostgREST 查询可能失败或返回空。

因此本轮将 lookup key 拆成两类：

```ts
debugLookupKeys: string[]; // 所有传入和反查得到的调试 key
uuidLookupKeys: string[];  // 实际用于 village_pois.village_id 查询的 UUID
```

实现上对应返回字段：

```ts
poiLookupKeys?: string[];      // debug keys
poiQueryVillageIds?: string[]; // 实际查询 village_pois 的 UUID
```

规则：

1. `zhengzhou_yingtaogou / 樱桃沟 / 樱桃沟社区 / 郑州樱桃沟 / 郑州市樱桃沟 / 樱桃沟农家乐` 只用于反查 `villages.id`。
2. 查询 `village_pois.village_id` 时，只允许使用 UUID。
3. 如果没有解析出 UUID，直接返回空，并在 `poiLookupDebug.error` 中标记：

```txt
no_uuid_lookup_key
```

樱桃沟演示兜底仍然保留，会强制将以下 UUID 加入 `poiQueryVillageIds`：

```txt
15aa5739-bc81-4432-8193-d2a51e02459d
```

验收时应看到：

```txt
dataQuality.poiResolvedVillageId = 15aa5739-bc81-4432-8193-d2a51e02459d
dataQuality.poiQueryVillageIds includes 15aa5739-bc81-4432-8193-d2a51e02459d
dataQuality.recommendedPoiCounts.activity > 0
dataQuality.recommendedPoiCounts.food > 0
dataQuality.recommendedPoiCounts.stay > 0
dataQuality.recommendedPoiCounts.parking > 0
```

## 12. Web V1.2.4 结果页交互补全

V1.2.4 详见：

```txt
docs/Web-V1.2.4-result-interaction.md
```

本阶段补充：

- 删除结果页村庄主卡片重复说明块和重复 tags
- 新增 `/api/map-preview` 服务端代理高德静态地图，避免前端暴露 key
- food / stay 从 `village_pois` 透传坐标、地址和 poiId，点击卡片可打开高德 marker 或搜索
- `/api/plan` 新增可选 `preferredVillageId / preferredVillageName / preferredVillageCode`，用于点击备选村庄后切换方案
