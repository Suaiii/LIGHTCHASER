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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function routePoint(start, end, t) {
  return {
    lat: lerp(start.lat, end.lat, t),
    lng: lerp(start.lng, end.lng, t),
  };
}

function buildNavigationGeometry(sunsetPayload, fallbackSpot) {
  const user = sunsetPayload?.meta?.coordinates || { lat: 31.2304, lng: 121.4737 };
  const poi = sunsetPayload?.recommendation?.coordinates || { lat: 31.2456, lng: 121.4895 };
  const midA = {
    lat: lerp(user.lat, poi.lat, 0.32) + 0.0022,
    lng: lerp(user.lng, poi.lng, 0.32) - 0.0014,
  };
  const midB = {
    lat: lerp(user.lat, poi.lat, 0.68) - 0.0016,
    lng: lerp(user.lng, poi.lng, 0.68) + 0.0018,
  };
  return {
    user,
    poi: { ...poi, name: fallbackSpot },
    route: [user, midA, midB, poi],
  };
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
        position: "absolute", inset: 0, padding: "92px 12px 92px",
        display: "flex", flexDirection: "column", zIndex: 2,
      }}>
        {/* 地图导航 + 光影叠层 */}
        <LightNavigationMap
          t={t}
          setT={setT}
          sunsetPayload={sunsetPayload}
          spot={spot}
          direction={direction}
          distanceKm={distanceKm}
          departClock={departClock}
        />
      </div>
    </div>
  );
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

function LeafletMapLayer({ geometry }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const routeLayerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || typeof L === "undefined") return;

    const center = routePoint(geometry.user, geometry.poi, 0.55);
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
    }).setView([center.lat, center.lng], 14);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
    }

    const latLngs = geometry.route.map((p) => [p.lat, p.lng]);
    const group = L.layerGroup([
      L.polyline(latLngs, { color: "#22d3ee", weight: 12, opacity: 0.34, lineCap: "round" }),
      L.polyline(latLngs, { color: "#67e8f9", weight: 6, opacity: 0.95, lineCap: "round" }),
      L.circleMarker([geometry.user.lat, geometry.user.lng], {
        radius: 10,
        color: "#fff",
        weight: 3,
        fillColor: "#3b82f6",
        fillOpacity: 1,
      }),
      L.marker([geometry.poi.lat, geometry.poi.lng], {
        icon: L.divIcon({
          className: "light-nav-marker",
          html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#ff4f4f;transform:rotate(-45deg);box-shadow:0 8px 18px rgba(0,0,0,.45);border:3px solid #111"><span style="position:absolute;left:7px;top:7px;width:8px;height:8px;border-radius:50%;background:#111;display:block"></span></div>',
          iconSize: [32, 32],
          iconAnchor: [14, 28],
        }),
      }),
    ]).addTo(map);

    routeLayerRef.current = group;
    map.fitBounds(L.latLngBounds(latLngs), { padding: [58, 42], animate: false });
  }, [geometry.user.lat, geometry.user.lng, geometry.poi.lat, geometry.poi.lng]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />;
}

function StaticMapFallback({ lightCss }) {
  return (
    <svg viewBox="0 0 400 520" width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
      <rect width="400" height="520" fill="#073542" />
      <path d="M -30 320 C 84 284 118 334 212 302 C 296 274 330 316 430 282" fill="none" stroke="#062238" strokeWidth="18" />
      {[54, 118, 182, 248, 312, 366].map((x, i) => (
        <path key={i} d={`M ${x} -40 L ${x - 58} 560`} stroke="rgba(155,190,206,.32)" strokeWidth="3" />
      ))}
      {[68, 142, 218, 294, 372, 444].map((y, i) => (
        <path key={i} d={`M -40 ${y} L 440 ${y - 70}`} stroke="rgba(155,190,206,.26)" strokeWidth="2.4" />
      ))}
      <path d="M 286 408 C 260 352 230 312 202 274 C 166 228 136 190 106 136" fill="none" stroke="#0e7490" strokeWidth="16" strokeLinecap="round" />
      <path d="M 286 408 C 260 352 230 312 202 274 C 166 228 136 190 106 136" fill="none" stroke="#67e8f9" strokeWidth="8" strokeLinecap="round" />
      <circle cx="286" cy="408" r="16" fill="#fff" />
      <circle cx="286" cy="408" r="10" fill="#3b82f6" />
      <path d="M 106 108 C 132 108 146 136 128 154 C 118 164 106 184 106 184 C 106 184 94 164 84 154 C 66 136 80 108 106 108 Z" fill="#ff4f4f" stroke="#111" strokeWidth="4" />
      <circle cx="106" cy="134" r="9" fill="#111" />
      <text x="180" y="252" fill={lightCss} fontSize="16" fontWeight="800">LIGHT WINDOW</text>
    </svg>
  );
}

