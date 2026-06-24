"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  Bookmark,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Heart,
  History,
  LogIn,
  MapPin,
  Navigation,
  Route,
  Send,
  Sparkles,
  Utensils,
  WandSparkles
} from "lucide-react";
import type { FoodOption, PlanAlternative, PlanResult, PlayHighlight, PlayPlace, StayOption } from "@/lib/types";
import {
  fetchCurrentUser,
  getStoredAccessToken,
  getStoredSession,
  signOut,
  type SupabaseAuthUser
} from "@/lib/supabase/client";
import styles from "./page.module.css";

type ExtendedVillage = PlanResult["recommended"] & {
  latitude?: number;
  longitude?: number;
  address?: string;
  fullName?: string;
};

type WebPlanResult = Omit<PlanResult, "recommended"> & {
  recommended: ExtendedVillage;
};

type RoutePlanResult = {
  provider: "amap" | "fallback";
  mode: "driving" | "walking" | "transit";
  originUsed?: {
    longitude: number;
    latitude: number;
    source: "user" | "default";
  };
  destinationUsed?: {
    longitude: number;
    latitude: number;
    name?: string;
  };
  distanceMeters?: number;
  distanceText: string;
  durationSeconds?: number;
  durationText: string;
  summary: string;
  tips?: string[];
  fallbackUsed?: boolean;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

type PolishResult = {
  polishedText: string;
  providerUsed?: "deepseek" | "fallback";
  fallbackUsed?: boolean;
  changed?: boolean;
};

const QUICK_TAGS = [
  "带父母",
  "亲子短途",
  "不想太累",
  "农家菜",
  "拍照出片",
  "住一晚",
  "周末近郊",
  "轻松慢游"
];

const INSPIRATIONS = [
  "周末想带父母轻松走走，想吃农家菜，不想太累",
  "一家三口周末近郊游，希望能拍照、吃饭，步行不要太多",
  "和朋友住一晚，想找安静、有乡村风景、适合慢游的地方"
];

function scoreText(score: number | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "智能匹配";
  }
  return `${Math.round(score > 1 ? score : score * 100)}% 匹配`;
}

function joinInput(input: string, tags: string[]): string {
  const tagText = tags.join("、");
  if (!input.trim()) {
    return tagText;
  }
  return tagText ? `${input.trim()}；偏好：${tagText}` : input.trim();
}

function getCompanions(tags: string[]): string[] {
  const companions: string[] = [];
  if (tags.includes("带父母")) {
    companions.push("带父母");
  }
  if (tags.includes("亲子短途")) {
    companions.push("亲子出游");
  }
  return companions;
}

function getMapPoint(plan: WebPlanResult | null, routePlan: RoutePlanResult | null) {
  const recommended = plan?.recommended;
  if (
    typeof recommended?.longitude === "number" &&
    typeof recommended?.latitude === "number"
  ) {
    return {
      longitude: recommended.longitude,
      latitude: recommended.latitude,
      name: recommended.name
    };
  }

  if (routePlan?.destinationUsed) {
    return {
      longitude: routePlan.destinationUsed.longitude,
      latitude: routePlan.destinationUsed.latitude,
      name: routePlan.destinationUsed.name || recommended?.name || "推荐村庄"
    };
  }

  return null;
}

function buildMapPreviewUrl(mapPoint: ReturnType<typeof getMapPoint>): string {
  if (!mapPoint) {
    return "";
  }

  const params = new URLSearchParams();
  params.set("lng", String(mapPoint.longitude));
  params.set("lat", String(mapPoint.latitude));
  params.set("name", mapPoint.name);
  return `/api/map-preview?${params.toString()}`;
}

function buildAmapPoiUrl(item: FoodOption | StayOption): string {
  if (item.poiId) {
    const params = new URLSearchParams();
    params.set("poiid", item.poiId);
    params.set("name", item.name);
    params.set("callnative", "1");
    return `https://uri.amap.com/marker?${params.toString()}`;
  }

  if (typeof item.longitude === "number" && typeof item.latitude === "number") {
    const params = new URLSearchParams();
    params.set("position", `${item.longitude},${item.latitude}`);
    params.set("name", item.name);
    params.set("coordinate", "gaode");
    params.set("callnative", "1");
    return `https://uri.amap.com/marker?${params.toString()}`;
  }

  if (item.name) {
    const params = new URLSearchParams();
    params.set("keyword", `${item.name} ${item.address || ""}`.trim());
    params.set("callnative", "1");
    return `https://uri.amap.com/search?${params.toString()}`;
  }

  return "";
}

