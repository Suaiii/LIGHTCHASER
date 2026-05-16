// subpanels.jsx — 三个右滑副屏：路线·光区 / 社区 / 快速拍摄
// 每个副屏使用「抖音笔记风格」的城市背景（非色卡渐变）

const { useState, useEffect, useRef, useMemo } = React;

// ────────────────────────────────────────────
// 全局接口：留给未来接入实时数据
// window.GuangbaoHooks.setLightT(t)    → 控制地图光区位置 (0..1)
// window.GuangbaoHooks.openNavigation() → 触发真实地图导航
// window.GuangbaoHooks.swipeVideoNext() → 主轴上下切换视频
// ────────────────────────────────────────────
if (typeof window !== "undefined" && !window.GuangbaoHooks) {
  window.GuangbaoHooks = {
    setLightT: (t) => {
      console.log("[GuangbaoHooks.setLightT]", t);
      window.dispatchEvent(new CustomEvent("guangbao:lightT", { detail: t }));
    },
    openNavigation: (spot) => {
      console.log("[GuangbaoHooks.openNavigation]", spot);
      const name = typeof spot === "string" ? spot : spot?.name;
      const keyword = encodeURIComponent(`${name || "苏州河乍浦路桥"} 上海`);
      window.open(`https://uri.amap.com/search?keyword=${keyword}&city=上海&view=map`, "_blank", "noopener,noreferrer");
    },
    swipeVideoNext: () => {
      console.log("[GuangbaoHooks.swipeVideoNext]");
      window.dispatchEvent(new CustomEvent("guangbao:swipeVideo", { detail: "next" }));
    },
    swipeVideoPrev: () => {
      console.log("[GuangbaoHooks.swipeVideoPrev]");
      window.dispatchEvent(new CustomEvent("guangbao:swipeVideo", { detail: "prev" }));
    },
    captureShot: (title) => {
      console.log("[GuangbaoHooks.captureShot]", title);
    },
  };
}

// 订阅外部光时间事件（供后续自动动画接入）
function useExternalLightT(setT) {
  useEffect(() => {
    function h(e) { setT(e.detail); }
    window.addEventListener("guangbao:lightT", h);
    return () => window.removeEventListener("guangbao:lightT", h);
  }, [setT]);
}

// ────────────────────────────────────────────
// 「抖音笔记」风格的背景层
// 用一张暗色城市夜景剪影 + 些许晚霞余光
// ────────────────────────────────────────────
function NotePhotoBg({ tone = "dusk" }) {
  // tone: dusk(黄昏) / blue(蓝调) / dawn(清晨)
  const presets = {
    dusk: {
      sky: "linear-gradient(180deg, #1a1525 0%, #2a1f2c 30%, #3a2535 55%, #1a1018 100%)",
      glow: "radial-gradient(420px 220px at 78% 38%, rgba(222,107,72,0.32), transparent 70%)",
      glow2: "radial-gradient(360px 200px at 8% 12%, rgba(138,64,104,0.22), transparent 70%)",
    },
    blue: {
      sky: "linear-gradient(180deg, #0d1a2e 0%, #15243f 40%, #1a2540 70%, #0a0f1c 100%)",
      glow: "radial-gradient(420px 220px at 78% 28%, rgba(92,116,154,0.4), transparent 70%)",
      glow2: "radial-gradient(360px 200px at 8% 88%, rgba(58,74,107,0.3), transparent 70%)",
    },
    dawn: {
      sky: "linear-gradient(180deg, #1f1a2a 0%, #322335 40%, #4a2540 70%, #1a1018 100%)",
      glow: "radial-gradient(420px 220px at 22% 22%, rgba(224,160,96,0.32), transparent 70%)",
      glow2: "radial-gradient(360px 200px at 88% 92%, rgba(200,72,88,0.16), transparent 70%)",
    },
  };
  const p = presets[tone] || presets.dusk;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: p.sky }} />
      <div style={{ position: "absolute", inset: 0, background: p.glow, mixBlendMode: "screen" }} />
      <div style={{ position: "absolute", inset: 0, background: p.glow2, mixBlendMode: "screen" }} />
      {/* 城市剪影 */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, opacity: 0.85 }}>
        <CitySilhouette height={220} color="#08080c" />
      </div>
      {/* 颗粒 */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "3px 3px",
        opacity: 0.35,
        pointerEvents: "none",
      }} />
      {/* 顶部 + 底部蒙层 (让 UI 元素更易读) */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 18%, transparent 75%, rgba(0,0,0,0.85) 100%)",
        pointerEvents: "none",
      }} />
    </>
  );
}

// ============================================
// 副屏 1 — 路线 / 光区导航
// ============================================
function minutesFromDistance(distanceText = "步行 16 分钟") {
  const match = String(distanceText).match(/(\d+)/);
  return match ? Number(match[1]) : 16;
}