function NavigationLightOverlay({ t, lightCss, sunAzimuth }) {
  const clamped = Math.max(0, Math.min(1, t));
  const angle = Number.isFinite(sunAzimuth) ? sunAzimuth : 255 + clamped * 18;
  const glowX = 74 + clamped * 176;
  const glowY = 104 + clamped * 188;
  const shadowX = 290 - clamped * 150;
  const shadowY = 108 + clamped * 236;

  return (
    <svg data-light-overlay="true" viewBox="0 0 400 520" width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
      <defs>
        <radialGradient id="walkableLight" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={lightCss} stopOpacity="0.72" />
          <stop offset="52%" stopColor={lightCss} stopOpacity="0.22" />
          <stop offset="100%" stopColor={lightCss} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="backShadow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#030712" stopOpacity="0.64" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="520" fill="rgba(1,8,18,0.22)" />
      <ellipse cx={glowX} cy={glowY} rx={120 + clamped * 34} ry={64 + clamped * 20} fill="url(#walkableLight)" transform={`rotate(${angle - 90} ${glowX} ${glowY})`} />
      <path d={`M ${shadowX} ${shadowY} C ${shadowX - 42} ${shadowY + 42}, ${shadowX - 52} ${shadowY + 116}, ${shadowX - 106} ${shadowY + 170} L 430 540 L 430 80 Z`}
        fill="url(#backShadow)" opacity="0.82" />
      {[0, 1, 2, 3].map((i) => (
        <line key={i}
          x1={48 + i * 66}
          y1={82 + i * 28}
          x2={122 + i * 66}
          y2={172 + i * 28}
          stroke={lightCss}
          strokeWidth="3"
          strokeLinecap="round"
          opacity={0.28 + clamped * 0.24}
          transform={`rotate(${angle - 245} ${120 + i * 44} ${150 + i * 26})`}
        />
      ))}
    </svg>
  );
}

