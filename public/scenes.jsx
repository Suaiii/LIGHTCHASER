// scenes.jsx — 5 个横向 feed 场景

const { useState, useEffect, useRef, useMemo } = React;

// ─────────────────────────────────────────
// 工具：颜色插值（8 个锚点色卡）
// ─────────────────────────────────────────
const hex = (h) => {
  const x = h.replace("#", "");
  return [parseInt(x.slice(0,2),16), parseInt(x.slice(2,4),16), parseInt(x.slice(4,6),16)];
};

// 主色卡 (Refined) — 用户供的 8 锚点
const PALETTE_REFINED = [
  { t: 0.00, c: hex("#5C749A"), name: "现在 · 清冷灰蓝" },
  { t: 0.15, c: hex("#3A4A6B"), name: "现在 · 深灰蓝" },
  { t: 0.35, c: hex("#B08050"), name: "Golden Hour · 暗金黄" },
  { t: 0.50, c: hex("#E0A060"), name: "Golden Hour · 橘黄" },
  { t: 0.65, c: hex("#DE6B48"), name: "日落 · 橘红" },
  { t: 0.78, c: hex("#C84858"), name: "晚霞峰值 · 深红" },
  { t: 0.90, c: hex("#8A4068"), name: "消散 · 紫红" },
  { t: 1.00, c: hex("#5A3870"), name: "夜幕 · 紫" },
];

// 备选色卡 (Dramatic) — 更饱和、用于对比
const PALETTE_DRAMATIC = [
  { t: 0.00, c: hex("#1A1D2E") },
  { t: 0.20, c: hex("#3A4A6B") },
  { t: 0.45, c: hex("#E0A060") },
  { t: 0.62, c: hex("#FF8A3D") },
  { t: 0.78, c: hex("#C84858") },
  { t: 0.92, c: hex("#5A3870") },
  { t: 1.00, c: hex("#14172A") },
];

let CURRENT_PALETTE = PALETTE_REFINED;
function setPalette(name) {
  CURRENT_PALETTE = name === "dramatic" ? PALETTE_DRAMATIC : PALETTE_REFINED;
}
function getPalette() { return CURRENT_PALETTE; }

function lerp(a, b, t) { return a + (b - a) * t; }
function skyColor(t) {
  t = Math.max(0, Math.min(1, t));
  const P = CURRENT_PALETTE;
  for (let i = 0; i < P.length - 1; i++) {
    const A = P[i], B = P[i + 1];
    if (t >= A.t && t <= B.t) {
      const u = (t - A.t) / (B.t - A.t);
      return [lerp(A.c[0], B.c[0], u), lerp(A.c[1], B.c[1], u), lerp(A.c[2], B.c[2], u)];
    }
  }
  return P[P.length - 1].c;
}
const rgb = (c) => `rgb(${c[0].toFixed(0)}, ${c[1].toFixed(0)}, ${c[2].toFixed(0)})`;

const hexToRgbTuple = (color, fallback = [200, 72, 88]) => {
  if (!color || typeof color !== "string") return fallback;
  const clean = color.replace("#", "");
  if (clean.length !== 6) return fallback;
  const parsed = [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
  return parsed.every(Number.isFinite) ? parsed : fallback;
};

const displayKmFromDistance = (distanceText = "步行 16 分钟") => {
  const minuteMatch = String(distanceText).match(/(\d+)/);
  if (!minuteMatch) return "1.2";
  const km = Math.max(0.2, Math.round((Number(minuteMatch[1]) / 12.5) * 10) / 10);
  return km.toFixed(km >= 10 ? 0 : 1);
};

function getTimelineColorAt(payload, ratio, fallbackRatio = ratio) {
  const colors = payload?.timelineColors;
  if (Array.isArray(colors) && colors.length > 0) {
    const index = Math.max(0, Math.min(colors.length - 1, Math.round(ratio * (colors.length - 1))));
    return hexToRgbTuple(colors[index], skyColor(fallbackRatio));
  }
  return skyColor(fallbackRatio);
}

function VideoBackdrop({ src, children, overlay = "linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 100%)" }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      {!failed && (
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.82,
          }}
        />
      )}
      {failed && children}
      <div style={{ position: "absolute", inset: 0, background: overlay, pointerEvents: "none" }} />
    </>
  );
}