function minutesFromClock(clock, fallback) {
  const match = String(clock || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClockFromMinutes(totalMinutes) {
  const wrapped = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${Math.floor(wrapped / 60)}:${String(wrapped % 60).padStart(2, "0")}`;
}

function distanceKmFromWalking(distanceText = "步行 16 分钟") {
  const minutes = minutesFromDistance(distanceText);
  const km = Math.max(0.2, Math.round((minutes / 12.5) * 10) / 10);
  return km.toFixed(km >= 10 ? 0 : 1);
}

function SceneRoute({ sunsetPayload }) {
  // t: 光的时间（0=现在 17:00, 1=日落后 18:30）
  // 默认 0.78 = 18:15 峰值
  const [t, setT] = useState(0.78);
  useExternalLightT(setT);
  const recommendation = sunsetPayload?.recommendation || {};
  const spot = recommendation.spot || "苏州河乍浦路桥";
  const direction = recommendation.direction || "西";
  const distanceText = recommendation.distance || "步行 16 分钟";
  const walkMinutes = minutesFromDistance(distanceText);
  const distanceKm = distanceKmFromWalking(distanceText);

  const peak = minutesFromClock(sunsetPayload?.peakTime, 18 * 60 + 15);
  const departClock = formatClockFromMinutes(peak - walkMinutes - 5);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <NotePhotoBg tone="dusk" />

      <div style={{
        position: "absolute", inset: 0, padding: "100px 16px 110px",
        display: "flex", flexDirection: "column", gap: 12, zIndex: 2,
      }}>
        {/* 顶部信息 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1.4, marginBottom: 4 }}>
              ROUTE&nbsp;·&nbsp;LIGHT&nbsp;TRAIL
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
              往{direction}走 <span style={{ color: "#ffd49a" }}>{distanceKm}km</span><br/>
              <span style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>→ {spot}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1 }}>
              建议出发
            </div>
            <div className="num" style={{
              fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500,
              fontSize: 30, color: "var(--accent)", lineHeight: 1, marginTop: 2,
            }}>{departClock}</div>
          </div>
        </div>

        {/* 3D 光影导航模型 */}
        <LightShadowMap3D
          t={t}
          setT={setT}
          sunsetPayload={sunsetPayload}
          spot={spot}
          direction={direction}
          distanceKm={distanceKm}
          departClock={departClock}
        />

        {/* CTA */}
        <button
          onClick={() => window.GuangbaoHooks?.openNavigation({ name: spot })}
          style={{
            padding: "13px 0",
            borderRadius: 14,
            background: "var(--accent)",
            color: "#1a0e08",
            border: "none",
            fontSize: 14, fontWeight: 700,
            fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 4px 12px rgba(255,138,61,0.30)",
          }}>
          打开地图导航 →
        </button>
      </div>
    </div>
  );
}

const SHADOW_BUILDINGS = [
  { x: 30, y: 260, w: 42, d: 26, h: 64, tone: "#2b2234", label: "街角楼" },
  { x: 88, y: 232, w: 54, d: 28, h: 92, tone: "#34263f", label: "商务楼" },
  { x: 158, y: 246, w: 38, d: 22, h: 58, tone: "#2d2638", label: "沿街店" },
  { x: 218, y: 218, w: 48, d: 28, h: 112, tone: "#40304b", label: "高层" },
  { x: 292, y: 238, w: 56, d: 30, h: 76, tone: "#33283d", label: "转角楼" },
  { x: 58, y: 342, w: 62, d: 30, h: 48, tone: "#2a2132", label: "仓库" },
  { x: 150, y: 332, w: 70, d: 30, h: 70, tone: "#3a2c43", label: "河岸楼" },
  { x: 250, y: 350, w: 76, d: 32, h: 54, tone: "#31263b", label: "观景台" },
];

const ROUTE_POINTS = [
  { x: 322, y: 356, label: "你" },
  { x: 286, y: 318 },
  { x: 236, y: 292 },
  { x: 178, y: 258 },
  { x: 128, y: 214 },
  { x: 92, y: 180, label: "机位" },
];

function routePath(points = ROUTE_POINTS) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function shadowPhase(t) {
  if (t < 0.35) return "楼缝开始进光";
  if (t < 0.62) return "江面反光变暖";
  if (t < 0.78) return "西向立面被点亮";
  if (t < 0.90) return "峰值前后最稳";
  return "蓝调接管天空";
}

function buildShadowAnchors(sunsetPayload) {
  return [
    { t: 0.00, label: "现在", time: "现在" },
    { t: 0.34, label: "黄金", time: sunsetPayload?.meta?.goldenHourStart || "17:30" },
    { t: 0.62, label: "日落", time: sunsetPayload?.meta?.sunsetTime || "18:02" },
    { t: 0.78, label: "峰值", time: sunsetPayload?.peakTime || "18:15" },
    { t: 1.00, label: "蓝调", time: "蓝调" },
  ];
}

function clockFromShadowT(t) {
  const total = 17 * 60 + Math.round(t * 90);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function IsoBuilding({ block, shadowDx, shadowDy, shadowOpacity, lightRgb, lit }) {
  const { x, y, w, d, h, tone } = block;
  const side = "rgba(16, 12, 24, 0.88)";
  const top = lit ? `rgba(${lightRgb[0]}, ${lightRgb[1]}, ${lightRgb[2]}, 0.36)` : "rgba(255,255,255,0.08)";
  const frontGlow = lit ? `drop-shadow(0 0 12px rgba(${lightRgb[0]}, ${lightRgb[1]}, ${lightRgb[2]}, 0.25))` : "none";
  return (
    <g>
      <polygon
        points={`${x},${y} ${x + w},${y} ${x + w + shadowDx},${y + shadowDy} ${x + shadowDx},${y + shadowDy}`}
        fill="rgba(0,0,0,0.58)"
        opacity={shadowOpacity}
        style={{ transition: "all .18s ease-out" }}
      />
      <polygon
        points={`${x},${y - h} ${x + w},${y - h} ${x + w},${y} ${x},${y}`}
        fill={tone}
        filter={frontGlow}
      />
      <polygon
        points={`${x + w},${y - h} ${x + w + d},${y - h + d * 0.42} ${x + w + d},${y + d * 0.42} ${x + w},${y}`}
        fill={side}
      />
      <polygon
        points={`${x},${y - h} ${x + d},${y - h + d * 0.42} ${x + w + d},${y - h + d * 0.42} ${x + w},${y - h}`}
        fill={top}
      />
      {[0.26, 0.52, 0.78].map((p, i) => (
        <line
          key={i}
          x1={x + w * p}
          y1={y - h + 10}
          x2={x + w * p}
          y2={y - 8}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
        />
      ))}
    </g>
  );
}

function LightShadowMap3D({ t, setT, sunsetPayload, spot, direction, distanceKm, departClock }) {
  const clamped = Math.max(0, Math.min(1, t));
  const currentColor = typeof getTimelineColorAt === "function"
    ? getTimelineColorAt(sunsetPayload, clamped, clamped)
    : skyColor(clamped);
  const lightRgb = currentColor.map((v) => Math.round(v));
  const lightCss = rgb(lightRgb);
  const sunX = 338 - clamped * 226;
  const sunY = 54 + clamped * 84;
  const shadowDx = (clamped - 0.42) * 98;
  const shadowDy = 24 + clamped * 42;
  const shadowOpacity = 0.18 + clamped * 0.28;
  const lightX = 308 - clamped * 204;
  const lightY = 134 + clamped * 92;
  const path = routePath();
  const anchors = buildShadowAnchors(sunsetPayload);
  const peak = sunsetPayload?.peakTime || "18:15";

  return (
    <div data-light-shadow-map="3d" style={{
      position: "relative",
      height: 402,
      borderRadius: 20,
      overflow: "hidden",
      background: "linear-gradient(180deg, rgba(19,20,34,0.95), rgba(11,9,16,0.98))",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "inset 0 0 70px rgba(0,0,0,0.48), 0 18px 45px rgba(0,0,0,0.34)",
    }}>
      <svg viewBox="0 0 400 430" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <radialGradient id="sunGlow3d" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fff2c9" stopOpacity="1" />
            <stop offset="46%" stopColor={lightCss} stopOpacity="0.72" />
            <stop offset="100%" stopColor={lightCss} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lightPool3d" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={lightCss} stopOpacity="0.68" />
            <stop offset="52%" stopColor={lightCss} stopOpacity="0.26" />
            <stop offset="100%" stopColor={lightCss} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="riverGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(92,116,154,0.16)" />
            <stop offset="55%" stopColor={lightCss} stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgba(20,25,44,0.28)" />
          </linearGradient>
        </defs>

        <rect width="400" height="430" fill="rgba(9,8,15,0.92)" />
        <path d="M 0 76 C 76 108 124 68 204 92 C 278 114 332 86 400 116 L 400 168 C 318 142 270 170 198 144 C 126 118 76 158 0 126 Z"
          fill="url(#riverGlow)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <path d="M 0 312 C 82 292 132 322 204 304 C 286 284 332 312 400 288 L 400 430 L 0 430 Z"
          fill="rgba(16,18,30,0.86)" />

        {[82, 140, 198, 256, 314].map((x, i) => (
          <line key={`v-${i}`} x1={x} y1="154" x2={x - 40} y2="410" stroke="rgba(255,255,255,0.055)" strokeWidth="1.2" />
        ))}
        {[176, 226, 276, 326, 376].map((y, i) => (
          <line key={`h-${i}`} x1="18" y1={y} x2="382" y2={y - 34} stroke="rgba(255,255,255,0.055)" strokeWidth="1.2" />
        ))}

        <ellipse cx={lightX} cy={lightY} rx={132 + clamped * 30} ry={78 + clamped * 18}
          fill="url(#lightPool3d)" style={{ transition: "all .18s ease-out" }} />

        <g opacity="0.88">
          {SHADOW_BUILDINGS.map((block, i) => (
            <IsoBuilding
              key={block.label}
              block={block}
              shadowDx={shadowDx}
              shadowDy={shadowDy}
              shadowOpacity={shadowOpacity}
              lightRgb={lightRgb}
              lit={i === 1 || i === 3 || i === 6 || (clamped > 0.70 && i === 7)}
            />
          ))}
        </g>

        <path d={path} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.2" strokeDasharray="7 7" strokeLinecap="round" />
        <path d={path} fill="none" stroke={lightCss} strokeWidth="7" strokeLinecap="round" opacity="0.18" />

        <g transform={`translate(${ROUTE_POINTS[0].x}, ${ROUTE_POINTS[0].y})`}>
          <circle r="17" fill="#3a8fff" opacity="0.2" />
          <circle r="8" fill="#fff" stroke="#3a8fff" strokeWidth="3" />
          <text x="0" y="31" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">你</text>
        </g>
        <g transform={`translate(${ROUTE_POINTS[ROUTE_POINTS.length - 1].x}, ${ROUTE_POINTS[ROUTE_POINTS.length - 1].y})`}>
          <circle r="26" fill={lightCss} opacity="0.2">
            <animate attributeName="r" values="20;30;20" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle r="11" fill={lightCss} />
          <path d="M 0 -10 L -5 -18 L 5 -18 Z" fill={lightCss} />
          <text x="0" y="-26" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800"
            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.62)", strokeWidth: 4 }}>最佳机位</text>
        </g>

        <circle cx={sunX} cy={sunY} r="58" fill="url(#sunGlow3d)" opacity="0.82" style={{ transition: "all .18s ease-out" }} />
        <circle cx={sunX} cy={sunY} r="13" fill="#fff4cf" opacity="0.95" />
      </svg>

      <div style={{
        position: "absolute", left: 12, top: 12,
        padding: "7px 10px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.42)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}>
        <div className="mono" style={{ fontSize: 9.5, color: "rgba(255,255,255,0.58)", letterSpacing: 1 }}>
          GPS + SUN + BLOCKS
        </div>
        <div style={{ marginTop: 3, fontSize: 12, color: "#fff", fontWeight: 700 }}>
          实时光影预览
        </div>
      </div>

      <div style={{
        position: "absolute", right: 12, top: 12,
        padding: "7px 10px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.42)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.10)",
        textAlign: "right",
      }}>
        <div className="mono" style={{ fontSize: 9.5, color: "rgba(255,255,255,0.58)", letterSpacing: 1 }}>
          ARRIVE&nbsp;BEFORE
        </div>
        <div className="num" style={{ marginTop: 2, fontSize: 22, color: "var(--accent)", fontFamily: "var(--font-display)", fontStyle: "italic" }}>
          {departClock}
        </div>
      </div>

      <div style={{
        position: "absolute", left: 12, right: 12, bottom: 102,
        display: "grid", gridTemplateColumns: "1fr 48px", gap: 8,
        alignItems: "end",
      }}>
        <div style={{
          padding: "7px 10px",
          borderRadius: 14,
          background: "rgba(0,0,0,0.50)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}>
          <div style={{ fontSize: 11.5, color: "#fff", fontWeight: 700, lineHeight: 1.25 }}>
            {spot} · {direction}向楼缝
          </div>
        <div style={{ marginTop: 2, fontSize: 9, color: "rgba(255,255,255,0.68)", lineHeight: 1.3 }}>
            {shadowPhase(clamped)} · {distanceKm}km · 峰值 {peak}
          </div>
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          display: "grid", placeItems: "center",
          color: "#1a0e08", fontWeight: 900,
          background: `linear-gradient(135deg, #fff2c9, ${lightCss})`,
          boxShadow: `0 0 24px rgba(${lightRgb[0]}, ${lightRgb[1]}, ${lightRgb[2]}, 0.35)`,
        }}>
          3D
        </div>
      </div>

      <ShadowTimeScrubber
        t={clamped}
        setT={setT}
        anchors={anchors}
        lightCss={lightCss}
      />
    </div>
  );
}

