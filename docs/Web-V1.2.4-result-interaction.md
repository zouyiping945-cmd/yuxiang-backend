# Web V1.2.4 结果页交互补全与视觉修正

## 1. 本轮目标

V1.2.4 在 V1.2.3 已能读取真实推荐 POI 的基础上，补齐 `/agent` 结果页的关键交互：

- 删除村庄主卡片中的重复说明与重复标签
- 路线规划卡片增加地图预览
- 美食 / 住宿卡片支持跳转高德地图
- 备选村庄支持点击切换生成新方案

本轮不修改 Supabase schema，不修改 scripts，不修改小程序，不改 package.json。

## 2. 删除重复说明区域

结果页村庄主卡片保留：

- 村庄名称
- 城市 / 评分 / 匹配度
- 村庄 description
- 第一组 tags
- “这里可以怎么玩”真实 POI 区

删除了原先位于 tags 下方的重复推荐说明块，以及其下方重复 tags，避免与村庄介绍和真实 POI 区重复。

## 3. 路线规划地图预览

新增：

```txt
app/api/map-preview/route.ts
```

前端请求：

```txt
/api/map-preview?lng=xxx&lat=xxx&name=目的地名称
```

服务端读取：

```txt
AMAP_WEB_SERVICE_KEY
```

如果未配置，也会尝试：

```txt
AMAP_KEY
```

服务端代理请求高德静态地图 API，并把图片返回给前端。这样不会把高德 key 暴露到浏览器。

如果地图预览失败或没有坐标，前端展示 CSS 占位图：

```txt
地图预览暂不可用，点击下方按钮打开高德地图
```

## 4. 美食 / 住宿跳转高德

`FoodOption` / `StayOption` 新增可选字段：

```ts
latitude?: number | null;
longitude?: number | null;
address?: string | null;
poiId?: string | null;
```

`village_pois` 映射 food / stay 时，会把 POI 坐标、地址和 poiId 一起传给前端。

点击卡片时：

- 有 `longitude / latitude`：打开高德 marker URI
- 没有坐标但有 name：打开高德 search URI
- 都没有：提示“暂无可跳转地址，请出发前手动搜索确认”

卡片 hover 时增加轻微浮起和边框反馈。

## 5. 备选村庄切换方案

`/api/plan` 请求新增可选字段：

```ts
preferredVillageId?: string;
preferredVillageName?: string;
preferredVillageCode?: string;
```

前端点击备选村庄时，会重新请求 `/api/plan`，并传入上述字段。

后端收到 preferred 字段后：

- 优先锁定该村庄作为 recommended
- 不再让普通打分覆盖它
- 仍读取该村庄的 recommended POI
- 仍调用 DeepSeek 做解释增强
- 旧请求不传 preferred 字段时，原逻辑保持不变

切换中前端展示：

```txt
正在切换到该备选村庄…
```

失败时提示：

```txt
切换方案失败，请稍后再试
```

并保留当前方案。

## 6. 验收建议

输入：

```txt
我要去郑州市樱桃沟进行农家乐，请你为我推荐几个游玩的地方
```

预期：

- 推荐村庄为樱桃沟社区
- 主卡片不再出现重复说明块和重复 tags
- “这里可以怎么玩”展示真实 POI
- 路线卡片出现地图预览或地图占位图
- 点击美食 / 住宿卡片可打开高德位置或搜索
- 点击备选村庄可切换新方案
- 切换后路线 / 美食 / 住宿 / 游玩 POI 同步更新
- `/api/plan` 旧请求保持兼容

## 7. Web V1.2.5 布局压缩

V1.2.5 只调整结果页 UI，不改 POI、DeepSeek、Supabase 查询逻辑。

本轮调整：

- 删除村庄主卡片底部 `travelTips / reasons` 对勾列表，避免与路线和停车建议重复。
- 路线规划卡片删除大段文字建议，仅保留距离 / 耗时、地图预览和底部按钮。
- 放大地图预览区域，使其成为路线卡片主体内容。
- 美食 / 住宿列表固定为 3 行等高卡片，并与路线地图区域高度对齐。
- 保留美食 / 住宿点击高德、打开地图、复制路线建议、备选村庄切换等原有交互。
