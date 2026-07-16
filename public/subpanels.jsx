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
      const keyword = encodeURIComponent(`${name || "附近开阔水岸"} 上海`);
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
  const poi = sunsetPayload?.recommendation?.coordinates || { lat: 30.7109005, lng: 121.3455949 };
  return {
    user,
    poi: { ...poi, name: fallbackSpot },
    route: [user, poi],
  };
}

function SceneRoute({ sunsetPayload, routeData, routeLoading = false, selectedSpotName, onSelectSpot }) {
  const recommendation = sunsetPayload?.recommendation || {};
  const spot = recommendation.spot || "附近开阔水岸";
  const direction = recommendation.direction || "西";
  const distanceText = recommendation.distance || "步行 16 分钟";
  const walkMinutes = minutesFromDistance(distanceText);
  const distanceKm = routeData?.distanceMeters
    ? (routeData.distanceMeters / 1000).toFixed(routeData.distanceMeters >= 10000 ? 0 : 1)
    : distanceKmFromWalking(distanceText);

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
          sunsetPayload={sunsetPayload}
          routeData={routeData}
          routeLoading={routeLoading}
          spot={spot}
          direction={direction}
          distanceKm={distanceKm}
          departClock={departClock}
          selectedSpotName={selectedSpotName}
          onSelectSpot={onSelectSpot}
        />
      </div>
    </div>
  );
}

function LeafletMapLayer({ geometry, routeData, nearbySpots = [], selectedSpotName }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const routeLayerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || typeof L === "undefined") return;

    const center = routePoint(geometry.user, geometry.poi, 0.55);
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      touchZoom: true,
      tap: false,
      keyboard: false,
      minZoom: 13,
      maxZoom: 17,
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

    const routePoints = routeData?.geometry?.length >= 2 ? routeData.geometry : geometry.route;
    const latLngs = routePoints.map((p) => [p.lat, p.lng]);
    const layers = [
      L.polyline(latLngs, { color: "#7a3618", weight: 12, opacity: 0.36, lineCap: "round" }),
      L.polyline(latLngs, { color: "#ff8a3d", weight: 6, opacity: 0.96, lineCap: "round" }),
      L.circleMarker([geometry.user.lat, geometry.user.lng], {
        radius: 10,
        color: "#fff",
        weight: 3,
        fillColor: "#ffb26f",
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
    ];

    nearbySpots.slice(0, 4).forEach((spot) => {
      const lat = spot.coordinates?.lat;
      const lng = spot.coordinates?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") return;
      const active = spot.name === selectedSpotName || (!selectedSpotName && spot.name === geometry.poi.name);
      if (active) return;
      layers.push(
        L.circleMarker([lat, lng], {
          radius: 7,
          color: "#ffd49a",
          weight: 2,
          fillColor: "#ff8a3d",
          fillOpacity: 0.74,
        }).bindTooltip(spot.name, {
          permanent: false,
          direction: "top",
          opacity: 0.9,
        })
      );
    });

    const group = L.layerGroup(layers).addTo(map);

    routeLayerRef.current = group;
    map.fitBounds(L.latLngBounds(latLngs), { padding: [74, 48], animate: true, duration: 0.35, maxZoom: 16 });
  }, [
    geometry.user.lat,
    geometry.user.lng,
    geometry.poi.lat,
    geometry.poi.lng,
    routeData?.source,
    routeData?.geometry?.length,
    nearbySpots.length,
    selectedSpotName,
  ]);

  return (
    <div
      ref={containerRef}
      data-swipe-lock="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        filter: "brightness(1.55) contrast(0.92) saturate(0.9)",
      }}
    />
  );
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
      <path d="M 286 408 C 260 352 230 312 202 274 C 166 228 136 190 106 136" fill="none" stroke="#7a3618" strokeWidth="16" strokeLinecap="round" />
      <path d="M 286 408 C 260 352 230 312 202 274 C 166 228 136 190 106 136" fill="none" stroke="#ff8a3d" strokeWidth="8" strokeLinecap="round" />
      <circle cx="286" cy="408" r="16" fill="#fff" />
      <circle cx="286" cy="408" r="10" fill="#ffb26f" />
      <path d="M 106 108 C 132 108 146 136 128 154 C 118 164 106 184 106 184 C 106 184 94 164 84 154 C 66 136 80 108 106 108 Z" fill="#ff4f4f" stroke="#111" strokeWidth="4" />
      <circle cx="106" cy="134" r="9" fill="#111" />
      <text x="180" y="252" fill={lightCss} fontSize="16" fontWeight="800">LIGHT WINDOW</text>
    </svg>
  );
}

