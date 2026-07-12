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
function SceneRoute() {
  // t: 光的时间（0=现在 17:00, 1=日落后 18:30）
  // 默认 0.78 = 18:15 峰值
  const [t, setT] = useState(0.78);
  useExternalLightT(setT);

  // 当前光线落点 (在地图上的归一化位置)
  // 早 → 偏东（地图右）；晚 → 偏西（地图左）
  // 用户走向是从右下角（"你"）往左上角（"机位"）
  const lightX = 0.85 - t * 0.55;   // 0.85 → 0.30
  const lightY = 0.30 + (1 - Math.sin(t * Math.PI)) * 0.15;

  // 当前光色
  const lightColor = skyColor(Math.max(0.45, Math.min(0.92, t)));
  const lightRgb = rgb(lightColor);

  // 倒推出发时间：峰值 18:15 - 步行 16 分钟 - 缓冲 5 分钟 = 17:54
  const peak = 18 * 60 + 15;
  const departMin = peak - 16 - 5;
  const departClock = `${Math.floor(departMin / 60)}:${String(departMin % 60).padStart(2,"0")}`;

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
              往西走 <span style={{ color: "#ffd49a" }}>1.2km</span><br/>
              <span style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>→ 静安寺南广场</span>
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

        {/* 地图 */}
        <RouteMap t={t} lightX={lightX} lightY={lightY} lightRgb={lightRgb} />

        {/* 光时间滑条 */}
        <LightTimeSlider t={t} setT={setT} />

        {/* CTA */}
        <button
          onClick={() => window.GuangbaoHooks?.openNavigation({ name: "静安寺南广场" })}
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

// 路线地图 SVG
function RouteMap({ t, lightX, lightY, lightRgb }) {
  // 主路径节点（地图归一化坐标 0..1）
  const path = [
    { x: 0.82, y: 0.85, label: "你" },       // 起点 — 右下
    { x: 0.62, y: 0.70 },
    { x: 0.42, y: 0.60 },
    { x: 0.28, y: 0.42 },
    { x: 0.22, y: 0.22, label: "机位" },     // 终点 — 左上
  ];
  const pathD = path.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * 400} ${p.y * 280}`).join(" ");
  const start = path[0], end = path[path.length - 1];

  // 中转路口
  const blocks = [
    // 大街区
    [0.10, 0.10, 0.16, 0.18], [0.32, 0.10, 0.14, 0.14], [0.52, 0.08, 0.18, 0.16],
    [0.78, 0.08, 0.16, 0.16],
    [0.05, 0.38, 0.10, 0.12], [0.55, 0.30, 0.20, 0.16], [0.82, 0.28, 0.14, 0.18],
    [0.08, 0.58, 0.18, 0.14], [0.42, 0.74, 0.18, 0.16], [0.78, 0.60, 0.18, 0.14],
    [0.08, 0.78, 0.12, 0.14], [0.62, 0.88, 0.18, 0.10],
  ];

  return (
    <div style={{
      position: "relative",
      height: 290, borderRadius: 16, overflow: "hidden",
      background: "rgba(10, 8, 16, 0.55)",
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
    }}>
      <svg viewBox="0 0 400 280" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          {/* 光区径向渐变 */}
          <radialGradient id="lightArea" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"  stopColor={lightRgb} stopOpacity="0.85" />
            <stop offset="40%" stopColor={lightRgb} stopOpacity="0.42" />
            <stop offset="100%" stopColor={lightRgb} stopOpacity="0" />
          </radialGradient>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* 底网格 */}
        <rect width="400" height="280" fill="url(#grid)" />

        {/* 街区 */}
        {blocks.map((b, i) => (
          <rect key={i}
            x={b[0]*400} y={b[1]*280} width={b[2]*400} height={b[3]*280}
            fill="rgba(255,255,255,0.05)"
            stroke="rgba(255,255,255,0.08)" strokeWidth="0.6"
            rx="3"
          />
        ))}

        {/* 主街道 (水平) */}
        {[0.30, 0.52, 0.76].map((y, i) => (
          <line key={i} x1="0" y1={y * 280} x2="400" y2={y * 280}
            stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        ))}
        {/* 主街道 (垂直) */}
        {[0.25, 0.50, 0.75].map((x, i) => (
          <line key={i} x1={x * 400} y1="0" x2={x * 400} y2="280"
            stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        ))}

        {/* 光区域 — 跟随时间 t 移动 */}
        <ellipse
          cx={lightX * 400} cy={lightY * 280}
          rx="160" ry="100"
          fill="url(#lightArea)"
          style={{ transition: "cx 0.15s, cy 0.15s, rx 0.15s, ry 0.15s" }}
        />

        {/* 阴影区域 (光线之外) — 微暗 */}
        <rect width="400" height="280" fill="rgba(0,0,0,0.18)" style={{ mixBlendMode: "multiply" }} />

        {/* 步行路径 — 虚线 */}
        <path
          d={pathD}
          fill="none"
          stroke={lightRgb}
          strokeWidth="3"
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          opacity="0.85"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* 起点 — "你" */}
        <g transform={`translate(${start.x * 400}, ${start.y * 280})`}>
          <circle r="14" fill="#3a8fff" opacity="0.25" />
          <circle r="8"  fill="#3a8fff" opacity="0.45" />
          <circle r="4.5" fill="#fff" stroke="#3a8fff" strokeWidth="2" />
        </g>

        {/* 终点 — 机位 */}
        <g transform={`translate(${end.x * 400}, ${end.y * 280})`}>
          <circle r="22" fill={lightRgb} opacity="0.18">
            <animate attributeName="r" values="18;26;18" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.22;0.08;0.22" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle r="9" fill={lightRgb} />
          <path d="M 0 -8 L -3 -12 L 3 -12 Z" fill={lightRgb} />
          <text x="0" y="-18" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 3 }}>
            机位
          </text>
        </g>
      </svg>

      {/* 顶部右上 — 时钟图标 */}
      <div style={{
        position: "absolute", top: 10, right: 12,
        padding: "4px 9px",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(10px)",
        borderRadius: 99,
        fontSize: 10, color: "#fff", fontFamily: "var(--font-mono)",
        letterSpacing: 0.6,
        display: "flex", alignItems: "center", gap: 5,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: lightRgb,
          boxShadow: `0 0 8px ${lightRgb}`,
        }} />
        {/* 把 t 映射回时钟 */}
        {(() => {
          const total = 17 * 60 + Math.round(t * 90);
          return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")} · 光在这里`;
        })()}
      </div>

      {/* 左下 — 当前段步行说明 */}
      <div style={{
        position: "absolute", bottom: 10, left: 12,
        padding: "5px 10px",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(10px)",
        borderRadius: 99,
        fontSize: 10, color: "rgba(255,255,255,0.85)",
        letterSpacing: 0.4,
      }}>
        ⊳ 沿 愚园路 西行 6 分钟
      </div>
    </div>
  );
}

