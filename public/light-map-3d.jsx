// light-map-3d.jsx — P2 实时 3D 光影地图 v2（2026-07-13 八条整改版）
// ① 提亮：HemisphereLight + 微光模式亮度保底，信息永远可读
// ② 右上角路线缩略图悬浮窗（复用 MiniRouteThumbnail）→ 点击切经典快导航
// ③ 手势：单指/左键拖 = 平移；双指捏合 = 缩放；双指旋转 / Shift·右键拖 = 旋转；滚轮 = 缩放
// ④ 手机适配：Pointer 双指手势、dpr 钳制、容器自适应
// ⑤ 真实性：建筑 = OSM 真实轮廓挤出（assets/geo/*.json，ODbL）；太阳 = 真实方位/高度角；
//    路线 = OSRM 真实路网。区域外无 OSM 数据时回退示意体块并在 HUD 如实标注。
// ⑥ 演示光位：demo 场景且已日落 → 采用 18:40 黄金时刻光位并在 HUD 标注"演示光位"
// 数据真实性徽标常驻 HUD，不冒充。

// ── 工具 ──────────────────────────────────────────
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
function zgToLocal(lat, lng, origin) {
  const R = 6371000, rad = Math.PI / 180;
  return {
    x: (lng - origin.lng) * rad * R * Math.cos(origin.lat * rad),
    z: -(lat - origin.lat) * rad * R,
  };
}
function zgSunDir(azDeg, altDeg) {
  const az = azDeg * Math.PI / 180, alt = Math.max(altDeg, 0.5) * Math.PI / 180;
  return { x: Math.sin(az) * Math.cos(alt), y: Math.sin(alt), z: -Math.cos(az) * Math.cos(alt) };
}
const zgClamp = (v, a, b) => Math.min(b, Math.max(a, v));

