# Web V1.3 用户登录与基础个人功能补全

## 1. 当前定位

Web V1.3 提供云端用户能力，但不改变 AI 规划主链路。用户登录后可以保存历史方案、收藏行程，并在“我的行程”中查看云端数据。

当前已保留：

- 邮箱验证码 / Magic Link 登录
- 手机号登录备用入口（依赖短信服务，当前可标注暂未开放）
- 微信登录入口与未配置提示
- 历史方案 / 我的收藏 / 我的行程云端页面
- 登录用户生成方案后自动保存历史方案
- 登录用户收藏行程后写入收藏和我的行程

已暂停：


## 2. 邮箱登录

邮箱登录使用 Supabase Auth Email OTP / Magic Link：

- 用户输入邮箱
- `POST /auth/v1/otp` 发送邮件验证码与 Magic Link
- 用户可以输入邮件验证码完成登录
- 用户也可以点击邮件中的 Magic Link 回到 `/login`
- `/login` 自动消费 URL hash 中的 Supabase session token
- 登录成功后跳回 `redirect`，默认 `/agent`

浏览器端仅使用：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

不会在前端暴露 service role key。

## 3. 手机号与微信登录

手机号登录使用 Supabase Auth Phone OTP，作为备用入口保留。由于短信服务依赖较强，当前页面可以提示暂未开放。

微信登录已新增：

- `/api/auth/wechat/start`
- `/api/auth/wechat/callback`

如果缺少：

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_REDIRECT_URI`

登录页会明确提示微信登录暂未配置，不会假装登录成功。

## 4. Supabase 表

SQL 文件：

`docs/supabase-v1.3-user-system.sql`

包含：

- `user_profiles`
- `user_plans`
- `user_favorites`
- `user_trips`

SQL 中已开启 RLS，并添加用户只能访问自己数据的基础 policy。

## 5. 用户 API

新增：

- `/api/user/profile`
- `/api/user/plans`
- `/api/user/favorites`
- `/api/user/trips`

所有接口都要求：

```txt
Authorization: Bearer <supabase_access_token>
```

未登录返回：

```json
{ "ok": false, "error": "UNAUTHORIZED" }
```

## 6. Agent 页接入

`/agent` 页面：

- 未登录：左侧显示登录 / 同步入口
- 已登录：显示邮箱或手机号尾号，并提供退出登录
- 历史方案 / 我的收藏 / 我的行程入口需要登录，未登录会跳转 `/login?redirect=...`
- 生成方案成功后，已登录用户自动保存到 `user_plans`
- 点击“收藏行程”时，未登录跳转登录；已登录写入 `user_favorites` 和 `user_trips`
- “导出行程”复制当前方案 JSON

## 7. 不影响现有 AI 规划链路

本轮不修改：

- `/api/plan`
- `/api/route`
- `/api/map-preview`
- Supabase 村庄 / POI schema
- DeepSeek provider
- 小程序项目

## 8. 验收

1. 打开 `/login`
2. 使用邮箱验证码或 Magic Link 登录
3. 登录成功后跳回 `/agent`
4. 在 `/agent` 生成方案
5. 登录用户自动保存历史方案
6. 点击“收藏行程”写入收藏和我的行程
7. `/history`、`/favorites`、`/trips` 均读取 Supabase 云端数据
8. 未登录访问个人页面时跳转登录