function LightNavigationMap({ t, setT, sunsetPayload, spot, direction, distanceKm, departClock }) {
  const clamped = Math.max(0, Math.min(1, t));
  const currentColor = typeof getTimelineColorAt === "function"
    ? getTimelineColorAt(sunsetPayload, clamped, clamped)
    : skyColor(clamped);
  const lightRgb = currentColor.map((v) => Math.round(v));
  const lightCss = rgb(lightRgb);
  const anchors = buildShadowAnchors(sunsetPayload);
  const peak = sunsetPayload?.peakTime || "18:15";
  const geometry = buildNavigationGeometry(sunsetPayload, spot);
  const sunAzimuth = sunsetPayload?.meta?.sun?.peak?.azimuthDeg;
  const etaMinutes = minutesFromDistance(sunsetPayload?.recommendation?.distance);
  const lightAccuracy = Math.round(68 + clamped * 22);

  return (
    <div data-light-shadow-map="navigation" style={{
      position: "relative",
      flex: 1,
      minHeight: 0,
      borderRadius: 20,
      overflow: "hidden",
      background: "#052b36",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "inset 0 0 70px rgba(0,0,0,0.34), 0 18px 45px rgba(0,0,0,0.34)",
    }}>
      {typeof L === "undefined" ? <StaticMapFallback lightCss={lightCss} /> : <LeafletMapLayer geometry={geometry} />}
      <NavigationLightOverlay t={clamped} lightCss={lightCss} sunAzimuth={sunAzimuth} />

      <div style={{
        position: "absolute", left: 16, right: 16, top: 16, zIndex: 4,
        padding: "13px 14px",
        borderRadius: 18,
        background: "rgba(25, 27, 36, 0.90)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 16px 42px rgba(0,0,0,0.26)",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 10, alignItems: "center" }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "3px solid #93c5fd", boxShadow: "0 0 0 3px rgba(59,130,246,.18)" }} />
          <div style={{ color: "#b9c7ff", fontSize: 15, fontWeight: 700 }}>Your location</div>
          <div style={{ color: "rgba(255,255,255,.72)", fontSize: 24, letterSpacing: 2 }}>···</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 10, alignItems: "center", marginTop: 13 }}>
          <div style={{ display: "grid", placeItems: "center", color: "#fda4af", fontSize: 20 }}>⌖</div>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{spot}</div>
          <div style={{ color: "rgba(255,255,255,.78)", fontSize: 22 }}>↕</div>
        </div>
      </div>

      <div style={{
        position: "absolute", right: 16, top: 170, zIndex: 4,
        width: 48, height: 48, borderRadius: "50%",
        display: "grid", placeItems: "center",
        background: "rgba(28, 30, 38, 0.88)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 12px 26px rgba(0,0,0,0.35)",
        color: "#fff", fontSize: 24,
      }}>
        ◈
      </div>

      <div style={{
        position: "absolute", left: 16, top: 274, zIndex: 4,
        padding: "7px 10px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.42)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}>
        <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,.58)", letterSpacing: 1 }}>SUN {Math.round(sunAzimuth || 0)}° · {lightAccuracy}%</div>
        <div style={{ marginTop: 3, fontSize: 12, color: "#fff", fontWeight: 800 }}>光照可见区叠层</div>
      </div>

      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 5,
        padding: "16px 16px 18px",
        borderRadius: "24px 24px 0 0",
        background: "rgba(12, 13, 18, 0.94)",
        borderTop: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 -18px 42px rgba(0,0,0,0.36)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 25, fontWeight: 800, letterSpacing: -0.5 }}>{etaMinutes} min · {distanceKm} km</div>
            <div style={{ marginTop: 3, color: "rgba(255,255,255,.62)", fontSize: 11 }}>建议 {departClock} 出发 · 峰值 {peak}</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {["☷", "⇧", "×"].map((icon) => (
              <div key={icon} style={{ width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(255,255,255,0.10)", color: "#fff", fontSize: 20 }}>{icon}</div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          <button onClick={() => window.GuangbaoHooks?.openNavigation({ name: spot })} style={navActionButton("#67e8f9", "#05202a")}>▲ Start</button>
          <button style={navActionButton("#07565c", "#d7ffff")}>☼ 光照</button>
          <button style={navActionButton("#073f46", "#d7ffff")}>▱ Save</button>
        </div>
        <ShadowTimeScrubber t={clamped} setT={setT} anchors={anchors} lightCss={lightCss} />
      </div>
    </div>
  );
}

function navActionButton(bg, color) {
  return {
    height: 42,
    borderRadius: 999,
    border: "none",
    background: bg,
    color,
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
  };
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
      padding: "8px 10px 8px",
      borderRadius: 16,
      background: "rgba(255, 255, 255, 0.07)",
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
  // 昨天的笔记 — 6 张
  const notes = [
    { skyT: 0.80, score: Math.min(99, score + 4), date: "昨天",   author: "城南旧光", note: `${spot} 刚到峰值就开始烧了` },
    { skyT: 0.62, score: Math.max(55, score - 8), date: "10.15", author: "西风掠云", note: "等了 40 分钟值得" },
    { skyT: 0.92, score: Math.min(96, score + 1), date: "10.14", author: "晚走的人", note: "蓝调比想象的久" },
    { skyT: 0.50, score: 62, date: "10.13", author: "陈小溪",  note: "金光段最舒服" },
    { skyT: 0.78, score: 88, date: "10.11", author: "夜灯",    note: "拍人也好看" },
    { skyT: 0.45, score: 55, date: "10.10", author: "k_walks", note: "云不够厚" },
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
              <NoteCard key={i} {...n} />
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
    </div>
  );
}

function NoteCard({ skyT, score, date, author, note }) {
  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      background: "#1a1018",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ position: "relative", aspectRatio: "4/5" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(180deg,
            ${rgb(skyColor(Math.max(0, skyT - 0.18)))} 0%,
            ${rgb(skyColor(skyT))} 50%,
            ${rgb(skyColor(Math.min(1, skyT + 0.15)))} 100%)`,
        }} />
        {/* 小天际线 */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, opacity: 0.95 }}>
          <CitySilhouette height={50} color="#08080c" />
        </div>
        {/* 评分胶囊 */}
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
        {/* 太阳 */}
        <div style={{
          position: "absolute",
          left: `${30 + skyT * 30}%`, top: `${40 - skyT * 10}%`,
          width: 22, height: 22, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,240,200,0.9), transparent 70%)",
          filter: "blur(1px)",
        }} />
      </div>
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

// ============================================
// 副屏 3 — 快速拍摄 / 一键发布
// ============================================
function SceneQuickShoot({ sunsetPayload }) {
  const [selectedTitle, setSelectedTitle] = useState(0);
  const [recording, setRecording] = useState(false);
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
    setTimeout(() => setRecording(false), 600);
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* 模拟实时取景器：用一个真实感更强的晚霞渐变 */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(180deg,
            ${rgb(skyColor(0.30))} 0%,
            ${rgb(skyColor(0.55))} 35%,
            ${rgb(skyColor(0.72))} 60%,
            ${rgb(skyColor(0.85))} 78%,
            #1a0d18 100%)
        `,
      }} />
      {/* 落日 */}
      <div style={{
        position: "absolute", left: "58%", top: "44%", transform: "translate(-50%, -50%)",
        width: 130, height: 130, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,245,220,1) 0%, rgba(255,210,150,0.7) 35%, rgba(255,170,110,0) 75%)",
        filter: "blur(2px)",
      }} />
      {/* 天际线 */}
      <div style={{ position: "absolute", bottom: 250, left: 0, right: 0 }}>
        <CitySilhouette height={220} color="#0d0a0f" />
      </div>

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
        {/* 标题芯片 */}
        <div style={{
          marginBottom: 14,
          padding: "10px 12px",
          background: "rgba(10, 6, 14, 0.6)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8,
          }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1 }}>
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
                  background: i === selectedTitle ? "var(--accent)" : "rgba(255,255,255,0.08)",
                  color: i === selectedTitle ? "#1a0e08" : "#fff",
                  border: "1px solid " + (i === selectedTitle ? "transparent" : "rgba(255,255,255,0.10)"),
                  borderRadius: 99,
                  fontSize: 12, fontWeight: i === selectedTitle ? 700 : 500,
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}>
                {tt}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          marginBottom: 12,
          padding: "10px 12px",
          background: "rgba(10, 6, 14, 0.48)",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginBottom: 7 }}>
            后端拍摄建议 · B 接口
          </div>
          {tips.slice(0, 3).map((tip, i) => (
            <div key={i} style={{
              display: "flex",
              gap: 8,
              fontSize: 11,
              color: "rgba(255,255,255,0.86)",
              lineHeight: 1.45,
              paddingTop: i ? 5 : 0,
            }}>
              <span className="mono" style={{ color: "#ffd49a" }}>{String(i + 1).padStart(2, "0")}</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>

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
          <button onClick={tapShutter} style={{
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
    </div>
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
