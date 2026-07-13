// light-map-gl.jsx — P2 光影地图 GL 版（MapLibre GL · 2026-07-13）
// 定位（第一性原理 F2）：原型参照物——演示"完整道路 + 真实建筑 + 太阳光照"的体验意图；
//   平台迁移三档预案见 page_specs.md P2（A 自定义web运行时直迁 / B 平台地图组件+光位罗盘 / C 录屏内嵌+2D交互）。
// 引擎：MapLibre GL（BSD, vendored）。数据：OpenFreeMap 矢量瓦片（OSM, ODbL）——
//   道路/建筑/水系/地名全量真实；建筑 3D 由 render_height 挤出；光照方向 = 真实/演示太阳方位角。
// 手势（原生）：拖=平移 · 滚轮/双指捏合=缩放 · 右键或Ctrl拖/双指旋转=旋转与俯仰。
// 兜底链：GL(在线瓦片) → Three 自研(离线) → 经典 2D。

const ZG_GL_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// —— 颜色工具：把任意 hex/hsl 字符串压暗成夜幕蓝调（style 程序化暗化）——
function zgParseColor(str) {
  if (typeof str !== "string") return null;
  let m = str.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return zgRgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  m = str.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return zgRgbToHsl(r, g, b);
  }
  m = str.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i);
  if (m) return { h: +m[1], s: +m[2] / 100, l: +m[3] / 100 };
  m = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return zgRgbToHsl(+m[1], +m[2], +m[3]);
  return null;
}
function zgRgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}
const zgHsl = (c) => `hsl(${Math.round(c.h)}, ${Math.round(c.s * 100)}%, ${Math.round(c.l * 100)}%)`;

// 逐层暗化 liberty 样式 → 追光夜幕调（道路保持可读的亮度层级）
// v2 修复（用户三图实证）：①删原生 fill-extrusion（曾与我们的建筑层叠两套，表达式色漏暗化成橙红块）
// ②表达式颜色不再跳过——按类别强制压为固定暗色（绿地墨绿块/医院粉紫块的根源）
// ③字号保底跳过带 icon 的层（曾把 Y301 路牌盾徽撑爆成白块）
// v3（用户二图实证）：④ 废除通用混色公式——绿色混成深青、品红混成紫的总根源；
//   改为**确定性调色板**：每类图层给死颜色，无论原色是字符串还是表达式，零意外。
//   ⑤ viewport 对齐只给点状地名——沿线道路标签保持贴线（曾致 "xia...ou...ard Side" 叠字乱码）。
function zgDarkenStyle(style) {
  const key2 = (ly) => `${ly.id} ${ly["source-layer"] || ""}`;
  const isRoadish = (ly) => /transportation|road|bridge|tunnel|path|aeroway/.test(key2(ly));
  const isWater = (ly) => /water/.test(key2(ly));
  const isGreen = (ly) => /landcover|park|grass|wood|forest|vegetation|golf|cemetery|scrub|meadow/.test(key2(ly));
  const isBuilding = (ly) => /building/.test(key2(ly));
  // ① 原生 3D 建筑层整层移除——3D 建筑只保留我们统一光照的 zg-3d-buildings
  style.layers = (style.layers || []).filter((ly) => ly.type !== "fill-extrusion");
  for (const ly of style.layers) {
    const paint = ly.paint || {};
    if (ly.type === "background") { paint["background-color"] = "#141824"; ly.paint = paint; continue; }
    if (ly.type === "symbol") {
      const lay = ly.layout || {};
      const hasIcon = !!lay["icon-image"];
      const linePlaced = lay["symbol-placement"] === "line" || lay["symbol-placement"] === "line-center";
      // ⑤ 屏幕对齐只给点状地名；道路名等沿线标签保持贴线，否则字母堆叠乱码
      if (!linePlaced) {
        lay["text-pitch-alignment"] = "viewport";
        lay["text-rotation-alignment"] = "viewport";
      }
      // ③ 字号保底只给纯文字点状层——路牌盾徽(icon+ref)不动
      if (!hasIcon && !linePlaced && typeof lay["text-size"] === "number" && lay["text-size"] < 12) lay["text-size"] = 12.5;
      // ⑦ POI/站点减密度（图四：某些角度标签与楼穿插堆叠）：
      //    小 POI 提高出现门槛 + 碰撞留白加大 + 字放不下就只显图标
      if (/poi|station|transit|bus|aerodrome|housenum/i.test(key2(ly))) {
        ly.minzoom = Math.max(ly.minzoom || 0, /housenum/i.test(ly.id) ? 17 : 15.4);
        lay["text-padding"] = 6;
        if (hasIcon) lay["text-optional"] = true;
      }
      ly.layout = lay;
    }
    for (const key of Object.keys(paint)) {
      if (!/-color$/.test(key)) continue;
      if (key === "text-color") { paint[key] = "#c0c8dd"; continue; }
      if (key === "text-halo-color") { paint[key] = "#0d1017"; paint["text-halo-width"] = 1.4; continue; }
      // ④ 确定性调色板：按类别给死，不做任何原色换算
      if (isWater(ly)) { paint[key] = "#17203a"; continue; }
      if (isGreen(ly)) { paint[key] = "#1a2230"; continue; }
      if (isBuilding(ly)) { paint[key] = "#1e2536"; continue; }
      if (ly.type === "line") {
        if (isRoadish(ly)) {
          const major = /motorway|trunk|primary/.test(ly.id);
          paint[key] = major ? "#5d6884" : "#3b4560";
        } else {
          paint[key] = "#242d44";
        }
        continue;
      }
      if (ly.type === "fill") { paint[key] = "#161d2c"; continue; }
      if (ly.type === "circle") { paint[key] = "#3a4358"; continue; }
      paint[key] = "#1c2333";
    }
    ly.paint = paint;
  }
  return style;
}

