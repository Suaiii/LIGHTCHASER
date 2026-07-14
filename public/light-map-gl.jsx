// light-map-gl.jsx — P2 光影地图 GL 版（MapLibre GL · 2026-07-13）
// 定位（第一性原理 F2）：原型参照物——演示"完整道路 + 真实建筑 + 太阳光照"的体验意图；
//   平台迁移三档预案见 page_specs.md P2（A 自定义web运行时直迁 / B 平台地图组件+光位罗盘 / C 录屏内嵌+2D交互）。
// 引擎：MapLibre GL（BSD, vendored）。数据：OpenFreeMap 矢量瓦片（OSM, ODbL）——
//   道路/建筑/水系/地名全量真实；建筑 3D 由 render_height 挤出；光照方向 = 真实/演示太阳方位角。
// 手势（原生）：拖=平移 · 滚轮/双指捏合=缩放 · 右键或Ctrl拖/双指旋转=旋转与俯仰。
// 兜底链：GL(在线瓦片) → Three 自研(离线) → 经典 2D。

const ZG_GL_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const ZG_BUILD = "v5.0"; // 构建号显示在 HUD 操作提示行——用户截图即可确认运行版本（代理缓存 localhost 屡次背刺）
const ZG_LOD_START = 14.6;
const ZG_LOD_END = 15.4;
const zgLodProgress = (zoom) => {
  const t = Math.max(0, Math.min(1, (zoom - ZG_LOD_START) / (ZG_LOD_END - ZG_LOD_START)));
  return t * t * (3 - 2 * t);
};