function ShadowTimeScrubber({ t, setT, anchors, lightCss }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  function handleDrag(clientX) {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setT(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  }

  function onDown(e) {
    dragging.current = true;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    handleDrag(x);
    e.preventDefault?.();
  }

  function onMove(e) {
    if (!dragging.current) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    handleDrag(x);
  }

  function onUp() {
    dragging.current = false;
  }

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

  return (
    <div data-shadow-time-scrubber="true" style={{
      position: "absolute", left: 12, right: 12, bottom: 12,
      padding: "8px 10px 8px",
      borderRadius: 16,
      background: "rgba(6, 5, 10, 0.72)",
      backdropFilter: "blur(18px)",
      border: "1px solid rgba(255,255,255,0.10)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.64)", letterSpacing: 1 }}>
          拖动预览街区光影
        </div>
        <div className="num" style={{ fontSize: 17, color: "#fff", fontFamily: "var(--font-display)", fontStyle: "italic" }}>
          {clockFromShadowT(t)}
        </div>
      </div>
      <div
        ref={trackRef}
        onPointerDown={onDown}
        onTouchStart={onDown}
        style={{
          position: "relative",
          height: 20,
          borderRadius: 999,
          background: "linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.16))",
          cursor: "grab",
          touchAction: "none",
          overflow: "hidden",
        }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${t * 100}%`,
          background: `linear-gradient(90deg, rgba(255,255,255,0.10), ${lightCss})`,
          opacity: 0.85,
        }} />
        {anchors.map((a, i) => (
          <button
            key={a.label}
            onClick={() => setT(a.t)}
            style={{
              position: "absolute",
              left: `${a.t * 100}%`,
              top: 3,
              transform: "translateX(-50%)",
              width: Math.abs(a.t - t) < 0.07 ? 18 : 8,
              height: 14,
              borderRadius: 99,
              border: "1px solid rgba(255,255,255,0.55)",
              background: Math.abs(a.t - t) < 0.07 ? "#fff" : "rgba(255,255,255,0.34)",
              cursor: "pointer",
            }}
            aria-label={a.label}
          />
        ))}
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: 6,
        fontSize: 8.5, color: "rgba(255,255,255,0.56)", fontFamily: "var(--font-mono)",
      }}>
        {anchors.map((a) => (
          <span key={a.label} style={{ color: Math.abs(a.t - t) < 0.07 ? "#fff" : "rgba(255,255,255,0.52)" }}>
            {a.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 副屏 2 — 社区 / 这片光下他们也来过
// ============================================
function SceneCommunity({ sunsetPayload }) {
  const score = sunsetPayload?.score || 87;
  const spot = sunsetPayload?.recommendation?.spot || "苏州河乍浦路桥";
  const [activeVideo, setActiveVideo] = useState(null);
  // 第 2 页信息卡片内，左滑第 3 张卡片的 4 张真实图片
  const notes = [
    {
      skyT: 0.80,
      score: Math.min(99, score + 4),
      date: "昨天",
      author: "静安寺追光",
      note: "静安寺晚霞封面，点开看现场视频",
      imageSrc: "/assets/jingansi/cover.png",
      videoSrc: "/assets/jingansi/video1-h264.mp4?v=20260516-203103",
    },
    {
      skyT: 0.62,
      score: Math.max(55, score - 8),
      date: "10.15",
      author: "西风掠云",
      note: "等了 40 分钟值得",
      imageSrc: "/assets/jingansi/fig6.jpeg",
    },
    {
      skyT: 0.92,
      score: Math.min(96, score + 1),
      date: "10.14",
      author: "晚走的人",
      note: "图2 · 蓝调比想象的久",
      imageSrc: "/assets/jingansi/fig2.jpeg",
    },
    {
      skyT: 0.50,
      score: 62,
      date: "10.13",
      author: "陈小溪",
      note: "图4 · 金光段最舒服",
      imageSrc: "/assets/jingansi/fig4.jpeg",
    },
  ];

  const comments = [
    `${spot} 今天有戏`,
    "下班直接去！",
    "今天天气配得上吗",
    "上次拍崩了 这次冲",
  ];

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <NotePhotoBg tone="blue" />

      <div style={{
        position: "absolute", inset: 0, padding: "100px 16px 110px",
        display: "flex", flexDirection: "column", gap: 12, zIndex: 2,
      }}>
        {/* 顶部 */}
        <div>
          <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1.4, marginBottom: 4 }}>
            COMMUNITY&nbsp;·&nbsp;NEARBY
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
            这片光下，<br/>
            他们也来过
          </div>
        </div>

        {/* 当下追光者计数 */}
        <div style={{
          padding: "11px 14px",
          background: "linear-gradient(135deg, rgba(255,138,61,0.15), rgba(200,72,88,0.12))",
          border: "1px solid rgba(255,138,61,0.28)",
          borderRadius: 14,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 12px var(--accent)",
            animation: "comm-pulse 1.8s ease-in-out infinite",
          }} />
          <div style={{ flex: 1, fontSize: 13, color: "#fff", fontWeight: 500 }}>
            现在还有 <span className="num" style={{
              fontFamily: "var(--font-display)", fontStyle: "italic",
              fontSize: 18, color: "#ffd49a", fontWeight: 600,
            }}>{Math.max(8, Math.round(score / 4))}</span> 位追光者也在这片光里
          </div>
        </div>

        {/* 笔记网格 */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {notes.map((n, i) => (
              <NoteCard
                key={i}
                {...n}
                onOpenVideo={n.videoSrc ? () => setActiveVideo(n.videoSrc) : undefined}
              />
            ))}
          </div>
        </div>

        {/* 漂浮短评 */}
        <div style={{
          padding: "10px 12px",
          background: "rgba(20, 14, 22, 0.55)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5, marginRight: 2 }}>
            💬 评论
          </div>
          {comments.map((c, i) => (
            <div key={i} style={{
              padding: "4px 10px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 99,
              fontSize: 11, color: "rgba(255,255,255,0.85)",
              whiteSpace: "nowrap",
            }}>
              {c}
            </div>
          ))}
        </div>

        {/* 筛选条件 */}
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.45)",
          fontFamily: "var(--font-mono)",
          textAlign: "center",
        }}>
          筛选 · 评分 {Math.max(50, Math.round(score / 10) * 10)}+ · {spot} · {sunsetPayload?.peakTime || "18:15"} 前后
        </div>
      </div>

      <style>{`
        @keyframes comm-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%      { transform: scale(1.5); opacity: 0.5; }
        }
      `}</style>
      {activeVideo && (
        <CommunityVideoPlayer
          src={activeVideo}
          poster="/assets/jingansi/cover.png"
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}

function NoteCard({ skyT, score, date, author, note, imageSrc, videoSrc, onOpenVideo }) {
  const media = (
    <div style={{ position: "relative", aspectRatio: "4/5", overflow: "hidden" }}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={note}
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(180deg,
            ${rgb(skyColor(Math.max(0, skyT - 0.18)))} 0%,
            ${rgb(skyColor(skyT))} 50%,
            ${rgb(skyColor(Math.min(1, skyT + 0.15)))} 100%)`,
        }} />
      )}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.02) 45%, rgba(0,0,0,0.45) 100%)",
        pointerEvents: "none",
      }} />
      {!imageSrc && (
        <>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, opacity: 0.95 }}>
            <CitySilhouette height={50} color="#08080c" />
          </div>
          <div style={{
            position: "absolute",
            left: `${30 + skyT * 30}%`, top: `${40 - skyT * 10}%`,
            width: 22, height: 22, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,240,200,0.9), transparent 70%)",
            filter: "blur(1px)",
          }} />
        </>
      )}
      {videoSrc && (
        <div style={{
          position: "absolute",
          left: 8,
          bottom: 8,
          width: 30,
          height: 30,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "rgba(0,0,0,0.58)",
          border: "1px solid rgba(255,255,255,0.56)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        }}>
          <span style={{
            display: "block",
            width: 0,
            height: 0,
            marginLeft: 3,
            borderTop: "6px solid transparent",
            borderBottom: "6px solid transparent",
            borderLeft: "10px solid #fff",
          }} />
        </div>
      )}
      <div style={{
        position: "absolute", top: 6, right: 6,
        padding: "2px 7px",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        borderRadius: 6,
        fontSize: 10, fontWeight: 700,
        color: score >= 80 ? "#ffd49a" : score >= 60 ? "#fff" : "rgba(255,255,255,0.65)",
        fontFamily: "var(--font-mono)",
      }}>
        {score}<span style={{ fontSize: 8, opacity: 0.6 }}>/100</span>
      </div>
    </div>
  );

  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      background: "#1a1018",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      {videoSrc ? (
        <button
          type="button"
          onClick={onOpenVideo}
          aria-label="播放静安寺视频"
          style={{
            display: "block",
            width: "100%",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            font: "inherit",
            color: "inherit",
            textAlign: "left",
          }}>
          {media}
        </button>
      ) : media}
      <div style={{ padding: "7px 9px 8px" }}>
        <div style={{
          fontSize: 11, color: "#fff", fontWeight: 500, lineHeight: 1.35,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 1,
          WebkitBoxOrient: "vertical",
        }}>{note}</div>
        <div style={{
          marginTop: 3,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 9, color: "rgba(255,255,255,0.5)",
        }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{author}</span>
          <span className="mono">{date}</span>
        </div>
      </div>
    </div>
  );
}