function zgFmtClock(min) {
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// ═══ Three.js 建筑渲染层（MapLibre CustomLayerInterface 官方模式）═══
// fill-extrusion 无面级光照/无阴影/无反射——三点都是用户实拍指出的缺失。
// 本层接管近景建筑：DirectionalLight(方向=太阳) 给每面真实受光/背光，
// castShadow 给楼间投影（影子落在地图路面上），envMap+metalness 给金属反光。
// 数据 = 离线包 shenzhen-buildings.json（14k 栋，走廊筛选）；远景仍由暗剪影 extrusion 兜底。
function zgMakeThreeBuildingsLayer({ originLL, sun, buildings, centerXZ, rangeM, lightHex }) {
  const THREE = window.THREE;
  const merc = maplibregl.MercatorCoordinate.fromLngLat([originLL.lng, originLL.lat], 0);
  const mScale = merc.meterInMercatorCoordinateUnits();

  let camera, scene, renderer;
  return {
    id: "zg-three-buildings",
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // 相机同步矩阵（官方 3D model 示例同款：平移到参考点 + 米级缩放 + Y-up 翻转）
      this._modelMatrix = new THREE.Matrix4()
        .makeTranslation(merc.x, merc.y, merc.z)
        .scale(new THREE.Vector3(mScale, -mScale, mScale))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // envMap：天空渐变 + 太阳亮斑 → 金属立面的反光内容
      {
        const ec = document.createElement("canvas"); ec.width = 512; ec.height = 256;
        const g2 = ec.getContext("2d");
        const grad = g2.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, "#07090f");
        grad.addColorStop(0.47, "#141b2c");
        grad.addColorStop(0.54, lightHex);
        grad.addColorStop(0.6, "#0c0f16");
        grad.addColorStop(1, "#07090f");
        g2.fillStyle = grad; g2.fillRect(0, 0, 512, 256);
        const sx = ((sun.azimuthDeg + 180) % 360) / 360 * 512;
        const rg = g2.createRadialGradient(sx, 138, 4, sx, 138, 64);
        rg.addColorStop(0, "#fff3da"); rg.addColorStop(0.2, lightHex); rg.addColorStop(1, "rgba(0,0,0,0)");
        g2.fillStyle = rg; g2.fillRect(0, 0, 512, 256);
        const envTex = new THREE.CanvasTexture(ec);
        envTex.mapping = THREE.EquirectangularReflectionMapping;
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromEquirectangular(envTex).texture;
        envTex.dispose(); pmrem.dispose();
      }

      // 建筑合批：走廊内全部楼合成一个 BufferGeometry（单 mesh，阴影一次搞定）
      const geoms = [];
      let count = 0;
      for (const b of buildings) {
        let cx = 0, cz = 0;
        const local = b.p.map(([la, ln]) => zgToLocal(la, ln, originLL));
        for (const q of local) { cx += q.x; cz += q.z; }
        cx /= local.length; cz /= local.length;
        if (Math.hypot(cx - centerXZ.x, cz - centerXZ.z) > rangeM) continue;
        try {
          const shape = new THREE.Shape(local.map((q) => new THREE.Vector2(q.x, -q.z)));
          const g3 = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
          g3.rotateX(-Math.PI / 2);
          geoms.push(g3);
          if (++count >= 800) break;
        } catch (e) { /* 退化多边形跳过 */ }
      }
      if (geoms.length) {
        // r128 内置 BufferGeometryUtils 不在核心——手动合并
        let totalPos = 0;
        const gs = geoms.map((g) => g.toNonIndexed());
        for (const g of gs) totalPos += g.attributes.position.count;
        const pos = new Float32Array(totalPos * 3);
        const nor = new Float32Array(totalPos * 3);
        let off = 0;
        for (const g of gs) {
          pos.set(g.attributes.position.array, off * 3);
          nor.set(g.attributes.normal.array, off * 3);
          off += g.attributes.position.count;
          g.dispose();
        }
        const merged = new THREE.BufferGeometry();
        merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        // 金属幕墙：受光面吃 keyLight、侧面吃 envMap 反光、背光面回落深色
        const mat = new THREE.MeshStandardMaterial({ color: "#6d7894", metalness: 0.7, roughness: 0.34, envMapIntensity: 0.8 });
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        this._count = count;
      }

      // 接影地面：透明 ShadowMaterial——楼影直接落在地图路面上
      const shadowGround = new THREE.Mesh(
        new THREE.PlaneGeometry(rangeM * 3, rangeM * 3),
        new THREE.ShadowMaterial({ opacity: 0.42 })
      );
      shadowGround.rotation.x = -Math.PI / 2;
      shadowGround.position.set(centerXZ.x, 0.5, centerXZ.z);
      shadowGround.receiveShadow = true;
      scene.add(shadowGround);

      // 太阳平行光：方向=真实/演示方位角+高度角（受光面/背光面由此天然分明）
      const keyHex = zgHexLerp(lightHex, "#ffd9ac", 0.6);
      const dir = zgSunDir(sun.azimuthDeg, Math.max(sun.altitudeDeg, 2));
      const sunLight = new THREE.DirectionalLight(new THREE.Color(keyHex), 1.7);
      const d = rangeM * 1.6;
      sunLight.position.set(centerXZ.x + dir.x * d, dir.y * d, centerXZ.z + dir.z * d);
      sunLight.target.position.set(centerXZ.x, 0, centerXZ.z);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      const sc = sunLight.shadow.camera;
      sc.left = -rangeM; sc.right = rangeM; sc.top = rangeM; sc.bottom = -rangeM; sc.far = d * 2.5;
      sc.updateProjectionMatrix();
      scene.add(sunLight); scene.add(sunLight.target);
      scene.add(new THREE.HemisphereLight("#2c3450", "#191d29", 0.5));
      scene.add(new THREE.AmbientLight("#333c58", 0.35));
      this._map = map;
    },
    render(gl, matrix) {
      if (!renderer) return;
      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(this._modelMatrix);
      renderer.state.reset();
      renderer.render(scene, camera);
    },
    onRemove() {
      if (scene) scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      renderer = null;
    },
  };
}