// 逐层暗化 liberty 样式 → 追光夜幕调。核心原则：**确定性调色板**——每类图层给死颜色，
// 不做任何原色换算（通用混色公式曾把绿地混成深青/品红混成紫，已废除）。
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
function zgMakeThreeBuildingsLayer({ originLL, sun, lightHex }) {
  const THREE = window.THREE;
  const merc = maplibregl.MercatorCoordinate.fromLngLat([originLL.lng, originLL.lat], 0);
  const mScale = merc.meterInMercatorCoordinateUnits();

  let camera, scene, renderer, buildingMesh = null, buildingMat = null, shadowMat = null;
  let buildToken = 0; // 新重建到来时作废进行中的分帧构建
  // 生长因子：0=藏于地下 1=满高。zoom 过阈值 → 楼从地面生长/缩回（scale.y），
  // 硬切显隐曾是用户"很不舒服"的关键——消失要有动画语言，才不像故障。
  // 绝对时间轴插值（非逐帧增量）：低帧率设备掉帧自动追赶，动画时长永远精准
  let grow = 0, growTarget = 0, growFrom = 0, growT0 = 0;
  let contextCanvas = null, contextLostHandler = null, contextRestoredHandler = null;
  const growEase = (g) => g * g * (3 - 2 * g); // smoothstep：双向共用一条曲线，zoom 中途反转不跳变
  const layer = {
    id: "zg-three-buildings",
    type: "custom",
    renderingMode: "3d",
    // 实时重建：polys = [{ rings:[[lng,lat],...], h, base }]（来源=瓦片实时或离线包兜底）。
    // 两条铁律（图九"楼全没了"的教训）：
    //   a) 先建新再拆旧——构建失败/为空时旧楼原样保留，宁可旧不可空；
    //   b) 分帧构建（每帧≤220栋）——1100 栋同步硬算曾一次性卡主线程 ~200ms。
    setBuildings(polys) {
      if (!scene) return 0;
      const batch = polys.slice(0, 650); // 近景优先；控制单次几何构建预算
      this._building = true;
      const token = ++buildToken;
      const gs = [];
      let idx = 0;
      const step = () => {
        if (!scene || token !== buildToken) { gs.forEach((g) => g.dispose()); return; }
        const end = Math.min(idx + 40, batch.length); // 小批次让快速拖动时主线程持续可响应
        for (; idx < end; idx++) {
          const b = batch[idx];
          try {
            const local = b.rings.map(([ln, la]) => zgToLocal(la, ln, originLL));
            const shape = new THREE.Shape(local.map((q) => new THREE.Vector2(q.x, -q.z)));
            const g3 = new THREE.ExtrudeGeometry(shape, { depth: Math.max(b.h - (b.base || 0), 3), bevelEnabled: false });
            g3.rotateX(-Math.PI / 2);
            if (b.base) g3.translate(0, b.base, 0);
            gs.push(g3); // r128 ExtrudeGeometry 本就非索引——勿调 toNonIndexed()（每栋一条 console.warn，1100 条/次即卡顿源）
          } catch (e) { /* 退化多边形跳过 */ }
        }
        if (idx < batch.length) { requestAnimationFrame(step); return; }
        if (!gs.length) { this._building = false; return; } // 全部退化：保留旧楼
        let total = 0;
        for (const g of gs) total += g.attributes.position.count;
        const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
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
        if (buildingMesh) { scene.remove(buildingMesh); buildingMesh.geometry.dispose(); }
        buildingMesh = new THREE.Mesh(merged, buildingMat);
        buildingMesh.castShadow = true;
        // 立面不接收阴影：掠射角(日落7°)下自阴影 acne 无法调参根治(图8/视频1 抖纹)。
        // 立面明暗交给 N·L(永远干净稳定)，楼间遮挡感保留在地面投影(shadowGround 照常接影)。
        buildingMesh.receiveShadow = false;
        // MapLibre 裸相机无正确视锥，Three 的剔除判定会误杀整个合批 mesh（曾致特定角度整片消失）
        buildingMesh.frustumCulled = false;
        buildingMesh.scale.y = Math.max(grow, 0.001); // 换装继承 zoom 已映射的当前高度
        buildingMesh.visible = grow > 0 || growTarget > 0;
        scene.add(buildingMesh);
        this._hasMesh = true;
        this._building = false;
        // 静态场景：阴影贴图只在满高时算一次（旋转时不再重采样 → 光照稳定 + 帧率解放）
        if (renderer && grow === 1) renderer.shadowMap.needsUpdate = true;
        // 换装就位 → 通知外层同步剪影层显隐（z-fight 根除 + 无空窗，统一归 LOD 管）。
        // map 判活：分帧构建完成时组件可能已重挂，死 map(remove 后 style 已销毁)上调 style API 会炸
        if (this._map && this._map.style) {
          this._onSwapped?.();
          this._map.triggerRepaint();
        }
        window.__zgB = { n: gs.length, verts: total }; // 测试钩子：自动化验证"楼是否真在场景里"
      };
      step();
      return batch.length;
    },
    // LOD 生长：目标 1=长出（拉近/首建登场）、0=缩回地里（拉远）。mesh 不销毁，
    // 动画在 render() 里逐帧推进（triggerRepaint 自续），拉回时零重建原样长回。
    setGrowTarget(t) {
      if (growTarget === t) return;
      growTarget = t;
      growFrom = grow; // 中途反转从当前高度接着走，无跳变
      growT0 = performance.now();
      if (buildingMesh && t > 0) buildingMesh.visible = true; // 登场先上台
      if (this._map && this._map.style) this._map.triggerRepaint();
    },
    setGrowProgress(t) {
      const next = Math.max(0, Math.min(1, t));
      grow = growTarget = growFrom = next;
      if (buildingMesh) {
        buildingMesh.scale.y = Math.max(next, 0.001);
        buildingMesh.visible = next > 0;
      }
      if (shadowMat) shadowMat.opacity = 0.3 * next;
      window.__zgGrow = next;
      if (this._map && this._map.style) this._map.triggerRepaint();
    },
    onAdd(map, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // 相机同步矩阵（官方 3D model 示例同款：平移到参考点 + 米级缩放 + Y-up 翻转）
      this._modelMatrix = new THREE.Matrix4()
        .makeTranslation(merc.x, merc.y, merc.z)
        .scale(new THREE.Vector3(mScale, -mScale, mScale))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl }); // 共享上下文：antialias 由 MapLibre 建上下文时决定，这里传了也无效
      renderer.autoClear = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false; // 场景静态：阴影只在建筑重建时算一次（防每帧重采样抖动+卡顿）
      // MapLibre and Three share one context. Recreate Three's renderer after a GPU reset.
      contextCanvas = map.getCanvas();
      contextLostHandler = (event) => { event.preventDefault(); window.__zgWebgl = "lost"; };
      contextRestoredHandler = () => {
        if (!scene || !contextCanvas) return;
        try {
          // Keep the existing Three renderer: it owns the resource restore hooks
          // for geometries/materials created before the shared context reset.
          renderer.resetState();
          renderer.shadowMap.needsUpdate = true;
          // Resume the absolute-time animation from its current height instead of
          // leaving a restored context stuck at a stale zero-height frame.
          growFrom = grow;
          growTarget = zgLodProgress(this._map.getZoom());
          growT0 = performance.now();
          window.__zgWebgl = "restored";
          this._map?.triggerRepaint();
        } catch (error) {
          window.__zgWebgl = "restore-failed";
          console.warn("[LIGHTCHASER] Three WebGL restore failed:", error);
        }
      };
      contextCanvas.addEventListener("webglcontextlost", contextLostHandler, false);
      contextCanvas.addEventListener("webglcontextrestored", contextRestoredHandler, false);
      window.__zgWebgl = "ready";

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
        // （曾在此画太阳亮斑——金属面镜面反射它时成片过曝白噪"乱码"，已移除；高光由平行光承担）
        const envTex = new THREE.CanvasTexture(ec);
        envTex.mapping = THREE.EquirectangularReflectionMapping;
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromEquirectangular(envTex).texture;
        envTex.dispose(); pmrem.dispose();
        renderer.resetState(); // PMREM 在共享上下文动过绑定——不复位会污染 MapLibre 下一帧（乱码残影源①）
      }

      // 日落观感=低照度高对比：暗蓝基底，仅受光面染色卡橙红；金属感由柔和 env + 镜面承担。
      // 半透明（用户定调：楼是配角不能抢戏）：depthWrite 保持 true——前楼正常遮后楼，
      // 透出的是底下 MapLibre 路网（Three 后画天然与已渲染地图混合），楼群内部不叠加发亮。
      buildingMat = new THREE.MeshStandardMaterial({
        color: "#333c54", metalness: 0.5, roughness: 0.55, envMapIntensity: 0.35,
        transparent: true, opacity: 0.68, depthWrite: true,
      });

      const RANGE = 2600; // 光照/阴影/接影覆盖半径（米，视口级）

      // 接影地面：透明 ShadowMaterial——楼影直接落在地图路面上
      shadowMat = new THREE.ShadowMaterial({ opacity: 0 }); // 初始 0：随楼生长淡入至 0.3（重影显得楼太"实"）
      const shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(RANGE * 3, RANGE * 3), shadowMat);
      shadowGround.rotation.x = -Math.PI / 2;
      shadowGround.position.set(0, 1.2, 0);
      shadowGround.receiveShadow = true;
      shadowGround.frustumCulled = false;
      shadowGround.material.depthWrite = false; // 防与地图面深度打架闪烁
      scene.add(shadowGround);

      // 太阳平行光：方向=真实/演示方位角+高度角（受光面/背光面由此天然分明）
      const keyHex = zgHexLerp(lightHex, "#ffc98f", 0.25); // 轻微金偏防粉，主体保持色卡日落色
      const dir = zgSunDir(sun.azimuthDeg, Math.max(sun.altitudeDeg, 2));
      const sunLight = new THREE.DirectionalLight(new THREE.Color(keyHex), 0.95); // 1.25 抢戏（图九反馈太亮），压回配角亮度
      const d = RANGE * 1.6;
      sunLight.position.set(dir.x * d, dir.y * d, dir.z * d);
      sunLight.target.position.set(0, 0, 0);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      // 掠射角(日落 alt 7°)自阴影 acne 的标准解：法线偏置 + 微负偏置——白噪竖纹的根源
      sunLight.shadow.normalBias = 3;
      sunLight.shadow.bias = -0.0002;
      const sc = sunLight.shadow.camera;
      sc.left = -RANGE; sc.right = RANGE; sc.top = RANGE; sc.bottom = -RANGE; sc.far = d * 2.5;
      sc.updateProjectionMatrix();
      scene.add(sunLight); scene.add(sunLight.target);
      scene.add(new THREE.HemisphereLight("#242c44", "#14171f", 0.42));
      scene.add(new THREE.AmbientLight("#2c3450", 0.28));
      this._map = map;
      this._ready = true;
    },
    render(gl, matrix) {
      if (!renderer) return;
      // 生长动画步进：绝对时间轴插值，显示值走 smoothstep。长 750ms / 缩 480ms。
      if (grow !== growTarget && buildingMesh) {
        const dur = growTarget > growFrom ? 750 : 480;
        const k = Math.min(1, (performance.now() - growT0) / dur);
        grow = growFrom + (growTarget - growFrom) * k;
        const e = growEase(grow);
        buildingMesh.scale.y = Math.max(e, 0.001);
        if (shadowMat) shadowMat.opacity = 0.3 * e; // 楼影随生长淡入淡出
        if (grow === 0) buildingMesh.visible = false; // 缩没了才真正退场
        if (grow === 1) renderer.shadowMap.needsUpdate = true; // 满高烘一次正确楼影
        window.__zgGrow = grow; // 测试钩子：验证生长动画真实发生
        this._map?.triggerRepaint(); // 自续动画帧
      }
      this._projM = this._projM || new THREE.Matrix4();
      camera.projectionMatrix = this._projM.fromArray(matrix).multiply(this._modelMatrix); // 复用矩阵：每帧 new 会攒 GC 停顿
      // resetState() 是 three 为共享上下文提供的完整复位(r126+)；旧 state.reset() 只清内部缓存不复位绑定，
      // 两台渲染器逐帧交替时随机出现纹理/缓冲错绑 = 帧级乱码残影（第一性排查 #1）
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      buildToken++; // 作废进行中的分帧构建
      if (scene) scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      if (contextCanvas) {
        contextCanvas.removeEventListener("webglcontextlost", contextLostHandler, false);
        contextCanvas.removeEventListener("webglcontextrestored", contextRestoredHandler, false);
      }
      contextCanvas = null;
      contextLostHandler = null;
      contextRestoredHandler = null;
      renderer = null;
      scene = null;
      this._map = null;
    },
  };
  return layer;
}

