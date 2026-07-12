// light-map-3d.jsx — P2 实时 3D 光影地图（AGENT_04 v1.1 · issue #12 愿景的第一落地）
// 核心：用 /api/sunset 返回的真实太阳方位角/高度角驱动 THREE.DirectionalLight，
//       建筑投影自然切出"此刻能看到光的区域"；OSRM 真实路线画成发光带；
//       附近追光者为演示光点（HUD 明确标注"演示"，不冒充真实数据）。
// 交互：拖拽旋转 / 滚轮缩放 / 闲置慢速自转（prefers-reduced-motion 时关闭）。
// 兜底：THREE 缺失或 WebGL 失败 → 回退经典 SceneRoute（legacy-v1 同款逻辑仍在 subpanels.jsx）。

// ── 小工具 ──────────────────────────────────────────
function zgHashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function zgMulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// lat/lng → 以 origin 为中心的本地平面坐标（米）。x=东, z=南(朝屏幕)
function zgToLocal(lat, lng, origin) {
  const R = 6371000, rad = Math.PI / 180;
  const x = (lng - origin.lng) * rad * R * Math.cos(origin.lat * rad);
  const z = -(lat - origin.lat) * rad * R;
  return { x, z };
}
// 罗盘方位角(0=N,90=E) + 高度角 → 世界方向单位向量（指向太阳）
function zgSunDir(azDeg, altDeg) {
  const az = azDeg * Math.PI / 180, alt = Math.max(altDeg, 0.5) * Math.PI / 180;
  return {
    x: Math.sin(az) * Math.cos(alt),
    y: Math.sin(alt),
    z: -Math.cos(az) * Math.cos(alt),
  };
}
const zgClamp = (v, a, b) => Math.min(b, Math.max(a, v));