function SceneLightMapGL({ sunsetPayload, routeData, routeLoading = false, selectedSpotName, onSelectSpot, onSwitchClassic }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const [mode, setMode] = useState(window.maplibregl ? "gl" : "three"); // gl | three
  const [tilesOk, setTilesOk] = useState(null); // null 加载中 | true | false

  const rec = sunsetPayload?.recommendation || {};
  const meta = sunsetPayload?.meta || {};
  const sunRaw = meta.sun?.current || { altitudeDeg: 8, azimuthDeg: 270 };
  const origin = meta.coordinates || { lat: 22.5956, lng: 113.9956 };
  const destLL = rec.coordinates || { lat: origin.lat + 0.006, lng: origin.lng - 0.01 };

  const isDemoData = /demo|fallback/.test(meta.source || "");
  const sunBelow = sunRaw.altitudeDeg <= 0;
  const demoSun = isDemoData;
  const sun = demoSun
    ? { azimuthDeg: 283, altitudeDeg: 7 }
    : { azimuthDeg: sunRaw.azimuthDeg, altitudeDeg: sunRaw.altitudeDeg };

  const peak = sunsetPayload?.peakTime || "18:15";
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const peakMin = (peak.match(/(\d{1,2}):(\d{2})/) || []).slice(1).reduce((h, m) => +h * 60 + +m, 0) || 18 * 60 + 15;
  const walkMin = +(/(\d+)/.exec(rec.distance || "")?.[1] || 16);
  const etaMin = nowMin + walkMin;
  const leftMin = peakMin - nowMin;
  const conclusion = leftMin < 0
    ? "今晚已过峰值 · 明晚黄金时刻见"
    : etaMin <= peakMin
      ? `步行 ${walkMin} 分钟 · ${zgFmtClock(etaMin)} 到 · 正好赶上`
      : `步行 ${walkMin} 分钟 · 到时峰值已过 ${etaMin - peakMin} 分钟 · 抓紧`;

  const spots = sunsetPayload
    ? [{ name: rec.spot, coordinates: rec.coordinates, distance: rec.distance },
       ...(sunsetPayload.nearbySpots || [])]
        .filter((s, i, l) => s?.name && l.findIndex((x) => x?.name === s.name) === i)
        .slice(0, 4)
    : [];

  useEffect(() => {
    if (mode !== "gl" || !boxRef.current || !window.maplibregl) return undefined;
    let disposed = false;
    let map = null;
    let raf = 0, idleTimer = 0, rotating = true;
    const markers = [];

    const routeLL = (routeData?.geometry?.length >= 2
      ? routeData.geometry
      : [{ lat: origin.lat, lng: origin.lng }, { lat: destLL.lat, lng: destLL.lng }]
    ).map((p) => [p.lng, p.lat]);

    // 9s 内样式未就绪 → 判离线，降级 Three
    const failTimer = setTimeout(() => { if (!disposed && !map?.loaded()) { setTilesOk(false); setMode("three"); } }, 9000);

    fetch(ZG_GL_STYLE_URL, { signal: AbortSignal.timeout(8000) })
      .then((r) => r.json())
      .then((style) => {
        if (disposed) return;
        style = zgDarkenStyle(style);

        map = new maplibregl.Map({
          container: boxRef.current,
          style,
          center: routeLL[Math.floor(routeLL.length / 2)],
          zoom: 14.2,
          pitch: 62,
          bearing: sun.azimuthDeg - 60, // 偏太阳60°：受光面(主题色)入画
          attributionControl: { compact: true }, // OSM/ODbL 署名保留（红线）
          maxPitch: 70,
        });
        mapRef.current = map;
        map.touchPitch.enable();

        map.on("load", () => {
          if (disposed) return;
          clearTimeout(failTimer);
          setTilesOk(true);

          // 光照：方向 = 真实/演示太阳方位角+高度角（anchor=map 随旋转保持地理正确）。
          // 光色用暖白——彩色光与底色相乘会产生不可控怪色（青/紫块的另一来源）；
          // 主题色改由建筑自身的"金属高度渐变"与天际光晕承载。
          map.setLight({
            anchor: "map",
            color: "#ffe3c4",
            intensity: 0.55,
            position: [1.5, sun.azimuthDeg, Math.min(88, 90 - sun.altitudeDeg)],
          });

          // 远景建筑：暗剪影 extrusion（只做背景轮廓）；近景真光影由 Three 自定义层接管
          if (!map.getLayer("zg-3d-buildings")) {
            map.addLayer({
              id: "zg-3d-buildings",
              type: "fill-extrusion",
              source: "openmaptiles",
              "source-layer": "building",
              minzoom: 12.5,
              paint: {
                "fill-extrusion-color": "#1d2436",
                "fill-extrusion-height": ["coalesce", ["get", "render_height"], 12],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": 0.62,
                "fill-extrusion-vertical-gradient": true,
              },
            });
          }

          // 近景建筑 = Three 自定义层：面级受光/背光 + 楼间投影 + envMap 金属反光
          if (window.THREE && typeof zgLoadBuildings === "function") {
            zgLoadBuildings().then((geo) => {
              if (disposed || !geo?.buildings?.length || map.getLayer("zg-three-buildings")) return;
              const destLocal = zgToLocal(destLL.lat, destLL.lng, origin);
              const centerXZ = { x: destLocal.x / 2, z: destLocal.z / 2 };
              const spanM = Math.hypot(destLocal.x, destLocal.z);
              try {
                map.addLayer(zgMakeThreeBuildingsLayer({
                  originLL: origin,
                  sun,
                  buildings: geo.buildings,
                  centerXZ,
                  rangeM: Math.max(1300, spanM * 0.9),
                  lightHex: zgSunPalette(sun.altitudeDeg),
                }));
              } catch (e) { console.warn("[LIGHTCHASER] three buildings layer failed:", e); }
            });
          }

          // 路线：光晕 + 亮芯 + 流动脉冲
          map.addSource("zg-route", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: routeLL } } });
          map.addLayer({ id: "zg-route-glow", type: "line", source: "zg-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ff8a3d", "line-width": 16, "line-blur": 8, "line-opacity": 0.5 } });
          map.addLayer({ id: "zg-route-core", type: "line", source: "zg-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffd49a", "line-width": 4.5 } });
          map.addSource("zg-pulse", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "zg-pulse", type: "circle", source: "zg-pulse", paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-blur": 0.35 } });

          // 起点 / 机位信标 / 附近追光者（演示）
          const mk = (lngLat, html) => {
            const el = document.createElement("div");
            el.innerHTML = html;
            const m = new maplibregl.Marker({ element: el.firstElementChild, anchor: "center" }).setLngLat(lngLat).addTo(map);
            markers.push(m);
          };
          mk(routeLL[0], '<div style="width:14px;height:14px;border-radius:99px;background:#fff;border:3px solid rgba(255,255,255,0.35);box-shadow:0 0 10px rgba(255,255,255,0.8)"></div>');
          const spotShort = (rec.spot || "机位").split("·").pop().trim();
          mk(routeLL[routeLL.length - 1], '<div style="display:flex;flex-direction:column;align-items:center;gap:3px"><div style="width:16px;height:16px;border-radius:99px;background:#ffd49a;box-shadow:0 0 18px rgba(255,212,154,0.95)"></div><div style="font-size:11px;font-weight:700;color:#ffd49a;background:rgba(14,17,26,0.82);padding:3px 9px;border-radius:99px;border:1px solid rgba(255,212,154,0.45);white-space:nowrap;box-shadow:0 0 10px rgba(0,0,0,0.6)">📍 ' + spotShort + '</div></div>');
          // 演示光点（确定性散布在路线周边）
          const seedRand = (function (a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(20260713);
          for (let i = 0; i < 4; i++) {
            const base = routeLL[Math.floor(seedRand() * routeLL.length)];
            mk([base[0] + (seedRand() - 0.5) * 0.004, base[1] + (seedRand() - 0.5) * 0.004],
              '<div class="zg-chaser" style="width:10px;height:10px;border-radius:99px;background:#ff8a3d;box-shadow:0 0 12px rgba(255,138,61,0.9)"></div>');
          }

          // 视野适配路线
          const b = routeLL.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(routeLL[0], routeLL[0]));
          map.fitBounds(b, { padding: { top: 190, bottom: 230, left: 70, right: 70 }, pitch: 62, bearing: sun.azimuthDeg - 60, duration: 900 });

          // 路线脉冲动画 + 闲置慢旋转
          const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
          const cum = [0];
          for (let i = 1; i < routeLL.length; i++) {
            const [x1, y1] = routeLL[i - 1], [x2, y2] = routeLL[i];
            cum.push(cum[i - 1] + Math.hypot((x2 - x1) * Math.cos(y1 * Math.PI / 180), y2 - y1));
          }
          const total = cum[cum.length - 1] || 1;
          const at = (t) => {
            const d = t * total;
            let i = cum.findIndex((c) => c >= d);
            if (i <= 0) i = 1;
            const f = (d - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-9);
            return [routeLL[i - 1][0] + (routeLL[i][0] - routeLL[i - 1][0]) * f, routeLL[i - 1][1] + (routeLL[i][1] - routeLL[i - 1][1]) * f];
          };
          let t0 = 0;
          function frame() {
            if (disposed) return;
            t0 += 1 / 60;
            if (!reducedMotion && map.getSource("zg-pulse")) {
              map.getSource("zg-pulse").setData({
                type: "FeatureCollection",
                features: [0, 0.5].map((off) => ({ type: "Feature", geometry: { type: "Point", coordinates: at((t0 * 0.045 + off) % 1) } })),
              });
            }
            if (rotating && !reducedMotion) map.setBearing(map.getBearing() + 0.018);
            raf = requestAnimationFrame(frame);
          }
          frame();

          const wake = () => {
            rotating = false;
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => { rotating = true; }, 4000);
          };
          ["mousedown", "touchstart", "wheel"].forEach((ev) => map.getCanvas().addEventListener(ev, wake, { passive: true }));
        });

        map.on("error", (e) => {
          // 样式级致命错误（瓦片单片 404 不算）→ 降级
          if (!map.loaded() && /style|source/i.test(String(e?.error?.message || ""))) {
            setTilesOk(false); setMode("three");
          }
        });
      })
      .catch(() => { if (!disposed) { setTilesOk(false); setMode("three"); } });

    return () => {
      disposed = true;
      clearTimeout(failTimer); clearTimeout(idleTimer);
      cancelAnimationFrame(raf);
      markers.forEach((m) => m.remove());
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [mode, destLL.lat, destLL.lng, routeData?.geometry?.length, sun.azimuthDeg, sun.altitudeDeg, rec.spot]);

  // 离线/无引擎 → Three 自研版（its own fallback → classic）
  if (mode === "three" && typeof Scene3DLightMap === "function") {
    return <Scene3DLightMap sunsetPayload={sunsetPayload} routeData={routeData} routeLoading={routeLoading} selectedSpotName={selectedSpotName} onSelectSpot={onSelectSpot} onSwitchClassic={onSwitchClassic} />;
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#141824" }}>
      <div ref={boxRef} data-swipe-lock="true" style={{ position: "absolute", inset: 0 }} />
      {/* 天际光晕（俯仰时的日落氛围层） */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30%", pointerEvents: "none", background: `linear-gradient(180deg, ${zgSunPalette(sun.altitudeDeg)}52 0%, transparent 100%)` }} />
      <style>{`@keyframes zgChaserPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.6}} .zg-chaser{animation:zgChaserPulse 2.2s ease-in-out infinite}`}</style>

      {/* 顶部 HUD */}
      <div style={{ position: "absolute", top: 96, left: 14, right: 14, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
        <div style={{ padding: "7px 13px", borderRadius: 999, background: "rgba(14,17,26,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>距峰值 </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#ffd49a", fontFamily: "var(--font-mono)" }}>{leftMin >= 0 ? `${leftMin} 分钟` : "已过"}</span>
        </div>
        <div style={{ padding: "7px 11px", borderRadius: 999, background: "rgba(14,17,26,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(255,255,255,0.8)" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: zgSunPalette(sun.altitudeDeg), marginRight: 5, boxShadow: "0 0 6px " + zgSunPalette(sun.altitudeDeg), verticalAlign: "middle" }} />☀ {Math.round(sun.azimuthDeg)}° · 高 {sun.altitudeDeg.toFixed(1)}°{demoSun ? " · 演示光位18:40" : sunBelow ? " · 已日落" : ""}
        </div>
      </div>

      {/* 快导航缩略图 */}
      <button type="button" onClick={() => onSwitchClassic?.()} aria-label="切换到快导航"
        style={{ position: "absolute", top: 136, right: 14, zIndex: 6, padding: 4, borderRadius: 16, cursor: "pointer", background: "rgba(14,17,26,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,138,61,0.4)", boxShadow: "0 0 16px rgba(255,138,61,0.18)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        {typeof MiniRouteThumbnail === "function" ? <MiniRouteThumbnail routeData={routeData} sunsetPayload={sunsetPayload} /> : <span style={{ fontSize: 20 }}>🗺</span>}
        <span style={{ fontSize: 8.5, color: "#ffb26f", letterSpacing: 1 }}>快导航</span>
      </button>

      {/* 真实性徽标 */}
      <div style={{ position: "absolute", top: 140, left: 14, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ fontSize: 9.5, letterSpacing: 1.1, color: "#8fd9a8", fontFamily: "var(--font-mono)" }}>
          {tilesOk == null ? "地图·载入中…" : "道路·建筑·OSM 实时瓦片"}
        </div>
        <div style={{ fontSize: 9.5, letterSpacing: 1.1, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono)" }}>
          太阳·{demoSun ? "演示光位" : "实时方位"} ｜ 路线·真实路网
        </div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "#ff8a3d", boxShadow: "0 0 8px rgba(255,138,61,0.8)" }} />
          附近追光者（演示）
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>拖动=平移 · 双指/右键=旋转俯仰 · 滚轮=缩放</div>
      </div>

      {/* 底部：机位 chips + 结论卡（换页通道，不锁滑动） */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, padding: "0 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} data-swipe-lock="true">
          {spots.map((s) => {
            const active = (selectedSpotName || spots[0]?.name) === s.name;
            return (
              <button key={s.name} onClick={() => onSelectSpot?.(s.name)} style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 999, background: active ? "var(--accent)" : "rgba(255,255,255,0.1)", color: active ? "#1a0e08" : "rgba(255,255,255,0.88)", border: "1px solid " + (active ? "var(--accent)" : "rgba(255,255,255,0.14)"), fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
                {s.name}{s.distance ? ` · ${s.distance.replace("步行 ", "")}` : ""}
              </button>
            );
          })}
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 18, background: "rgba(14,17,26,0.74)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginBottom: 3 }}>
            {rec.direction ? `往${rec.direction} · ` : ""}{rec.spot || "推荐机位"}{routeLoading ? " · 路线更新中…" : ""}
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff" }}>{conclusion}</div>
        </div>
      </div>
    </div>
  );
}
