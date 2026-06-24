# Web V1.0 AI Agent 页面说明

## 1. 为什么将主展示形态从小程序转为 Web Agent

小程序适合移动端即时使用，但桌面 Web 更适合完整展示“需求输入、Agent 工作流、推荐理由、路线、吃住和备选村庄”这条长链路。Web V1.0 新增 `/agent` 页面，用更大的信息空间呈现 AI 乡旅规划能力，同时继续复用现有 `/api/plan` 和 `/api/route`。

本轮没有替换小程序，也没有修改现有 API，而是增加一个独立的 Web Agent 展示入口。

## 2. 本轮参考 UI 图的元素

页面参考设计图中的以下视觉和信息结构：

- 左侧固定品牌与导航侧栏
- 浅绿、米白、暖灰为主色
- 少量紫色作为 AI 状态点缀
- 顶部大标题和田园主视觉
- 中央大尺寸自然语言输入框
- 圆角大卡片与柔和阴影
- Agent 推荐结果集中在一张完整面板中
- 推荐理由、路线、美食、住宿和备选村庄分区展示

页面没有复制参考图中的外链图片，而是使用 CSS 渐变、抽象山形、田野曲线和村落符号构建田园背景。

## 3. 已真实可用的功能

- 输入自然语言出游需求
- 选择快捷需求标签
- 调用 `POST /api/plan`
- 展示推荐村庄、城市、评分、标签、描述和匹配度
- 展示 AI 推荐理由、reasonTags 和 travelTips
- 展示 `/api/plan` 返回的 foods 和 stays
- 展示 alternatives
- 推荐生成后自动调用 `POST /api/route`
- 展示路线距离、耗时、建议、提醒、provider 和 fallback 状态
- 复制路线建议
- 根据目的地坐标生成高德 H5 导航 URI
- 重新生成方案
- 空输入、计划失败和路线失败提示
- 非 DeepSeek 结果显示规则推荐兜底提示

## 4. 当前仅为占位的功能

以下功能在页面中被明确弱化，点击后提示“该功能将在后续版本开放”：

- 历史方案
- 我的收藏
- 我的行程
- Web 登录和注册
- 关于我们
- 更多美食
- 更多住宿
- 收藏行程
- 导出行程
- 点击备选村庄后重新生成

页面不展示假天气，不绘制假地图预览，也不伪造真实账号或收藏状态。

## 5. `/api/plan` 调用方式

页面调用：

```text
POST /api/plan
Content-Type: application/json
```

请求体：

```json
{
  "inputText": "周末想带父母轻松走走，想吃农家菜，不想太累",
  "companions": ["带父母"],
  "demands": ["带父母", "不想太累", "农家菜"]
}
```

快捷标签会作为 `demands` 参与请求；“带父母”和“亲子短途”也会映射到 `companions`。页面不改变现有 API 请求或返回结构。

## 6. `/api/route` 调用方式

推荐村庄返回后自动调用：

```text
POST /api/route
Content-Type: application/json
```

如果推荐结果含坐标：

```json
{
  "villageId": "zhengzhou_yingtaogou",
  "destination": {
    "longitude": 113.589043,
    "latitude": 34.617794,
    "name": "樱桃沟社区"
  },
  "mode": "driving"
}
```

如果推荐结果没有坐标，则只传 `villageId` 和 `mode`，由后端查询 Supabase 村庄坐标。

打开地图时优先使用推荐结果坐标，其次使用 `/api/route` 返回的 `destinationUsed`，生成：

```text
https://uri.amap.com/navigation?to=longitude,latitude,name&mode=car
```

## 7. 当前暂不实现的能力

Web V1.0 不实现：

- 真实登录、注册和账号系统
- 历史方案持久化
- 收藏与导出
- 天气 API
- 地图 SDK 和地图预览图
- 新的第三方接口
- 直接读取 `village_pois`

高德 URI 在浏览器中作为 H5 路线链接打开，不保证所有设备都直接唤起高德 App。

## 8. 下一步 Web V1.1

Web V1.1 计划读取 `village_pois` 中已审核、已推荐的真实 POI：

- 展示真实餐饮和住宿店铺
- 展示店铺地址、电话、距离和评分
- 店铺支持地图打开
- DeepSeek 基于真实 POI 生成更具体的吃住解释

## 9. Web V1.0.1 信息结构优化

V1.0.1 进一步简化 `/agent` 页面：

