# Seed 数据迁移计划

## 1. 当前数据来源

当前 seed 数据来源于：

- `lib/real-villages.ts`
- `REAL_VILLAGES` 中的 24 个郑州圈 seed 村庄

这些数据已经包含：

- 基础行政信息
- 推荐标签
- 适合人群
- 匹配关键词
- 结构化质量字段
- 官方名单来源
- 路线建议
- 美食建议
- 住宿建议

当前仍然是 seed 阶段，不代表正式核验后的商家、路线或地图数据。

## 2. 迁移顺序

建议按依赖关系分批迁移：

1. 先插入 `villages`
2. 再插入 `village_profiles`
3. 再插入 `village_designations`
4. 再插入 `village_routes`
5. 再插入 `village_foods`
6. 再插入 `village_stays`

原因：

- `villages` 是主表，生成数据库侧 uuid。
- 其他表通过 `village_id` 关联 `villages.id`。
- 迁移脚本需要先根据 `village_code` 找到对应 `village_id`，再写入子表。

## 3. 字段映射摘要

- `RealVillageData.id` -> `villages.village_code`
- `tags / suitableFor / matchKeywords / recommendedTransport` -> `village_profiles`
- `designations` -> `village_designations`
- `routeOptions` -> `village_routes`
- `foods` -> `village_foods`
- `stays` -> `village_stays`

## 4. 后端读取策略

建议分三步推进：

### 第一步：Supabase 优先，本地 fallback

后端读取时：

1. 先尝试从 Supabase 读取 published / 可用村庄。
2. 如果 Supabase 未配置、报错或无数据，则 fallback 到本地 `REAL_VILLAGES`。
3. 保持 `/api/plan` 返回结构不变。

### 第二步：验证稳定后减少 fallback 依赖

当 Supabase 数据稳定后：

1. 继续保留本地 fallback。
2. 但日常推荐优先依赖数据库。
3. 通过日志观察 Supabase 命中率和 fallback 触发率。

### 第三步：管理后台维护数据

后续可以通过管理后台维护：

- 村庄基础信息
- 推荐标签
- 路线
- 餐饮
- 住宿
- 官方名单来源
- 核验状态

## 5. 风险

- seed 数据仍需人工核验。
- 餐饮、住宿、路线不是正式商家数据。
- 暂无经纬度。
- 暂无正式地图导航。
- `dataReviewStatus` 当前主要用于标记迁移前的数据质量阶段。
- 如果后续字段扩展，应优先通过新增字段或新表处理，避免破坏现有推荐链路。

## 6. V0.9 建议

V0.9 可以做：

1. 写迁移脚本。
2. 导入 24 条 seed。
3. 改造后端读取 Supabase。
4. 保留本地 fallback。
5. 增加 Supabase 读取失败日志。
6. 增加最小数据校验脚本，检查每条村庄是否包含 profiles、routes、foods、stays。