function zgMinutesFromClock(clock, fallback) {
  if (typeof clock !== "string") return fallback;
  const m = clock.match(/(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : fallback;
}
function zgWalkMinutes(distanceText) {
  const m = /(\d+)/.exec(distanceText || "");
  return m ? +m[1] : 16;
}

// ── 3D 场景（一次构建，数据变更时重建）────────────────
function zgBuildScene(canvas, params) {
  const { route, dest, sun, skyHex, chasers, reducedMotion } = params;
  const THREE = window.THREE;
  const W = canvas.clientWidth, H = canvas.clientHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(zgClamp(window.devicePixelRatio || 1, 1, 1.5));
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // 天空：当前天色 → 深夜蓝的垂直渐变（用大球体着色近似）
  const skyColor = new THREE.Color(skyHex || "#C84858");
  scene.background = new THREE.Color("#0a0a0d");
  scene.fog = new THREE.Fog("#0a0a0d", 420, 1500);

  const camera = new THREE.PerspectiveCamera(46, W / H, 1, 4000);

  // 地面（接影）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ color: "#101319", roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(3000, 60, 0x1d2230, 0x161a26);
  grid.position.y = 0.2;
  scene.add(grid);

  // 路线发光带（真实 OSRM 几何）
  const pts = route.map((p) => new THREE.Vector3(p.x, 2.2, p.z));
  let routeLen = 0;
  for (let i = 1; i < pts.length; i++) routeLen += pts[i].distanceTo(pts[i - 1]);
  if (pts.length >= 2) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(24, pts.length * 2), 2.6, 6, false),
      new THREE.MeshBasicMaterial({ color: "#ff8a3d" })
    );
    scene.add(tube);
    const glow = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(24, pts.length * 2), 6.5, 6, false),
      new THREE.MeshBasicMaterial({ color: "#ff8a3d", transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    scene.add(glow);
  }

  // 起点标记（你在这）
  const originDot = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: "#ffffff" })
  );
  originDot.position.set(pts[0]?.x || 0, 5, pts[0]?.z || 0);
  scene.add(originDot);

  // 终点光柱（机位信标）
  const destPos = new THREE.Vector3(dest.x, 0, dest.z);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 5, 90, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: "#ffd49a", transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  beacon.position.set(destPos.x, 45, destPos.z);
  scene.add(beacon);
  const destDot = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 16), new THREE.MeshBasicMaterial({ color: "#ffd49a" }));
  destDot.position.set(destPos.x, 6, destPos.z);
  scene.add(destDot);

  // 城市体块（确定性伪随机；给太阳投影用——投影切出"光可见区域"）
  const rand = zgMulberry(zgHashSeed(params.seedKey || "zhuiguang"));
  const buildingMat = new THREE.MeshStandardMaterial({ color: "#171b26", roughness: 0.85, metalness: 0.05 });
  const buildings = new THREE.Group();
  const span = Math.max(routeLen, 400);
  const half = span * 0.75;
  for (let i = 0; i < 46; i++) {
    const w = 18 + rand() * 42, d = 18 + rand() * 42;
    const hgt = 14 + Math.pow(rand(), 1.6) * 120;
    const bx = (rand() * 2 - 1) * half;
    const bz = (rand() * 2 - 1) * half;
    // 让开路线走廊（距任一路径点 <36m 则跳过）
    let tooClose = false;
    for (let k = 0; k < pts.length; k += 2) {
      const dx = pts[k].x - bx, dz = pts[k].z - bz;
      if (dx * dx + dz * dz < 36 * 36) { tooClose = true; break; }
    }
    if (tooClose) continue;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), buildingMat);
    box.position.set(bx, hgt / 2, bz);
    box.castShadow = true;
    box.receiveShadow = true;
    buildings.add(box);
  }
  scene.add(buildings);

  // 太阳：真实方位角/高度角 → 平行光（castShadow 渲染光可见区域）
  const sunBelow = sun.altitudeDeg <= 0;
  const dir = zgSunDir(sun.azimuthDeg, sunBelow ? 2.5 : sun.altitudeDeg);
  const sunDist = 900;
  const sunLight = new THREE.DirectionalLight(skyColor.clone().lerp(new THREE.Color("#ffd49a"), 0.45), sunBelow ? 0.55 : 1.35);
  sunLight.position.set(dir.x * sunDist, dir.y * sunDist, dir.z * sunDist);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  const sc = sunLight.shadow.camera;
  sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.far = 2600;
  sc.updateProjectionMatrix();
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight("#2a3050", sunBelow ? 0.9 : 0.55));

  // 太阳盘（可视锚点，让"光从哪来"一眼可见）
  const sunSprite = new THREE.Mesh(
    new THREE.SphereGeometry(26, 20, 20),
    new THREE.MeshBasicMaterial({ color: skyColor.clone().lerp(new THREE.Color("#ffdda0"), 0.7) })
  );
  sunSprite.position.copy(sunLight.position).multiplyScalar(0.9);
  scene.add(sunSprite);
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(64, 20, 20),
    new THREE.MeshBasicMaterial({ color: skyColor, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sunGlow.position.copy(sunSprite.position);
  scene.add(sunGlow);

  // 附近追光者（演示光点，脉动）
  const chaserMeshes = chasers.map((c) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(3.6, 12, 12), new THREE.MeshBasicMaterial({ color: "#ff8a3d", transparent: true, opacity: 0.95 }));
    m.position.set(c.x, 4, c.z);
    scene.add(m);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(7.5, 12, 12), new THREE.MeshBasicMaterial({ color: "#ff8a3d", transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.copy(m.position);
    scene.add(halo);
    return { m, halo, phase: Math.random() * Math.PI * 2 };
  });

  // 相机轨道（自实现：拖拽=旋转，滚轮=缩放）
  const mid = new THREE.Vector3((pts[0]?.x + destPos.x) / 2 || 0, 0, (pts[0]?.z + destPos.z) / 2 || 0);
  const orbit = { theta: Math.PI * 0.22, phi: Math.PI * 0.32, radius: zgClamp(span * 1.15, 320, 1400) };
  function applyCamera() {
    const sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi);
    camera.position.set(
      mid.x + orbit.radius * sp * Math.sin(orbit.theta),
      orbit.radius * cp,
      mid.z + orbit.radius * sp * Math.cos(orbit.theta)
    );
    camera.lookAt(mid.x, 10, mid.z);
  }
  applyCamera();

  // 帧循环
  let raf = 0, idle = true, disposed = false;
  const clock = { t: 0 };
  function frame() {
    if (disposed) return;
    clock.t += 1 / 60;
    if (idle && !reducedMotion) orbit.theta += 0.0014; // 闲置慢速自转(silk)
    if (!reducedMotion) {
      chaserMeshes.forEach((c) => {
        const s = 1 + Math.sin(clock.t * 2.4 + c.phase) * 0.28;
        c.halo.scale.setScalar(s);
        c.halo.material.opacity = 0.12 + 0.1 * (1 + Math.sin(clock.t * 2.4 + c.phase)) / 2;
      });
      beacon.material.opacity = 0.28 + 0.1 * (1 + Math.sin(clock.t * 1.6)) / 2;
    }
    applyCamera();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  frame();

  return {
    setIdle(v) { idle = v; },
    rotate(dx, dy) {
      orbit.theta -= dx * 0.005;
      orbit.phi = zgClamp(orbit.phi - dy * 0.004, 0.12, Math.PI * 0.46);
    },
    zoom(f) { orbit.radius = zgClamp(orbit.radius * f, 220, 2000); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    },
    sunBelow,
  };
}

// ── React 组件（与 SceneRoute 同 props，可直接换装）──────
function Scene3DLightMap({ sunsetPayload, routeData, routeLoading = false, selectedSpotName, onSelectSpot }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [failed, setFailed] = useState(false);

  const rec = sunsetPayload?.recommendation || {};
  const meta = sunsetPayload?.meta || {};
  const sun = meta.sun?.current || { altitudeDeg: 8, azimuthDeg: 270 };
  const origin = meta.coordinates || { lat: 30.72, lng: 121.343 };
  const destLL = rec.coordinates || { lat: origin.lat + 0.006, lng: origin.lng - 0.01 };

  const peak = sunsetPayload?.peakTime || "18:15";
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const peakMin = zgMinutesFromClock(peak, 18 * 60 + 15);
  const walkMin = zgWalkMinutes(rec.distance);
  const etaMin = nowMin + walkMin;
  const leftMin = peakMin - nowMin;
  const conclusion = leftMin < 0
    ? `今晚已过峰值 · 明晚黄金时刻见`
    : etaMin <= peakMin
      ? `步行 ${walkMin} 分钟 · ${String(Math.floor(etaMin / 60)).padStart(2, "0")}:${String(etaMin % 60).padStart(2, "0")} 到 · 正好赶上`
      : `步行 ${walkMin} 分钟 · 到时峰值已过 ${etaMin - peakMin} 分钟 · 抓紧或看明晚`;

  const spots = sunsetPayload
    ? [{ name: rec.spot, coordinates: rec.coordinates, distance: rec.distance },
       ...(sunsetPayload.nearbySpots || [])]
        .filter((s, i, l) => s?.name && l.findIndex((x) => x?.name === s.name) === i)
        .slice(0, 4)
    : [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!window.THREE) { setFailed(true); return; }

    // 路线：OSRM 真实几何 → 本地米坐标；无则直线
    const geo = routeData?.geometry?.length >= 2
      ? routeData.geometry
      : [{ lat: origin.lat, lng: origin.lng }, { lat: destLL.lat, lng: destLL.lng }];
    const route = geo.map((p) => zgToLocal(p.lat, p.lng, origin));
    const dest = zgToLocal(destLL.lat, destLL.lng, origin);

    // 演示光点：沿路线/终点附近散布 4 个（HUD 已标注"演示"）
    const rand = zgMulberry(zgHashSeed(rec.spot || "chasers"));
    const chasers = Array.from({ length: 4 }, () => {
      const base = route[Math.floor(rand() * route.length)] || dest;
      return { x: base.x + (rand() * 2 - 1) * 120, z: base.z + (rand() * 2 - 1) * 120 };
    });

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let engine;
    try {
      engine = zgBuildScene(canvas, {
        route, dest, sun,
        skyHex: sunsetPayload?.currentSkyColor,
        chasers, reducedMotion,
        seedKey: `${rec.spot || "zg"}·${meta.city || ""}`,
      });
    } catch (e) {
      console.warn("[LIGHTCHASER] 3D scene failed, fallback to classic route.", e);
      setFailed(true);
      return;
    }
    engineRef.current = engine;

    // 拖拽旋转（跟手 snap）＋滚轮缩放
    let dragging = false, lx = 0, ly = 0, idleTimer = 0;
    function wake() {
      engine.setIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => engine.setIdle(true), 2600);
    }
    function down(e) { const p = e.touches ? e.touches[0] : e; dragging = true; lx = p.clientX; ly = p.clientY; wake(); }
    function move(e) {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      engine.rotate(p.clientX - lx, p.clientY - ly);
      lx = p.clientX; ly = p.clientY;
      wake();
      if (e.cancelable) e.preventDefault();
    }
    function up() { dragging = false; }
    function wheel(e) { engine.zoom(e.deltaY > 0 ? 1.08 : 0.925); wake(); e.preventDefault(); }
    canvas.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: true });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", up);
    canvas.addEventListener("wheel", wheel, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      canvas.removeEventListener("touchstart", down);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", up);
      canvas.removeEventListener("wheel", wheel);
      clearTimeout(idleTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, [
    sun.azimuthDeg, sun.altitudeDeg,
    destLL.lat, destLL.lng,
    routeData?.geometry?.length,
    sunsetPayload?.currentSkyColor,
    rec.spot,
  ]);

  // WebGL/THREE 失败 → 经典地图版（1.0 逻辑，仍在 subpanels.jsx）
  if (failed && typeof SceneRoute === "function") {
    return <SceneRoute sunsetPayload={sunsetPayload} routeData={routeData} routeLoading={routeLoading} selectedSpotName={selectedSpotName} onSelectSpot={onSelectSpot} />;
  }

  const sunBelow = sun.altitudeDeg <= 0;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0a0a0d" }}>
      {/* 仅锁 canvas：拖拽=旋转视角；底部结论卡区域不锁，保留上下/左右滑动换页的通道（防导航陷阱） */}
      <canvas ref={canvasRef} data-swipe-lock="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "grab" }} />

      {/* 顶部 HUD：倒计时(payload,瞬时) + 太阳读数 */}
      <div style={{ position: "absolute", top: 96, left: 14, right: 14, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
        <div style={{ padding: "7px 13px", borderRadius: 999, background: "rgba(10,10,13,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>距峰值 </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#ffd49a", fontFamily: "var(--font-mono)" }}>
            {leftMin >= 0 ? `${leftMin} 分钟` : "已过"}
          </span>
        </div>
        <div style={{ padding: "7px 11px", borderRadius: 999, background: "rgba(10,10,13,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(255,255,255,0.75)" }}>
          ☀ {Math.round(sun.azimuthDeg)}° · 高 {sun.altitudeDeg.toFixed(1)}°{sunBelow ? " · 已日落" : ""}
        </div>
      </div>

      {/* 徽标 + 演示光点图例 */}
      <div style={{ position: "absolute", top: 140, left: 14, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ fontSize: 9.5, letterSpacing: 1.2, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono)" }}>3D 光影 · 太阳实时方位驱动</div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "#ff8a3d", boxShadow: "0 0 8px rgba(255,138,61,0.8)" }} />
          附近追光者（演示）
        </div>
      </div>

      {/* 底部：结论句(payload) + 机位切换 chips */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, padding: "0 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} data-swipe-lock="true">
          {spots.map((s) => {
            const active = (selectedSpotName || spots[0]?.name) === s.name;
            return (
              <button key={s.name} onClick={() => onSelectSpot?.(s.name)} style={{
                flexShrink: 0, padding: "7px 12px", borderRadius: 999,
                background: active ? "var(--accent)" : "rgba(255,255,255,0.08)",
                color: active ? "#1a0e08" : "rgba(255,255,255,0.85)",
                border: "1px solid " + (active ? "var(--accent)" : "rgba(255,255,255,0.12)"),
                fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
              }}>
                {s.name}{s.distance ? ` · ${s.distance.replace("步行 ", "")}` : ""}
              </button>
            );
          })}
        </div>
        <div style={{
          padding: "12px 14px", borderRadius: 18,
          background: "rgba(10,10,13,0.66)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginBottom: 3 }}>
            {rec.direction ? `往${rec.direction} · ` : ""}{rec.spot || "推荐机位"}{routeLoading ? " · 路线更新中…" : ""}
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff" }}>{conclusion}</div>
        </div>
      </div>
    </div>
  );
}