function SceneLightMapGL({ sunsetPayload, routeData, routeLoading = false, selectedSpotName, onSelectSpot, onSwitchClassic, lightTime = "now" }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const [mode, setMode] = useState(window.maplibregl ? "gl" : "three"); // gl | three
  const [tilesOk, setTilesOk] = useState(null); // null 加载中 | true | false
  const [bInfo, setBInfo] = useState(null);      // {src:"tiles"|"pack", n} 建筑来源与数量
  const lightZoneMode = new URLSearchParams(window.location.search).get("lightZone") || "off";

  const rec = sunsetPayload?.recommendation || {};
  const meta = sunsetPayload?.meta || {};
  const sunRaw = meta.sun?.current || { altitudeDeg: 8, azimuthDeg: 270 };
  const origin = meta.coordinates || { lat: 22.5956, lng: 113.9956 };
  const destLL = rec.coordinates || { lat: origin.lat + 0.006, lng: origin.lng - 0.01 };

  const isDemoData = /demo|fallback/.test(meta.source || "");
  const sunBelow = sunRaw.altitudeDeg <= 0;
  // 光照时刻控制量：给定 HH:MM → SunCalc(当天,当地) 推算真实方位角/高度角（与 sun_events 同一几何源，非编造）
  const timeSun = (() => {
    if (!lightTime || lightTime === "now" || !window.SunCalc) return null;
    const m = lightTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const d0 = new Date(); d0.setHours(+m[1], +m[2], 0, 0);
    const p = SunCalc.getPosition(d0, origin.lat, origin.lng);
    return { azimuthDeg: (p.azimuth * 180 / Math.PI + 180 + 360) % 360, altitudeDeg: p.altitude * 180 / Math.PI };
  })();
  const demoSun = isDemoData && !timeSun;
  const sun = timeSun
    ? timeSun
    : demoSun
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
    window.__zgLightZone = null;
    window.__zgLightZoneSelectCalls = 0;
    let disposed = false;
    let map = null;
    let raf = 0, idleTimer = 0, lightZoneTimer = 0, rotating = true;
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
        window.__zgMap = map; // 测试钩子：旋转不变性自动化验证用（Playwright 精确控制 bearing）
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

          const featuresToPolys = (feats) => {
            const seen = new Set();
            const polys = [];
            for (const f of feats) {
              const h = +(f.properties?.render_height ?? 12) || 12;
              const base = +(f.properties?.render_min_height ?? 0) || 0;
              const gj = f.geometry;
              const rings = gj.type === "Polygon" ? [gj.coordinates[0]]
                : gj.type === "MultiPolygon" ? gj.coordinates.map((p) => p[0]) : [];
              for (const ring of rings) {
                if (!ring || ring.length < 4) continue;
                const key = `${ring[0][0].toFixed(5)},${ring[0][1].toFixed(5)},${h}`;
                if (seen.has(key)) continue;
                seen.add(key);
                polys.push({ rings: ring, h, base });
              }
            }
            return polys;
          };

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
                "fill-extrusion-opacity-transition": { duration: 0 }, // zoom 本身就是连续量，不再叠加滞后动画
                "fill-extrusion-vertical-gradient": true,
              },
            });
          }

          // 近景建筑 = Three 自定义层：面级受光/背光 + 楼间投影 + envMap 金属反光
          // 数据源：**瓦片实时**（querySourceFeatures 取当前视口真实建筑，随移动重建）；
          // 离线包仅作断网/瓦片缺失兜底——最终呈现必须实时，不是本地 mock。
          if (window.THREE && !map.getLayer("zg-three-buildings")) {
            const threeLayer = zgMakeThreeBuildingsLayer({
              originLL: origin,
              sun,
              lightHex: zgSunPalette(sun.altitudeDeg),
            });
            try { map.addLayer(threeLayer); } catch (e) { console.warn("[LIGHTCHASER] three layer add failed:", e); }

            // ═ 重建调度（事件驱动——图九"楼刷没了/残缺"的修复）═
            // 铁律：①只有建成才记账，查空保留旧楼；②瓦片是异步流，任何时刻查询都可能只拿到
            // 部分楼（曾以 136 栋残缺状态永久定格），所以拿 sourcedata(isSourceLoaded) 当
            // "数据到齐"信号自动补建；③已有完整楼群时残缺数据永不上桌（pendingMove 挂起等到齐）；
            // ④ LOD 分级：z<13.8 瓦片里建筑数据天然稀疏/缺失，Three 精品层只管近景，
            //   拉远交回剪影 extrusion 层（全 zoom 有数据）——"拉远+旋转楼消失"的根治。
            const LOD_Z = ZG_LOD_START;
            let rebuildTimer = 0, recheckTimer = 0;
            let doneCenter = null, doneZoom = null, doneCount = 0, srcIsPack = false, builtOnce = false;
            let pendingMove = false; // 移动后瓦片未齐、等 sourcedata 一次换准
            const metersApart = (a, b) => Math.hypot((a.lng - b.lng) * 111320 * Math.cos(a.lat * Math.PI / 180), (a.lat - b.lat) * 111320);
            const commit = (n, count, src) => {
              doneCenter = map.getCenter(); doneZoom = map.getZoom();
              doneCount = count; srcIsPack = src === "pack"; builtOnce = true; pendingMove = false;
              setBInfo({ src, n });
            };
            const queryPolys = () => {
              try {
                const c = map.getCenter();
                const bounds = map.getBounds();
                const corners = [bounds.getNorthEast(), bounds.getNorthWest(), bounds.getSouthEast(), bounds.getSouthWest()];
                const viewRadius = Math.max(...corners.map((p) => metersApart(c, p))) * 1.25;
                return featuresToPolys(map.querySourceFeatures("openmaptiles", { sourceLayer: "building" }))
                  .map((poly) => {
                    let lng = 0, lat = 0;
                    for (const p of poly.rings) { lng += p[0]; lat += p[1]; }
                    const centroid = { lng: lng / poly.rings.length, lat: lat / poly.rings.length };
                    return { poly, distance: metersApart(c, centroid) };
                  })
                  // querySourceFeatures includes off-screen loaded tiles. Filter and
                  // prioritize before the 1100-building cap so distant tiles cannot
                  // consume the whole Three mesh while the foreground stays empty.
                  .filter((item) => item.distance <= viewRadius)
                  .sort((a, b) => a.distance - b.distance)
                  .map((item) => item.poly);
              }
              catch (e) { return []; /* 源未就绪 */ }
            };
            // LOD 过渡：低 z=剪影层淡入+光影楼缩回地里；高 z 且 Three 有楼=光影楼生长+剪影淡出。
            // 全部连续量（生长动画+透明度过渡）——硬切显隐的"楼突然蒸发"曾是用户最不适的点
            let lodLow = null;
            const syncLod = (force) => {
              const progress = zgLodProgress(map.getZoom());
              const low = progress <= 0;
              if (!force && Math.abs(progress - (lodLow ?? -1)) < 0.002) return;
              lodLow = progress;
              threeLayer.setGrowProgress?.(progress);
              if (map.getLayer("zg-3d-buildings")) {
                // Never overlap the native extrusion with Three. The base map still
                // retains its 2D building footprints at low zoom, while Three alone
                // owns the grow/shrink animation at high zoom.
                map.setPaintProperty("zg-3d-buildings", "fill-extrusion-opacity", 0);
              }
            };
            threeLayer._onSwapped = () => {
              // setBuildings is intentionally asynchronous; close the bridge
              // only after the replacement mesh is actually on the scene.
              pendingMove = false;
              syncLod(true);
            };
            map.on("zoom", () => syncLod(false));
            const rebuild = () => { // 相机移动驱动：距上次成功 >400m 或 zoom >0.5 才动（小拖动不重算）
              if (disposed || !threeLayer._ready) return;
              const c = map.getCenter(), z = map.getZoom();
              if (z < LOD_Z) return; // 拉远：本层歇着，剪影层自会跟瓦片走
              if (doneCenter && metersApart(c, doneCenter) < 400 && Math.abs(z - doneZoom) < 0.5) { pendingMove = false; return; }
              const polys = queryPolys();
              // 远跳(>2km)时旧楼已全在视口外，残缺新楼也比空场强，立即换装再由 sourcedata 补全；
              // 近距移动才值得"未齐不换"（旧楼还在视口垫底，等到齐一次换准防闪变）
              const farMove = doneCenter && metersApart(c, doneCenter) > 2000;
              if (polys.length >= 10 && (!builtOnce || farMove || map.areTilesLoaded())) {
                const n = threeLayer.setBuildings(polys);
                if (n > 0) commit(n, polys.length, "tiles");
              } else {
                pendingMove = true; // 数据未齐：不动旧楼，等 sourcedata 到齐一次换准
              }
            };
            const recheck = () => { // 瓦片到齐驱动：补全残缺 / 完成挂起的移动换装（不看位移门槛）
              if (disposed || !threeLayer._ready) return;
              if (map.getZoom() < LOD_Z) return;
              // 手势/动画中不换装——旋转途中楼群突变=肉眼跳变，顺延到交互结束
              if (map.isMoving()) { recheckTimer = setTimeout(recheck, 150); return; }
              const polys = queryPolys();
              if (polys.length < 10) return;
              const richer = polys.length >= Math.max(doneCount * 1.2, doneCount + 40);
              if (pendingMove || richer || srcIsPack || !builtOnce) {
                const n = threeLayer.setBuildings(polys);
                if (n > 0) commit(n, polys.length, "tiles");
              }
            };
            map.on("sourcedata", (e) => {
              if (e.sourceId !== "openmaptiles" || !e.isSourceLoaded) return;
              clearTimeout(recheckTimer);
              recheckTimer = setTimeout(recheck, 400);
            });
            let schedCenter = null, schedZoom = null;
            map.on("moveend", () => {
              // 闲置自转每帧发 moveend（setBearing=jumpTo）——中心/缩放没变就不打扰
              const c = map.getCenter(), z = map.getZoom();
              if (schedCenter && metersApart(c, schedCenter) < 1 && Math.abs(z - schedZoom) < 1e-6) return;
              schedCenter = c; schedZoom = z;
              clearTimeout(rebuildTimer);
              rebuildTimer = setTimeout(rebuild, 120);
            });
            rebuildTimer = setTimeout(rebuild, 240); // 首响应：有部分数据先建起来，sourcedata 到齐后自动补全
            setTimeout(() => { // 离线兜底：12s 仍无楼（断网/瓦片全挂）才动用离线包，按视口就近筛
              if (disposed || builtOnce || map.getZoom() < LOD_Z || typeof zgLoadBuildings !== "function") return;
              zgLoadBuildings().then((geo) => {
                if (disposed || builtOnce || !geo?.buildings?.length) return;
                const c = map.getCenter();
                const near = geo.buildings
                  .map((b) => ({ b, d: metersApart({ lng: b.p[0][1], lat: b.p[0][0] }, c) }))
                  .filter((x) => x.d < 2600).sort((a, b2) => a.d - b2.d).slice(0, 650)
                  .map((x) => ({ rings: x.b.p.map(([la, ln]) => [ln, la]), h: x.b.h, base: 0 }));
                const n = threeLayer.setBuildings(near);
                if (n > 0) commit(n, near.length, "pack");
              });
            }, 12000);
          }

          // 路线：光晕 + 亮芯 + 流动脉冲
          map.addSource("zg-route", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: routeLL } } });
          map.addLayer({ id: "zg-route-glow", type: "line", source: "zg-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ff8a3d", "line-width": 16, "line-blur": 8, "line-opacity": 0.5 } });
          map.addLayer({ id: "zg-route-core", type: "line", source: "zg-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffd49a", "line-width": 4.5 } });
          map.addSource("zg-pulse", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "zg-pulse", type: "circle", source: "zg-pulse", paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-blur": 0.35 } });

          // HERMES-03 proposals are URL-gated and use regular MapLibre layers only.
          // They never enter the animation loop or create another shared GL renderer.
          const axisEnabled = lightZoneMode === "axis" || lightZoneMode === "both";
          const spotsEnabled = lightZoneMode === "spots" || lightZoneMode === "both";
          if (window.ZGLightZone && (axisEnabled || spotsEnabled)) {
            try {
            const officialCandidates = spots
              .filter((spot) => Number.isFinite(spot?.coordinates?.lng) && Number.isFinite(spot?.coordinates?.lat))
              .map((spot, index) => ({ id: `spot-${index}`, name: spot.name, lng: spot.coordinates.lng, lat: spot.coordinates.lat }));
            const routeCandidatePool = routeLL
              .filter((_, index) => index === 0 || index === routeLL.length - 1 || index % Math.max(1, Math.floor(routeLL.length / 16)) === 0)
              .map((point, index) => ({ id: `route-${index}`, name: `路线光位 ${index + 1}`, lng: point[0], lat: point[1] }));
            const getVisibleCandidates = () => {
              const canvas = map.getCanvas();
              const isReadable = (candidate) => {
                const point = map.project([candidate.lng, candidate.lat]);
                return point.x >= 16 && point.x <= canvas.clientWidth - 16 && point.y >= 170 && point.y <= canvas.clientHeight - 170;
              };
              const selected = officialCandidates.filter(isReadable).slice(0, 4);
              const routeVisible = routeCandidatePool.filter(isReadable);
              const slots = 4 - selected.length;
              for (let index = 0; index < slots && routeVisible.length; index++) {
                const candidate = routeVisible[Math.min(routeVisible.length - 1, Math.floor((index + 0.5) * routeVisible.length / slots))];
                if (!selected.some((item) => Math.hypot(item.lng - candidate.lng, item.lat - candidate.lat) < 0.00008)) selected.push(candidate);
              }
              return selected;
            };
            if (axisEnabled) {
              map.addSource("zg-sun-axis", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
              map.addLayer({ id: "zg-sun-axis-glow", type: "line", source: "zg-sun-axis", layout: { "line-cap": "round" }, paint: { "line-color": "#80c9c1", "line-width": 7, "line-blur": 5, "line-opacity": 0.18 } }, "zg-route-glow");
              map.addLayer({ id: "zg-sun-axis-core", type: "line", source: "zg-sun-axis", layout: { "line-cap": "round" }, paint: { "line-color": "#9adbd2", "line-width": 2, "line-opacity": 0.82, "line-dasharray": [2, 2] } }, "zg-route-glow");
              map.addLayer({
                id: "zg-sun-axis-tip", type: "circle", source: "zg-sun-axis", filter: ["==", ["geometry-type"], "Point"],
                paint: { "circle-radius": 5, "circle-color": "#9adbd2", "circle-opacity": 0.9, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.2, "circle-stroke-opacity": 0.65 },
              });
              map.addLayer({
                id: "zg-sun-axis-label", type: "symbol", source: "zg-sun-axis", filter: ["==", ["geometry-type"], "Point"],
                layout: { "text-field": "日落方向", "text-size": 10, "text-offset": [0, 1.4], "text-allow-overlap": true, "text-ignore-placement": true },
                paint: { "text-color": "#a7e1d9", "text-halo-color": "#111621", "text-halo-width": 1.2 },
              });
            }
            if (spotsEnabled) {
              map.addSource("zg-light-spots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
              map.addLayer({
                id: "zg-light-spots", type: "circle", source: "zg-light-spots",
                paint: {
                  "circle-radius": 7,
                  "circle-color": ["match", ["get", "status"], "exposed", "#f4c477", "blocked", "#586174", "below_horizon", "#39404f", "#8a8f9b"],
                  "circle-opacity": 0.82,
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-width": 1,
                  "circle-stroke-opacity": 0.55,
                },
              });
              map.addLayer({
                id: "zg-light-spots-label", type: "symbol", source: "zg-light-spots",
                layout: {
                  "text-field": ["match", ["get", "status"], "exposed", "见光", "blocked", "受挡", "below_horizon", "已日落", "待数据"],
                  "text-size": 10,
                  "text-offset": [0, 1.4],
                  "text-allow-overlap": false,
                },
                paint: { "text-color": "#d8dbe3", "text-halo-color": "#111621", "text-halo-width": 1.2 },
              });
            }

            let lightZoneGeneration = 0;
            let lightZoneReadyGeneration = -1;
            let lightZoneCenter = null;
            let lightZoneZoom = null;
            let lightZoneBearing = null;
            const getSampleCandidates = () => {
              const canvas = map.getCanvas();
              return getVisibleCandidates().map((candidate) => {
                const rayEnd = window.ZGLightZone.destinationPoint(candidate, sun.azimuthDeg, 700);
                const screenEnd = map.project([rayEnd.lng, rayEnd.lat]);
                return {
                  ...candidate,
                  coverageComplete: screenEnd.x >= 0 && screenEnd.x <= canvas.clientWidth && screenEnd.y >= 0 && screenEnd.y <= canvas.clientHeight,
                };
              });
            };
            const queryLightZoneSample = (candidates) => {
              if (!spotsEnabled || !candidates.length) return { candidates, buildings: [], visibleBuildingCount: 0, matchedCount: 0, truncated: false };
              const corridors = candidates.map((candidate) => {
                const endpoint = window.ZGLightZone.destinationPoint(candidate, sun.azimuthDeg, 700);
                const latMargin = 120 / 111320;
                const lngMargin = 120 / (111320 * Math.cos(candidate.lat * Math.PI / 180));
                return {
                  minLng: Math.min(candidate.lng, endpoint.lng) - lngMargin,
                  maxLng: Math.max(candidate.lng, endpoint.lng) + lngMargin,
                  minLat: Math.min(candidate.lat, endpoint.lat) - latMargin,
                  maxLat: Math.max(candidate.lat, endpoint.lat) + latMargin,
                };
              });
              const ringIntersects = (ring, corridor) => {
                let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
                for (const point of ring) {
                  minLng = Math.min(minLng, point[0]); maxLng = Math.max(maxLng, point[0]);
                  minLat = Math.min(minLat, point[1]); maxLat = Math.max(maxLat, point[1]);
                }
                return maxLng >= corridor.minLng && minLng <= corridor.maxLng && maxLat >= corridor.minLat && minLat <= corridor.maxLat;
              };
              const featureIntersects = (feature) => {
                const geometry = feature.geometry;
                const rings = geometry.type === "Polygon" ? geometry.coordinates
                  : geometry.type === "MultiPolygon" ? geometry.coordinates.flat(1) : [];
                return corridors.some((corridor) => rings.some((ring) => ringIntersects(ring, corridor)));
              };
              const corridorFeatures = map.querySourceFeatures("openmaptiles", { sourceLayer: "building" }).filter(featureIntersects);
              const visibleBuildings = featuresToPolys(corridorFeatures);
              window.__zgLightZoneSelectCalls += 1;
              const selected = window.ZGLightZone.selectRayBuildings(candidates, visibleBuildings, sun, { maxDistance: 700, maxBuildings: 650 });
              return { candidates, buildings: selected.buildings, visibleBuildingCount: visibleBuildings.length, matchedCount: selected.matchedCount, truncated: selected.truncated };
            };
            const refreshLightZone = (sample, dataReady = false, totalStarted = performance.now(), queryMs = 0) => {
              if (axisEnabled) {
                const center = map.getCenter();
                const start = window.ZGLightZone.destinationPoint(center, sun.azimuthDeg + 180, 250);
                const end = window.ZGLightZone.destinationPoint(start, sun.azimuthDeg, 900);
                map.getSource("zg-sun-axis")?.setData({
                  type: "FeatureCollection",
                  features: [
                    { type: "Feature", properties: { azimuth: Math.round(sun.azimuthDeg) }, geometry: { type: "LineString", coordinates: [[start.lng, start.lat], [end.lng, end.lat]] } },
                    { type: "Feature", properties: { azimuth: Math.round(sun.azimuthDeg) }, geometry: { type: "Point", coordinates: [end.lng, end.lat] } },
                  ],
                });
              }
              let evaluated = [];
              if (spotsEnabled) {
                evaluated = window.ZGLightZone.evaluateCandidates(sample.candidates, sample.buildings, sun, { dataReady: dataReady && !sample.truncated });
                map.getSource("zg-light-spots")?.setData({
                  type: "FeatureCollection",
                  features: evaluated.map((item) => ({ type: "Feature", properties: item, geometry: { type: "Point", coordinates: [item.lng, item.lat] } })),
                });
              }
              window.__zgLightZone = {
                mode: lightZoneMode,
                generation: lightZoneGeneration,
                sunAzimuthDeg: +sun.azimuthDeg.toFixed(2),
                sunAltitudeDeg: +sun.altitudeDeg.toFixed(2),
                visibleBuildingCount: sample.visibleBuildingCount,
                rayBuildingCount: sample.buildings.length,
                matchedBuildingCount: sample.matchedCount,
                candidateCount: evaluated.length,
                coveredCandidateCount: sample.candidates.filter((candidate) => candidate.coverageComplete).length,
                exposedCount: evaluated.filter((item) => item.status === "exposed").length,
                dataReady: dataReady && !sample.truncated,
                truncated: sample.truncated,
                queryMs: +queryMs.toFixed(2),
                computeMs: +(performance.now() - totalStarted).toFixed(2),
              };
            };
            const emptySample = { candidates: getSampleCandidates(), buildings: [], visibleBuildingCount: 0, matchedCount: 0, truncated: false };
            refreshLightZone(emptySample);

            // Proposal sampling is independent from the Three LOD. Verdicts are
            // published only for the settled camera generation whose source is complete.
            const syncLightZone = () => {
              if (disposed || map.isMoving()) return;
              const totalStarted = performance.now();
              try { if (map.isSourceLoaded("openmaptiles")) lightZoneReadyGeneration = lightZoneGeneration; } catch { /* wait for sourcedata */ }
              const candidates = getSampleCandidates();
              const queryStarted = performance.now();
              const sample = queryLightZoneSample(candidates);
              const queryMs = performance.now() - queryStarted;
              refreshLightZone(sample, lightZoneReadyGeneration === lightZoneGeneration, totalStarted, queryMs);
            };
            const scheduleLightZone = (delay = 120) => {
              if (lightZoneTimer) return;
              lightZoneTimer = setTimeout(() => {
                lightZoneTimer = 0;
                syncLightZone();
              }, delay);
            };
            if (spotsEnabled) {
              map.on("sourcedata", (event) => {
                if (event.sourceId !== "openmaptiles" || !event.isSourceLoaded || map.isMoving()) return;
                lightZoneReadyGeneration = lightZoneGeneration;
                scheduleLightZone();
              });
            }
            map.on("moveend", () => {
              const center = map.getCenter(), zoom = map.getZoom(), bearing = map.getBearing();
              const bearingDelta = lightZoneBearing == null ? 180 : Math.abs((((bearing - lightZoneBearing) % 360) + 540) % 360 - 180);
              const moved = !lightZoneCenter || Math.hypot((center.lng - lightZoneCenter.lng) * 100000, (center.lat - lightZoneCenter.lat) * 100000) >= 1 || Math.abs(zoom - lightZoneZoom) >= 0.001 || (spotsEnabled && bearingDelta >= 5);
              if (!moved) return;
              lightZoneCenter = center; lightZoneZoom = zoom; lightZoneBearing = bearing;
              lightZoneGeneration += 1;
              lightZoneReadyGeneration = -1;
              scheduleLightZone();
            });
            scheduleLightZone(600);
            } catch (error) {
              console.error("[LIGHTCHASER] light zone setup failed:", error);
              window.__zgLightZone = { mode: lightZoneMode, error: String(error) };
            }
          }

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

          // 视野适配路线——zoom 下限钳在光影楼 LOD 之上：长路线(4km+)全览会落到 z≈12.8，
          // 开场就只剩剪影楼，与"第一眼=光影楼群"的演示叙事相悖；路线出画交给缩略图兜全貌
          const b = routeLL.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(routeLL[0], routeLL[0]));
          const cam = map.cameraForBounds(b, { padding: { top: 190, bottom: 230, left: 70, right: 70 }, bearing: sun.azimuthDeg - 60 });
          map.easeTo({ center: cam ? cam.center : routeLL[0], zoom: Math.max(cam ? cam.zoom : 14.6, 14.05), pitch: 62, bearing: sun.azimuthDeg - 60, duration: 900 });

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
          let t0 = 0, fno = 0;
          function frame() {
            if (disposed) return;
            t0 += 1 / 60;
            // 脉冲隔帧更新：setData 会强制整图重绘，60fps 更新=静止时 GPU 也全速跑
            if (!reducedMotion && (fno++ % 4 === 0) && map.getSource("zg-pulse")) {
              map.getSource("zg-pulse").setData({
                type: "FeatureCollection",
                features: [0, 0.5].map((off) => ({ type: "Feature", geometry: { type: "Point", coordinates: at((t0 * 0.045 + off) % 1) } })),
              });
            }
            if (rotating && !reducedMotion && !spotsEnabled) map.setBearing(map.getBearing() + 0.018);
            raf = requestAnimationFrame(frame);
          }
          frame();

          const wake = () => {
            rotating = false;
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => { rotating = !spotsEnabled; }, 4000);
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
      clearTimeout(failTimer); clearTimeout(idleTimer); clearTimeout(lightZoneTimer);
      cancelAnimationFrame(raf);
      markers.forEach((m) => m.remove());
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      window.__zgLightZone = null;
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
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: zgSunPalette(sun.altitudeDeg), marginRight: 5, boxShadow: "0 0 6px " + zgSunPalette(sun.altitudeDeg), verticalAlign: "middle" }} />☀ {Math.round(sun.azimuthDeg)}° · 高 {sun.altitudeDeg.toFixed(1)}°{timeSun ? ` · 光位${lightTime}(推算)` : demoSun ? " · 演示光位18:40" : sunBelow ? " · 已日落" : ""}
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
          {tilesOk == null ? "地图·载入中…" : bInfo ? (bInfo.src === "tiles" ? `道路·瓦片实时 ｜ 建筑·视口实时 ${bInfo.n} 栋` : `道路·瓦片实时 ｜ 建筑·离线包兜底 ${bInfo.n} 栋`) : "道路·瓦片实时 ｜ 建筑·构建中…"}
        </div>
        <div style={{ fontSize: 9.5, letterSpacing: 1.1, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono)" }}>
          太阳·{timeSun ? `${lightTime} 推算` : demoSun ? "演示光位" : "实时方位"} ｜ 路线·真实路网
        </div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "#ff8a3d", boxShadow: "0 0 8px rgba(255,138,61,0.8)" }} />
          附近追光者（演示）
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>拖动=平移 · 双指/右键=旋转俯仰 · 滚轮=缩放 · {ZG_BUILD}</div>
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