function CommunityVideoPlayer({ src, poster, onClose }) {
  return (
    <div
      data-swipe-lock="true"
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "82px 14px 104px",
      }}>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭视频"
        style={{
          position: "absolute",
          top: 86,
          right: 18,
          zIndex: 2,
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.28)",
          background: "rgba(0,0,0,0.52)",
          color: "#fff",
          fontSize: 24,
          lineHeight: "30px",
          fontFamily: "Arial, sans-serif",
          cursor: "pointer",
        }}>
        ×
      </button>
      <video
        src={src}
        poster={poster}
        controls
        autoPlay
        playsInline
        style={{
          width: "100%",
          maxHeight: "100%",
          borderRadius: 16,
          background: "#000",
          boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
        }}
      />
    </div>
  );
}

// ============================================
// 副屏 3 — 快速拍摄 / 一键发布
// ============================================
function SceneQuickShoot({ sunsetPayload, publishedVideoMode = false }) {
  const [selectedTitle, setSelectedTitle] = useState(0);
  const [recording, setRecording] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const score = sunsetPayload?.score || 87;
  const peak = sunsetPayload?.peakTime || "18:15";
  const duration = sunsetPayload?.peakDuration || 14;
  const spot = sunsetPayload?.recommendation?.spot || "苏州河乍浦路桥";
  const tips = sunsetPayload?.shootingTips?.length ? sunsetPayload.shootingTips : [
    "把河面留在画面下三分之一",
    "等一个人物或车辆剪影经过",
    "锁住天空高光，再微微降低曝光",
  ];

  // 预生成的笔记标题候选
  const titles = [
    "今晚的光",
    `西天烧了 ${duration} 分钟`,
    "刚好赶上",
    `上海·${peak}`,
    `为这片光我跑到${spot}`,
  ];

  function tapShutter() {
    setRecording(true);
    window.GuangbaoHooks?.captureShot(titles[selectedTitle]);
    setTimeout(() => {
      setRecording(false);
      window.dispatchEvent(new CustomEvent("guangbao:publishedVideo", { detail: true }));
    }, 220);
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {publishedVideoMode ? (
        <>
          <PublishedVideoScene
            src="/assets/jingansi/video2.mp4?v=20260516-195311"
            onProgress={setPublishProgress}
          />
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 82, zIndex: 10,
            padding: "0 14px",
          }}>
            <ShootAssistPanel
              titles={titles}
              selectedTitle={selectedTitle}
              setSelectedTitle={setSelectedTitle}
              tips={tips}
              transparent
            />
            <div style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 14,
            }}>
              <PublishProgressButton
                progress={publishProgress}
                onClick={() => window.dispatchEvent(new CustomEvent("guangbao:publishedVideo", { detail: false }))}
              />
            </div>
          </div>
        </>
      ) : (
        <>
      {/* 实时取景器背景 */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: 'url("/assets/jingansi/fig3.jpeg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.02) 42%, rgba(0,0,0,0.52) 100%)",
        pointerEvents: "none",
      }} />

      {/* 取景器 overlay */}
      <ViewfinderOverlay recording={recording} />

      {/* 顶部：当前光线评估 */}
      <div style={{
        position: "absolute", top: 100, left: 16, right: 16, zIndex: 3,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: 1.4, marginBottom: 4 }}>
            VIEWFINDER&nbsp;·&nbsp;LIVE
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            刚好的光
          </div>
        </div>
        <div style={{
          padding: "8px 11px",
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          textAlign: "right",
        }}>
          <div className="mono" style={{ fontSize: 8.5, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>
            CURRENT
          </div>
          <div className="num" style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 28, fontWeight: 500, color: "#ffd49a", lineHeight: 1,
          }}>{score}</div>
        </div>
      </div>

      {/* 右侧：拍摄参数建议 */}
      <div style={{
        position: "absolute", right: 16, top: 200, zIndex: 3,
        display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end",
      }}>
        {[
          ["ISO", score >= 80 ? "200" : "400"],
          ["快门", score >= 80 ? "1/160" : "1/100"],
          ["光圈", "f/4"],
          ["白平衡", score >= 80 ? "5600K" : "5200K"],
        ].map((p, i) => (
          <div key={i} className="mono" style={{
            padding: "3px 8px",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            borderRadius: 6,
            fontSize: 10, color: "rgba(255,255,255,0.9)",
            letterSpacing: 0.5,
          }}>
            <span style={{ opacity: 0.55 }}>{p[0]}</span> · <span style={{ color: "#ffd49a", fontWeight: 600 }}>{p[1]}</span>
          </div>
        ))}
      </div>

      {/* 底部：标题候选 + 快门 */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 80, zIndex: 4,
        padding: "0 14px",
      }}>
        <ShootAssistPanel
          titles={titles}
          selectedTitle={selectedTitle}
          setSelectedTitle={setSelectedTitle}
          tips={tips}
        />

        {/* 快门 + 辅助按钮 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 8px",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "grid", placeItems: "center",
            color: "#fff", fontSize: 18,
            backdropFilter: "blur(10px)",
          }}>▦</div>

          {/* 快门 */}
          <button type="button" aria-label="播放成片视频" onClick={tapShutter} style={{
            width: 76, height: 76, borderRadius: "50%",
            background: "transparent",
            border: "3px solid rgba(255,255,255,0.85)",
            display: "grid", placeItems: "center",
            cursor: "pointer",
            position: "relative",
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: recording ? 12 : "50%",
              background: recording ? "var(--warn)" : "#fff",
              transition: "all 0.25s cubic-bezier(.7,0,.3,1)",
              boxShadow: "0 0 24px rgba(255,255,255,0.4)",
            }} />
            {recording && (
              <div style={{
                position: "absolute", inset: -8, borderRadius: "50%",
                border: "2px solid var(--warn)",
                animation: "shutter-ring 0.6s ease-out",
              }} />
            )}
          </button>

          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "grid", placeItems: "center",
            color: "#fff", fontSize: 18,
            backdropFilter: "blur(10px)",
          }}>⟳</div>
        </div>

        <div style={{
          marginTop: 10, textAlign: "center",
          fontSize: 10.5, color: "rgba(255,255,255,0.55)",
          letterSpacing: 1,
        }}>
          拍完直接发 · 标题已准备好
        </div>
      </div>

      <style>{`
        @keyframes shutter-ring {
          0%   { transform: scale(1);    opacity: 0.9; }
          100% { transform: scale(1.35); opacity: 0;   }
        }
      `}</style>
        </>
      )}
    </div>
  );
}

