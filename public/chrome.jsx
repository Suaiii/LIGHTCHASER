// chrome.jsx - Douyin-like shell UI shared by the feed.

const railIconBox = {
  width: 48,
  height: 48,
  display: "grid",
  placeItems: "center",
  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.62))",
};

function TopTabs({ active = "推荐" }) {
  const isLightMode = active === "追·光";
  const tabs = isLightMode
    ? ["上海", "追·光", "机位", "路线", "拍摄"]
    : ["点", "直播", "团购", "上海", "关注", "商城", "推荐"];

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: isLightMode ? 16 : 18,
      padding: isLightMode ? "7px 13px 12px" : "7px 13px 13px",
      color: "rgba(255,255,255,0.58)",
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: 0,
      position: "relative",
      zIndex: 12,
      whiteSpace: "nowrap",
      justifyContent: isLightMode ? "center" : "flex-start",
      textShadow: "0 1px 8px rgba(0,0,0,0.55)",
    }}>
      <div style={{
        width: 30,
        height: 28,
        display: "grid",
        placeItems: "center",
        marginRight: 2,
        flexShrink: 0,
        position: isLightMode ? "absolute" : "relative",
        left: isLightMode ? 13 : "auto",
      }}>
        <span style={{
          width: 26,
          height: 19,
          display: "block",
          background: `
            linear-gradient(#fff,#fff) 0 1px/26px 3px no-repeat,
            linear-gradient(#fff,#fff) 0 8px/26px 3px no-repeat,
            linear-gradient(#fff,#fff) 0 15px/26px 3px no-repeat
          `,
          borderRadius: 2,
          opacity: 0.96,
        }} />
      </div>

      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <div key={tab} style={{
            position: "relative",
            color: isActive ? "#fff" : "rgba(255,255,255,0.58)",
            fontWeight: isActive ? 950 : 800,
            fontSize: isActive && isLightMode ? 24 : isActive ? 20 : 18,
            paddingBottom: 4,
            transition: "color .2s, transform .2s",
            transform: isActive ? "translateY(-2px)" : "none",
            letterSpacing: isActive && isLightMode ? 1.5 : 0,
            textShadow: isActive && isLightMode
              ? "0 4px 18px rgba(255,138,61,0.48), 0 2px 10px rgba(0,0,0,0.8)"
              : "0 1px 8px rgba(0,0,0,0.55)",
          }}>
            {tab}
            {tab === "直播" && (
              <span style={{
                position: "absolute",
                right: -15,
                top: -9,
                padding: "1px 4px",
                borderRadius: 5,
                background: "#ff2f68",
                color: "#fff",
                fontSize: 10,
                fontWeight: 900,
                lineHeight: 1.2,
              }}>直播</span>
            )}
            {isActive && (
              <span style={{
                position: "absolute",
                bottom: -8,
                left: "50%",
                transform: "translateX(-50%)",
                width: isLightMode ? 38 : 28,
                height: 3,
                borderRadius: 4,
                background: isLightMode ? "#ff8a3d" : "#fff",
                boxShadow: isLightMode ? "0 0 16px rgba(255,138,61,0.65)" : "none",
              }} />
            )}
          </div>
        );
      })}

      <div style={{
        marginLeft: isLightMode ? 0 : "auto",
        width: 34,
        height: 34,
        flexShrink: 0,
        position: isLightMode ? "absolute" : "relative",
        right: isLightMode ? 13 : "auto",
      }}>
        <span style={{
          position: "absolute",
          left: 4,
          top: 3,
          width: 19,
          height: 19,
          borderRadius: "50%",
          border: "4px solid #fff",
        }} />
        <span style={{
          position: "absolute",
          right: 3,
          bottom: 5,
          width: 16,
          height: 4,
          borderRadius: 4,
          background: "#fff",
          transform: "rotate(45deg)",
        }} />
      </div>
    </div>
  );
}

