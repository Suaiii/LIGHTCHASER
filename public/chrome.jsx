// chrome.jsx — 顶部 tab / 右侧操作栏 / 底部导航
// 共享 UI 元素：feed 框架（结构沿用，视觉自己做）

const { useState } = React;

// ────────────────────────────────────────────
// 顶部 Tab 栏
// ────────────────────────────────────────────
function TopTabs({ active = "推荐" }) {
  // 「追·光」融入官方 tab，挂在「推荐」右侧
  const tabs = ["附近", "关注", "推荐", "追·光", "精选"];
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 18,
      padding: "6px 16px 12px",
      color: "rgba(255,255,255,0.55)",
      fontSize: 14,
      fontWeight: 500,
      letterSpacing: 0.3,
      position: "relative",
      zIndex: 5,
      whiteSpace: "nowrap",
    }}>
      {tabs.map(t => {
        const a = t === active;
        return (
          <div key={t} style={{
            position: "relative",
            color: a ? "#fff" : "rgba(255,255,255,0.55)",
            fontWeight: a ? 700 : 500,
            fontSize: a ? 17 : 14,
            paddingBottom: 2,
            transition: "all .2s",
          }}>
            {t}
            {a && (
              <div style={{
                position: "absolute",
                bottom: -6,
                left: "50%",
                transform: "translateX(-50%)",
                width: 16, height: 3,
                background: "var(--accent)",
                borderRadius: 2,
              }} />
            )}
          </div>
        );
      })}
      <div style={{ marginLeft: "auto", opacity: 0.85, fontSize: 16 }}>⌕</div>
    </div>
  );
}

