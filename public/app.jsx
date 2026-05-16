// app.jsx — 抖音风 2D feed
// 主轴：上下滑（视频之间）· 次轴：左右滑（晚霞卡片内的子页）

const { useState, useEffect, useRef } = React;

// ─────────────────────────────────────────
// 2D swipe feed
//  feed = [ row, row, ... ], row = [ pageRender, ... ]
//  index = { row, col }
//   - 在多列 row 上左右滑切 col
//   - 跨 row 上下滑切 row（同时回到该 row 的 col=0）
// ─────────────────────────────────────────
function SwipeFeed({ feed, index, setIndex }) {
  const ref = useRef(null);
  const drag = useRef({ on: false, x0: 0, y0: 0, dx: 0, dy: 0, locked: null });
  const [off, setOff] = useState({ x: 0, y: 0 });

  const W = 402;
  const H = 874;

  function onDown(e) {
    const p = e.touches ? e.touches[0] : e;
    drag.current = { on: true, x0: p.clientX, y0: p.clientY, dx: 0, dy: 0, locked: null };
  }
  function onMove(e) {
    const d = drag.current;
    if (!d.on) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - d.x0;
    const dy = p.clientY - d.y0;
    if (d.locked == null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        d.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      } else {
        return;
      }
    }
    const colsInRow = feed[index.row].length;
    if (d.locked === "x") {
      // 只允许有多列时才左右滑动
      if (colsInRow > 1) {
        d.dx = dx;
        setOff({ x: dx, y: 0 });
        if (e.cancelable) e.preventDefault();
      }
    } else {
      d.dy = dy;
      setOff({ x: 0, y: dy });
      if (e.cancelable) e.preventDefault();
    }
  }
  function onUp() {
    const d = drag.current;
    if (!d.on) return;
    const th = 70;
    let { row, col } = index;
    if (d.locked === "x") {
      const colsInRow = feed[row].length;
      if (d.dx < -th && col < colsInRow - 1) col++;
      else if (d.dx > th && col > 0) col--;
    } else if (d.locked === "y") {
      if (d.dy < -th && row < feed.length - 1) { row++; col = 0; }
      else if (d.dy > th && row > 0) { row--; col = 0; }
    }
    if (row !== index.row || col !== index.col) {
      setIndex({ row, col });
    }
    d.on = false; d.locked = null; d.dx = 0; d.dy = 0;
    setOff({ x: 0, y: 0 });
  }

  useEffect(() => {
    const el = ref.current;
    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onUp);
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onUp);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  return (
    <div ref={ref} style={{
      position: "absolute", inset: 0, overflow: "hidden",
      userSelect: "none", cursor: "grab",
    }}>
      {feed.map((row, r) => (
        <div key={r} style={{
          position: "absolute", top: 0, left: 0,
          width: W * row.length, height: H,
          display: "flex",
          transform: `translate3d(${-index.col * W + (r === index.row ? off.x : 0)}px, ${(r - index.row) * H + off.y}px, 0)`,
          transition: drag.current.on ? "none" : "transform 0.5s cubic-bezier(.2,.85,.2,1)",
        }}>
          {row.map((Page, c) => (
            <div key={c} style={{ position: "relative", width: W, height: H, flexShrink: 0 }}>
              <Page />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// 缩放容器：把 402x874 设备缩放到 viewport
// ─────────────────────────────────────────
function DeviceScaler({ width, height, children }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function calc() {
      const padding = 40;
      const sx = (window.innerWidth - padding) / width;
      const sy = (window.innerHeight - padding) / height;
      setScale(Math.min(1, sx, sy));
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [width, height]);
  return (
    <div style={{ width: width * scale, height: height * scale, position: "relative" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width, height }}>
        {children}
      </div>
    </div>
  );
}

// 额外视频场景：早晨 / 金光
function SceneMorningVlog() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <VideoBackdrop src="/assets/videos/d91d7d3f2b78bfbc6e784bfa6038df15.mp4">
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%),
          linear-gradient(180deg, #f4c98a 0%, #d97a4a 45%, #4a2540 80%, #14172a 100%)
        `,
      }} />
      </VideoBackdrop>
      <div style={{
        position: "absolute", left: "30%", top: "38%",
        width: 100, height: 100, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,245,220,1) 0%, rgba(255,200,140,0.5) 45%, transparent 75%)",
        filter: "blur(2px)",
      }} />
      <div style={{ position: "absolute", bottom: 120, left: 0, right: 0, opacity: 0.92 }}>
        <CitySilhouette height={280} color="#180a18" />
      </div>
      <div style={{ position: "absolute", top: 100, left: 16, fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-mono)" }}>
        抖音号：morning_chase · 上海·苏州河
      </div>
      <div style={{ position: "absolute", left: 0, right: 80, bottom: 100, padding: "0 18px" }}>
        <div style={{ marginBottom: 10 }}>
          <AIPill text="清晨金光 · #追光晨拍" />
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 4 }}>@晨拍小队</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          5:42 起床赢的人 <span style={{ color: "#ffd49a" }}>#苏州河</span> <span style={{ color: "#ffd49a" }}>#日出</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 主 App
// ─────────────────────────────────────────
const DEFAULTS = /*EDITMODE-BEGIN*/{
  "scenario": "live",
  "accentColor": "#ff8a3d",
  "showChrome": true,
  "palette": "refined"
}/*EDITMODE-END*/;

const DEMO_SCENARIOS = ["high", "mid", "low"];

const FALLBACK_SUNSET_PAYLOAD = {
  score: 87,
  scoreLabel: "值得跑出门",
  peakTime: "18:15",
  peakDuration: 14,
  currentSkyColor: "#C84858",
  timelineColors: ["#3A4A6B", "#53607B", "#7A6A61", "#A87557", "#C98557", "#E0A060", "#D96C5B", "#B54F60", "#7A436B", "#5A3870"],
  recommendation: {
    direction: "西南",
    spot: "金山城市沙滩",
    distance: "步行 16 分钟",
    coordinates: {
      lat: 30.7109005,
      lng: 121.3455949,
    },
    reason: "海面足够开阔，低云被晚霞染色时会在水面上拉出很长的反光带",
  },
  shootingTips: [
    "站到岸线或栏杆边，把水面留在画面下三分之一",
    "等一艘船、骑车的人或行人经过，让剪影压住天空",
    "先锁住水面反光，再把镜头微微抬到树线或建筑边缘",
  ],
  meta: {
    source: "frontend-fallback",
    city: "Shanghai",
    coordinates: {
      lat: 30.7109005,
      lng: 121.3455949,
    },
    goldenHourStart: "17:30",
    sunsetTime: "18:02",
    sun: {
      current: { altitudeDeg: 8.4, azimuthDeg: 270.2 },
      peak: { altitudeDeg: 2.6, azimuthDeg: 279.6 },
    },
  },
};

function getPositionOnce(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation_unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 4500,
      maximumAge: 5 * 60 * 1000,
      ...options,
    });
  });
}

function getScenarioFallback(scenario) {
  if (scenario === "mid") {
    return { ...FALLBACK_SUNSET_PAYLOAD, score: 52, scoreLabel: "可以顺路看看", peakDuration: 10 };
  }
  if (scenario === "low") {
    return { ...FALLBACK_SUNSET_PAYLOAD, score: 25, scoreLabel: "今天歇着", peakDuration: 6 };
  }
  return FALLBACK_SUNSET_PAYLOAD;
}

function useSunsetData(scenario) {
  const lastGpsRef = useRef(null);
  const [state, setState] = useState({
    payload: FALLBACK_SUNSET_PAYLOAD,
    loading: true,
    error: null,
    mode: "live",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const isDemo = DEMO_SCENARIOS.includes(scenario);
      const mode = isDemo ? `demo-${scenario}` : "live";
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        mode,
        payload: prev.payload || getScenarioFallback(scenario),
      }));

      try {
        let gps = lastGpsRef.current;

        try {
          const position = await getPositionOnce({ timeout: isDemo ? 3000 : 4500 });
          gps = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          lastGpsRef.current = gps;
        } catch (geoError) {
          console.info("[LIGHTCHASER] GPS unavailable, using Shanghai/default route.", geoError.message);
        }

        const params = new URLSearchParams();
        if (isDemo) {
          params.set("demo", scenario);
        }
        if (gps) {
          params.set("lat", gps.latitude);
          params.set("lng", gps.longitude);
        } else if (!isDemo) {
          params.set("city", "shanghai");
        }

        const endpoint = `/api/sunset?${params.toString()}`;
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`sunset_api_${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setState({
            payload,
            loading: false,
            error: null,
            mode: isDemo ? `demo-${scenario}${gps ? "-gps" : ""}` : (gps ? "gps" : "shanghai"),
          });
        }
      } catch (error) {
        console.warn("[LIGHTCHASER] Sunset API failed, using local fallback.", error);
        if (!cancelled) {
          setState({
            payload: getScenarioFallback(scenario),
            loading: false,
            error,
            mode: "fallback",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  return state;
}

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);
  const [index, setIndex] = useState({ row: 1, col: 0 }); // 默认停在晚霞卡片
  const [, force] = useState(0);
  const {
    payload: sunsetPayload,
    loading: sunsetLoading,
    error: sunsetError,
    mode: sunsetMode,
  } = useSunsetData(t.scenario);

  // accent color
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accentColor);
  }, [t.accentColor]);

  // 色卡切换 — refined / dramatic
  useEffect(() => {
    setPalette(t.palette);
    force(x => x + 1);  // 重渲染所有用到 skyColor 的组件
  }, [t.palette]);

  const score = sunsetPayload?.score ?? (t.scenario === "high" ? 87 : t.scenario === "mid" ? 52 : 25);
  const peak = sunsetPayload?.peakTime || "18:15";

  // 2D feed 结构
  // 接口：window.GuangbaoHooks.swipeVideoNext() / swipeVideoPrev() 可外部切视频
  const feed = [
    // Row 0: 普通视频
    [() => <SceneVlog score={score} sunsetPayload={sunsetPayload} />],
    // Row 1: 追·光卡片（4 子页）— 封面 → 路线 → 社区 → 拍摄
    [
      () => <SceneSunsetCard score={score} peak={peak} sunsetPayload={sunsetPayload} loading={sunsetLoading} mode={sunsetMode} />,
      () => <SceneRoute sunsetPayload={sunsetPayload} />,
      () => <SceneCommunity sunsetPayload={sunsetPayload} />,
      () => <SceneQuickShoot sunsetPayload={sunsetPayload} />,
    ],
    // Row 2: 蓝调时刻视频
    [() => <SceneNextVideo />],
    // Row 3: 清晨金光
    [() => <SceneMorningVlog />],
  ];

  const rowLabels = ["视频 · 街景", "追·光卡片", "视频 · 蓝调外滩", "视频 · 苏州河"];
  const colLabels = ["封面", "路线·光区", "社区", "拍摄"];

  // 外部钩子：上下滑视频
  useEffect(() => {
    function h(e) {
      if (e.detail === "next" && index.row < feed.length - 1) setIndex({ row: index.row + 1, col: 0 });
      else if (e.detail === "prev" && index.row > 0) setIndex({ row: index.row - 1, col: 0 });
    }
    window.addEventListener("guangbao:swipeVideo", h);
    return () => window.removeEventListener("guangbao:swipeVideo", h);
  }, [index.row, feed.length]);

  const cur = feed[index.row];
  const inSunset = index.row === 1;
  const screenLabel = inSunset
    ? `0${index.row+1}.${index.col+1} ${rowLabels[index.row]} · ${colLabels[index.col]}`
    : `0${index.row+1} ${rowLabels[index.row]}`;

  // 当前是否在视频条目（决定是否显示动作栏）
  const showActionRail = index.row !== 1;

  return (
    <>
      <DeviceScaler width={402} height={874}>
        <IOSDevice width={402} height={874} dark={true}>
          <div data-screen-label={screenLabel} style={{
            position: "relative", width: "100%", height: "100%",
            background: "#0a0a0d", overflow: "hidden",
          }}>
            <SwipeFeed feed={feed} index={index} setIndex={setIndex} />

            {/* Top tabs */}
            {t.showChrome && (
              <div style={{ position: "absolute", top: 50, left: 0, right: 0, zIndex: 10 }}>
                <TopTabs active={inSunset ? "追·光" : "推荐"} />
              </div>
            )}

            {/* 右侧动作栏（只在视频条目） */}
            {t.showChrome && showActionRail && (
              <ActionRail
                likes={index.row === 0 ? "24.1w" : index.row === 2 ? "11.8w" : "8.6w"}
                comments={index.row === 0 ? 3812 : index.row === 2 ? 1803 : 920}
                shares={index.row === 0 ? "1.8w" : index.row === 2 ? "2.4w" : "0.6w"}
                saves={index.row === 0 ? "6.4w" : index.row === 2 ? "1.2w" : "1.0w"}
                avatar="/assets/uploads/avatar-duck.jpg"
              />
            )}

            {/* 底部导航 */}
            {t.showChrome && <BottomNav />}

            {/* 行 / 列指示器 */}
            <FeedIndicators feed={feed} index={index} />

            {/* 上下滑动 hint — 仅在 sunset 卡片封面显示，且仅前 6 秒 */}
            {inSunset && index.col === 0 && <ScrollHint />}
          </div>
        </IOSDevice>
      </DeviceScaler>

      <TweaksPanel title="Tweaks">
        <TweakSection label="晚霞场景">
          <TweakSelect
            label="评分场景"
            value={t.scenario}
            onChange={(v) => setTweak("scenario", v)}
            options={[
              { value: "live", label: "实时 · GPS/上海" },
              { value: "high", label: "高分 87 · 值得跑出门" },
              { value: "mid",  label: "中分 52 · 一般" },
              { value: "low",  label: "低分 25 · 今天歇着" },
            ]}
          />
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, marginTop: 6 }}>
            数据：{sunsetLoading ? "加载中" : sunsetMode}
            {sunsetError ? " · 已使用本地兜底" : ""}
          </div>
        </TweakSection>

        <TweakSection label="色卡 (Palette)">
          <TweakRadio
            label="色彩方案"
            value={t.palette}
            onChange={(v) => setTweak("palette", v)}
            options={[
              { value: "refined",  label: "精修 8 锚点" },
              { value: "dramatic", label: "戏剧 7 锚点" },
            ]}
          />
          <PaletteSwatch palette={t.palette} />
        </TweakSection>

        <TweakSection label="视觉">
          <TweakColor
            label="主题色"
            value={t.accentColor}
            onChange={(v) => setTweak("accentColor", v)}
            options={["#ff8a3d", "#c84858", "#e0a060", "#5a3870"]}
          />
          <TweakToggle
            label="显示抖音 Feed 框架"
            value={t.showChrome}
            onChange={(v) => setTweak("showChrome", v)}
          />
        </TweakSection>

        <TweakSection label="跳转">
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.55, marginBottom: 10 }}>
            上下滑：切视频 · 左右滑：在追·光卡片内
          </div>
          <TweakButton
            label="一键路演：3D 光影导航"
            onClick={() => {
              setTweak({ scenario: "high", palette: "refined", showChrome: true });
              setIndex({ row: 1, col: 1 });
              window.GuangbaoHooks?.setLightT?.(0.78);
            }}
          />
          <div style={{ display: "grid", gridTemplateRows: `repeat(${feed.length}, 1fr)`, gap: 6 }}>
            {feed.map((row, r) => (
              <div key={r} style={{ display: "grid", gridTemplateColumns: `60px repeat(${row.length}, 1fr)`, gap: 4 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center" }}>
                  {String(r+1).padStart(2,"0")}
                </div>
                {row.map((_, c) => (
                  <button key={c}
                    onClick={() => setIndex({ row: r, col: c })}
                    style={{
                      padding: "6px 4px",
                      background: (r === index.row && c === index.col) ? "var(--accent)" : "rgba(255,255,255,0.06)",
                      color: (r === index.row && c === index.col) ? "#1a0e08" : "#fff",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      fontSize: 10, fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}>
                    {row.length > 1 ? colLabels[c] : rowLabels[r].split(" · ")[1] || "视频"}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// ─────────────────────────────────────────
// Feed 指示器：竖向 dots (右下) + 行内子页指示 (底部居中)
// ─────────────────────────────────────────
function FeedIndicators({ feed, index }) {
  return (
    <>
      {/* 行内子页（仅多列 row） */}
      {feed[index.row].length > 1 && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 92,
          display: "flex", justifyContent: "center", gap: 6,
          zIndex: 8, pointerEvents: "none",
        }}>
          {feed[index.row].map((_, c) => (
            <div key={c} style={{
              width: c === index.col ? 18 : 5, height: 4, borderRadius: 99,
              background: c === index.col ? "var(--accent)" : "rgba(255,255,255,0.4)",
              transition: "all .35s cubic-bezier(.2,.7,.2,1)",
            }} />
          ))}
        </div>
      )}
      {/* 竖向 row 指示 */}
      <div style={{
        position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: 6,
        zIndex: 8, pointerEvents: "none",
      }}>
        {feed.map((_, r) => (
          <div key={r} style={{
            width: 3, height: r === index.row ? 16 : 5, borderRadius: 99,
            background: r === index.row ? "var(--accent)" : "rgba(255,255,255,0.35)",
            transition: "all .35s",
          }} />
        ))}
      </div>
    </>
  );
}

// 自动消失的上下滑提示
function ScrollHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div style={{
      position: "absolute", left: "50%", top: 22, transform: "translateX(-50%)",
      padding: "5px 12px",
      background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(12px)",
      borderRadius: 99,
      fontSize: 10, color: "rgba(255,255,255,0.8)",
      letterSpacing: 1.4,
      zIndex: 30,
      animation: "fadeOut 4.5s forwards",
      pointerEvents: "none",
    }}>
      ↑ 上下滑切视频 · ← 左滑看预报
      <style>{`@keyframes fadeOut { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }`}</style>
    </div>
  );
}

// 色卡预览条
function PaletteSwatch({ palette }) {
  const P = palette === "dramatic" ? PALETTE_DRAMATIC : PALETTE_REFINED;
  const stops = P.map(k => `${rgb(k.c)} ${(k.t * 100).toFixed(1)}%`).join(", ");
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        height: 26, borderRadius: 8,
        background: `linear-gradient(90deg, ${stops})`,
        border: "1px solid rgba(255,255,255,0.08)",
      }} />
      <div style={{
        marginTop: 4,
        display: "flex", justifyContent: "space-between",
        fontSize: 9, fontFamily: "var(--font-mono)",
        color: "rgba(255,255,255,0.55)",
      }}>
        <span>17:00</span><span>17:30</span><span>18:02</span><span>18:15</span><span>18:30</span>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