function VlogFallbackScene() {
  return (
    <>
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 100%),
          linear-gradient(to bottom, ${rgb(skyColor(0.3))} 0%, ${rgb(skyColor(0.55))} 45%, ${rgb(skyColor(0.7))} 70%, #1a1820 100%)
        `,
      }} />
      <div style={{
        position: "absolute", left: "20%", top: "32%",
        width: 96, height: 96, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,230,180,0.95) 0%, rgba(255,200,140,0.4) 40%, transparent 70%)",
        filter: "blur(3px)",
      }} />
      <div style={{ position: "absolute", bottom: 120, left: 0, right: 0, opacity: 0.85 }}>
        <CitySilhouette height={260} />
      </div>
      <div style={{
        position: "absolute", right: 40, bottom: 200, width: 4, height: 220,
        background: "#0a0a0d",
      }} />
      <div style={{
        position: "absolute", right: 24, bottom: 408, width: 38, height: 14,
        background: "#0a0a0d", borderRadius: 2,
      }} />
    </>
  );
}

// time helpers — slider 0..1 maps to 17:00 → 18:30 (90min)
function tToClock(t) {
  const totalMin = 17 * 60 + Math.round(t * 90);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

// ─────────────────────────────────────────
// 装饰：上海天际线（东方明珠 + 上海中心 + 金茂 + SWFC）
// 纯几何体：矩形 + 圆 + 梯形，不是写实插画
// ─────────────────────────────────────────
function CitySilhouette({ height = 180, color = "#0a0a0d", opacity = 1 }) {
  return (
    <svg viewBox="0 0 400 200" width="100%" height={height} preserveAspectRatio="none"
         style={{ display: "block", opacity }}>
      <defs>
        <linearGradient id="cityFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="60%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <g fill="url(#cityFade)">
        {/* 远景小楼群 - 左 */}
        <rect x="0"   y="150" width="22" height="50" />
        <rect x="22"  y="135" width="18" height="65" />
        <rect x="40"  y="120" width="14" height="80" />
        <rect x="54"  y="140" width="24" height="60" />
        <rect x="78"  y="118" width="16" height="82" />
        <rect x="94"  y="100" width="22" height="100" />
        <rect x="116" y="130" width="10" height="70" />

        {/* 东方明珠：细高柱 + 2 球 */}
        <rect x="131" y="58" width="4" height="142" />
        <circle cx="133" cy="110" r="9" />
        <circle cx="133" cy="75"  r="6.5" />
        <polygon points="133,42 130,58 136,58" />

        {/* 中距、中高度 */}
        <rect x="145" y="125" width="20" height="75" />
        <rect x="165" y="105" width="12" height="95" />
        <rect x="177" y="122" width="18" height="78" />

        {/* SWFC 环球金融中心：梯形上部 + 矩形洞（“开瓶器”） */}
        <polygon points="198,200 198,60 222,60 222,200" />
        <rect x="205" y="68" width="10" height="6" fill={color} fillOpacity="0" />
        {/* hole — 用背景色覆盖：由外部控制，这里用黑漆出一个凹槽 */}

        {/* 金茂大厦：多层梯形顶 */}
        <polygon points="230,200 230,82 244,82 244,76 252,76 252,200" />
        <polygon points="234,82 234,72 248,72 248,82" />
        <rect x="239" y="58" width="4" height="14" />
        <polygon points="239,58 241,50 243,58" />

        {/* 上海中心 (Shanghai Tower)：高 · 顶部圆角·略扞转 */}
        <path d="M 258 200 L 258 50 Q 258 40 263 38 L 270 36 L 274 38 Q 278 40 278 50 L 278 200 Z" />
        <rect x="267" y="30" width="2" height="8" />

        {/* 中距楼群 右 */}
        <rect x="284" y="118" width="22" height="82" />
        <rect x="306" y="100" width="14" height="100" />
        <rect x="320" y="135" width="20" height="65" />
        <rect x="340" y="112" width="12" height="88" />
        <rect x="352" y="130" width="18" height="70" />
        <rect x="370" y="108" width="14" height="92" />
        <rect x="384" y="140" width="16" height="60" />
      </g>
    </svg>
  );
}

// 占位图（取代真实图片）
function PhotoPlaceholder({ skyT = 0.62, label, height = 240, showCity = true, children }) {
  const top = skyColor(Math.max(0, skyT - 0.18));
  const mid = skyColor(skyT);
  const bot = skyColor(Math.min(1, skyT + 0.15));
  const cityH = typeof height === "number" ? height * 0.55 : "55%";
  return (
    <div style={{
      position: "relative",
      width: "100%", height,
      borderRadius: 14, overflow: "hidden",
      background: `linear-gradient(to bottom, ${rgb(top)}, ${rgb(mid)} 55%, ${rgb(bot)})`,
      boxShadow: "inset 0 0 80px rgba(0,0,0,0.25)",
    }}>
      {/* 太阳 / 圆 */}
      <div style={{
        position: "absolute", left: "62%", top: "44%",
        width: 64, height: 64, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(255,240,200,0.95) 0%, rgba(255,200,140,0.6) 40%, rgba(255,200,140,0) 70%)`,
        filter: "blur(2px)",
      }} />
      {/* 云带 */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: "30%", height: 36,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent 70%)",
        filter: "blur(8px)",
      }} />
      {/* 城市轮廓 */}
      {showCity && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <CitySilhouette height={cityH} />
        </div>
      )}
      {/* 标签 */}
      {label && (
        <div style={{
          position: "absolute", top: 10, left: 10,
          padding: "3px 8px",
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)",
          fontSize: 10, color: "rgba(255,255,255,0.8)",
          fontFamily: "var(--font-mono)",
          borderRadius: 4,
          letterSpacing: 0.4,
        }}>{label}</div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────
// 评分 → 文案 / 颜色
// ─────────────────────────────────────────
function scoreInfo(score) {
  if (score >= 80) return { label: "值得跑出门", tone: "high",  c: "#ff8a3d", sub: "今晚的天空有戏" };
  if (score >= 50) return { label: "天空一般",   tone: "mid",   c: "#e0a060", sub: "明天可能更好" };
  return { label: "今天歇着",                    tone: "low",   c: "#7a7a85", sub: "晚上换个事做" };
}

// ─────────────────────────────────────────
// Scene 0 — 街景 vlog (入口)
// ─────────────────────────────────────────
function SceneVlog({ score = 87, sunsetPayload }) {
  const info = scoreInfo(score);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <VideoBackdrop src="/assets/videos/d2e53f3bad4d95ca349f8a8d39ca3c43.mp4">
        <VlogFallbackScene />
      </VideoBackdrop>

      {/* 抖音号 + 来源 */}
      <div style={{
        position: "absolute", top: 64, left: 16,
        fontSize: 11, color: "rgba(255,255,255,0.55)",
        fontFamily: "var(--font-mono)",
      }}>
        <div>抖音号：guang_chaser</div>
        <div>⌕ 上海·南京西路</div>
      </div>

      {/* 卡片浮层 — 视频底部信息 */}
      <div style={{
        position: "absolute", left: 0, right: 80, bottom: 100, padding: "0 18px",
      }}>
        <div style={{ marginBottom: 10 }}>
          <AIPill text={`${sunsetPayload?.scoreLabel || info.sub} · 上滑看预报`} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 4 }}>
          @光 · 追光者
          <span style={{
            display: "inline-grid", placeItems: "center",
            width: 14, height: 14, borderRadius: "50%",
            background: "var(--accent)", color: "#fff",
            fontSize: 9, marginLeft: 4, verticalAlign: 1, fontWeight: 800,
          }}>✓</span>
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", lineHeight: 1.5, marginBottom: 6 }}>
          今天天气不错，出来走走。 <span style={{ color: "#ffd49a" }}>#晚霞预警</span>
          <span style={{ color: "#ffd49a" }}> #citywalk</span>
          <span style={{ color: "#ffd49a" }}> #{sunsetPayload?.recommendation?.spot || "上海江边"}</span>
        </div>
        <MusicMarquee text="Under Current — Bunkka · 海浪拟声 · 67.8w 人使用" />
      </div>

      {/* 引导：左滑发现 */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 64,
        textAlign: "center",
        fontSize: 11, color: "rgba(255,255,255,0.6)",
        letterSpacing: 4,
        fontWeight: 500,
        animation: "fadeNudge 2.4s ease-in-out infinite",
      }}>
        ← &nbsp; 左滑查看今晚的天空
      </div>
      <style>{`
        @keyframes fadeNudge {
          0%, 100% { opacity: 0.35; transform: translateX(0); }
          50%      { opacity: 0.85; transform: translateX(-6px); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────
// Scene 1 — AI 加载（瞬态过渡）
// ─────────────────────────────────────────
function SceneLoading({ progress = 0 }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: `linear-gradient(180deg, #1a1d2e 0%, ${rgb(skyColor(0.55))} 50%, ${rgb(skyColor(0.78))} 100%)`,
      display: "grid", placeItems: "center",
    }}>
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div style={{
          width: 88, height: 88, margin: "0 auto 28px",
          borderRadius: "50%",
          background: "conic-gradient(from 0deg, transparent, #ff8a3d, #ffd49a, transparent)",
          animation: "spin 1.2s linear infinite",
          padding: 3,
        }}>
          <div style={{
            width: "100%", height: "100%", borderRadius: "50%",
            background: "#1a1d2e",
            display: "grid", placeItems: "center",
            fontFamily: "var(--font-display)",
            fontSize: 36, fontWeight: 600,
            color: "#ffd49a",
          }}>追</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>
          正在为你查看今晚的天空
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono)" }}>
          云量 · 湿度 · 太阳方位 · 能见度
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Scene 2 — 晚霞卡片封面 (核心 · 强视觉)
//   设计目标：刷到的一瞬间就明白「我要去拍」
//   - 全屏晚霞渐变背景（用 refined 色卡的爆发段）
//   - 上海标志性天际线剪影 + 落日
//   - 大号衬线中文标语 + 评分徽章
//   - 底部机位卡：距离 + 峰值时刻 + 左滑提示
// ─────────────────────────────────────────
function MiniRouteThumbnail({ routeData, sunsetPayload }) {
  const start = sunsetPayload?.meta?.coordinates;
  const end = sunsetPayload?.recommendation?.coordinates;
  const points = routeData?.geometry?.length ? routeData.geometry : [start, end].filter(Boolean);
  const validPoints = points.filter((point) => typeof point?.lat === "number" && typeof point?.lng === "number");

  if (validPoints.length < 2) {
    return <span style={{ fontSize: 22, color: "#fff" }}>◎</span>;
  }

  const lats = validPoints.map((point) => point.lat);
  const lngs = validPoints.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);
  const project = (point) => {
    const x = 10 + ((point.lng - minLng) / lngSpan) * 40;
    const y = 50 - ((point.lat - minLat) / latSpan) * 40;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const path = validPoints.map(project).join(" ");

  return (
    <svg data-route-thumbnail="true" viewBox="0 0 60 60" width="50" height="50" aria-label="路线缩略图">
      <rect width="60" height="60" rx="14" fill="rgba(255,255,255,0.08)" />
      <path d="M 8 16 L 54 10 M 6 42 L 50 34 M 22 6 L 18 54 M 42 8 L 38 56" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
      <polyline points={path} fill="none" stroke="#ff8a3d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={project(validPoints[0]).split(",")[0]} cy={project(validPoints[0]).split(",")[1]} r="5" fill="#ffb26f" stroke="#fff" strokeWidth="2" />
      <circle cx={project(validPoints[validPoints.length - 1]).split(",")[0]} cy={project(validPoints[validPoints.length - 1]).split(",")[1]} r="5" fill="#ff5a5a" stroke="#1b0d12" strokeWidth="2" />
    </svg>
  );
}

