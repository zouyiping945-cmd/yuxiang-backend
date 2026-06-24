import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = url.searchParams.get("redirect") || "/agent";
  const appId = process.env.WECHAT_APP_ID?.trim();
  const redirectUri = process.env.WECHAT_REDIRECT_URI?.trim();

  if (!appId || !redirectUri) {
    const target = new URL("/login", url.origin);
    target.searchParams.set("redirect", redirect);
    target.searchParams.set("error", "wechat_not_configured");
    return NextResponse.redirect(target);
  }

  const state = crypto.randomUUID();
  const authUrl = new URL("https://open.weixin.qq.com/connect/qrconnect");
  authUrl.searchParams.set("appid", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "snsapi_login");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(`${authUrl.toString()}#wechat_redirect`);
  response.cookies.set("wechat_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60
  });
  response.cookies.set("wechat_oauth_redirect", redirect, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60
  });
  return response;
}
