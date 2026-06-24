# Web V1.1 乡村 POI 数据补全第一阶段

## 1. 为什么要补全真实 POI 数据

Web V1.0.4 已经能在 `/agent` 结果页临时调用高德 POI 搜索，展示“这里可以怎么玩”的真实候选地点。但临时检索更适合在线生成，不适合作为长期稳定的数据基础。

V1.1 的目标是把真实 POI 候选沉淀到 `village_pois` 表中，为后续“游玩点、美食、住宿、停车”统一审核和推荐打基础。

## 2. 四类 POI 如何支撑前端

`village_pois.category` 统一使用四类：

- `activity`：这里怎么玩 / 游玩点 / 体验点
- `food`：觅美食
- `stay`：寻住处
- `parking`：停车点

后续前端和 `/api/plan` 可以基于同一张表读取真实、可审核、可推荐的 POI，而不是只依赖 seed 数据或临时搜索。

## 3. 高德 POI 只是候选

高德周边搜索结果只作为候选数据，不直接等于正式推荐。

新增 activity POI 时默认：

- `source = "amap"`
- `data_review_status = "needs_review"`
- `is_recommended = false`

不会自动设置为 `verified`，也不会自动设置为 `is_recommended = true`。

## 4. 审核字段含义

`data_review_status`：

- `needs_review`：高德或脚本生成的候选，待人工核验
- `verified`：人工确认真实可用
- `rejected`：人工确认不适合作为展示数据

`is_recommended`：

- `false`：仅为候选或普通 POI
- `true`：人工精选，可进入前端重点展示

## 5. 覆盖标准

V1.1 第一阶段最低候选覆盖标准：

- activity >= 4
- food >= 3
- stay >= 2
- parking >= 1

覆盖检查脚本：

```bash
npx tsx scripts/check-village-poi-coverage.ts
```

输出会列出每个村庄四类 POI 的数量、verified 数量、recommended 数量，以及是否达到最低覆盖。

## 6. 人工审核流程

建议流程：

1. 运行 activity 同步脚本，补齐游玩候选：

   ```bash
   npx tsx scripts/amap-sync-village-activity-pois.ts
   ```

2. 运行覆盖检查脚本，定位不足村庄：

   ```bash
   npx tsx scripts/check-village-poi-coverage.ts
   ```

3. 导出审核 CSV：

   ```bash
   npx tsx scripts/export-village-poi-review.ts
   ```

4. 人工打开 `docs/review/village-poi-review.csv`，核验 POI 的名称、地址、距离、电话、评分、类型。

5. 在 Supabase 中将可用 POI 改为：

   - `data_review_status = "verified"`
   - 精选项再设置 `is_recommended = true`

6. 明显不相关或错误的候选改为：

   - `data_review_status = "rejected"`

## 7. 本阶段新增脚本

- `scripts/amap-sync-village-activity-pois.ts`
  - 从 villages 读取有坐标的村庄
  - 使用高德周边搜索获取 activity 候选
  - 每个村庄最多保存 12 条
  - 不覆盖 verified
  - 插入前校验 object keys 一致，避免 PGRST102

- `scripts/check-village-poi-coverage.ts`
  - 检查 24 个村庄四类 POI 覆盖
  - 输出 needs_review / verified / rejected / recommended 数量
  - 给出 PASS / WARN 结论

- `scripts/export-village-poi-review.ts`
  - 导出 `docs/review/village-poi-review.csv`
  - 方便人工审核和筛选推荐 POI

## 8. 下一步 Web V1.2

Web V1.2 建议：

- `/api/plan` 优先读取 `village_pois` 中 `verified` / `is_recommended = true` 的真实 POI
- “这里怎么玩”展示 verified / recommended activity
- “觅美食”展示 verified / recommended food
- “寻住处”展示 verified / recommended stay
- DeepSeek 基于真实数据库 POI 生成解释，而不是依赖临时搜索结果

## 9. Web V1.1.1 推荐候选池 POI 覆盖过滤

V1.1.1 在 `/api/plan` 推荐阶段引入 POI 覆盖度过滤，目标是避免 activity 覆盖为 0 的村庄成为正式首推。

新增 `getVillagePoiCoverage()`：

- 从 Supabase `village_pois` 读取 `village_id` 和 `category`
- 聚合每个村庄的 `activity / food / stay / parking` 数量
- 计算覆盖级别：
  - `strong`：activity >= 4, food >= 3, stay >= 2, parking >= 1
  - `usable`：activity >= 1, food >= 3, stay >= 2
  - `excluded`：不满足以上条件，尤其 activity = 0

推荐优先级：

1. 优先从 `strong` 村庄中选择 recommended。
2. 如果没有 `strong`，再从 `usable` 中选择。
3. `excluded` 不进入覆盖过滤后的 recommended 或 alternatives。
4. 如果 Supabase 覆盖查询失败，或过滤后没有可用候选，则 fallback 到原始推荐逻辑，避免 `/api/plan` 失败。

`/api/plan` 返回可选字段：

```ts
dataQuality?: {
  poiCoverageLevel: "strong" | "usable" | "fallback";
  activityCount?: number;
  foodCount?: number;
  stayCount?: number;
  parkingCount?: number;
}
```

前端暂不展示该字段，仅用于后端推荐质量控制。

## 10. Web V1.1.2 POI 自动预筛选

V1.1.2 新增 `scripts/auto-rank-village-pois.ts`，用于在人工审核前先自动筛选每个村庄各类别较优 POI。

自动推荐数量：

- activity：最多 6 条，低于 4 条提示 warning
- food：最多 5 条，低于 3 条提示 warning
- stay：最多 4 条，低于 2 条提示 warning
- parking：最多 2 条，低于 1 条提示 warning

脚本只更新：

- `is_recommended`
- `review_notes` 中追加 `auto_ranked`

脚本不会：

- 删除 POI
- 修改 villages 表
- 将 POI 自动改成 `verified`
- 覆盖 `rejected`
- 取消人工 verified 推荐

运行方式：

```bash
npx tsx scripts/auto-rank-village-pois.ts
```

自动预筛选后，`verified` 仍然需要人工审核确认。

## 11. Web V1.2 /api/plan 读取推荐 POI

V1.2 已将 `/api/plan` 的真实 POI 来源从“seed / 临时高德检索优先”调整为“Supabase 推荐 POI 优先”。

新增读取方法：

```txt
lib/data/village-recommended-pois.ts
```

读取条件：

- `village_id = recommended.id`
- `is_recommended = true`
- `data_review_status in ("verified", "needs_review")`

当前由于还没有人工审核，`verified = 0` 属于正常状态，线上主要会使用 `needs_review + is_recommended = true` 的自动预筛结果。

映射关系：

- `activity` → `/api/plan.playPlaces`
- `food` → `/api/plan.foods`
- `stay` → `/api/plan.stays`
- `parking` → `/api/plan.travelTips` 停车候选提醒

DeepSeek 只接收这些推荐 POI 名称作为上下文，不能编造未传入的景点、餐厅、民宿或停车点。

fallback 仍然保留：

1. Supabase 推荐 POI
2. 当前高德临时 activity 候选
3. 原 seed foods / stays
4. 友好兜底

Supabase 查询失败时只打印 warn，不会导致 `/api/plan` 500。