function SceneSunsetCard({ score = 87, peak = "18:15", sunsetPayload, routeData, loading = false, mode = "live" }) {
  const info = { ...scoreInfo(score), label: sunsetPayload?.scoreLabel || scoreInfo(score).label };
  const recommendation = sunsetPayload?.recommendation || {};
  const burst = getTimelineColorAt(sunsetPayload, 0.78, 0.78);   // 峰值红
  const golden = getTimelineColorAt(sunsetPayload, 0.50, 0.50);  // 橘
  const violet = getTimelineColorAt(sunsetPayload, 0.92, 0.92);  // 紫
  const current = hexToRgbTuple(sunsetPayload?.currentSkyColor, burst);
  const spot = recommendation.spot || "附近开阔水岸";
  const distanceText = recommendation.distance || "步行 16 分钟";
  const distanceKm = displayKmFromDistance(distanceText);
  const cityLabel = sunsetPayload?.meta?.city === "Los Angeles" ? "洛杉矶" : "上海";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: 'url("/assets/uploads/jingansi-card-bg.jpeg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        transform: "scale(1.02)",
        filter: "saturate(1.02) contrast(1.02) brightness(0.54)",
      }} />

      {/* 背景：分层晚霞渐变 */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(180deg,
            rgba(8, 10, 18, 0.78) 0%,
            rgba(15, 14, 24, 0.34) 18%,
            rgba(28, 18, 24, 0.12) 42%,
            rgba(40, 18, 28, 0.24) 64%,
            rgba(16, 8, 18, 0.78) 100%)
        `,
      }} />

      <div style={{
        position: "absolute",
        inset: 0,
        background: `
          radial-gradient(circle at 68% 30%, ${rgb(golden)}44 0%, transparent 26%),
          radial-gradient(circle at 72% 58%, ${rgb(burst)}26 0%, transparent 32%),
          linear-gradient(180deg, transparent 0%, rgba(8, 6, 12, 0.18) 62%, rgba(8, 6, 12, 0.55) 100%)
        `,
        mixBlendMode: "screen",
        opacity: 0.92,
      }} />

      {/* 顶部光晕 */}
      <div style={{
        position: "absolute", left: "55%", top: "32%", transform: "translate(-50%, -50%)",
        width: 360, height: 360, borderRadius: "50%",
        background: `radial-gradient(circle, ${rgb(golden)}55 0%, ${rgb(burst)}28 35%, transparent 65%)`,
        filter: "blur(8px)",
        opacity: 0.68,
      }} />

      {/* 太阳：落到天际线上方 */}
      <div style={{
        position: "absolute", left: "57%", top: 360, transform: "translateX(-50%)",
        width: 110, height: 110, borderRadius: "50%",
        background: `radial-gradient(circle,
          rgba(255,245,220,0.58) 0%,
          rgba(255,210,150,0.45) 25%,
          rgba(255,170,110,0.18) 50%,
          rgba(255,140,90,0) 75%)`,
        filter: "blur(1.5px)",
        zIndex: 1,
        opacity: 0.52,
      }} />

      {/* 大号衬线标语 — 左侧 */}
      <div style={{
        position: "absolute", left: 20, top: 110, zIndex: 3,
        color: "#fff",
      }}>
        <AIPill text={`${loading ? "正在定位" : "今晚"} · ${cityLabel} · ${mode}`} />
        <div className="num" style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 64,
          lineHeight: 0.95,
          letterSpacing: -2,
          marginTop: 14,
          textShadow: "0 4px 30px rgba(0,0,0,0.35)",
        }}>
          今晚<br/>
          西天<br/>
          <span style={{
            background: `linear-gradient(180deg, #fff 0%, #ffe2b8 60%, ${rgb(burst)} 110%)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontWeight: 700,
          }}>会烧</span>
        </div>
        <div style={{
          marginTop: 12,
          fontSize: 13,
          color: "rgba(255,255,255,0.85)",
          fontWeight: 500,
          letterSpacing: 0.5,
          maxWidth: 240,
          lineHeight: 1.5,
        }}>
          峰值 {peak} · 约 {sunsetPayload?.peakDuration || 14} 分钟 · 向{recommendation.direction || "西"}看
          <br/>
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
            ——AI 译自今天的气象
          </span>
        </div>
      </div>

      {/* 右上：评分徽章 */}
      <div style={{
        position: "absolute", right: 16, top: 110, zIndex: 3,
        display: "flex", flexDirection: "column", alignItems: "flex-end",
      }}>
        <div style={{
          padding: "10px 14px",
          background: "rgba(0,0,0,0.32)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          textAlign: "right",
          minWidth: 92,
        }}>
          <div className="mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: 1.4 }}>
            SUNSET&nbsp;SCORE
          </div>
          <div className="num" style={{
            fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500,
            fontSize: 54, lineHeight: 1,
            color: "#fff",
            textShadow: "0 2px 12px rgba(0,0,0,0.3)",
            marginTop: 2,
          }}>{score}<span style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", fontWeight: 400 }}>/100</span></div>
          <div style={{
            marginTop: 4, paddingTop: 4,
            borderTop: "1px solid rgba(255,255,255,0.15)",
            fontSize: 12, fontWeight: 700, color: "#ffd49a",
          }}>
            {info.label}
          </div>
        </div>
      </div>

      {/* 中段：天际线剪影 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 240, zIndex: 2 }}>
        <CitySilhouette height={260} color="#100815" opacity={0.32} />
      </div>

      {/* 倒映水面：很薄的渐变带 */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 200, height: 50, zIndex: 2,
        background: `linear-gradient(180deg, transparent, ${rgb(burst)}22, transparent)`,
        opacity: 0.6,
      }} />

      {/* 底部：机位卡 */}
      <div style={{
        position: "absolute", left: 14, right: 14, bottom: 110, zIndex: 5,
        padding: "14px 16px",
        background: "rgba(20, 10, 24, 0.55)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20,
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 14,
            background: "rgba(255,255,255,0.08)",
            display: "grid", placeItems: "center",
            overflow: "hidden",
            boxShadow: `0 4px 16px ${rgb(burst)}66`,
          }}>
            <MiniRouteThumbnail routeData={routeData} sunsetPayload={sunsetPayload} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
              {spot} · {recommendation.direction || "西"}望机位
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              <span><span style={{ color: "#ffd49a" }}>{distanceKm}</span>km</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{distanceText}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>峰值 <span style={{ color: "#ffd49a" }}>{peak}</span></span>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.10)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8,
        }}>
          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.6)",
            letterSpacing: 2,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ animation: "leftnudge 1.8s ease-in-out infinite", display: "inline-block" }}>←</span>
            左滑·看天空变色
          </div>
          <button style={{
            padding: "9px 18px",
            borderRadius: 99,
            background: "var(--accent)",
            color: "#1a0e08",
            border: "none",
            fontSize: 13, fontWeight: 700,
            fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 4px 12px rgba(255,138,61,0.35)",
          }}>
            ➤&nbsp;导航前往
          </button>
        </div>
      </div>

      <style>{`@keyframes leftnudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-4px); } }`}</style>
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div className="num" style={{
        fontSize: 24, color: accent ? "var(--accent)" : "#fff", fontWeight: 500,
        fontFamily: "var(--font-display)", fontStyle: "italic",
      }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────
// Scene 3 — 时间条 + 色卡 (产品灵魂)
// ─────────────────────────────────────────
function SceneTimeSlider({ sunsetPayload }) {
  const [t, setT] = useState(0.62);  // 默认在 18:02 日落
  const trackRef = useRef(null);
  const dragging = useRef(false);

  const c = getTimelineColorAt(sunsetPayload, t, t);
  const cTop = getTimelineColorAt(sunsetPayload, Math.max(0, t - 0.18), Math.max(0, t - 0.18));
  const cMid = c;
  const cBot = getTimelineColorAt(sunsetPayload, Math.min(1, t + 0.15), Math.min(1, t + 0.15));

  function handleDrag(clientX) {
    const el = trackRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const nt = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setT(nt);
  }
  function onDown(e) {
    dragging.current = true;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    handleDrag(x);
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging.current) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    handleDrag(x);
  }
  function onUp() { dragging.current = false; }

  useEffect(() => {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const anchors = [
    { t: 0.00, label: "17:00", note: "现在" },
    { t: 0.33, label: sunsetPayload?.meta?.goldenHourStart || "17:30", note: "黄金时刻" },
    { t: 0.62, label: sunsetPayload?.meta?.sunsetTime || "18:02", note: "日落" },
    { t: 0.78, label: sunsetPayload?.peakTime || "18:15", note: "峰值" },
    { t: 1.00, label: "18:30", note: "结束" },
  ];

  // 当前最近锚点的 note
  let nearestNote = anchors[0].note;
  let minD = 1;
  for (const a of anchors) {
    const d = Math.abs(a.t - t);
    if (d < minD) { minD = d; nearestNote = a.note; }
  }

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: `linear-gradient(180deg, ${rgb(cTop)} 0%, ${rgb(cMid)} 55%, ${rgb(cBot)} 100%)`,
      transition: "background 0.1s linear",
      overflow: "hidden",
    }}>
      {/* 太阳 - 高度随时间变化 */}
      <div style={{
        position: "absolute",
        left: `${20 + t * 50}%`,
        top: `${68 - Math.sin(t * Math.PI) * 38}%`,
        width: 80, height: 80, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,240,200,0.95) 0%, rgba(255,200,140,0.5) 40%, rgba(255,200,140,0) 75%)",
        filter: "blur(2px)",
        transition: "left 0.1s linear, top 0.1s linear",
      }} />

      {/* 远景城市 */}
      <div style={{ position: "absolute", bottom: 280, left: 0, right: 0, opacity: 0.9 }}>
        <CitySilhouette height={180} />
      </div>

      {/* 顶部 hud */}
      <div style={{
        position: "absolute", top: 60, left: 0, right: 0, padding: "0 18px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        color: "#fff",
      }}>
        <AIPill text="光的视角 · 拖动看变化" />
        <div className="mono" style={{
          fontSize: 11, color: "rgba(255,255,255,0.7)", letterSpacing: 1,
          padding: "4px 8px", background: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(10px)", borderRadius: 6,
        }}>
          {rgb(c).toUpperCase().replace("RGB", "").replace(/[()]/g, "").split(",").map(s => Number(s).toString(16).padStart(2,"0")).join("")}
        </div>
      </div>

      {/* 大时间显示 */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 260, textAlign: "center",
        color: "#fff",
      }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: 4, opacity: 0.7, marginBottom: 6 }}>
          {nearestNote.toUpperCase()}
        </div>
        <div className="num" style={{
          fontSize: 96, fontWeight: 400, lineHeight: 1,
          fontFamily: "var(--font-display)", fontStyle: "italic",
          textShadow: "0 4px 30px rgba(0,0,0,0.4)",
          letterSpacing: -2,
        }}>
          {tToClock(t)}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
          {timeNarration(t)}
        </div>
      </div>

      {/* 时间条 */}
      <div style={{
        position: "absolute", left: 16, right: 16, bottom: 140,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20,
        padding: "16px 16px 14px",
      }}>
        {/* 色卡轨 */}
        <div
          ref={trackRef}
          onPointerDown={onDown}
          onTouchStart={onDown}
          style={{
            position: "relative",
            height: 36, borderRadius: 10,
          background: buildSkyGradient(sunsetPayload),
            cursor: "grab",
            touchAction: "none",
          }}>
          {/* 锚点 */}
          {anchors.map((a, i) => (
            <div key={i} style={{
              position: "absolute", left: `${a.t * 100}%`, top: -2, bottom: -2,
              width: 2, background: "rgba(255,255,255,0.45)",
              transform: "translateX(-1px)",
            }} />
          ))}
          {/* 拇指 */}
          <div style={{
            position: "absolute", left: `${t * 100}%`, top: -6, bottom: -6,
            width: 4, transform: "translateX(-2px)",
            background: "#fff",
            borderRadius: 4,
            boxShadow: "0 0 0 3px rgba(255,255,255,0.3), 0 4px 12px rgba(0,0,0,0.5)",
          }} />
        </div>

        {/* 锚点标签 */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 8,
          fontSize: 10, color: "rgba(255,255,255,0.65)",
          fontFamily: "var(--font-mono)",
        }}>
          {anchors.map((a, i) => (
            <div key={i} style={{
              opacity: Math.abs(a.t - t) < 0.08 ? 1 : 0.6,
              fontWeight: Math.abs(a.t - t) < 0.08 ? 700 : 400,
              color: Math.abs(a.t - t) < 0.08 ? "#fff" : "rgba(255,255,255,0.65)",
            }}>
              {a.label}
            </div>
          ))}
        </div>
      </div>

      {/* 评分 mini */}
      <div style={{
        position: "absolute", top: 110, right: 16,
        display: "flex", alignItems: "baseline", gap: 4,
        color: "#fff",
      }}>
        <span className="mono" style={{ fontSize: 10, opacity: 0.6, marginRight: 2 }}>评分</span>
        <span className="num" style={{ fontSize: 32, fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500 }}>87</span>
        <span className="mono" style={{ fontSize: 10, opacity: 0.6 }}>/100</span>
      </div>
    </div>
  );
}

