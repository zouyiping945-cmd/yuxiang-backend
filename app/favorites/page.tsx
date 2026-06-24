"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredAccessToken } from "@/lib/supabase/client";

type Favorite = {
  id: string;
  favorite_type?: string;
  target_name?: string;
  created_at?: string;
  payload?: {
    recommended?: {
      name?: string;
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

export default function FavoritesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadFavorites = () => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login?redirect=/favorites");
      return;
    }

    fetch("/api/user/favorites", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) {
          setItems(payload.data || []);
        } else {
          setMessage("收藏读取失败，请稍后再试。");
        }
      })
      .catch(() => setMessage("收藏读取失败，请稍后再试。"))
      .finally(() => setLoading(false));
  };

  useEffect(loadFavorites, [router]);

  const removeFavorite = async (id: string) => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login?redirect=/favorites");
      return;
    }

    const response = await fetch(`/api/user/favorites?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => null);

    if (response?.ok) {
      setItems((current) => current.filter((item) => item.id !== id));
    } else {
      setMessage("取消收藏失败，请稍后再试。");
    }
  };

  return (
    <main style={pageStyle}>
      <Link href="/agent" style={{ color: "#61734e", textDecoration: "none" }}>← 返回 AI 规划</Link>
      <h1 style={{ fontFamily: '"STKaiti", "KaiTi", serif', fontSize: 34 }}>我的收藏</h1>
      <p style={{ color: "#70786b" }}>收藏行程后，会在这里保存方案摘要。</p>

      {loading ? <p>正在读取收藏...</p> : null}
      {message ? <p style={{ color: "#a76500" }}>{message}</p> : null}
      {!loading && items.length === 0 ? <p>暂无收藏，回到 /agent 可收藏当前行程。</p> : null}

      <section style={{ display: "grid", gap: 14, marginTop: 22 }}>
        {items.map((item) => (
          <article key={item.id} style={cardStyle}>
            <strong>{item.target_name || item.payload?.recommended?.name || "收藏方案"}</strong>
            <p style={{ color: "#70786b" }}>类型：{item.favorite_type || "plan"}</p>
            <small style={{ color: "#8c9388" }}>
              {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
            </small>
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => removeFavorite(item.id)}
                style={{
                  border: "1px solid rgba(89,109,72,0.18)",
                  borderRadius: 999,
                  padding: "9px 16px",
                  background: "#fff",
                  color: "#61734e",
                  cursor: "pointer"
                }}
              >
                取消收藏
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