// 光时间滑条（紧凑版）
function LightTimeSlider({ t, setT }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);
  const c = skyColor(t);

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
    e.preventDefault?.();
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

  const total = 17 * 60 + Math.round(t * 90);
  const clock = `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`;

  const anchors = [
    { t: 0.00, l: "现在" },
    { t: 0.33, l: "Golden" },
    { t: 0.62, l: "日落" },
    { t: 0.78, l: "峰值" },
    { t: 1.00, l: "结束" },
  ];

  return (
    <div style={{
      padding: "12px 14px 10px",
      background: "rgba(20, 14, 22, 0.55)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", letterSpacing: 1 }}>
          拖动看光在哪里
        </div>
        <div className="num" style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: 18, fontWeight: 500, color: "#fff",
        }}>{clock}</div>
      </div>
      <div
        ref={trackRef}
        onPointerDown={onDown}
        onTouchStart={onDown}
        style={{
          position: "relative",
          height: 22, borderRadius: 6,
          background: buildSkyGradient(),
          cursor: "grab",
          touchAction: "none",
        }}>
        {anchors.map((a, i) => (
          <div key={i} style={{
            position: "absolute", left: `${a.t * 100}%`, top: -1, bottom: -1,
            width: 1.5, background: "rgba(255,255,255,0.5)",
            transform: "translateX(-0.5px)",
          }} />
        ))}
        <div style={{
          position: "absolute", left: `${t * 100}%`, top: -5, bottom: -5,
          width: 4, transform: "translateX(-2px)",
          background: "#fff",
          borderRadius: 4,
          boxShadow: `0 0 0 3px ${rgb(c)}66, 0 4px 12px rgba(0,0,0,0.5)`,
        }} />
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: 6,
        fontSize: 9, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-mono)",
      }}>
        {anchors.map((a, i) => (
          <div key={i} style={{
            color: Math.abs(a.t - t) < 0.06 ? "#fff" : "rgba(255,255,255,0.55)",
            fontWeight: Math.abs(a.t - t) < 0.06 ? 700 : 400,
          }}>{a.l}</div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 副屏 2 — 社区 / 这片光下他们也来过
// ============================================
function SceneCommunity() {
  // 昨天的笔记 — 6 张
  const notes = [
    { skyT: 0.80, score: 91, date: "昨天",   author: "城南旧光", note: "刚到峰值就开始烧了" },
    { skyT: 0.62, score: 74, date: "10.15", author: "西风掠云", note: "等了 40 分钟值得" },
    { skyT: 0.92, score: 86, date: "10.14", author: "晚走的人", note: "蓝调比想象的久" },
    { skyT: 0.50, score: 62, date: "10.13", author: "陈小溪",  note: "金光段最舒服" },
    { skyT: 0.78, score: 88, date: "10.11", author: "夜灯",    note: "拍人也好看" },
    { skyT: 0.45, score: 55, date: "10.10", author: "k_walks", note: "云不够厚" },
  ];

  const comments = [
    "这个机位真的有戏",
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
            }}>23</span> 位追光者也在这片光里
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
          筛选 · 评分 80+ · 静安寺周边 · 17:30–19:00
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
function SceneQuickShoot() {
  const [selectedTitle, setSelectedTitle] = useState(0);
  const [recording, setRecording] = useState(false);

  // 预生成的笔记标题候选
  const titles = [
    "今晚的光",
    "西天烧了 16 分钟",
    "刚好赶上",
    "上海·静安区·18:15",
    "为这片光我跑了一公里",
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
          }}>87</div>
        </div>
      </div>

      {/* 右侧：拍摄参数建议 */}
      <div style={{
        position: "absolute", right: 16, top: 200, zIndex: 3,
        display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end",
      }}>
        {[
          ["ISO", "200"],
          ["快门", "1/160"],
          ["光圈", "f/4"],
          ["白平衡", "5600K"],
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