function timeNarration(t) {
  if (t < 0.2) return "日落前 · 西边天空泛起轻微金光";
  if (t < 0.4) return "黄金时刻开始 · 光线变软";
  if (t < 0.6) return "建筑反射开始变暖 · 拍人最佳";
  if (t < 0.7) return "日落 · 等十分钟，最好的还在后面";
  if (t < 0.85) return "晚霞峰值 · 整个西天在烧";
  return "余晖散去 · 蓝调时刻接管天空";
}

function buildSkyGradient(sunsetPayload) {
  if (sunsetPayload?.timelineColors?.length) {
    const colors = sunsetPayload.timelineColors;
    const stops = colors.map((color, index) => `${color} ${((index / (colors.length - 1)) * 100).toFixed(1)}%`).join(", ");
    return `linear-gradient(90deg, ${stops})`;
  }
  const stops = CURRENT_PALETTE.map(k => `${rgb(k.c)} ${(k.t * 100).toFixed(1)}%`).join(", ");
  return `linear-gradient(90deg, ${stops})`;
}

// ─────────────────────────────────────────
// Scene 4 — 机位详情 / 拍摄指令 / 附近作品
// ─────────────────────────────────────────
function SceneSpotDetail() {
  return (
    <div style={{
      position: "absolute", inset: 0, overflow: "hidden",
      background: "#0a0a0d",
    }}>
      {/* 顶部实景占位 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}>
        <PhotoPlaceholder skyT={0.72} label="STATIC.PREVIEW · 18:14" height={320} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 60%, #0a0a0d 100%)",
        }} />
        {/* 机位 pin */}
        <div style={{
          position: "absolute", left: "62%", top: "55%", transform: "translate(-50%, -100%)",
          color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        }}>
          <div style={{
            padding: "5px 10px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)",
            borderRadius: 8, fontSize: 11, fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.15)",
          }}>站这里 ↓</div>
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 0 3px rgba(255,138,61,0.35)",
          }} />
        </div>

        {/* 顶部 hud */}
        <div style={{ position: "absolute", top: 60, left: 16, right: 16, display: "flex", justifyContent: "space-between" }}>
          <AIPill text="机位 · 静安寺天桥 · 西望" />
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "5px 10px",
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
            borderRadius: 99,
            fontSize: 11, color: "#fff", fontWeight: 500,
          }}>
            <span style={{ color: "#4ad97a", fontSize: 14, lineHeight: 1 }}>●</span> 已收藏
          </div>
        </div>
      </div>

      {/* 下半部信息卡 */}
      <div style={{
        position: "absolute", top: 280, left: 0, right: 0, bottom: 110,
        padding: "0 16px",
        display: "flex", flexDirection: "column", gap: 12,
        overflow: "auto",
      }}>
        {/* 距离 + 导航 */}
        <div style={{
          padding: "14px 16px",
          background: "var(--bg-card)",
          borderRadius: 18,
          display: "flex", alignItems: "center", gap: 14,
          border: "1px solid var(--line)",
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: "rgba(255,138,61,0.12)",
            display: "grid", placeItems: "center",
            color: "var(--accent)",
            fontSize: 22,
          }}>◎</div>
          <div style={{ flex: 1 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-dim)", marginBottom: 2 }}>距你位置</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 500, fontFamily: "var(--font-display)", fontStyle: "italic" }}>
              1.2<span style={{ fontSize: 13, marginLeft: 2 }}>km</span>
              <span style={{ fontSize: 12, color: "var(--ink-dim)", marginLeft: 8, fontStyle: "normal", fontFamily: "var(--font-cn)" }}>步行约 16 分钟</span>
            </div>
          </div>
          <button style={{
            padding: "10px 16px", borderRadius: 12,
            background: "var(--accent)",
            color: "#1a0e08",
            border: "none", fontWeight: 700, fontSize: 13,
            fontFamily: "inherit",
          }}>导航前往</button>
        </div>

        {/* 拍摄小贴士 */}
        <div style={{
          padding: "14px 16px",
          background: "var(--bg-card)",
          borderRadius: 18,
          border: "1px solid var(--line)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 16 }}>☀</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>三条拍摄指令</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-dim)", marginLeft: "auto" }}>BY · AI</div>
          </div>
          {[
            { n: "01", t: "站在邮筒右边", s: "构图前景压住" },
            { n: "02", t: "等一辆车开过", s: "让车窗反射夕阳" },
            { n: "03", t: "拍车窗反光、不是车", s: "ISO 200 / 1/160s" },
          ].map((x, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "10px 0",
              borderTop: i ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}>
              <div className="num" style={{
                fontSize: 22, fontFamily: "var(--font-display)", fontStyle: "italic",
                color: "var(--accent)", lineHeight: 1, marginTop: -2,
                minWidth: 28,
              }}>{x.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{x.t}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>{x.s}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 附近作品 */}
        <div style={{
          padding: "14px 16px 16px",
          background: "var(--bg-card)",
          borderRadius: 18,
          border: "1px solid var(--line)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 16 }}>🔥</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>附近用户作品</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>查看更多 ›</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {[
              { skyT: 0.7, user: "摄影小白", likes: 128 },
              { skyT: 0.55, user: "魔都旅人", likes: 96 },
              { skyT: 0.85, user: "光影捕手", likes: 75 },
              { skyT: 0.92, user: "日落收藏家", likes: 63 },
            ].map((p, i) => (
              <div key={i}>
                <div style={{ position: "relative", aspectRatio: "3/4", borderRadius: 8, overflow: "hidden" }}>
                  <PhotoPlaceholder skyT={p.skyT} height="100%" showCity />
                </div>
                <div style={{
                  marginTop: 5,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontSize: 10, color: "var(--ink-dim)",
                }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{p.user}</span>
                  <span>♥{p.likes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Scene 5 — 下一条视频 (回到 feed)
// ─────────────────────────────────────────
function SceneNextVideo() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* 不同的色调 — 蓝调 */}
      <VideoBackdrop src="/assets/videos/6a9a18fae770dc501bdd92751eb1f58b.mp4">
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 100%),
          linear-gradient(180deg, #1a2540 0%, #2a3a5a 50%, #1a1820 100%)
        `,
      }} />
      </VideoBackdrop>
      {/* 月亮 */}
      <div style={{
        position: "absolute", right: "20%", top: "22%",
        width: 56, height: 56, borderRadius: "50%",
        background: "radial-gradient(circle, #f0e6d2 0%, rgba(240,230,210,0.3) 60%, transparent 80%)",
        filter: "blur(1px)",
      }} />
      {/* 城市 */}
      <div style={{ position: "absolute", bottom: 140, left: 0, right: 0 }}>
        <CitySilhouette height={300} />
      </div>
      {/* 灯光点 */}
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${(i * 137) % 95 + 2}%`,
          bottom: `${140 + (i * 23) % 180}px`,
          width: 2, height: 2,
          background: "#ffd49a",
          boxShadow: "0 0 6px #ffd49a",
          opacity: 0.7,
        }} />
      ))}

      {/* 视频信息 */}
      <div style={{ position: "absolute", left: 0, right: 80, bottom: 100, padding: "0 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 4 }}>
          @夜行人小K
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", lineHeight: 1.5, marginBottom: 6 }}>
          外滩蓝调时刻，整座城市在发光 <span style={{ color: "#ffd49a" }}>#bluehour</span>
        </div>
        <MusicMarquee text="Night Drive — slowed · 蓝调 · 12.3w 人使用" />
      </div>

      <div style={{
        position: "absolute", top: 64, left: 16,
        fontSize: 11, color: "rgba(255,255,255,0.55)",
        fontFamily: "var(--font-mono)",
      }}>
        抖音号：nightwalk_k · 上海·外滩
      </div>
    </div>
  );
}

Object.assign(window, {
  SceneVlog, SceneLoading, SceneSunsetCard, SceneTimeSlider, SceneSpotDetail, SceneNextVideo,
  scoreInfo, skyColor, rgb, CitySilhouette, PhotoPlaceholder,
  setPalette, getPalette, PALETTE_REFINED, PALETTE_DRAMATIC,
  buildSkyGradient, getTimelineColorAt, VideoBackdrop,
});