function pushHighlight(highlights: PlayHighlight[], next: PlayHighlight) {
  if (!next.title.trim() || !next.desc.trim()) {
    return;
  }

  if (highlights.some((item) => item.title === next.title)) {
    return;
  }

  highlights.push(next);
}

function buildFallbackHighlights(plan: WebPlanResult | null): PlayHighlight[] {
  if (!plan) {
    return [];
  }

  const highlights: PlayHighlight[] = [];
  const tags = plan.recommended.tags || [];
  const foodNames = (plan.foods || []).map((item) => item.name).filter(Boolean).slice(0, 2);
  const stayNames = (plan.stays || []).map((item) => item.name).filter(Boolean).slice(0, 2);

  if (tags.some((tag) => tag.includes("轻松") || tag.includes("慢游") || tag.includes("康养"))) {
    pushHighlight(highlights, {
      title: "轻松慢游",
      desc: "适合把节奏放慢，以散步、休息和短暂停留为主。",
      source: "profile"
    });
  }

  if (foodNames.length > 0 || tags.some((tag) => tag.includes("农家菜") || tag.includes("美食"))) {
    pushHighlight(highlights, {
      title: "农家菜用餐",
      desc: foodNames.length > 0
        ? `可参考已有餐饮候选：${foodNames.join("、")}，出发前建议确认营业情况。`
        : "可安排本地家常风味或农家菜，具体店铺建议出发前用地图确认。",
      source: "food"
    });
  }

  if (tags.some((tag) => tag.includes("拍照") || tag.includes("风光"))) {
    pushHighlight(highlights, {
      title: "田园拍照",
      desc: "适合预留一段不赶时间的拍照停留，优先选择光线柔和的时段。",
      source: "profile"
    });
  }

  if (stayNames.length > 0) {
    pushHighlight(highlights, {
      title: "住一晚慢游",
      desc: `可参考已有住宿候选：${stayNames.join("、")}，预订前建议核验房态和位置。`,
      source: "stay"
    });
  }

  tags.slice(0, 3).forEach((tag) => {
    pushHighlight(highlights, {
      title: tag,
      desc: `围绕“${tag}”安排轻量体验，具体点位和服务建议出发前再次确认。`,
      source: "profile"
    });
  });

  return highlights.slice(0, 5);
}

function getPlayPlaceSourceLabel(source: PlayPlace["source"]): string {
  if (source === "amap") {
    return "高德POI";
  }

  if (source === "supabase") {
    return "本地数据";
  }

  return "候选数据";
}