// —— 追光主题光色：日照高度角 → 色卡（tokens 8 锚点语言）——
// 正午白金 → golden 金黄 → 日落橘红 → 峰值深红 → 暮光紫，锚点间线性插值。
// GL 版与 Three 版共用（本文件先于 light-map-gl.jsx 加载）。
const ZG_SUN_PALETTE = [
  { alt: -6, c: "#5A3870" },   // 暮光紫（夜幕）
  { alt: 0,  c: "#8A4068" },   // 消散紫红
  { alt: 3,  c: "#C84858" },   // 晚霞峰值深红
  { alt: 8,  c: "#DE6B48" },   // 日落橘红
  { alt: 16, c: "#E0A060" },   // Golden Hour 橘黄
  { alt: 30, c: "#EBC28E" },   // 暖金
  { alt: 55, c: "#F2E2C4" },   // 正午白金
];
function zgHexLerp(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const mix = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t);
  return "#" + ((mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).padStart(6, "0");
}
function zgSunPalette(altDeg) {
  const P = ZG_SUN_PALETTE;
  if (altDeg <= P[0].alt) return P[0].c;
  for (let i = 1; i < P.length; i++) {
    if (altDeg <= P[i].alt) {
      return zgHexLerp(P[i - 1].c, P[i].c, (altDeg - P[i - 1].alt) / (P[i].alt - P[i - 1].alt));
    }
  }
  return P[P.length - 1].c;
}
function zgMinutesFromClock(clock, fallback) {
  const m = typeof clock === "string" && clock.match(/(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : fallback;
}
function zgWalkMinutes(distanceText) {
  const m = /(\d+)/.exec(distanceText || "");
  return m ? +m[1] : 16;
}

// OSM 建筑数据缓存（一次拉取全局复用）
// 主数据包：26 战略分片（25 机位+南科大场地，scripts/fetch-shenzhen-buildings.mjs 产出）；旧南山片区包为回退。
let ZG_GEO_CACHE = null;
function zgLoadBuildings() {
  if (!ZG_GEO_CACHE) {
    ZG_GEO_CACHE = fetch("/assets/geo/shenzhen-buildings.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("miss"))))
      .catch(() => fetch("/assets/geo/shenzhen-nanshan-buildings.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return ZG_GEO_CACHE;
}

// ── 3D 场景 ───────────────────────────────────────
function zgBuildScene(canvas, params) {
  const { route, dest, sun, skyHex, chasers, reducedMotion, osmBuildings, origin } = params;
  const THREE = window.THREE;
  const W = canvas.clientWidth, H = canvas.clientHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(zgClamp(window.devicePixelRatio || 1, 1, 1.5));
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const lightHex = zgSunPalette(sun.altitudeDeg);
  const skyColor = new THREE.Color(skyHex || "#C84858");
  // ① 亮度保底：背景与雾从纯黑提到深蓝灰，天空色轻染
  const bgColor = new THREE.Color("#141824").lerp(skyColor, 0.12);
  scene.background = bgColor;
  scene.fog = new THREE.Fog(bgColor, 600, 2200);

  // 环境反射贴图：等距柱状天空渐变（地平线=主题光色，天顶=夜幕）→ 金属立面的反光内容
  {
    const ec = document.createElement("canvas"); ec.width = 512; ec.height = 256;
    const g = ec.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, "#07090f");
    grad.addColorStop(0.46, bgColor.getStyle());
    grad.addColorStop(0.54, lightHex);
    grad.addColorStop(0.58, zgHexLerp(lightHex, "#0c0f16", 0.7));
    grad.addColorStop(1.0, "#07090f");
    g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
    // 太阳亮斑（按方位角放在地平线上，反光里能看到光源位置）
    const sx = ((sun.azimuthDeg + 180) % 360) / 360 * 512;
    const rg = g.createRadialGradient(sx, 140, 4, sx, 140, 70);
    rg.addColorStop(0, "#fff3da"); rg.addColorStop(0.18, lightHex + ""); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 512, 256);
    const envTex = new THREE.CanvasTexture(ec);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    envTex.dispose(); pmrem.dispose();
  }

  const camera = new THREE.PerspectiveCamera(46, W / H, 1, 5000);

  // 地面（比 v1 亮两档）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: "#252b3a", roughness: 0.88, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(4000, 80, 0x2a3145, 0x1f2534);
  grid.position.y = 0.2;
  scene.add(grid);

  // 路线发光带（亮芯 + 光晕 + 流动脉冲点，让路线一眼可循）
  const pts = route.map((p) => new THREE.Vector3(p.x, 2.4, p.z));
  let routeLen = 0;
  for (let i = 1; i < pts.length; i++) routeLen += pts[i].distanceTo(pts[i - 1]);
  // 长路线自适应：雾距/远裁剪随路线长度伸展（南科大→塘朗山 4km+ 级路线不再被雾吞）
  scene.fog = new THREE.Fog(bgColor, Math.max(700, routeLen * 0.5), Math.max(2400, routeLen * 2.0));
  camera.far = Math.max(5000, routeLen * 4);
  camera.updateProjectionMatrix();
  const groundScale = Math.max(1, (routeLen * 3) / 4000);
  ground.scale.setScalar(groundScale);
  grid.scale.setScalar(groundScale);
  const tubeR = Math.max(3.2, routeLen / 380);           // 远视距下路线保持可见粗细
  let routeCurve = null;
  if (pts.length >= 2) {
    routeCurve = new THREE.CatmullRomCurve3(pts);
    const seg = Math.max(32, pts.length * 2);
    scene.add(new THREE.Mesh(
      new THREE.TubeGeometry(routeCurve, seg, tubeR, 8, false),
      new THREE.MeshBasicMaterial({ color: "#ffb26f", fog: false })
    ));
    scene.add(new THREE.Mesh(
      new THREE.TubeGeometry(routeCurve, seg, tubeR * 2.6, 8, false),
      new THREE.MeshBasicMaterial({ color: "#ff8a3d", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    ));
  }
  // 路线流动脉冲（方向感：从起点流向机位）
  const pulses = [];
  if (routeCurve && !reducedMotion) {
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(tubeR * 1.4, 10, 10), new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false }));
      scene.add(p);
      pulses.push({ mesh: p, offset: i / 3 });
    }
  }

  // 起点/终点
  const originDot = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 16), new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false }));
  originDot.position.set(pts[0]?.x || 0, 5, pts[0]?.z || 0);
  scene.add(originDot);
  const destPos = new THREE.Vector3(dest.x, 0, dest.z);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 6, 110, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: "#ffd49a", transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
  );
  beacon.position.set(destPos.x, 55, destPos.z);
  scene.add(beacon);
  const destDot = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), new THREE.MeshBasicMaterial({ color: "#ffd49a", fog: false }));
  destDot.position.set(destPos.x, 6, destPos.z);
  scene.add(destDot);

  // ⑤ 建筑：优先 OSM 真实轮廓挤出；区域无数据 → 示意体块（HUD 标注由 React 层负责）
  const mid = new THREE.Vector3((pts[0]?.x + destPos.x) / 2 || 0, 0, (pts[0]?.z + destPos.z) / 2 || 0);
  // 金属幕墙质感：高金属度+低粗糙度，反光内容来自天空 envMap（主题光色随高度角变化）
  const buildingMat = new THREE.MeshStandardMaterial({ color: "#6b7490", roughness: 0.42, metalness: 0.55, envMapIntensity: 0.8 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4a5470, transparent: true, opacity: 0.14 });
  let realCount = 0;
  if (osmBuildings && osmBuildings.length) {
    const RANGE = Math.max(routeLen * 0.9, 900);
    for (const b of osmBuildings) {
      // 质心筛选：只渲染路线走廊附近的
      let cx = 0, cz = 0;
      const local = b.p.map(([la, ln]) => zgToLocal(la, ln, origin));
      for (const q of local) { cx += q.x; cz += q.z; }
      cx /= local.length; cz /= local.length;
      if (Math.hypot(cx - mid.x, cz - mid.z) > RANGE) continue;
      try {
        const shape = new THREE.Shape(local.map((q) => new THREE.Vector2(q.x, -q.z)));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geo, buildingMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        // 亮边线：微光下仍能读出建筑轮廓（①信息保底）
        scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat));
        realCount++;
        if (realCount >= 420) break; // 手机性能上限
      } catch (e) { /* 个别退化多边形跳过 */ }
    }
  }
  if (realCount < 8) {
    // 回退示意体块（确定性伪随机，非真实——HUD 会标注"示意"）
    const rand = zgMulberry(zgHashSeed(params.seedKey || "zhuiguang"));
    const half = Math.max(routeLen, 400) * 0.7;
    for (let i = 0; i < 40; i++) {
      const w = 20 + rand() * 40, d = 20 + rand() * 40, hgt = 14 + Math.pow(rand(), 1.6) * 110;
      const bx = mid.x + (rand() * 2 - 1) * half, bz = mid.z + (rand() * 2 - 1) * half;
      let tooClose = false;
      for (let k = 0; k < pts.length; k += 2) {
        if (Math.hypot(pts[k].x - bx, pts[k].z - bz) < 40) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), buildingMat);
      box.position.set(bx, hgt / 2, bz);
      box.castShadow = true; box.receiveShadow = true;
      scene.add(box);
    }
  }

  // 光照：真实太阳方位/高度角（或演示光位）
  const dir = zgSunDir(sun.azimuthDeg, sun.altitudeDeg);
  const sunDist = Math.max(1100, routeLen * 1.1);
  const range2 = Math.max(routeLen * 0.9, 900);
  // 直射光=色卡向金偏 50%：高光金橘不发粉；氛围色仍由 envMap/半球光承载色卡本色
  const keyHex = zgHexLerp(lightHex, "#ffb46a", 0.5);
  const sunLight = new THREE.DirectionalLight(new THREE.Color(keyHex), sun.dim ? 0.85 : 2.1);
  sunLight.position.set(mid.x + dir.x * sunDist, dir.y * sunDist, mid.z + dir.z * sunDist);
  sunLight.target.position.copy(mid);
  scene.add(sunLight.target);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -range2; sc.right = range2; sc.top = range2; sc.bottom = -range2; sc.far = 3400;
  sc.updateProjectionMatrix();
  scene.add(sunLight);
  // ① 半球光 + 环境光：保证暗部信息可读（微光模式一样看得清路线/建筑/HUD）
  scene.add(new THREE.HemisphereLight(bgColor.clone().lerp(new THREE.Color(lightHex), 0.3), "#232838", sun.dim ? 1.05 : 0.5));
  scene.add(new THREE.AmbientLight("#3a4260", sun.dim ? 0.55 : 0.2));

  // 太阳盘 + 光晕
  const sunSprite = new THREE.Mesh(new THREE.SphereGeometry(42, 20, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(keyHex).lerp(new THREE.Color("#ffffff"), 0.25) }));
  sunSprite.position.copy(sunLight.position).sub(mid).multiplyScalar(0.72).add(mid);
  sunSprite.material.fog = false;
  scene.add(sunSprite);
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(130, 20, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(lightHex), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sunGlow.position.copy(sunSprite.position);
  scene.add(sunGlow);

  // 附近追光者（演示光点）
  const chaserMeshes = chasers.map((c) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 12), new THREE.MeshBasicMaterial({ color: "#ff8a3d", fog: false }));
    m.position.set(c.x, 4, c.z);
    scene.add(m);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(8.5, 12, 12), new THREE.MeshBasicMaterial({ color: "#ff8a3d", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.copy(m.position);
    scene.add(halo);
    return { m, halo, phase: Math.random() * Math.PI * 2 };
  });

  // 相机轨道 + 可平移 target（③）
  // 初始注视点取路线 30% 处（起点城区侧，建筑密度高），比几何中点更能展示建筑群
  const target = (routeCurve ? routeCurve.getPointAt(0.3) : mid).clone(); target.y = 0;
  // 视角偏太阳 60°：主题色受光面入画（正对太阳=全逆光剪影，看不到光色）
  const orbit = { theta: ((360 - sun.azimuthDeg + 60) * Math.PI) / 180, phi: Math.PI * 0.38, radius: zgClamp(routeLen * 0.7 || 600, 320, 2400) };
  function applyCamera() {
    const sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi);
    camera.position.set(
      target.x + orbit.radius * sp * Math.sin(orbit.theta),
      orbit.radius * cp,
      target.z + orbit.radius * sp * Math.cos(orbit.theta)
    );
    camera.lookAt(target.x, 10, target.z);
  }
  applyCamera();

  let raf = 0, idle = true, disposed = false;
  const clock = { t: 0 };
  function frame() {
    if (disposed) return;
    clock.t += 1 / 60;
    if (idle && !reducedMotion) orbit.theta += 0.0011;
    if (!reducedMotion) {
      chaserMeshes.forEach((c) => {
        const s = 1 + Math.sin(clock.t * 2.4 + c.phase) * 0.28;
        c.halo.scale.setScalar(s);
      });
      if (routeCurve) {
        pulses.forEach((p) => {
          const u = (clock.t * 0.06 + p.offset) % 1;
          const pos = routeCurve.getPointAt(u);
          p.mesh.position.set(pos.x, 4, pos.z);
        });
      }
      beacon.material.opacity = 0.32 + 0.1 * (1 + Math.sin(clock.t * 1.6)) / 2;
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
    // ③ 平移：屏幕位移 → 地面位移（跟随相机朝向）
    pan(dx, dy) {
      const k = orbit.radius / H * 1.15;
      const sinT = Math.sin(orbit.theta), cosT = Math.cos(orbit.theta);
      // 相机右方向（地面投影）与前方向
      target.x -= (dx * cosT - dy * sinT) * k;
      target.z += (dx * sinT + dy * cosT) * k;
      const LIM = Math.max(routeLen, 600) * 1.4;
      target.x = zgClamp(target.x, mid.x - LIM, mid.x + LIM);
      target.z = zgClamp(target.z, mid.z - LIM, mid.z + LIM);
    },
    zoom(f) { orbit.radius = zgClamp(orbit.radius * f, 200, 2400); },
    realCount,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    },
  };
}