- 删除固定展示的 Agent Workflow / 规划完成进度卡片，只在按钮和局部状态中保留轻量 loading 表达。
- 删除独立“AI 推荐理由”大卡片，将 `reasonSummary / summary`、`reasonTags` 和精简后的 `travelTips / reasons` 合并进推荐村庄主卡片。
- 将路线规划、觅美食、寻住处放入同一个三栏内容区，桌面端并排展示，移动端自动堆叠。
- 将备选村庄固定在结果区域底部，作为最后一块辅助选择内容。

本次调整只改变 UI 信息结构，不改变 `/api/plan`、`/api/route` 请求结构或后端逻辑。

## 10. Web V1.0.2 上线前关键修正

V1.0.2 聚焦上线前必要体验修正，没有改动 Supabase schema、`/api/route`、脚本或小程序项目：

- 压缩 `/agent` 首屏高度、输入框高度和未生成方案时的空态区域，减少大面积留白。
- 删除页面上可见的“为什么推荐这里”独立结构，将推荐解释自然合并进村庄介绍主卡片。
- 路线规划、觅美食、寻住处保持同一行三栏展示；卡片等高、按钮沉底，移动端自动堆叠。
- foods 最多展示前 3 项，stays 最多展示前 3 项；为空时显示“暂无精选推荐”兜底文案。
- 新增 `playHighlights` 可选字段，用于展示“这里可以怎么玩 / 推荐体验”。
- `playHighlights` 先由规则层基于现有村庄 tags、description、routeOptions、foods、stays 生成；DeepSeek 开启时只允许基于这些结构化数据润色，不允许编造景点、店铺或路线。
- 新增 `POST /api/agent-polish`，用于“AI 帮我润色”输入内容；DeepSeek 调用只发生在服务端，失败时返回原文并标记 `fallbackUsed`。

`/api/plan` 的请求结构保持不变；本次只在返回结果中增加可选展示字段，不影响已有调用方。`/api/route` 请求和返回结构保持不变。

## 11. Web V1.0.3 首页空态与 AI 润色修正

V1.0.3 继续聚焦上线前必要体验修正：

- 未生成结果前删除“填写上方需求，AI 将生成一份乡村旅行方案”等空态提示条。
- `/agent` 未生成结果时改为 GPT / DeepSeek 式居中输入入口，标题、输入卡片和轻量免责声明在首屏中居中展示，不再为结果区预留占位高度。
- “AI 帮我润色”按钮从紫色调整为黄橙色系，主按钮仍保持绿色，主次更清晰。
- `/api/agent-polish` 返回新增诊断字段：`providerUsed`、`fallbackUsed`、`changed`。
- DeepSeek 润色 prompt 强化为“规划需求整理器”，要求保留用户原意，明确同行对象、节奏、餐饮偏好、体力约束和目的地偏好，控制在 60-100 字，不编造村庄、景点或店铺。
- 如果 DeepSeek 不可用，润色接口返回原文，`providerUsed = "fallback"`，`fallbackUsed = true`，不抛出 500。

本次仍未修改 `/api/plan` 和 `/api/route` 的请求结构。

## 12. Web V1.0.4 真实游玩地点推荐

V1.0.4 将结果页“这里可以怎么玩”从泛化体验建议升级为优先展示真实游玩地点：

- `/api/plan` 返回新增可选字段 `playPlaces`，字段包括 `name`、`category`、`address`、`distanceText`、`reason`、`source`。
- 后端在推荐村庄确定后，如果村庄有坐标，会围绕村庄坐标调用高德 POI 周边搜索。
- 高德检索使用多组关键词，例如“村名 + 农家乐 / 采摘 / 景区 / 公园 / 文化 / 亲子 / 垂钓 / 老街 / 美食 / 民宿 / 艺术”。
- 候选 POI 会按 `poi_id` 或 `name + address` 去重，并过滤停车场、厕所、银行、政府机构、加油站等无关地点。
- DeepSeek 不再直接生成地点名称，只能基于传入的 `amapPlayPois` 候选列表做筛选、排序和推荐理由整理。
- 后端会校验 DeepSeek 输出：`playPlaces.name` 必须存在于候选 POI 名称白名单中；地址、距离和数据源始终从原始候选补回。
- 如果没有可核验 POI，前端不会假装展示真实地点，而是改为“可体验内容”，并提示当前缺少可核验 POI。

前端展示优先级：

1. `playPlaces` 有数据：展示“这里可以怎么玩”，卡片展示真实地点名称、类型、地址、距离、推荐理由和来源标签。
2. `playPlaces` 为空但 `playHighlights` 有数据：展示“可体验内容”，明确说明是基于村庄信息生成的体验建议。
3. 两者都为空：显示友好兜底，建议出发前结合地图 App 搜索周边开放信息。

本次没有新增地图 SDK、登录、收藏、天气、导出或小程序同步能力。