export default function AgentPage() {
  const [inputText, setInputText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [plan, setPlan] = useState<WebPlanResult | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlanResult | null>(null);
  const [planning, setPlanning] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [switchingVillageId, setSwitchingVillageId] = useState("");
  const [mapPreviewFailed, setMapPreviewFailed] = useState(false);
  const [error, setError] = useState("");
  const [routeError, setRouteError] = useState("");
  const [notice, setNotice] = useState("");
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const inspirationIndex = useRef(0);

  const playPlaces = useMemo(() => (plan?.playPlaces ?? []).slice(0, 6), [plan]);
  const playHighlights = useMemo(() => {
    if (plan?.playHighlights?.length) {
      return plan.playHighlights.slice(0, 5);
    }

    return buildFallbackHighlights(plan);
  }, [plan]);
  const mapPoint = useMemo(() => getMapPoint(plan, routePlan), [plan, routePlan]);
  const mapPreviewUrl = useMemo(() => buildMapPreviewUrl(mapPoint), [mapPoint]);

  useEffect(() => {
    setMapPreviewFailed(false);
  }, [mapPreviewUrl]);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const session = getStoredSession();
      if (!session?.access_token) {
        if (mounted) {
          setAuthUser(null);
          setAuthLoading(false);
        }
        return;
      }

      const user = await fetchCurrentUser();
      if (mounted) {
        setAuthUser(user);
        setAuthLoading(false);
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => {
      setNotice((current) => (current === message ? "" : current));
    }, 2400);
  };

  const placeholderAction = () => {
    showNotice("该功能将在后续版本开放。");
  };

  const requireLogin = (redirect = "/agent") => {
    window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
  };

  const getAuthHeaders = () => {
    const token = getStoredAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : null;
  };

  const openUserPage = (path: "/history" | "/favorites" | "/trips") => {
    if (!authUser) {
      requireLogin(path);
      return;
    }

    window.location.href = path;
  };

  const savePlanToHistory = async (nextPlan: WebPlanResult, input: string) => {
    const headers = getAuthHeaders();
    if (!authUser || !headers) {
      return null;
    }

    const response = await fetch("/api/user/plans", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: `${nextPlan.recommended.name} AI 方案`,
        inputText: input,
        planPayload: nextPlan
      })
    }).catch(() => null);

    if (!response?.ok) {
      console.warn("save user plan failed");
      return null;
    }

    const payload = await response.json().catch(() => null);
    return payload?.ok ? payload.data : null;
  };

  const saveFavoriteAndTrip = async () => {
    if (!plan) {
      return;
    }

    const headers = getAuthHeaders();
    if (!authUser || !headers) {
      requireLogin("/agent");
      return;
    }

    const payloadWithRoute = {
      ...plan,
      route: routePlan
    };

    const favoriteResponse = await fetch("/api/user/favorites", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        favoriteType: "plan",
        targetId: plan.recommended.id,
        targetName: plan.recommended.name,
        payload: payloadWithRoute
      })
    }).catch(() => null);

    const tripResponse = await fetch("/api/user/trips", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: `${plan.recommended.name} AI 行程`,
        payload: payloadWithRoute
      })
    }).catch(() => null);

    if (favoriteResponse?.ok && tripResponse?.ok) {
      showNotice("已收藏并加入我的行程");
      return;
    }

    showNotice("保存失败，请稍后再试");
  };

  const exportCurrentPlan = async () => {
    if (!plan) {
      showNotice("暂无可导出的方案");
      return;
    }

    const text = JSON.stringify({ ...plan, route: routePlan }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      showNotice("方案 JSON 已复制，可粘贴保存");
    } catch {
      showNotice("导出失败，请手动复制页面内容");
    }
  };

  const handleLogout = async () => {
    await signOut();
    setAuthUser(null);
    showNotice("已退出登录");
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const switchInspiration = () => {
    inspirationIndex.current = (inspirationIndex.current + 1) % INSPIRATIONS.length;
    setInputText(INSPIRATIONS[inspirationIndex.current]);
    setSelectedTags([]);
  };

  const fetchRoute = async (nextPlan: WebPlanResult) => {
    setRouteLoading(true);
    setRouteError("");

    const recommended = nextPlan.recommended;
    const hasDestination =
      typeof recommended.longitude === "number" &&
      typeof recommended.latitude === "number";

    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          villageId: recommended.id,
          ...(hasDestination
            ? {
                destination: {
                  longitude: recommended.longitude,
                  latitude: recommended.latitude,
                  name: recommended.name
                }
              }
            : {}),
          mode: "driving"
        })
      });

      if (!response.ok) {
        throw new Error(`ROUTE_HTTP_${response.status}`);
      }

      const payload = (await response.json()) as ApiResponse<RoutePlanResult>;
      if (!payload.ok) {
        throw new Error(payload.error?.message || "route failed");
      }

      setRoutePlan(payload.data);
    } catch {
      setRoutePlan(null);
      setRouteError("路线规划暂不可用，建议出发前使用地图 App 确认");
    } finally {
      setRouteLoading(false);
    }
  };

  const handlePolish = async () => {
    const original = inputText.trim();
    if (!original) {
      showNotice("请先输入要润色的出行需求");
      return;
    }

    setPolishing(true);
    try {
      const response = await fetch("/api/agent-polish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputText: original,
          selectedTags,
          preference: {
            companions: getCompanions(selectedTags),
            demands: selectedTags,
            needStay: selectedTags.includes("住一晚"),
            travelWithElders: selectedTags.includes("带父母"),
            travelWithKids: selectedTags.includes("亲子短途"),
            farmFoodPreferred: selectedTags.includes("农家菜"),
            easyWalkRequired: selectedTags.includes("不想太累")
          }
        })
      });

      if (!response.ok) {
        throw new Error(`POLISH_HTTP_${response.status}`);
      }

      const payload = (await response.json()) as ApiResponse<PolishResult>;
      if (!payload.ok) {
        throw new Error(payload.error?.message || "polish failed");
      }

      if (payload.data.polishedText) {
        setInputText(payload.data.polishedText);
      }

      if (payload.data.fallbackUsed || payload.data.providerUsed === "fallback") {
        showNotice("AI 润色暂时不可用，已保留原需求，可直接规划。");
      } else if (payload.data.providerUsed === "deepseek" && payload.data.changed) {
        showNotice("已优化为更清晰的规划需求。");
      } else {
        showNotice("已整理需求，可直接规划。");
      }
    } catch {
      showNotice("AI 润色暂时不可用，已保留原需求，可直接规划。");
    } finally {
      setPolishing(false);
    }
  };

  const handleSubmit = async () => {
    const finalInput = joinInput(inputText, selectedTags);
    if (!finalInput) {
      setError("请输入你的出行需求");
      return;
    }

    setPlanning(true);
    setError("");
    setRouteError("");
    setPlan(null);
    setRoutePlan(null);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputText: finalInput,
          companions: getCompanions(selectedTags),
          demands: selectedTags
        })
      });

      if (!response.ok) {
        throw new Error(`PLAN_HTTP_${response.status}`);
      }

      const payload = (await response.json()) as ApiResponse<WebPlanResult>;
      if (!payload.ok) {
        throw new Error(payload.error?.message || "plan failed");
      }

      setPlan(payload.data);
      await savePlanToHistory(payload.data, finalInput);
      setPlanning(false);
      await fetchRoute(payload.data);
    } catch {
      setPlanning(false);
      setError("AI 规划暂时失败，请稍后再试");
    }
  };

  const openMap = () => {
    if (!mapPoint) {
      showNotice("暂无坐标，请复制村庄名称后在地图中搜索");
      return;
    }

    const to = `${mapPoint.longitude},${mapPoint.latitude},${encodeURIComponent(mapPoint.name)}`;
    window.open(`https://uri.amap.com/navigation?to=${to}&mode=car`, "_blank", "noopener,noreferrer");
  };

  const copyRoute = async () => {
    if (!plan) {
      return;
    }

    const text = routePlan
      ? `前往${plan.recommended.name}：${routePlan.distanceText}，${routePlan.durationText}。${routePlan.summary}`
      : `${plan.recommended.name}：${routeError || "建议出发前使用地图 App 确认路线。"}`;

    try {
      await navigator.clipboard.writeText(text);
      showNotice("路线建议已复制");
    } catch {
      showNotice("复制失败，请手动选择路线文字");
    }
  };

  const openAmapPoi = (item: FoodOption | StayOption) => {
    const url = buildAmapPoiUrl(item);
    if (!url) {
      showNotice("暂无可跳转地址，请出发前手动搜索确认。");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const switchAlternative = async (alternative: PlanAlternative) => {
    if (!plan || switchingVillageId) {
      return;
    }

    setSwitchingVillageId(alternative.id);
    setRouteError("");
    showNotice("正在切换到该备选村庄…");

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputText: plan.inputText || joinInput(inputText, selectedTags),
          companions: getCompanions(selectedTags),
          demands: selectedTags,
          preferredVillageId: alternative.id,
          preferredVillageName: alternative.name,
          preferredVillageCode: alternative.id
        })
      });

      if (!response.ok) {
        throw new Error(`PLAN_SWITCH_HTTP_${response.status}`);
      }

      const payload = (await response.json()) as ApiResponse<WebPlanResult>;
      if (!payload.ok) {
        throw new Error(payload.error?.message || "switch failed");
      }

      setPlan(payload.data);
      await savePlanToHistory(payload.data, plan.inputText || joinInput(inputText, selectedTags));
      setRoutePlan(null);
      await fetchRoute(payload.data);
      window.requestAnimationFrame(() => {
        document.querySelector(`.${styles.resultPanel}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      showNotice("切换方案失败，请稍后再试");
    } finally {
      setSwitchingVillageId("");
    }
  };

  return (
    <main className={styles.pageShell}>
      {notice ? <div className={styles.toast}>{notice}</div> : null}

      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <img className={styles.brandLogo} src="/brand/yuxiang-logo.png" alt="" aria-hidden="true" />
          </div>
          <div>
            <strong>豫见乡旅</strong>
            <span>AI Agent</span>
          </div>
        </div>

        <nav className={styles.sidebarNav} aria-label="主导航">
          <button className={`${styles.navItem} ${styles.navItemActive}`} type="button">
            <Sparkles size={18} />
            智能规划
          </button>
          <button className={styles.navItem} type="button" onClick={() => openUserPage("/history")}>
            <History size={18} />
            历史方案
          </button>
          <button className={styles.navItem} type="button" onClick={() => openUserPage("/favorites")}>
            <Heart size={18} />
            我的收藏
          </button>
          <button className={styles.navItem} type="button" onClick={() => openUserPage("/trips")}>
            <CalendarDays size={18} />
            我的行程
          </button>
        </nav>

        <div className={styles.sidebarSpacer} />

        <div className={styles.loginCard}>
          <LogIn size={20} />
          {authUser ? (
            <>
              <strong>已登录</strong>
              <p>{authUser.email || (authUser.phone ? `手机号尾号 ${authUser.phone.slice(-4)}` : "云端同步已开启")}</p>
              <button type="button" onClick={handleLogout}>
                退出登录
              </button>
            </>
          ) : (
            <>
              <strong>登录 / 同步</strong>
              <p>{authLoading ? "正在检查登录状态" : "登录后可保存历史方案、收藏和行程"}</p>
              <button type="button" onClick={() => requireLogin("/agent")}>
                立即登录
              </button>
            </>
          )}
        </div>

        <button className={styles.aboutButton} type="button" onClick={placeholderAction}>
          关于我们
        </button>
      </aside>

      <section className={styles.content}>
        <header className={`${styles.hero} ${plan ? "" : styles.heroCentered}`}>
          <div className={styles.heroSky}>
            <span className={styles.birdOne}>⌁</span>
            <span className={styles.birdTwo}>⌁</span>
            <span className={styles.sparkle}>✦</span>
          </div>
          <div className={styles.mountainBack} />
          <div className={styles.mountainFront} />
          <div className={styles.fieldLines} />
          <div className={styles.villageSilhouette}>
            <span>⌂</span><span>⌂</span><span>⌂</span><span>⌂</span>
          </div>

          <button className={styles.inspirationButton} type="button" onClick={switchInspiration}>
            <WandSparkles size={15} />
            换一换灵感
          </button>

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>YUXIANG TRAVEL AGENT</p>
            <h1>乡村田园旅行，让 AI 帮你规划</h1>
            <p>选村、路线、吃住建议，一次生成</p>
          </div>

          <div className={styles.promptCard}>
            <textarea
              value={inputText}
              onChange={(event) => {
                setInputText(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="例如：周末想带父母轻松走走，想吃农家菜，不想太累"
              maxLength={400}
              aria-label="出行需求"
            />

            <div className={styles.promptFooter}>
              <div className={styles.quickTags}>
                {QUICK_TAGS.map((tag) => (
                  <button
                    className={selectedTags.includes(tag) ? styles.tagSelected : ""}
                    type="button"
                    aria-pressed={selectedTags.includes(tag)}
                    key={tag}
                    onClick={() => toggleTag(tag)}
                  >
                    {selectedTags.includes(tag) ? <Check size={13} /> : <span>＋</span>}
                    {tag}
                  </button>
                ))}
              </div>

              <div className={styles.promptActions}>
                <button
                  className={styles.polishButton}
                  type="button"
                  onClick={handlePolish}
                  disabled={polishing || planning || routeLoading}
                >
                  <Sparkles size={16} />
                  {polishing ? "润色中..." : "AI 帮我润色"}
                </button>
                <button
                  className={styles.submitButton}
                  type="button"
                  onClick={handleSubmit}
                  disabled={planning || routeLoading || polishing}
                >
                  <Send size={18} />
                  {planning ? "AI 正在规划" : "开始 AI 规划"}
                </button>
              </div>
            </div>
            {error ? <p className={styles.formError}>{error}</p> : null}
          </div>
          {!plan ? (
            <p className={styles.heroDisclaimer}>AI 生成内容仅供参考，请结合实际情况安排出行。</p>
          ) : null}
        </header>

        {plan ? (
          <section className={styles.resultPanel}>
            <div className={styles.resultHero}>
              <div>
                <span className={styles.resultAgentBadge}>
                  <Sparkles size={14} />
                  AI 乡旅规划助手为你推荐
                </span>
                <h2>{plan.recommended.name}</h2>
                <div className={styles.villageMeta}>
                  <span><MapPin size={14} />{plan.recommended.city || "河南乡村"}</span>
                  <span>★ {plan.recommended.rating || "待完善"}</span>
                  <span className={styles.matchBadge}>{scoreText(plan.matchScore)}</span>
                </div>
                <p>{plan.recommended.description}</p>
                <div className={styles.villageTags}>
                  {(plan.recommended.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                {playPlaces.length > 0 ? (
                  <div className={styles.playHighlights}>
                    <div className={styles.playHighlightTitle}>
                      <Sparkles size={15} />
                      <span>这里可以怎么玩</span>
                      <em>真实地点来自高德 POI / 本地村庄数据，出发前建议再次确认营业状态。</em>
                    </div>
                    <div className={styles.playPlaceGrid}>
                      {playPlaces.map((place) => (
                        <div className={styles.playPlaceCard} key={`${place.name}_${place.address ?? ""}`}>
                          <div className={styles.playPlaceHeader}>
                            <strong>{place.name}</strong>
                            <span>{getPlayPlaceSourceLabel(place.source)}</span>
                          </div>
                          <div className={styles.playPlaceMeta}>
                            {place.category ? <em>{place.category}</em> : null}
                            {place.distanceText ? <span>{place.distanceText}</span> : null}
                          </div>
                          {place.address ? <p className={styles.playPlaceAddress}>{place.address}</p> : null}
                          <p>{place.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : playHighlights.length > 0 ? (
                  <div className={styles.playHighlights}>
                    <div className={styles.playHighlightTitle}>
                      <Sparkles size={15} />
                      <span>可体验内容</span>
                      <em>当前缺少可核验 POI，以下为基于村庄信息生成的体验建议。</em>
                    </div>
                    <div className={styles.playHighlightGrid}>
                      {playHighlights.map((highlight) => (
                        <div key={`${highlight.title}_${highlight.desc}`}>
                          <strong>{highlight.title}</strong>
                          <p>{highlight.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.playHighlights}>
                    <div className={styles.playHighlightTitle}>
                      <Sparkles size={15} />
                      <span>可体验内容</span>
                    </div>
                    <p className={styles.playEmptyText}>暂未获取到可核验游玩地点，建议出发前结合地图 App 搜索周边开放信息。</p>
                  </div>
                )}
              </div>
              <div className={styles.resultLandscape} aria-hidden="true">
                <span className={styles.resultSun} />
                <span className={styles.resultHillOne} />
                <span className={styles.resultHillTwo} />
                <span className={styles.resultHouse}>⌂</span>
              </div>
            </div>

            <div className={styles.contentTrio}>
              <article className={styles.trioCard}>
                <div className={styles.cardTitle}>
                  <Route size={19} />
                  <h3>路线规划</h3>
                  {routePlan ? (
                    <span className={styles.providerBadge}>
                      {routePlan.provider === "amap" ? "高德路线" : "估算建议"}
                    </span>
                  ) : null}
                </div>

                {routeLoading ? (
                  <div className={styles.routeLoading}>
                    <span />
                    正在获取真实距离与耗时...
                  </div>
                ) : routePlan ? (
                  <>
                    <div className={styles.routeMetrics}>
                      <div><Navigation size={18} /><span>距离</span><strong>{routePlan.distanceText}</strong></div>
                      <div><Clock3 size={18} /><span>耗时</span><strong>{routePlan.durationText}</strong></div>
                    </div>
                    <div className={styles.mapPreview}>
                      {mapPreviewUrl && !mapPreviewFailed ? (
                        <img src={mapPreviewUrl} alt={`${plan.recommended.name}地图预览`} onError={() => setMapPreviewFailed(true)} />
                      ) : (
                        <div className={styles.mapFallback}>
                          <span>⌂</span>
                          <p>地图预览暂不可用，点击下方按钮打开高德地图。</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.routeError}>
                      {routeError || "路线规划暂不可用"}
                    </p>
                    <div className={styles.mapPreview}>
                      <div className={styles.mapFallback}>
                        <span>⌂</span>
                        <p>路线规划暂不可用，建议出发前使用地图 App 确认。</p>
                      </div>
                    </div>
                  </>
                )}

                <div className={styles.routeActions}>
                  <button type="button" onClick={openMap}>
                    <Navigation size={16} />
                    打开地图
                  </button>
                  <button type="button" onClick={copyRoute}>
                    <Copy size={16} />
                    复制路线建议
                  </button>
                </div>
              </article>

              <article className={styles.trioCard}>
                <div className={styles.cardTitle}>
                  <Utensils size={19} />
                  <h3>觅美食</h3>
                </div>
                <p className={styles.sectionHint}>点击店铺可在高德中查看位置</p>
                {(plan.foods || []).length > 0 ? (
                  <div className={styles.compactItemList}>
                    {(plan.foods || []).slice(0, 3).map((food, index) => (
                      <button className={styles.serviceItem} type="button" onClick={() => openAmapPoi(food)} key={`${food.name}_${index}`}>
                        <span className={styles.foodIcon}>{food.name?.slice(0, 1) || "食"}</span>
                        <div>
                          <strong>{food.name}</strong>
                          <p>{food.desc}</p>
                          <span>{food.priceText}</span>
                          {food.tag ? <em>{food.tag}</em> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyServiceText}>暂无精选推荐，建议出发前结合地图 App 查询附近店铺。</p>
                )}
                <div className={styles.trioFooter}>
                  <button type="button" onClick={placeholderAction}>查看更多美食</button>
                </div>
              </article>

              <article className={styles.trioCard}>
                <div className={styles.cardTitle}>
                  <BedDouble size={19} />
                  <h3>寻住处</h3>
                </div>
                <p className={styles.sectionHint}>点击店铺可在高德中查看位置</p>
                {(plan.stays || []).length > 0 ? (
                  <div className={styles.compactItemList}>
                    {(plan.stays || []).slice(0, 3).map((stay, index) => (
                      <button className={styles.serviceItem} type="button" onClick={() => openAmapPoi(stay)} key={`${stay.name}_${index}`}>
                        <span className={styles.stayIcon}>⌂</span>
                        <div>
                          <strong>{stay.name}</strong>
                          <p>{stay.desc}</p>
                          <span>{stay.priceText}</span>
                          {stay.tag ? <em>{stay.tag}</em> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyServiceText}>暂无精选推荐，建议出发前结合地图 App 查询附近店铺。</p>
                )}
                <div className={styles.trioFooter}>
                  <button type="button" onClick={placeholderAction}>查看更多住宿</button>
                </div>
              </article>
            </div>

            <article className={styles.alternativeCard}>
              <div className={styles.cardTitle}>
                <MapPin size={19} />
                <h3>备选村庄</h3>
                <span className={styles.placeholderLabel}>{switchingVillageId ? "正在切换方案…" : "点击切换方案"}</span>
              </div>
              <div className={styles.alternativeGrid}>
                {(plan.alternatives || []).map((alternative) => (
                  <button
                    type="button"
                    key={alternative.id}
                    onClick={() => switchAlternative(alternative)}
                    disabled={Boolean(switchingVillageId)}
                  >
                    <span className={styles.alternativeVisual}>⌂</span>
                    <div>
                      <strong>{alternative.name}</strong>
                      <span>{alternative.city}</span>
                      <p>{alternative.summary || alternative.reasonSummary || alternative.description}</p>
                      <div>
                        {(alternative.tags || []).slice(0, 2).map((tag) => <em key={tag}>{tag}</em>)}
                        <b>{scoreText(alternative.matchScore)}</b>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </article>

            <footer className={styles.resultFooter}>
              <p>
                本次规划内容由 AI 生成，仅供参考。出行前请确认路线和服务信息。
                {plan.providerUsed !== "deepseek" ? " 当前使用规则推荐兜底生成。" : ""}
              </p>
              <div>
                <button type="button" onClick={saveFavoriteAndTrip}><Bookmark size={15} />收藏行程</button>
                <button type="button" onClick={exportCurrentPlan}>导出行程</button>
                <button type="button" onClick={handleSubmit}>重新生成</button>
              </div>
            </footer>
          </section>
        ) : null}
      </section>
    </main>
  );
}
