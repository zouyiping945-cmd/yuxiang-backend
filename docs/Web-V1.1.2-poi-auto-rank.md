# Web V1.1.2 POI 自动预筛选与推荐标记

## 1. 背景

V1.1 已经将 activity / food / stay / parking 候选 POI 写入 `village_pois`，但全部人工审核成本较高。V1.1.2 先做自动预筛选：为每个村庄、每个类别挑出更适合前端展示的候选，标记 `is_recommended = true`。

本阶段不把任何 POI 自动改为 `verified`。`verified` 仍然只属于后续人工审核结果。

## 2. 推荐数量上限

每个村庄每类最多保留：

- activity：4-6 条
- food：3-5 条
- stay：2-4 条
- parking：1-2 条

脚本使用上限作为自动推荐数量，同时低于下限时打印 warning，提示后续人工补充。

## 3. 自动评分规则

通用加分：

- 距离近：`distance_meters` 越小得分越高
- 有电话 `tel`
- 有评分 `rating`
- 有价格 `price_text`
- `type_text` 和当前 category 匹配
- 名称或地址中包含村名
- 名称、地址、类型中出现“附近 / 周边 / 村 / 乡 / 镇”

activity 加分关键词：

- 景区
- 公园
- 采摘
- 农家乐
- 亲子
- 文化
- 老街
- 垂钓
- 艺术
- 研学
- 休闲
- 田园
- 大食堂
- 乐园
- 营地

food 加分关键词：

- 农家
- 饭店
- 餐厅
- 大食堂
- 烩面
- 土鸡
- 烧烤
- 家常菜

stay 加分关键词：

- 民宿
- 酒店
- 客栈
- 山居
- 度假
- 农家院

parking 加分关键词：

- 停车场
- 停车点

排除关键词：

- 厕所
- 银行
- 政府
- 加油站
- 学校
- 医院
- 派出所
- 公司
- 小区
- 住宅
- 充电站
- 维修
- 快递

命中排除关键词的 POI 不参与自动推荐。

## 4. verified / rejected 保护规则

- `rejected`：不参与评分，不更新推荐标记。
- `verified + is_recommended = true`：优先保留，不会被自动取消。
- `verified` 且未被选中：不强制改成 false，避免破坏人工审核结果。
- `needs_review` 被选中：设置 `is_recommended = true`，并在 `review_notes` 中追加 `auto_ranked`。
- `needs_review` 未被选中：设置 `is_recommended = false`，`data_review_status` 保持不变。

## 5. 运行方式

在 Web 项目根目录运行：

```bash
npx tsx scripts/auto-rank-village-pois.ts
```

脚本会读取：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

脚本不会读取或导出任何 secret。

## 6. 输出内容

运行后会打印：

- villages total
- total POIs scanned
- recommended activity count
- recommended food count
- recommended stay count
- recommended parking count
- per village recommended summary
- warnings for villages still below target

## 7. 后续人工审核

自动推荐只是预筛选，不等于正式认证。后续仍建议结合 `docs/review/village-poi-review.csv` 做人工核验：

- 可用且准确：改为 `data_review_status = verified`
- 精选展示：保留或设置 `is_recommended = true`
- 不适合展示：改为 `data_review_status = rejected`