// ── React 组件 ─────────────────────────────────────
function Scene3DLightMap({ sunsetPayload, routeData, routeLoading = false, selectedSpotName, onSelectSpot, onSwitchClassic }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [geoInfo, setGeoInfo] = useState(null); // {realCount} | {realCount:0}

  const rec = sunsetPayload?.recommendation || {};
  const meta = sunsetPayload?.meta || {};
  const sunRaw = meta.sun?.current || { altitudeDeg: 8, azimuthDeg: 270 };
  const origin = meta.coordinates || { lat: 22.4867, lng: 113.9385 };
  const destLL = rec.coordinates || { lat: origin.lat + 0.006, lng: origin.lng - 0.01 };

  // ⑥ 演示光位：demo/兜底场景一律用黄金时刻光位（预设晚霞卡配正午顶光/夜晚黑屏都错乱，HUD 如实标注）；
  //    live 实时场景才用真实太阳（已日落→微光模式但亮度保底）。
  const isDemoData = /demo|fallback/.test(meta.source || "");
  const sunBelow = sunRaw.altitudeDeg <= 0;
  const demoSun = isDemoData;
  const sun = demoSun
    ? { azimuthDeg: 283, altitudeDeg: 7, dim: false }
    : { azimuthDeg: sunRaw.azimuthDeg, altitudeDeg: sunRaw.altitudeDeg, dim: sunBelow };

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
      : `步行 ${walkMin} 分钟 · 到时峰值已过 ${etaMin - peakMin} 分钟 · 抓紧`;

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

    let cancelled = false;
    let engine = null;
    let cleanupFns = [];

    zgLoadBuildings().then((geo) => {
      if (cancelled || !canvas.isConnected) return;

      const geoRoute = routeData?.geometry?.length >= 2
        ? routeData.geometry
        : [{ lat: origin.lat, lng: origin.lng }, { lat: destLL.lat, lng: destLL.lng }];
      const route = geoRoute.map((p) => zgToLocal(p.lat, p.lng, origin));
      const dest = zgToLocal(destLL.lat, destLL.lng, origin);

      const rand = zgMulberry(zgHashSeed(rec.spot || "chasers"));
      const chasers = Array.from({ length: 4 }, () => {
        const base = route[Math.floor(rand() * route.length)] || dest;
        return { x: base.x + (rand() * 2 - 1) * 130, z: base.z + (rand() * 2 - 1) * 130 };
      });

      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      try {
        engine = zgBuildScene(canvas, {
          route, dest, sun, origin,
          skyHex: demoSun ? "#DE6B48" : sunsetPayload?.currentSkyColor, // 演示光位配日落橘红天色
          chasers, reducedMotion,
          osmBuildings: geo?.buildings || null,
          seedKey: `${rec.spot || "zg"}·${meta.city || ""}`,
        });
      } catch (e) {
        console.warn("[LIGHTCHASER] 3D scene failed, fallback to classic route.", e);
        setFailed(true);
        return;
      }
      engineRef.current = engine;
      setGeoInfo({ realCount: engine.realCount });

      // ③④ 手势：Pointer 统一处理（鼠标+触屏），单指=平移 / Shift·右键=旋转 / 双指=捏合缩放+旋转
      const pointers = new Map();
      let lastPinch = null; // {dist, angle}
      let idleTimer = 0;
      function wake() {
        engine.setIdle(false);
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => engine.setIdle(true), 3000);
      }
      function onDown(e) {
        canvas.setPointerCapture?.(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey });
        lastPinch = null;
        wake();
      }
      function onMove(e) {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        if (pointers.size === 2) {
          // 双指：捏合缩放 + 旋转
          pointers.set(e.pointerId, { ...p, x: e.clientX, y: e.clientY });
          const [a, b] = [...pointers.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          if (lastPinch) {
            engine.zoom(lastPinch.dist / Math.max(dist, 1));
            engine.rotate((angle - lastPinch.angle) * 140, 0);
          }
          lastPinch = { dist, angle };
        } else {
          const dx = e.clientX - p.x, dy = e.clientY - p.y;
          if (p.shift || p.btn === 2) engine.rotate(dx, dy);   // Shift/右键 = 旋转
          else engine.pan(dx, dy);                              // 单指/左键 = 平移
          pointers.set(e.pointerId, { ...p, x: e.clientX, y: e.clientY });
        }
        wake();
        if (e.cancelable) e.preventDefault();
      }
      function onUp(e) { pointers.delete(e.pointerId); lastPinch = null; }
      function onWheel(e) { engine.zoom(e.deltaY > 0 ? 1.08 : 0.925); wake(); e.preventDefault(); }
      function onCtx(e) { e.preventDefault(); }
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("contextmenu", onCtx);
      canvas.style.touchAction = "none"; // ④ 触屏手势全权接管
      cleanupFns.push(() => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("contextmenu", onCtx);
        clearTimeout(idleTimer);
      });
    });

    return () => {
      cancelled = true;
      cleanupFns.forEach((f) => f());
      if (engineRef.current) { engineRef.current.dispose(); engineRef.current = null; }
    };
  }, [
    sun.azimuthDeg, sun.altitudeDeg,
    destLL.lat, destLL.lng,
    routeData?.geometry?.length,
    sunsetPayload?.currentSkyColor,
    rec.spot,
  ]);

  if (failed && typeof SceneRoute === "function") {
    return <SceneRoute sunsetPayload={sunsetPayload} routeData={routeData} routeLoading={routeLoading} selectedSpotName={selectedSpotName} onSelectSpot={onSelectSpot} />;
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#141824" }}>
      <canvas ref={canvasRef} data-swipe-lock="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "grab" }} />

      {/* 顶部 HUD：倒计时 + 太阳读数 */}
      <div style={{ position: "absolute", top: 96, left: 14, right: 14, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
        <div style={{ padding: "7px 13px", borderRadius: 999, background: "rgba(14,17,26,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>距峰值 </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#ffd49a", fontFamily: "var(--font-mono)" }}>
            {leftMin >= 0 ? `${leftMin} 分钟` : "已过"}
          </span>
        </div>
        <div style={{ padding: "7px 11px", borderRadius: 999, background: "rgba(14,17,26,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(255,255,255,0.8)" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: zgSunPalette(sun.altitudeDeg), marginRight: 5, boxShadow: "0 0 6px " + zgSunPalette(sun.altitudeDeg), verticalAlign: "middle" }} />☀ {Math.round(sun.azimuthDeg)}° · 高 {sun.altitudeDeg.toFixed(1)}°{demoSun ? " · 演示光位18:40" : sunBelow ? " · 已日落" : ""}
        </div>
      </div>

      {/* ② 右上角：路线缩略图悬浮窗 → 点击进经典快导航 */}
      <button
        type="button"
        onClick={() => onSwitchClassic?.()}
        aria-label="切换到快导航"
        style={{
          position: "absolute", top: 136, right: 14, zIndex: 6,
          padding: 4, borderRadius: 16, cursor: "pointer",
          background: "rgba(14,17,26,0.72)", backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,138,61,0.4)",
          boxShadow: "0 0 16px rgba(255,138,61,0.18)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        }}>
        {typeof MiniRouteThumbnail === "function"
          ? <MiniRouteThumbnail routeData={routeData} sunsetPayload={sunsetPayload} />
          : <span style={{ fontSize: 20 }}>🗺</span>}
        <span style={{ fontSize: 8.5, color: "#ffb26f", letterSpacing: 1 }}>快导航</span>
      </button>

      {/* 数据真实性徽标 + 演示光点图例（⑤ 诚实标注） */}
      <div style={{ position: "absolute", top: 140, left: 14, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ fontSize: 9.5, letterSpacing: 1.1, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono)" }}>
          太阳·实时方位 ｜ 路线·真实路网
        </div>
        <div style={{ fontSize: 9.5, letterSpacing: 1.1, color: geoInfo?.realCount >= 8 ? "#8fd9a8" : "rgba(255,255,255,0.45)", fontFamily: "var(--font-mono)" }}>
          {geoInfo == null ? "建筑·载入中…" : geoInfo.realCount >= 8 ? `建筑·OSM实测 ${geoInfo.realCount} 栋` : "建筑·示意体块(该区域无OSM数据)"}
        </div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "#ff8a3d", boxShadow: "0 0 8px rgba(255,138,61,0.8)" }} />
          附近追光者（演示）
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
          单指移动 · 双指缩放旋转{typeof window !== "undefined" && !("ontouchstart" in window) ? " · Shift拖=旋转" : ""}
        </div>
      </div>

      {/* 底部：结论句 + 机位切换（此区不锁滑动 = 换页通道） */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, padding: "0 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} data-swipe-lock="true">
          {spots.map((s) => {
            const active = (selectedSpotName || spots[0]?.name) === s.name;
            return (
              <button key={s.name} onClick={() => onSelectSpot?.(s.name)} style={{
                flexShrink: 0, padding: "7px 12px", borderRadius: 999,
                background: active ? "var(--accent)" : "rgba(255,255,255,0.1)",
                color: active ? "#1a0e08" : "rgba(255,255,255,0.88)",
                border: "1px solid " + (active ? "var(--accent)" : "rgba(255,255,255,0.14)"),
                fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
              }}>
                {s.name}{s.distance ? ` · ${s.distance.replace("步行 ", "")}` : ""}
              </button>
            );
          })}
        </div>
        <div style={{
          padding: "12px 14px", borderRadius: 18,
          background: "rgba(14,17,26,0.74)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginBottom: 3 }}>
            {rec.direction ? `往${rec.direction} · ` : ""}{rec.spot || "推荐机位"}{routeLoading ? " · 路线更新中…" : ""}
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff" }}>{conclusion}</div>
        </div>
      </div>
    </div>
  );
}