function ActionRail({ likes = "12.4w", comments = 3812, shares = "1.8w", saves = "6.4w", avatar }) {
  const actions = [
    { key: "like", label: likes },
    { key: "comment", label: comments },
    { key: "save", label: saves },
    { key: "share", label: shares },
  ];

  return (
    <div style={{
      position: "absolute",
      right: 11,
      bottom: 132,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16,
      zIndex: 12,
    }}>
      <div className="douyin-rail-pop" style={{ position: "relative", width: 55, height: 55 }}>
        <div style={{
          width: 55,
          height: 55,
          borderRadius: "50%",
          background: avatar
            ? `center / cover no-repeat url("${avatar}")`
            : "linear-gradient(135deg, #ff8a3d, #c84858)",
          border: "3px solid rgba(255,255,255,0.98)",
          boxShadow: "0 4px 18px rgba(0,0,0,0.44)",
          overflow: "hidden",
        }} />
        <div style={{
          position: "absolute",
          bottom: -9,
          left: "50%",
          transform: "translateX(-50%)",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#ff2f68",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 22,
          fontWeight: 950,
          lineHeight: "18px",
          border: "2px solid #151111",
          animation: "rail-followBob 2.1s ease-in-out infinite",
        }}>+</div>
      </div>

      {actions.map((action, index) => (
        <div
          key={action.key}
          className={`douyin-rail-pop rail-btn rail-${action.key}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            cursor: "pointer",
            animationDelay: `${90 + index * 60}ms`,
          }}>
          <RailIcon type={action.key} />
          <div style={{
            fontSize: 14,
            color: "#fff",
            fontWeight: 750,
            textShadow: "0 1px 5px rgba(0,0,0,0.72)",
            lineHeight: 1,
          }}>{action.label}</div>
        </div>
      ))}

      <div className="douyin-rail-pop" style={{
        width: 45,
        height: 45,
        borderRadius: "50%",
        background: "conic-gradient(from 0deg, #171717, #444, #141414, #555, #171717)",
        border: "2px solid rgba(255,255,255,0.42)",
        animation: "rail-spin 8s linear infinite",
        position: "relative",
        boxShadow: "0 5px 18px rgba(0,0,0,0.46)",
      }}>
        <div style={{
          position: "absolute",
          inset: 13,
          borderRadius: "50%",
          background: avatar ? `center / cover no-repeat url("${avatar}")` : "var(--accent)",
        }} />
      </div>

      <style>{`
        @keyframes rail-spin { to { transform: rotate(360deg); } }
        @keyframes rail-followBob {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50%      { transform: translateX(-50%) scale(1.12); }
        }
        @keyframes rail-pop-in {
          from { opacity: 0; transform: translate3d(18px, 14px, 0) scale(.86); }
          to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes rail-heartbeat {
          0%, 35%, 100% { transform: scale(1); }
          12%           { transform: scale(1.16); }
          24%           { transform: scale(.96); }
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
          50%      { transform: scale(1.08) rotate(18deg); opacity: .94; }
        }
        .douyin-rail-pop {
          animation: rail-pop-in 360ms cubic-bezier(.2,.85,.2,1) both;
        }
        .rail-like svg    { animation: rail-heartbeat 1.7s ease-in-out infinite; }
        .rail-comment svg { animation: rail-bubble 2.4s ease-in-out infinite; }
        .rail-share svg   { animation: rail-shareSlide 2.0s ease-in-out infinite; }
        .rail-save svg    { animation: rail-starWink 3.2s ease-in-out infinite; }
        .rail-btn:active  { transform: scale(.9); transition: transform .1s; }
      `}</style>
    </div>
  );
}

function RailIcon({ type }) {
  if (type === "like") {
    return (
      <div style={railIconBox}>
        <svg viewBox="0 0 64 64" width="49" height="49" aria-hidden="true">
          <path d="M32 55 C18 43 8 34 8 22 C8 13 14 8 22 8 C27 8 30 10 32 15 C34 10 38 8 43 8 C51 8 56 14 56 22 C56 34 46 43 32 55 Z" fill="#fff" />
        </svg>
      </div>
    );
  }
  if (type === "comment") {
    return (
      <div style={railIconBox}>
        <svg viewBox="0 0 64 64" width="49" height="49" aria-hidden="true">
          <path d="M10 28 C10 17 20 10 33 10 C46 10 56 18 56 29 C56 40 46 48 33 48 C30 48 26 47 23 46 L13 52 L16 42 C12 38 10 34 10 28 Z" fill="#fff" />
          <circle cx="24" cy="29" r="3" fill="#202020" opacity=".78" />
          <circle cx="33" cy="29" r="3" fill="#202020" opacity=".78" />
          <circle cx="42" cy="29" r="3" fill="#202020" opacity=".78" />
        </svg>
      </div>
    );
  }
  if (type === "save") {
    return (
      <div style={railIconBox}>
        <svg viewBox="0 0 64 64" width="50" height="50" aria-hidden="true">
          <path d="M32 7 L39 23 L56 24 L43 35 L47 52 L32 43 L17 52 L21 35 L8 24 L25 23 Z" fill="#fff" />
        </svg>
      </div>
    );
  }
  return (
    <div style={railIconBox}>
      <svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true">
        <path d="M8 36 C20 26 32 21 44 20 L44 10 L58 28 L44 46 L44 35 C31 35 20 39 10 50 C12 44 13 40 8 36 Z" fill="#fff" />
      </svg>
    </div>
  );
}

function MusicMarquee({ text = "♫ Under Current - Bunkka", color = "rgba(255,255,255,0.65)" }) {
  const item = `♫  ${text}  ·  `;
  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      width: "100%",
      maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      fontSize: 11,
      color,
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

function BottomNav() {
  const items = [
    { label: "首页", active: true, mark: "⌁" },
    { label: "朋友" },
    { label: "+", isPlus: true },
    { label: "消息" },
    { label: "我" },
  ];

  return (
    <div style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: 86,
      padding: "12px 24px 22px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "linear-gradient(to top, rgba(5,5,6,0.98) 0%, rgba(8,8,9,0.92) 58%, rgba(0,0,0,0) 100%)",
      zIndex: 12,
    }}>
      {items.map((item, index) => {
        if (item.isPlus) {
          return (
            <div key={index} style={{
              width: 54,
              height: 42,
              borderRadius: 12,
              background: "#fff",
              border: "3px solid #fff",
              display: "grid",
              placeItems: "center",
              color: "#000",
              fontWeight: 900,
              fontSize: 25,
              lineHeight: 1,
              boxShadow: "-5px 0 0 #23f4ef, 5px 0 0 #ff2f68, 0 7px 18px rgba(0,0,0,0.5)",
              transform: "translateY(-4px)",
            }}>+</div>
          );
        }
        return (
          <div key={index} style={{
            color: item.active ? "#fff" : "rgba(255,255,255,0.55)",
            fontWeight: item.active ? 900 : 750,
            fontSize: 19,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            position: "relative",
            minWidth: 44,
            textShadow: "0 1px 8px rgba(0,0,0,0.55)",
          }}>
            <span>{item.label}</span>
            {item.mark && <span style={{ fontSize: 16, transform: "translateY(1px)" }}>{item.mark}</span>}
          </div>
        );
      })}
    </div>
  );
}

function AIPill({ text = "AI 为你预报 · 今晚值得抬头" }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px 6px 8px",
      background: "rgba(20, 14, 24, 0.65)",
      border: "1px solid rgba(255,255,255,0.10)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: 99,
      fontSize: 12,
      color: "rgba(255,255,255,0.92)",
      fontWeight: 500,
    }}>
      <div style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #ff8a3d, #c84858 60%, #5a3870)",
        display: "grid",
        placeItems: "center",
        fontSize: 10,
        fontWeight: 700,
        color: "#fff",
      }}>光</div>
      {text}
    </div>
  );
}

function PageDots({ count, active }) {
  return (
    <div style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 92,
      display: "flex",
      justifyContent: "center",
      gap: 6,
      zIndex: 8,
      pointerEvents: "none",
    }}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} style={{
          width: index === active ? 18 : 6,
          height: 4,
          borderRadius: 99,
          background: index === active ? "var(--accent)" : "rgba(255,255,255,0.4)",
          transition: "all .35s cubic-bezier(.2,.7,.2,1)",
        }} />
      ))}
    </div>
  );
}

Object.assign(window, { TopTabs, ActionRail, BottomNav, AIPill, PageDots, MusicMarquee });