function PublishedVideoScene({ src, onProgress }) {
  return (
    <div
      data-swipe-lock="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 9,
        background: "#000",
        overflow: "hidden",
      }}>
      <video
        src={src}
        autoPlay
        muted
        playsInline
        controls={false}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          onProgress?.(video.duration ? video.currentTime / video.duration : 0);
        }}
        onTimeUpdate={(e) => {
          const video = e.currentTarget;
          onProgress?.(video.duration ? Math.min(1, video.currentTime / video.duration) : 0);
        }}
        onEnded={() => onProgress?.(1)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          background: "#000",
        }}
      />
      <div style={{
        position: "absolute",
        inset: "92px 0 96px",
        pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(0,0,0,0.28), transparent 18%, transparent 76%, rgba(0,0,0,0.44))",
      }} />
    </div>
  );
}

function PublishProgressButton({ progress = 0, onClick }) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <button
      type="button"
      aria-label="播放成片视频"
      onClick={onClick}
      style={{
        width: 86,
        height: 86,
        borderRadius: "50%",
        border: "none",
        background: "transparent",
        display: "grid",
        placeItems: "center",
        position: "relative",
        padding: 0,
        cursor: "pointer",
      }}>
      <svg
        viewBox="0 0 92 92"
        width="92"
        height="92"
        style={{
          position: "absolute",
          inset: -3,
          transform: "rotate(-90deg)",
          filter: "drop-shadow(0 0 8px rgba(255, 96, 112, 0.22))",
        }}>
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke="rgba(255, 150, 158, 0.22)"
          strokeWidth="4"
        />
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke="rgba(255, 112, 126, 0.72)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.18s linear" }}
        />
      </svg>
      <div style={{
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.94)",
        boxShadow: "0 0 24px rgba(255,255,255,0.34)",
      }} />
    </button>
  );
}