// ────────────────────────────────────────────
// 右侧动作栏 (like / comment / share / save)
// ────────────────────────────────────────────
function ActionRail({ likes = "12.4w", comments = 3812, shares = "1.8w", saves = "6.4w", avatar }) {
  const items = [
    { key: "like",    icon: "❤", label: likes,    color: "#ff5b78" },
    { key: "comment", icon: "💬", label: comments },
    { key: "share",   icon: "↗", label: shares },
    { key: "save",    icon: "☆", label: saves },
  ];
  return (
    <div style={{
      position: "absolute",
      right: 12,
      bottom: 140,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 22,
      zIndex: 6,
    }}>
      {/* 头像 + 关注 */}
      <div style={{ position: "relative", width: 46, height: 46 }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          background: avatar
            ? `center / cover no-repeat url("${avatar}")`
            : "linear-gradient(135deg, #ff8a3d, #c84858)",
          border: "2px solid rgba(255,255,255,0.9)",
          display: "grid", placeItems: "center",
          fontSize: 18, color: "#fff", fontWeight: 700,
          overflow: "hidden",
        }}>{avatar ? null : "追"}</div>
        <div style={{
          position: "absolute",
          bottom: -8, left: "50%", transform: "translateX(-50%)",
          width: 18, height: 18, borderRadius: "50%",
          background: "var(--accent)",
          color: "#fff", fontSize: 14, lineHeight: "16px",
          display: "grid", placeItems: "center",
          fontWeight: 700,
          border: "1.5px solid #0a0a0d",
          animation: "rail-followBob 2.2s ease-in-out infinite",
        }}>+</div>
      </div>

      {items.map((it, i) => (
        <div key={it.key} className={`rail-btn rail-${it.key}`} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          cursor: "pointer",
        }}>
          <div style={{
            fontSize: 28, lineHeight: 1,
            color: it.color || "#fff",
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
          }}>{it.icon}</div>
          <div className="num" style={{
            fontSize: 11, color: "#fff", fontWeight: 600,
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            fontFamily: "inherit",
          }}>{it.label}</div>
        </div>
      ))}

      {/* 唱片 */}
      <div style={{
        width: 38, height: 38, borderRadius: "50%",
        background: "conic-gradient(from 0deg, #2a2a35, #444, #2a2a35)",
        border: "1.5px solid rgba(255,255,255,0.6)",
        animation: "rail-spin 8s linear infinite",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", inset: 12,
          borderRadius: "50%",
          background: "var(--accent)",
        }} />
      </div>

      <style>{`
        @keyframes rail-spin { to { transform: rotate(360deg); } }
        @keyframes rail-followBob {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50%      { transform: translateX(-50%) scale(1.12); }
        }
        @keyframes rail-heartbeat {
          0%, 35%, 100% { transform: scale(1); }
          12%           { transform: scale(1.18); }
          24%           { transform: scale(0.95); }
        }
        @keyframes rail-bubble {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes rail-shareSlide {
          0%, 100% { transform: translate(0,0); }
          50%      { transform: translate(2px,-2px); }
        }
        @keyframes rail-starWink {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          50%      { transform: scale(1.08) rotate(36deg); opacity: 0.92; }
        }
        .rail-like > div:first-child    { animation: rail-heartbeat 1.6s ease-in-out infinite; }
        .rail-comment > div:first-child { animation: rail-bubble 2.4s ease-in-out infinite; }
        .rail-share > div:first-child   { animation: rail-shareSlide 2.0s ease-in-out infinite; }
        .rail-save > div:first-child    { animation: rail-starWink 3.2s ease-in-out infinite; }
        .rail-btn:active                { transform: scale(0.9); transition: transform 0.1s; }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────
// MusicMarquee — 滑动跑马灯音乐条
// ─────────────────────────────────────────
function MusicMarquee({ text = "♀ Under Current — Bunkka", color = "rgba(255,255,255,0.65)" }) {
  const item = `♫  ${text}  ·  `;
  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      width: "100%",
      maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      fontSize: 11, color,
      fontFamily: "var(--font-mono)",
      lineHeight: 1.4,
    }}>
      <div style={{
        display: "inline-flex",
        whiteSpace: "nowrap",
        animation: "music-marquee 18s linear infinite",
      }}>
        <span>{item.repeat(4)}</span>
        <span>{item.repeat(4)}</span>
      </div>
      <style>{`
        @keyframes music-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────
// 底部导航
// ────────────────────────────────────────────
function BottomNav() {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      padding: "10px 18px 28px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))",
      zIndex: 7,
    }}>
      {[
        { label: "首页", active: true, icon: "⇋" },
        { label: "朋友", icon: "◌◌" },
        { label: "+", isPlus: true },
        { label: "消息", icon: "✉", badge: 19 },
        { label: "我", icon: "○" },
      ].map((it, i) => {
        if (it.isPlus) return (
          <div key={i} style={{
            width: 48, height: 32,
            borderRadius: 8,
            background: "#fff",
            border: "2px solid #fff",
            display: "grid", placeItems: "center",
            color: "#000", fontWeight: 800, fontSize: 22, lineHeight: 1,
            boxShadow: "0 0 0 3px rgba(0,0,0,0.4), 0 0 0 4px var(--accent)",
          }}>+</div>
        );
        return (
          <div key={i} style={{
            color: it.active ? "#fff" : "rgba(255,255,255,0.55)",
            fontWeight: it.active ? 700 : 500,
            fontSize: 14,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            position: "relative",
            minWidth: 44,
          }}>
            <div style={{ fontSize: 18, opacity: 0.9 }}>{it.icon}</div>
            <div>{it.label}</div>
            {it.badge && (
              <div style={{
                position: "absolute", top: -4, right: -2,
                background: "var(--warn)",
                color: "#fff", fontSize: 10, fontWeight: 700,
                padding: "1px 6px", borderRadius: 99, lineHeight: 1.4,
              }}>{it.badge}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────
// "AI 为你推荐" 胶囊
// ────────────────────────────────────────────
function AIPill({ text = "AI 为你预报 · 今晚值得抬头" }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 12px 6px 8px",
      background: "rgba(20, 14, 24, 0.65)",
      border: "1px solid rgba(255,255,255,0.10)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: 99,
      fontSize: 12, color: "rgba(255,255,255,0.92)",
      fontWeight: 500,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "linear-gradient(135deg, #ff8a3d, #c84858 60%, #5a3870)",
        display: "grid", placeItems: "center",
        fontSize: 10, fontWeight: 700, color: "#fff",
      }}>光</div>
      {text}
    </div>
  );
}

// ────────────────────────────────────────────
// 页面指示器
// ────────────────────────────────────────────
function PageDots({ count, active }) {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 92,
      display: "flex", justifyContent: "center", gap: 6,
      zIndex: 8, pointerEvents: "none",
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          width: i === active ? 18 : 6, height: 4, borderRadius: 99,
          background: i === active ? "var(--accent)" : "rgba(255,255,255,0.4)",
          transition: "all .35s cubic-bezier(.2,.7,.2,1)",
        }} />
      ))}
    </div>
  );
}

Object.assign(window, { TopTabs, ActionRail, BottomNav, AIPill, PageDots, MusicMarquee });
