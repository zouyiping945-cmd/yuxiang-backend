"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredAccessToken } from "@/lib/supabase/client";

type Trip = {
  id: string;
  title?: string;
  status?: string;
  trip_date?: string;
  created_at?: string;
  payload?: {
    recommended?: {
      name?: string;
    };
    route?: {
      distanceText?: string;
      durationText?: string;
    };
  };
};

const pageStyle = {
  minHeight: "100vh",
  padding: "34px min(5vw, 72px)",
  background: "linear-gradient(180deg, #fbfaf4 0%, #eff3e4 100%)",
  color: "#243821"
};

const cardStyle = {
  border: "1px solid rgba(89, 109, 72, 0.16)",
  borderRadius: 22,
  padding: 20,
  background: "rgba(255,255,252,0.9)",
  boxShadow: "0 16px 42px rgba(63,78,49,0.08)"
};

export default function TripsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login?redirect=/trips");
      return;
    }

    fetch("/api/user/trips", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) {
          setItems(payload.data || []);
        } else {
          setMessage("行程读取失败，请稍后再试。");
        }
      })
      .catch(() => setMessage("行程读取失败，请稍后再试。"))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main style={pageStyle}>
      <Link href="/agent" style={{ color: "#61734e", textDecoration: "none" }}>← 返回 AI 规划</Link>
      <h1 style={{ fontFamily: '"STKaiti", "KaiTi", serif', fontSize: 34 }}>我的行程</h1>
      <p style={{ color: "#70786b" }}>收藏当前规划时，会同步加入我的行程。</p>

      {loading ? <p>正在读取行程...</p> : null}
      {message ? <p style={{ color: "#a76500" }}>{message}</p> : null}
      {!loading && items.length === 0 ? <p>暂无行程，回到 /agent 收藏一次规划即可加入。</p> : null}

      <section style={{ display: "grid", gap: 14, marginTop: 22 }}>
        {items.map((item) => (
          <article key={item.id} style={cardStyle}>
            <strong>{item.title || item.payload?.recommended?.name || "AI 乡旅行程"}</strong>
            <p style={{ color: "#70786b" }}>状态：{item.status || "planned"}</p>
            <p>
              {item.payload?.route?.distanceText || "距离待确认"}
              {" · "}
              {item.payload?.route?.durationText || "耗时待确认"}
            </p>
            <small style={{ color: "#8c9388" }}>
              {item.trip_date ? `出行日期：${item.trip_date}` : "暂未设置出行日期"}
              {item.created_at ? ` · 创建于 ${new Date(item.created_at).toLocaleString()}` : ""}
            </small>
          </article>
        ))}
      </section>
    </main>
  );
}
