"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  consumeMagicLinkFromUrl,
  isSupabaseAuthConfigured,
  sendEmailOtp,
  sendPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp
} from "@/lib/supabase/client";
import styles from "./page.module.css";

type LoginMode = "email" | "phone";

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return trimmed.replace(/\s/g, "");
  }
  const digits = trimmed.replace(/\D/g, "");
  return digits.startsWith("86") ? `+${digits}` : `+86${digits}`;
}

function getWechatErrorMessage(error: string | null): string {
  if (error === "wechat_not_configured") {
    return "微信登录暂未配置，请先使用邮箱登录。";
  }
  if (error === "wechat_session_pending") {
    return "微信授权框架已接入，但当前阶段尚未打通 Supabase 登录会话，请先使用邮箱登录。";
  }
  if (error === "wechat_state_invalid") {
    return "微信登录状态校验失败，请重新尝试。";
  }
  if (error === "wechat_token_failed") {
    return "微信授权失败，请稍后再试。";
  }
  return "";
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/agent";
  const initialError = useMemo(() => getWechatErrorMessage(searchParams.get("error")), [searchParams]);
  const [mode, setMode] = useState<LoginMode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState(initialError);
  const configured = isSupabaseAuthConfigured();

  useEffect(() => {
    let mounted = true;

    const consumeMagicLink = async () => {
      const session = await consumeMagicLinkFromUrl();
      if (!mounted || !session) {
        return;
      }

      await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }).catch(() => undefined);

      router.replace(redirect);
    };

    consumeMagicLink();

    return () => {
      mounted = false;
    };
  }, [redirect, router]);

  const handleSendCode = async () => {
    setMessage("");
    if (!configured) {
      setMessage("登录服务暂未配置。");
      return;
    }

    setSending(true);
    try {
      if (mode === "email") {
        if (!email.trim()) {
          setMessage("请输入邮箱，系统会发送邮件验证码 / Magic Link。");
          return;
        }

        const redirectTo = `${window.location.origin}/login?redirect=${encodeURIComponent(redirect)}`;
        await sendEmailOtp(email.trim(), redirectTo);
        setMessage("邮件已发送，请查收验证码；也可以直接点击邮件中的 Magic Link 登录。");
        return;
      }

      if (mode === "phone") {
        setMessage("手机号登录需要短信服务，当前暂未开放。请先使用邮箱做云端同步。");
        return;
      }

      if (!phone.trim()) {
        setMessage("请输入手机号，验证码将通过短信发送。");
        return;
      }

      await sendPhoneOtp(normalizePhone(phone));
      setMessage("短信验证码已发送，请查收。");
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      if (text.includes("429")) {
        setMessage("发送过于频繁，请稍后再试。");
      } else {
        setMessage(mode === "email" ? "邮件验证码发送失败，请检查邮箱或邮件服务配置。" : "验证码发送失败，请检查手机号或短信服务配置。");
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setMessage("");
    if (!configured) {
      setMessage("登录服务暂未配置。");
      return;
    }
    if (mode === "phone") {
      setMessage("手机号登录需要短信服务，当前暂未开放。请先使用邮箱做云端同步。");
      return;
    }
    if (!code.trim()) {
      setMessage("请输入验证码。");
      return;
    }

    setVerifying(true);
    try {
      const session =
        mode === "email"
          ? await verifyEmailOtp(email.trim(), code.trim())
          : await verifyPhoneOtp(normalizePhone(phone), code.trim());

      await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }).catch(() => undefined);
      router.replace(redirect);
    } catch {
      setMessage("验证码错误或已过期。");
    } finally {
      setVerifying(false);
    }
  };

  const handleWechatLogin = () => {
    window.location.href = `/api/auth/wechat/start?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <strong>豫见乡旅 AI Agent</strong>
          <span>邮箱登录用于云端同步历史方案、收藏和我的行程。</span>
        </div>

        <div className={styles.tabs}>
          <button
            className={mode === "email" ? styles.tabActive : styles.tab}
            type="button"
            onClick={() => {
              setMode("email");
              setCode("");
              setMessage("");
            }}
          >
            邮箱登录
          </button>
          <button
            className={mode === "phone" ? styles.tabActive : styles.tab}
            type="button"
            onClick={() => {
              setMode("phone");
              setCode("");
              setMessage("");
            }}
          >
            手机号登录（暂未开放）
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>{mode === "email" ? "邮箱" : "手机号"}</span>
              <input
                value={mode === "email" ? email : phone}
                onChange={(event) => (mode === "email" ? setEmail(event.target.value) : setPhone(event.target.value))}
                placeholder={mode === "email" ? "请输入邮箱地址" : "请输入中国大陆手机号"}
                inputMode={mode === "email" ? "email" : "tel"}
              />
            </label>
            <button className={styles.secondaryButton} type="button" onClick={handleSendCode} disabled={sending}>
              {sending ? "发送中..." : mode === "email" ? "发送邮件" : "发送验证码"}
            </button>
          </div>

          <label className={styles.field}>
            <span>验证码</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={mode === "email" ? "请输入邮件验证码" : "请输入短信验证码"}
              inputMode="numeric"
            />
          </label>

          <button className={styles.button} type="button" onClick={handleVerify} disabled={verifying}>
            {verifying ? "登录中..." : "确认登录"}
          </button>
        </div>

        <div className={styles.divider}>或</div>
        <button className={styles.wechatButton} type="button" onClick={handleWechatLogin}>
          微信登录
        </button>

        <p className={styles.message}>
          {message || "推荐使用邮箱登录：可输入验证码，也可点击邮件中的 Magic Link。"}
        </p>
        <Link className={styles.backLink} href="/agent">返回 AI 规划</Link>
      </section>
    </main>
  );
}