function ShootAssistPanel({ titles, selectedTitle, setSelectedTitle, tips, transparent = false }) {
  const panelStyle = transparent
    ? {
        marginBottom: 8,
        padding: "0 2px",
        background: "transparent",
        border: "none",
        borderRadius: 0,
      }
    : {
        marginBottom: 14,
        padding: "10px 12px",
        background: "rgba(10, 6, 14, 0.6)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
      };

  const tipsStyle = transparent
    ? {
        marginBottom: 0,
        padding: "0 2px",
        background: "transparent",
        border: "none",
        borderRadius: 0,
      }
    : {
        marginBottom: 12,
        padding: "10px 12px",
        background: "rgba(10, 6, 14, 0.48)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
      };

  return (
    <>
      <div style={panelStyle}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8,
          textShadow: transparent ? "0 1px 5px rgba(0,0,0,0.8)" : "none",
        }}>
          <div style={{ fontSize: 10, color: transparent ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.55)", letterSpacing: 1 }}>
            一键标题 · 选一个直接发
          </div>
          <div style={{ fontSize: 9, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
            AI 准备好了 ↻
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {titles.map((tt, i) => (
            <button key={i}
              onClick={() => setSelectedTitle(i)}
              style={{
                flexShrink: 0,
                padding: "8px 12px",
                background: transparent
                  ? (i === selectedTitle ? "var(--accent)" : "transparent")
                  : (i === selectedTitle ? "var(--accent)" : "rgba(255,255,255,0.08)"),
                color: i === selectedTitle ? "#1a0e08" : "#fff",
                border: transparent
                  ? "1px solid " + (i === selectedTitle ? "transparent" : "rgba(255,255,255,0.42)")
                  : "1px solid " + (i === selectedTitle ? "transparent" : "rgba(255,255,255,0.10)"),
                borderRadius: 99,
                fontSize: 12, fontWeight: i === selectedTitle ? 700 : 500,
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                cursor: "pointer",
                textShadow: transparent && i !== selectedTitle ? "0 1px 5px rgba(0,0,0,0.9)" : "none",
              }}>
              {tt}
            </button>
          ))}
        </div>
      </div>

      <div style={tipsStyle}>
        <div style={{
          fontSize: 10,
          color: transparent ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.55)",
          letterSpacing: 1,
          marginBottom: 7,
          textShadow: transparent ? "0 1px 5px rgba(0,0,0,0.85)" : "none",
        }}>
          后端拍摄建议 · B 接口
        </div>
        {tips.slice(0, 3).map((tip, i) => (
          <div key={i} style={{
            display: "flex",
            gap: 8,
            fontSize: 11,
            color: "rgba(255,255,255,0.9)",
            lineHeight: 1.45,
            paddingTop: i ? 5 : 0,
            textShadow: transparent ? "0 1px 5px rgba(0,0,0,0.85)" : "none",
          }}>
            <span className="mono" style={{ color: "#ffd49a" }}>{String(i + 1).padStart(2, "0")}</span>
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// 取景器叠加层
function ViewfinderOverlay({ recording }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      {/* 四角对焦框 */}
      <svg viewBox="0 0 402 874" width="100%" height="100%" preserveAspectRatio="none">
        {/* 网格 (3x3) */}
        {[1, 2].map(i => (
          <line key={"v"+i} x1={i*134} y1="100" x2={i*134} y2="774"
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" strokeDasharray="2 4" />
        ))}
        {[1, 2].map(i => (
          <line key={"h"+i} x1="20" y1={100 + i*225} x2="382" y2={100 + i*225}
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" strokeDasharray="2 4" />
        ))}
        {/* 中央对焦框 */}
        {[
          ["M 170 380 L 170 400 L 190 400", ""],
          ["M 232 400 L 252 400 L 252 380", ""],
          ["M 170 480 L 170 460 L 190 460", ""],
          ["M 232 460 L 252 460 L 252 480", ""],
        ].map((p, i) => (
          <path key={i} d={p[0]} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        ))}
      </svg>

      {/* 录制红框 */}
      {recording && (
        <div style={{
          position: "absolute", inset: 4,
          border: "3px solid var(--warn)",
          borderRadius: 24,
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}

Object.assign(window, {
  SceneRoute, SceneCommunity, SceneQuickShoot, NotePhotoBg,
});
