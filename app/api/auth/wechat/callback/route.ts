import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServiceRestConfig } from "@/lib/auth/session";

type WechatTokenResponse = {
  access_token?: string;
  openid?: string;
  errmsg?: string;
};

type WechatUserInfo = {
  openid?: string;
  nickname?: string;
  headimgurl?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = cookies();
  const expectedState = cookieStore.get("wechat_oauth_state")?.value;
  const redirect = cookieStore.get("wechat_oauth_redirect")?.value || "/agent";

  if (!code || !state || !expectedState || state !== expectedState) {
    const target = new URL("/login", url.origin);
    target.searchParams.set("redirect", redirect);
    target.searchParams.set("error", "wechat_state_invalid");
    return NextResponse.redirect(target);
  }

  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    const target = new URL("/login", url.origin);
    target.searchParams.set("redirect", redirect);
    target.searchParams.set("error", "wechat_not_configured");
    return NextResponse.redirect(target);
  }

  const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  tokenUrl.searchParams.set("appid", appId);
  tokenUrl.searchParams.set("secret", appSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("grant_type", "authorization_code");

  const tokenResponse = await fetch(tokenUrl, { cache: "no-store" }).catch(() => null);
  if (!tokenResponse?.ok) {
    const target = new URL("/login", url.origin);
    target.searchParams.set("redirect", redirect);
    target.searchParams.set("error", "wechat_token_failed");
    return NextResponse.redirect(target);
  }

  const tokenPayload = (await tokenResponse.json()) as WechatTokenResponse;
  if (!tokenPayload.access_token || !tokenPayload.openid) {
    const target = new URL("/login", url.origin);
    target.searchParams.set("redirect", redirect);
    target.searchParams.set("error", "wechat_token_failed");
    return NextResponse.redirect(target);
  }

  const infoUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
  infoUrl.searchParams.set("access_token", tokenPayload.access_token);
  infoUrl.searchParams.set("openid", tokenPayload.openid);
  infoUrl.searchParams.set("lang", "zh_CN");
  const infoResponse = await fetch(infoUrl, { cache: "no-store" }).catch(() => null);
  const info = infoResponse?.ok ? ((await infoResponse.json()) as WechatUserInfo) : {};

  const service = getServiceRestConfig();
  if (service) {
    await fetch(`${service.baseUrl}/rest/v1/user_profiles?on_conflict=wechat_openid`, {
      method: "POST",
      headers: {
        ...service.headers,
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        wechat_openid: tokenPayload.openid,
        nickname: info.nickname ?? null,
        avatar_url: info.headimgurl ?? null,
        updated_at: new Date().toISOString()
      }),
      cache: "no-store"
    }).catch(() => undefined);
  }

  const target = new URL("/login", url.origin);
  target.searchParams.set("redirect", redirect);
  target.searchParams.set("error", "wechat_session_pending");
  const response = NextResponse.redirect(target);
  response.cookies.delete("wechat_oauth_state");
  response.cookies.delete("wechat_oauth_redirect");
  return response;
}
