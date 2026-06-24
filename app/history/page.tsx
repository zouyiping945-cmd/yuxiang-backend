"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredAccessToken } from "@/lib/supabase/client";

type UserPlan = {
  id: string;
  title?: string;
  input_text?: string;
  recommended_village_name?: string;
  created_at?: string;
  plan_payload?: {
    reasonSummary?: string;
    summary?: string;
  };
};

const pageStyle = {
  minHeight: "100vh",
  padding: "34px min(5vw, 72px)",
  background: "linear-gradient(180deg, #fbfaf4 0%, #eff3e4 100%)",
  color: "#243821"
};

const gridStyle = {
  display: "grid",
  gap: 14,
  marginTop: 22
};

const cardStyle = {
  border: "1px solid rgba(89, 109, 72, 0.16)",
  borderRadius: 22,
  padding: 20,
  background: "rgba(255,255,252,0.9)",
  boxShadow: "0 16px 42px rgba(63,78,49,0.08)"
};

export default function HistoryPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<UserPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login?redirect=/history");
      return;
    }

    fetch("/api/user/plans", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) {
          setPlans(payload.data || []);
        } else {
          setMessage("历史方案读取失败，请稍后再试。");
        }
      })
      .catch(() => setMessage("历史方案读取失败，请稍后再试。"))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main style={pageStyle}>
      <Link href="/agent" style={{ color: "#61734e", textDecoration: "none" }}>← 返回 AI 规划</Link>
      <h1 style={{ fontFamily: '"STKaiti", "KaiTi", serif', fontSize: 34 }}>历史方案</h1>
      <p style={{ color: "#70786b" }}>这里会展示你登录后自动保存的 AI 乡旅规划方案。</p>

      {loading ? <p>正在读取历史方案...</p> : null}
      {message ? <p style={{ color: "#a76500" }}>{message}</p> : null}
      {!loading && plans.length === 0 ? <p>暂无历史方案，回到 /agent 生成一次规划后会自动保存。</p> : null}

      <section style={gridStyle}>
        {plans.map((plan) => (
          <article key={plan.id} style={cardStyle}>
            <strong>{plan.title || plan.recommended_village_name || "AI 乡旅方案"}</strong>
            <p style={{ color: "#70786b" }}>{plan.input_text || "未记录原始需求"}</p>
            <p>{plan.plan_payload?.reasonSummary || plan.plan_payload?.summary || "已保存完整方案，可作为后续行程参考。"}</p>
            <small style={{ color: "#8c9388" }}>
              {plan.created_at ? new Date(plan.created_at).toLocaleString() : ""}
            </small>
          </article>
        ))}
      </section>
    </main>
  );
}