function LightNavigationMap({ sunsetPayload, routeData, routeLoading, spot, direction, distanceKm, departClock, selectedSpotName, onSelectSpot }) {
  const peak = sunsetPayload?.peakTime || "18:15";
  const geometry = buildNavigationGeometry(sunsetPayload, spot);
  const sunAzimuth = sunsetPayload?.meta?.sun?.peak?.azimuthDeg;
  const etaMinutes = routeData?.durationSeconds
    ? Math.max(1, Math.round(routeData.durationSeconds / 60))
    : minutesFromDistance(sunsetPayload?.recommendation?.distance);
  const routeSourceLabel = routeLoading
    ? "路线计算中"
    : routeData?.source === "osrm-foot"
      ? "真实步行路线"
      : "估算路线";
  const nearbySpots = [
    {
      name: sunsetPayload?.recommendation?.spot,
      coordinates: sunsetPayload?.recommendation?.coordinates,
      direction: sunsetPayload?.recommendation?.direction,
      distance: sunsetPayload?.recommendation?.distance,
      reason: sunsetPayload?.recommendation?.reason,
    },
    ...(sunsetPayload?.nearbySpots || []),
  ].filter((item, index, list) =>
    item?.name &&
    item?.coordinates &&
    list.findIndex((candidate) => candidate?.name === item.name) === index
  );

  return (
    <div
      data-light-shadow-map="navigation"
      data-route-source={routeData?.source || "pending"}
      data-route-points={routeData?.geometry?.length || 0}
      data-selected-spot={selectedSpotName || spot}
      style={{
      position: "relative",
      flex: 1,
      minHeight: 0,
      borderRadius: 20,
      overflow: "hidden",
      background: "#16202a",
      border: "1px solid rgba(255,138,61,0.26)",
      boxShadow: "inset 0 0 42px rgba(255,138,61,0.08), 0 18px 45px rgba(0,0,0,0.34)",
    }}>
      {typeof L === "undefined" ? <StaticMapFallback lightCss="#ff8a3d" /> : <LeafletMapLayer geometry={geometry} routeData={routeData} nearbySpots={nearbySpots} selectedSpotName={selectedSpotName || spot} />}

      <div className="float-pop" style={{
        position: "absolute", left: 16, right: 16, top: 16, zIndex: 4,
        padding: "13px 14px",
        borderRadius: 18,
        background: "rgba(25, 27, 36, 0.90)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,138,61,0.16)",
        boxShadow: "0 16px 42px rgba(0,0,0,0.26)",
        "--float-delay": "70ms",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 10, alignItems: "center" }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "3px solid #ffb26f", boxShadow: "0 0 0 3px rgba(255,138,61,.18)" }} />
          <div style={{ color: "#ffd0aa", fontSize: 15, fontWeight: 700 }}>Your location</div>
          <div style={{ color: "rgba(255,255,255,.72)", fontSize: 24, letterSpacing: 2 }}>···</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 10, alignItems: "center", marginTop: 13 }}>
          <div style={{ display: "grid", placeItems: "center", color: "#fda4af", fontSize: 20 }}>⌖</div>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{spot}</div>
          <div style={{ color: "rgba(255,255,255,.78)", fontSize: 22 }}>↕</div>
        </div>
      </div>

      <div className="float-pop" style={{
        position: "absolute", right: 16, top: 170, zIndex: 4,
        width: 48, height: 48, borderRadius: "50%",
        display: "grid", placeItems: "center",
        background: "rgba(28, 30, 38, 0.88)",
        border: "1px solid rgba(255,138,61,0.22)",
        boxShadow: "0 12px 26px rgba(0,0,0,0.35)",
        color: "#fff", fontSize: 24,
        "--float-delay": "130ms",
      }}>
        ＋
      </div>

      <div className="float-pop" style={{
        position: "absolute", left: 16, top: 274, zIndex: 4,
        padding: "7px 10px",
        borderRadius: 12,
        background: "rgba(36, 22, 14, 0.62)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,138,61,0.20)",
        "--float-delay": "190ms",
      }}>
        <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,.58)", letterSpacing: 1 }}>SUN {Math.round(sunAzimuth || 0)}° · {routeSourceLabel}</div>
        <div style={{ marginTop: 3, fontSize: 12, color: "#fff", fontWeight: 800 }}>双指缩放 · 可切换 {nearbySpots.length || 1} 个目的地</div>
      </div>

      <div className="float-pop" style={{
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 5,
        padding: "16px 16px 18px",
        borderRadius: "24px 24px 0 0",
        background: "rgba(18, 15, 15, 0.93)",
        borderTop: "1px solid rgba(255,138,61,0.18)",
        boxShadow: "0 -18px 42px rgba(0,0,0,0.36)",
        "--float-delay": "250ms",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 25, fontWeight: 800, letterSpacing: -0.5 }}>{etaMinutes} min · {distanceKm} km</div>
            <div style={{ marginTop: 3, color: "rgba(255,255,255,.62)", fontSize: 11 }}>建议 {departClock} 出发 · 峰值 {peak}</div>
          </div>
          <button data-route-go-button="true" onClick={() => window.GuangbaoHooks?.openNavigation({ name: spot })} style={{
            height: 46,
            padding: "0 22px",
            borderRadius: 999,
            border: "none",
            background: "#ff8a3d",
            color: "#1a0e08",
            fontSize: 15,
            fontWeight: 900,
            fontFamily: "inherit",
            boxShadow: "0 12px 30px rgba(255,138,61,0.28)",
          }}>➤ 前往</button>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          paddingTop: 2,
        }}>
          {nearbySpots.slice(0, 3).map((item, index) => {
            const active = item.name === (selectedSpotName || spot);
            return (
            <button key={item.name} type="button" data-swipe-lock="true" onClick={() => onSelectSpot?.(item.name)} className="float-pop" style={{
              padding: "8px 9px",
              borderRadius: 13,
              background: active ? "rgba(255,138,61,0.22)" : "rgba(255,255,255,0.07)",
              border: active ? "1px solid rgba(255,178,111,0.56)" : "1px solid rgba(255,138,61,0.12)",
              minWidth: 0,
              textAlign: "left",
              fontFamily: "inherit",
              cursor: "pointer",
              boxShadow: active ? "0 8px 20px rgba(255,138,61,0.16)" : "none",
              "--float-delay": `${330 + index * 70}ms`,
            }}>
              <div style={{ fontSize: 10, color: active ? "#ffb26f" : "rgba(255,255,255,0.62)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {active ? "当前路线" : `备选 ${index + 1}`}
              </div>
              <div style={{ marginTop: 3, fontSize: 11, color: "#fff", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.name}
              </div>
            </button>
          );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// 副屏 2 — 社区 / 这片光下他们也来过
// ============================================
function SceneCommunity({ sunsetPayload }) {
  const score = sunsetPayload?.score || 87;
  const spot = sunsetPayload?.recommendation?.spot || "附近开阔水岸";
  const [activeVideo, setActiveVideo] = useState(null);
  const notes = [
    {
      skyT: 0.80,
      score: Math.min(99, score + 4),
      date: "昨天",
      author: "静安寺追光",
      note: "静安寺晚霞封面，点开看现场视频",
      imageSrc: "/assets/jingansi/cover.png",
      videoSrc: "/assets/jingansi/video1-h264.mp4",
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
        <div className="float-pop" style={{ "--float-delay": "70ms" }}>
          <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1.4, marginBottom: 4 }}>
            COMMUNITY&nbsp;·&nbsp;NEARBY
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
            这片光下，<br/>
            他们也来过
          </div>
        </div>

        <div className="float-pop" style={{
          padding: "11px 14px",
          background: "linear-gradient(135deg, rgba(255,138,61,0.15), rgba(200,72,88,0.12))",
          border: "1px solid rgba(255,138,61,0.28)",
          borderRadius: 14,
          display: "flex", alignItems: "center", gap: 10,
          "--float-delay": "150ms",
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

        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {notes.map((n, i) => (
              <NoteCard
                key={i}
                {...n}
                index={i}
                onOpenVideo={n.videoSrc ? () => setActiveVideo(n.videoSrc) : undefined}
              />
            ))}
          </div>
        </div>

        <div className="float-pop" style={{
          padding: "10px 12px",
          background: "rgba(20, 14, 22, 0.55)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          "--float-delay": "430ms",
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

function NoteCard({ skyT, score, date, author, note, imageSrc, videoSrc, onOpenVideo, index = 0 }) {
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
    <div className="float-pop" style={{
      borderRadius: 12, overflow: "hidden",
      background: "#1a1018",
      border: "1px solid rgba(255,255,255,0.06)",
      "--float-delay": `${230 + index * 55}ms`,
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
const CAMERA_DEFAULT_FILTERS = ["dusk_warm", "film_fade", "teal_orange"];
const CAMERA_COMPOSE_LABELS = {
  thirds: "三分构图",
  leading: "引导线",
  silhouette: "剪影留天",
  frame: "框景构图",
};

function buildGuidedCameraContext(sunsetPayload) {
  const recommendation = sunsetPayload?.recommendation || {};
  return {
    scene: recommendation.scene || "sunset",
    composeTemplate: recommendation.compose_template || "thirds",
    filters: recommendation.filters?.length ? recommendation.filters : CAMERA_DEFAULT_FILTERS,
    spot: recommendation.spot || "当前机位",
    direction: recommendation.direction || "建议朝向",
    score: sunsetPayload?.score ?? 0,
    peakTime: sunsetPayload?.peakTime || "待更新",
    bearing: recommendation.bearing || null,
    sunAzimuth: sunsetPayload?.meta?.sun?.current?.azimuthDeg || null,
    tips: sunsetPayload?.shootingTips || [],
  };
}

function ratioNumber(ratioName) {
  if (ratioName === "1:1") return 1;
  if (ratioName === "16:9") return 16 / 9;
  if (ratioName === "4:3") return 4 / 3;
  return 3 / 4;
}

function centerCropForRatio(frame, ratioName) {
  const target = ratioNumber(ratioName);
  const sourceRatio = frame.width / frame.height;
  if (sourceRatio > target) {
    const width = Math.round(frame.height * target);
    return { x: Math.round((frame.width - width) / 2), y: 0, width, height: frame.height };
  }
  const height = Math.round(frame.width / target);
  return { x: 0, y: Math.round((frame.height - height) / 2), width: frame.width, height };
}

function CameraLineIcon({ kind }) {
  if (kind === "switch") {
    return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 7h9l-2.5-2.5M17 17H8l2.5 2.5"/><path d="M18 8.5a7 7 0 0 1 .3 6M6 15.5a7 7 0 0 1-.3-6"/></svg>;
  }
  if (kind === "camera") {
    return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>;
  }
  if (kind === "film") {
    return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5v14M16 5v14M4 9h4M16 9h4M4 15h4M16 15h4"/></svg>;
  }
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/></svg>;
}

function CameraCompositionGuide({ snapshot }) {
  if (!snapshot?.aiComposition) return null;
  const template = snapshot.composeTemplate || "thirds";
  const decision = snapshot.decision;
  const crop = snapshot.sampleCount >= 3 && decision?.output?.applyComposition ? decision.cropBox : null;
  const frame = snapshot?.frame;
  const cropStyle = crop && frame?.width && frame?.height ? {
    left: `${Math.max(0, crop.x / frame.width * 100)}%`,
    top: `${Math.max(0, crop.y / frame.height * 100)}%`,
    width: `${Math.min(100, crop.width / frame.width * 100)}%`,
    height: `${Math.min(100, crop.height / frame.height * 100)}%`,
  } : null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
      <svg viewBox="0 0 402 874" width="100%" height="100%" preserveAspectRatio="none">
        {template === "thirds" && <>
          <path d="M134 96V778M268 96V778M16 323H386M16 551H386" stroke="rgba(255,255,255,.24)" strokeWidth=".7" strokeDasharray="3 5"/>
        </>}
        {template === "leading" && <>
          <path d="M22 760L201 430L380 760M38 742L201 474L364 742" stroke="rgba(255,255,255,.28)" strokeWidth="1" fill="none"/>
        </>}
        {template === "silhouette" && <>
          <path d="M16 588H386" stroke="rgba(255,255,255,.32)" strokeWidth="1" strokeDasharray="4 5"/>
          <path d="M16 96H386V588H16z" fill="rgba(255,138,61,.035)"/>
        </>}
        {template === "frame" && <>
          <path d="M62 176h48M62 176v48M340 176h-48M340 176v48M62 690h48M62 690v-48M340 690h-48M340 690v-48" stroke="rgba(255,255,255,.55)" strokeWidth="2" fill="none"/>
        </>}
      </svg>
      {cropStyle && <div style={{
        position: "absolute", ...cropStyle,
        border: "1px solid var(--accent)",
        boxShadow: "0 0 24px rgba(255,138,61,.18), inset 0 0 0 999px rgba(255,138,61,.025)",
        transition: "all 350ms cubic-bezier(.2,.7,.2,1)",
      }}>
        <span className="mono" style={{
          position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)",
          padding: "4px 8px", borderRadius: 999, whiteSpace: "nowrap",
          background: "rgba(10,10,13,.72)", color: "var(--accent)", fontSize: 9,
        }}>AI 建议 · {decision.effectiveAspectRatio}</span>
      </div>}
    </div>
  );
}

function FullFilterDrawer({ open, session, snapshot, onSnapshot, onClose }) {
  if (!open || !session) return null;
  const groups = session.getFilterGroups();
  const chooseAI = () => {
    session.selectFilter(null);
    onSnapshot(session.configure({ aiFilter: true }));
  };
  const chooseNative = () => {
    session.selectFilter(null);
    onSnapshot(session.configure({ aiFilter: false }));
  };
  const chooseFilter = (key) => {
    session.configure({ aiFilter: false });
    onSnapshot(session.selectFilter(key));
  };
  const utilityCard = (label, active, onClick, note) => (
    <button type="button" onClick={onClick} style={{
      minHeight: 70, borderRadius: 12, padding: "10px 8px", textAlign: "left",
      background: active ? "rgba(255,138,61,.14)" : "rgba(255,255,255,.055)",
      border: active ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,.1)",
      color: "#fff",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 10, color: "rgba(255,255,255,.5)" }}>{note}</div>
    </button>
  );
  return (
    <div data-swipe-lock="true" style={{
      position: "absolute", inset: 0, zIndex: 30,
      background: "rgba(10,10,13,.3)", backdropFilter: "blur(2px)",
    }} onClick={onClose}>
      <section onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: "64%",
        borderRadius: "27px 27px 0 0", overflow: "hidden",
        background: "rgba(10,10,13,.96)",
        borderTop: "1px solid rgba(255,255,255,.1)",
        boxShadow: "0 0 48px rgba(255,138,61,.08)",
        animation: "camera-sheet-in 350ms cubic-bezier(.2,.7,.2,1)",
      }}>
        <header style={{
          height: 62, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,.08)",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>胶片风格 · 23</div>
            <div style={{ marginTop: 3, fontSize: 10, color: "rgba(255,255,255,.5)" }}>全量展示 · 按品牌分组</div>
          </div>
          <button type="button" aria-label="关闭滤镜抽屉" onClick={onClose} style={{
            width: 44, height: 44, borderRadius: 999, background: "rgba(255,255,255,.07)",
            border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontSize: 22,
          }}>×</button>
        </header>
        <div style={{ height: "calc(100% - 62px)", overflowY: "auto", padding: "16px 16px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 16 }}>
            {utilityCard("AI 推荐", snapshot.aiFilter && !snapshot.selectedFilterKey, chooseAI, snapshot.spotFilterKeys?.length ? "场景与光线判断 · 机位预设兜底" : "按场景与光线自动判断")}
            {utilityCard("原生", !snapshot.aiFilter && !snapshot.selectedFilterKey, chooseNative, "关闭滤镜，保留原始色彩")}
          </div>
          {groups.map((group) => (
            <section key={group.brand} style={{ marginBottom: 20 }}>
              <div className="mono" style={{ marginBottom: 8, fontSize: 10, color: "rgba(255,255,255,.55)", letterSpacing: 1.2 }}>{group.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
                {group.filters.map((filter) => {
                  const active = snapshot.activeFilterKey === filter.key;
                  return (
                    <button key={filter.key} type="button" onClick={() => chooseFilter(filter.key)} aria-pressed={active} style={{
                      minWidth: 0, padding: 0, overflow: "hidden", borderRadius: 12,
                      background: "rgba(255,255,255,.055)",
                      border: active ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,.09)",
                      boxShadow: active ? "0 0 18px rgba(255,138,61,.2)" : "none",
                      color: "#fff", textAlign: "left",
                    }}>
                      <img src={filter.demoPath || "/assets/jingansi/fig3.jpeg"} alt="" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }} />
                      <div style={{ padding: "8px", fontSize: 10, lineHeight: 1.2, color: active ? "var(--accent)" : "rgba(255,255,255,.78)" }}>{filter.label}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function CameraReview({ photo, titles, selectedTitle, setSelectedTitle, tips, spot, onClose, onPublish }) {
  if (!photo) return null;
  return (
    <div data-swipe-lock="true" style={{ position: "absolute", inset: 0, zIndex: 24, background: "#0a0a0d", display: "grid", gridTemplateRows: "minmax(0,1fr) auto" }}>
      <div style={{ position: "relative", minHeight: 0, background: "#0a0a0d", padding: "20px 16px 8px", display: "grid", placeItems: "center" }}>
        <img src={photo.dataUrl} alt="拍摄成片" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }} />
        <button type="button" aria-label="返回取景" onClick={onClose} style={{
          position: "absolute", top: 30, left: 16, width: 44, height: 44, borderRadius: 999,
          background: "rgba(10,10,13,.56)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", fontSize: 22,
        }}>‹</button>
      </div>
      <section style={{
        padding: "16px 16px 24px", borderRadius: "27px 27px 0 0",
        background: "rgba(10,10,13,.98)", borderTop: "1px solid rgba(255,255,255,.08)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{titles[selectedTitle]}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,.55)" }}>{spot} · {photo.filterLabel || "原生"} · {photo.aspectRatio}</div>
          </div>
          <span className="mono" style={{ padding: "5px 8px", borderRadius: 999, background: "rgba(255,138,61,.12)", color: "var(--accent)", fontSize: 9 }}>AI 已整理</span>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 12, paddingBottom: 2 }}>
          {titles.map((title, index) => (
            <button key={title} type="button" onClick={() => setSelectedTitle(index)} style={{
              flex: "0 0 auto", minHeight: 44, padding: "0 12px", borderRadius: 999,
              background: selectedTitle === index ? "var(--accent)" : "rgba(255,255,255,.06)",
              border: "1px solid " + (selectedTitle === index ? "var(--accent)" : "rgba(255,255,255,.1)"),
              color: selectedTitle === index ? "#1a0e08" : "rgba(255,255,255,.8)", fontSize: 11,
            }}>{title}</button>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.55, color: "rgba(255,255,255,.62)" }}>{tips[0]}</div>
        <div style={{ marginTop: 8, display: "flex", gap: 6, fontSize: 10, color: "var(--accent)" }}><span>#追光</span><span>#晚霞预警</span><span>#刚好的光</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 10, marginTop: 14 }}>
          <a href={photo.dataUrl} download={`lightchaser-${Date.now()}.jpg`} style={{
            minHeight: 46, borderRadius: 12, display: "grid", placeItems: "center", textDecoration: "none",
            background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontSize: 13, fontWeight: 600,
          }}>保存成片</a>
          <button type="button" onClick={onPublish} style={{
            minHeight: 46, borderRadius: 12, background: "var(--accent)", border: 0, color: "#1a0e08", fontSize: 13, fontWeight: 800,
            boxShadow: "0 0 24px rgba(255,138,61,.22)",
          }}>带话题发布</button>
        </div>
      </section>
    </div>
  );
}

function CameraIntroPreview({ active, onFinished }) {
  const [phase, setPhase] = useState("idle");
  const videoRef = useRef(null);
  const dismissedRef = useRef(false);
  const fallbackTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);

  function clearFallbackTimer() {
    if (!fallbackTimerRef.current) return;
    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }

  function dismissIntro(immediate = false) {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    clearFallbackTimer();
    if (immediate) {
      videoRef.current?.pause();
      setPhase("hidden");
      onFinished?.();
      return;
    }
    setPhase("dismissing");
    fadeTimerRef.current = window.setTimeout(() => {
      videoRef.current?.pause();
      setPhase("hidden");
      onFinished?.();
    }, 440);
  }

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      dismissedRef.current = true;
      setPhase("hidden");
      onFinished?.();
      return;
    }
    setPhase("visible");
  }, [active]);

  useEffect(() => {
    if (phase !== "visible") return undefined;
    const video = videoRef.current;
    fallbackTimerRef.current = window.setTimeout(dismissIntro, 9000);
    const playback = video?.play();
    playback?.catch(() => dismissIntro());
    return () => {
      clearFallbackTimer();
      video?.pause();
    };
  }, [phase]);

  useEffect(() => {
    if (!active && (phase === "visible" || phase === "dismissing")) dismissIntro(true);
  }, [active]);

  useEffect(() => () => {
    dismissedRef.current = true;
    clearFallbackTimer();
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    videoRef.current?.pause();
  }, []);

  if (phase === "idle" || phase === "hidden") return null;

  return (
    <section data-camera-intro="true" data-swipe-lock="true" aria-label="AI 相机效果预览" style={{
      position: "absolute", inset: 0, zIndex: 40, overflow: "hidden",
      display: "grid", placeItems: "center", background: "#050403",
      opacity: phase === "dismissing" ? 0 : 1,
      pointerEvents: phase === "dismissing" ? "none" : "auto",
      transition: "opacity 420ms ease",
    }}>
      <video ref={videoRef} autoPlay muted playsInline preload="auto" onEnded={() => dismissIntro()} onError={() => dismissIntro()} style={{
        display: "block", width: "100%", height: "100%", objectFit: "contain", background: "#050403",
      }}>
        <source src="/assets/ai-camera-intro.webm" type="video/webm" />
        <source src="/assets/ai-camera-intro.mp4" type="video/mp4" />
      </video>
      <button type="button" onClick={() => dismissIntro()} aria-label="跳过启动动画" title="跳过" style={{
        position: "absolute", top: "max(16px, env(safe-area-inset-top))", right: "max(16px, env(safe-area-inset-right))",
        width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center",
        border: "1px solid rgba(255,255,255,.28)", background: "rgba(5,4,3,.72)",
        color: "rgba(255,255,255,.86)", backdropFilter: "blur(16px)", fontSize: 24, lineHeight: 1,
      }}>×</button>
    </section>
  );
}

function SceneQuickShoot({ sunsetPayload, publishedVideoMode = false, active = true }) {
  const context = buildGuidedCameraContext(sunsetPayload);
  const sessionFactory = window.LightchaserCameraSession;
  const sessionRef = useRef(null);
  if (!sessionRef.current && sessionFactory?.createCameraSession) {
    sessionRef.current = sessionFactory.createCameraSession({
      core: window.LightchaserAICameraCore,
      mode: "guided",
      context,
    });
  }
  const session = sessionRef.current;
  const [snapshot, setSnapshot] = useState(() => session?.snapshot() || { aiComposition: true, aiFilter: true, composeTemplate: "thirds", previewCss: "none" });
  const [cameraState, setCameraState] = useState("off");
  const [facingMode, setFacingMode] = useState("environment");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastPhoto, setLastPhoto] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState(0);
  const [publishProgress, setPublishProgress] = useState(0);
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const streamRef = useRef(null);

  const duration = sunsetPayload?.peakDuration || 0;
  const tips = context.tips.length ? context.tips : [
    "把水面或街沿留在画面下三分之一",
    "等人物或车辆进入画面再按快门",
    "锁住天空高光，再微微降低曝光",
  ];
  const titles = ["今晚的光", duration ? `西天烧了 ${duration} 分钟` : "等光落到刚好的位置", "刚好赶上", `${context.peakTime} · ${context.spot}`, `为这片光我跑到${context.spot}`];

  useEffect(() => {
    if (!session) return;
    setSnapshot(session.configure({ context }));
  }, [context.spot, context.score, context.peakTime, context.composeTemplate, context.filters.join("|")]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (active) return;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState("off");
    setDrawerOpen(false);
    setReviewOpen(false);
  }, [active]);

  useEffect(() => {
    if (!session || !active || publishedVideoMode || reviewOpen) return undefined;
    let cancelled = false;
    let timer = null;
    const vision = window.LightchaserVision;
    async function sense(source, frame) {
      if (!source || cancelled) return;
      try {
        const ready = vision ? await vision.init() : false;
        const sample = ready ? await vision.detect(source, frame) : null;
        if (!cancelled) setSnapshot(session.pushSample(sample, frame));
      } catch (error) {
        if (!cancelled) setSnapshot(session.pushSample(null, frame));
      }
    }
    if (cameraState === "on" && videoRef.current) {
      const tick = () => {
        const video = videoRef.current;
        if (video?.readyState >= 2) sense(video, { width: video.videoWidth, height: video.videoHeight });
      };
      tick();
      timer = setInterval(tick, 2800);
    } else if (imageRef.current?.complete) {
      const image = imageRef.current;
      sense(image, { width: image.naturalWidth || 1200, height: image.naturalHeight || 1600 });
    }
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [active, cameraState, publishedVideoMode, reviewOpen]);

  async function openCamera(nextFacingMode) {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState("denied"); return; }
    setCameraState("starting");
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setFacingMode(nextFacingMode);
      setCameraState("on");
    } catch (error) {
      console.info("[LIGHTCHASER] camera unavailable:", error.name);
      setCameraState("denied");
    }
  }

  async function toggleCamera() {
    const nextFacingMode = cameraState === "on"
      ? (facingMode === "environment" ? "user" : "environment")
      : facingMode;
    await openCamera(nextFacingMode);
  }

  async function capturePhoto() {
    if (!session || captureBusy) return;
    const source = cameraState === "on" ? videoRef.current : imageRef.current;
    const width = source?.videoWidth || source?.naturalWidth;
    const height = source?.videoHeight || source?.naturalHeight;
    if (!source || !width || !height) return;
    setCaptureBusy(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    try {
      const plan = session.getCapturePlan({ width, height });
      const crop = plan.applyComposition && plan.cropBox
        ? plan.cropBox
        : centerCropForRatio({ width, height }, plan.effectiveAspectRatio);
      let canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(crop.width));
      canvas.height = Math.max(1, Math.round(crop.height));
      canvas.getContext("2d").drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      if (plan.filterKey && window.LightchaserFilterLayers?.createRenderer) {
        const result = await window.LightchaserFilterLayers.createRenderer().render({
          sourceCanvas: canvas,
          filterKey: plan.filterKey,
          preset: plan.preset,
          sceneContext: { spot: context.spot, aspectRatio: plan.effectiveAspectRatio },
        });
        canvas = result?.finalCanvas || canvas;
      }
      setLastPhoto({
        dataUrl: canvas.toDataURL("image/jpeg", .94),
        width: canvas.width,
        height: canvas.height,
        filterLabel: plan.preset?.label || null,
        aspectRatio: plan.effectiveAspectRatio,
        decision: plan.decision,
      });
      setReviewOpen(true);
      window.GuangbaoHooks?.captureShot(titles[selectedTitle]);
    } catch (error) {
      console.warn("[LIGHTCHASER] capture failed", error);
    } finally {
      setCaptureBusy(false);
    }
  }

  function toggleComposition() {
    if (!session) return;
    setSnapshot(session.configure({ aiComposition: !snapshot.aiComposition }));
  }

  const hasVision = snapshot.sampleCount > 0 && snapshot.decision?.decisionReason !== "low_scene_confidence";
  const lightDirection = context.sunAzimuth != null ? `朝${context.direction} · 太阳 ${Math.round(context.sunAzimuth)}°` : `朝${context.direction}`;
  const guideText = context.score < 45
    ? "今晚不值得跑 · 收藏机位，明晚拍"
    : hasVision
      ? `AI ${snapshot.decision?.sceneLabel || "场景"} ${Math.round((snapshot.decision?.sceneConfidence || 0) * 100)}% · ${snapshot.decision?.compositionGuideText || CAMERA_COMPOSE_LABELS[snapshot.composeTemplate]}`
      : `构图引擎 · ${CAMERA_COMPOSE_LABELS[snapshot.composeTemplate] || "保持当前画幅"} · ${lightDirection}`;

  if (publishedVideoMode) {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0a0a0d" }}>
        {lastPhoto ? (
          <img src={lastPhoto.dataUrl} alt="已发布成片" onLoad={() => setPublishProgress(1)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#0a0a0d" }} />
        ) : (
          <PublishedVideoScene src="/assets/jingansi/video2.mp4" onProgress={setPublishProgress} />
        )}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 28, zIndex: 12, textAlign: "center" }}>
          <div style={{ marginBottom: 12, fontSize: 12, color: "rgba(255,255,255,.82)" }}>已带上 #追光 · {context.spot}</div>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("guangbao:publishedVideo", { detail: false }))} style={{
            minWidth: 160, minHeight: 46, borderRadius: 999, border: 0, background: "var(--accent)", color: "#1a0e08", fontWeight: 800,
          }}>返回拍摄 · {Math.round(publishProgress * 100)}%</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0a0a0d" }}>
      <img ref={imageRef} src="/assets/jingansi/fig3.jpeg" alt="静态取景预览" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        display: cameraState === "on" ? "none" : "block", filter: snapshot.previewCss || "none",
        transition: "filter 150ms cubic-bezier(.3,.7,.4,1)",
      }} />
      <video ref={videoRef} autoPlay muted playsInline style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        display: cameraState === "on" ? "block" : "none", filter: snapshot.previewCss || "none",
        transition: "filter 150ms cubic-bezier(.3,.7,.4,1)",
      }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(180deg,rgba(10,10,13,.32),transparent 24%,transparent 68%,rgba(10,10,13,.62))" }} />
      <CameraCompositionGuide snapshot={snapshot} />

      <div style={{ position: "absolute", top: 86, left: 16, right: 16, zIndex: 5, pointerEvents: "none" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 32, padding: "0 12px", borderRadius: 999,
          background: "rgba(10,10,13,.58)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.1)",
          boxShadow: "0 0 24px rgba(255,138,61,.12)", color: "#fff", fontSize: 11.5, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)", boxShadow: "0 0 12px rgba(255,138,61,.5)" }} />
          追光 {context.score} · 峰值 {context.peakTime}
        </div>
        <div style={{ marginTop: 8, display: "table", maxWidth: 300, padding: "7px 10px", borderRadius: 12,
          background: "rgba(10,10,13,.52)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.08)",
          color: "rgba(255,255,255,.82)", fontSize: 10.5, lineHeight: 1.35 }}>{guideText}</div>
      </div>

      <div data-swipe-lock="true" style={{ position: "absolute", right: 16, top: 192, zIndex: 6, display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" onClick={toggleComposition} aria-pressed={snapshot.aiComposition} style={{
          width: 54, minHeight: 48, borderRadius: 12, padding: "5px 3px", display: "grid", placeItems: "center", gap: 2,
          background: snapshot.aiComposition ? "var(--accent)" : "rgba(10,10,13,.58)",
          border: snapshot.aiComposition ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,.1)",
          color: snapshot.aiComposition ? "#1a0e08" : "rgba(255,255,255,.82)", backdropFilter: "blur(14px)", fontSize: 9.5, fontWeight: 700,
        }}><CameraLineIcon kind="compose"/><span>AI构图</span></button>
        <button type="button" onClick={() => setDrawerOpen(true)} aria-label="打开全量滤镜" style={{
          width: 54, minHeight: 48, borderRadius: 12, padding: "5px 3px", display: "grid", placeItems: "center", gap: 2,
          background: snapshot.activeFilterKey ? "rgba(255,138,61,.16)" : "rgba(10,10,13,.58)",
          border: snapshot.activeFilterKey ? "1px solid rgba(255,138,61,.5)" : "1px solid rgba(255,255,255,.1)",
          color: snapshot.activeFilterKey ? "var(--accent)" : "rgba(255,255,255,.82)", backdropFilter: "blur(14px)", fontSize: 9.5, fontWeight: 700,
        }}><CameraLineIcon kind="film"/><span>滤镜</span></button>
      </div>

      <div data-swipe-lock="true" style={{ position: "absolute", left: 24, right: 24, bottom: 32, zIndex: 7, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button type="button" onClick={() => lastPhoto ? setReviewOpen(true) : setDrawerOpen(true)} aria-label="最近成片" style={{
          width: 48, height: 48, borderRadius: 12, padding: 0, overflow: "hidden", display: "grid", placeItems: "center",
          background: "rgba(10,10,13,.58)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", backdropFilter: "blur(14px)",
        }}>{lastPhoto ? <img src={lastPhoto.dataUrl} alt="最近成片" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <CameraLineIcon kind="film"/>}</button>

        <button type="button" onClick={capturePhoto} aria-label="拍照" disabled={captureBusy} style={{
          width: 82, height: 82, borderRadius: "50%", padding: 6, background: "rgba(10,10,13,.18)",
          border: "3px solid rgba(255,255,255,.9)", display: "grid", placeItems: "center", opacity: captureBusy ? .55 : 1,
          boxShadow: "0 0 28px rgba(255,255,255,.18)",
        }}><span style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.96)", display: "block" }} /></button>

        <button type="button" onClick={toggleCamera} aria-label={cameraState === "on" ? "切换前后摄像头" : "开启实况相机"} style={{
          width: 48, height: 48, borderRadius: 999, display: "grid", placeItems: "center",
          background: cameraState === "on" ? "rgba(255,138,61,.18)" : "rgba(10,10,13,.58)",
          border: cameraState === "on" ? "1px solid rgba(255,138,61,.55)" : "1px solid rgba(255,255,255,.12)",
          color: cameraState === "on" ? "var(--accent)" : "#fff", backdropFilter: "blur(14px)",
        }}>{cameraState === "starting" ? <span className="mono">…</span> : <CameraLineIcon kind={cameraState === "on" ? "switch" : "camera"}/>}</button>
      </div>

      {(cameraState === "denied" || cameraState === "starting") && <div style={{ position: "absolute", left: 0, right: 0, bottom: 124, zIndex: 7, textAlign: "center", pointerEvents: "none",
        fontSize: 10, color: cameraState === "denied" ? "var(--accent)" : "rgba(255,255,255,.6)" }}>
        {cameraState === "denied" ? "相机权限不可用 · 已切换静态预览" : "正在启动相机"}
      </div>}

      {flash && <div style={{ position: "absolute", inset: 0, zIndex: 18, background: "rgba(255,255,255,.84)", pointerEvents: "none", animation: "camera-flash 150ms ease-out forwards" }} />}
      {captureBusy && <div className="mono" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 19,
        padding: "9px 12px", borderRadius: 999, background: "rgba(10,10,13,.72)", color: "#fff", fontSize: 10 }}>正在整理成片</div>}

      <FullFilterDrawer open={drawerOpen} session={session} snapshot={snapshot} onSnapshot={setSnapshot} onClose={() => setDrawerOpen(false)} />
      <CameraReview photo={reviewOpen ? lastPhoto : null} titles={titles} selectedTitle={selectedTitle} setSelectedTitle={setSelectedTitle} tips={tips} spot={context.spot}
        onClose={() => setReviewOpen(false)} onPublish={() => window.dispatchEvent(new CustomEvent("guangbao:publishedVideo", { detail: true }))} />
      <style>{`
        @keyframes camera-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes camera-flash { from { opacity: 1; } to { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          [data-screen-label*="拍摄"] * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
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
      <div className="float-pop" style={{ ...panelStyle, "--float-delay": transparent ? "180ms" : "260ms" }}>
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
              className="float-pop"
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
                "--float-delay": `${320 + i * 45}ms`,
              }}>
              {tt}
            </button>
          ))}
        </div>
      </div>

      <div className="float-pop" style={{ ...tipsStyle, "--float-delay": transparent ? "280ms" : "360ms" }}>
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
          <div key={i} className="float-pop" style={{
            display: "flex",
            gap: 8,
            fontSize: 11,
            color: "rgba(255,255,255,0.9)",
            lineHeight: 1.45,
            paddingTop: i ? 5 : 0,
            textShadow: transparent ? "0 1px 5px rgba(0,0,0,0.85)" : "none",
            "--float-delay": `${430 + i * 55}ms`,
          }}>
            <span className="mono" style={{ color: "#ffd49a" }}>{String(i + 1).padStart(2, "0")}</span>
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ViewfinderOverlay({ recording }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      <svg viewBox="0 0 402 874" width="100%" height="100%" preserveAspectRatio="none">
        {[1, 2].map(i => (
          <line key={"v"+i} x1={i*134} y1="100" x2={i*134} y2="774"
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" strokeDasharray="2 4" />
        ))}
        {[1, 2].map(i => (
          <line key={"h"+i} x1="20" y1={100 + i*225} x2="382" y2={100 + i*225}
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" strokeDasharray="2 4" />
        ))}
        {[
          ["M 170 380 L 170 400 L 190 400", ""],
          ["M 232 400 L 252 400 L 252 380", ""],
          ["M 170 480 L 170 460 L 190 460", ""],
          ["M 232 460 L 252 460 L 252 480", ""],
        ].map((p, i) => (
          <path key={i} d={p[0]} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        ))}
      </svg>

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
