// photo-map.jsx — HERMES-10 追·光地图：实时定位、照片气泡、附近时间流与按需路线。

const { useEffect: usePhotoMapEffect, useMemo: usePhotoMapMemo, useRef: usePhotoMapRef, useState: usePhotoMapState } = React;

const PHOTO_MAP_DEMOS = [
  { id: "demo-01", dx: -0.0045, dy: 0.0028, place: "附近的光", author: "追光用户", caption: "附近的第一束光，等待真实内容出现。", age_hours: 0.4, likes: 0, comments: 0, tone: "sunset", size: 80 },
  { id: "demo-02", dx: 0.0032, dy: -0.0023, place: "城市转角", author: "追光用户", caption: "这里将展示附近的人刚拍下的瞬间。", age_hours: 2, likes: 0, comments: 0, tone: "amber", size: 64 },
  { id: "demo-03", dx: -0.0021, dy: -0.0042, place: "街边一角", author: "追光用户", caption: "一张等待被发布的照片。", age_hours: 5, likes: 0, comments: 0, tone: "blue", size: 48 },
  { id: "demo-04", dx: 0.0054, dy: 0.0038, place: "此刻附近", author: "追光用户", caption: "留给附近内容的照片气泡位置。", age_hours: 12, likes: 0, comments: 0, tone: "rose", size: 64 },
  { id: "demo-05", dx: 0.0009, dy: 0.0051, place: "晚风经过", author: "追光用户", caption: "此处等待真实的附近帖子。", age_hours: 20, likes: 0, comments: 0, tone: "dusk", size: 80 },
  { id: "demo-06", dx: -0.0057, dy: -0.0006, place: "散步路线", author: "追光用户", caption: "地图会随你的实时位置重新布局。", age_hours: 36, likes: 0, comments: 0, tone: "gold", size: 64 },
  { id: "demo-07", dx: 0.0018, dy: -0.0052, place: "下一处风景", author: "追光用户", caption: "本周的占位照片示例。", age_hours: 72, likes: 0, comments: 0, tone: "violet", size: 48 },
  { id: "demo-note", dx: 0.0054, dy: -0.0048, place: "附近留言", author: "追光用户", caption: "有人在附近吗？", age_hours: 8, likes: 0, comments: 0, kind: "note", tone: "yellow", size: 64 },
];

const PHOTO_MAP_TONES = {
  sunset: "linear-gradient(145deg, #f2bd88 0%, #d67557 44%, #564864 100%)",
  amber: "linear-gradient(145deg, #f8dfae 0%, #d6a46e 48%, #657580 100%)",
  blue: "linear-gradient(145deg, #c5e2ee 0%, #82a9c1 48%, #5c6680 100%)",
  rose: "linear-gradient(145deg, #f3c9c3 0%, #df9994 45%, #87728b 100%)",
  dusk: "linear-gradient(145deg, #ffe0a0 0%, #e48b69 48%, #5d5878 100%)",
  gold: "linear-gradient(145deg, #f1dc9d 0%, #d9ae5b 46%, #758292 100%)",
  violet: "linear-gradient(145deg, #dacbe7 0%, #9f8dbe 46%, #6f7899 100%)",
};

function photoMapTime(ageHours) {
  if (ageHours < 1) return "刚刚";
  if (ageHours < 24) return `${Math.round(ageHours)} 小时前`;
  return `${Math.round(ageHours / 24)} 天前`;
}

function makePhotoMapPosts(origin, livePosts) {
  return [...PHOTO_MAP_DEMOS, ...livePosts].map((post) => ({
    ...post,
    lat: post.lat ?? origin.lat + post.dy,
    lng: post.lng ?? origin.lng + post.dx,
  }));
}

function usePhotoMapLocation(fallback) {
  const [location, setLocation] = usePhotoMapState({ ...fallback, source: "waiting" });
  const locate = () => {
    if (!navigator.geolocation) {
      setLocation((current) => ({ ...current, source: "unsupported" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation({ lat: coords.latitude, lng: coords.longitude, source: "live" }),
      () => setLocation((current) => ({ ...current, source: "fallback" })),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  };
  usePhotoMapEffect(() => { locate(); }, []);
  return { location, locate };
}

// 半屏详情约 430px 高，取一半作为纵向偏移，把目标点平移到视口上半部，避免被 bottom sheet 遮住。
const PHOTO_MAP_SHEET_OFFSET_Y = 215;
function panPhotoMapToPost(map, post) {
  const zoom = map.getZoom();
  const target = map.unproject(map.project([post.lat, post.lng], zoom).add([0, PHOTO_MAP_SHEET_OFFSET_Y]), zoom);
  map.panTo(target, { animate: true });
}

function PhotoMapLeaflet({ origin, posts, selectedPost, routeVisible, routeData, onSelectPost, onLocate, onMapReady }) {
  const containerRef = usePhotoMapRef(null);
  const mapRef = usePhotoMapRef(null);
  const layersRef = usePhotoMapRef([]);

  usePhotoMapEffect(() => {
    if (!containerRef.current || typeof L === "undefined") return undefined;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      minZoom: 12,
      maxZoom: 18,
    }).setView([origin.lat, origin.lng], 15);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    onMapReady?.(map);
    return () => { onMapReady?.(null); map.remove(); mapRef.current = null; };
  }, []);

  usePhotoMapEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([origin.lat, origin.lng], Math.max(map.getZoom(), 15), { animate: true });
  }, [origin.lat, origin.lng]);

  // 点开气泡后平移地图，使该点位于视口上半部，不被半屏 sheet 遮住。
  usePhotoMapEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPost) return;
    panPhotoMapToPost(map, selectedPost);
  }, [selectedPost?.id]);

  usePhotoMapEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((layer) => layer.remove());
    const layers = [];
    const locationIcon = L.divIcon({
      className: "photo-map-location-icon",
      iconSize: [54, 54], iconAnchor: [27, 27],
      html: '<span class="photo-map-location-cone"></span><span class="photo-map-location-dot"></span>',
    });
    layers.push(L.marker([origin.lat, origin.lng], { icon: locationIcon, zIndexOffset: 800 }).addTo(map));
    posts.forEach((post, index) => {
      const rotation = [-5, 3, -2, 4, -4, 2, -3, 5][index % 8];
      const isLive = post.is_live;
      const size = post.size || 64;
      if (post.kind === "note") {
        const noteIcon = L.divIcon({
          className: "photo-map-marker-icon",
          iconSize: [80, 55], iconAnchor: [40, 27],
          html: `<button class="photo-map-note-marker" aria-label="打开附近留言" style="--tilt:${rotation}deg">${post.caption}</button>`,
        });
        const noteMarker = L.marker([post.lat, post.lng], { icon: noteIcon, zIndexOffset: 200 + index }).addTo(map);
        noteMarker.on("click", () => onSelectPost(post));
        layers.push(noteMarker);
        return;
      }
      // 拍立得照片泡 + 下方地点标签（小图标 + 黑色粗体），整体倾斜 --tilt。
      const content = `<span class="photo-map-marker-stack" style="--tilt:${rotation}deg"><button class="photo-map-bubble-marker ${isLive ? "is-live" : ""}" aria-label="打开 ${post.place}" style="--tone:${PHOTO_MAP_TONES[post.tone] || PHOTO_MAP_TONES.sunset};--size:${size}px"><span class="photo-map-marker-image"></span><span class="photo-map-marker-demo">${isLive ? "刚发布·演示" : "示例"}</span></button><span class="photo-map-marker-label">${post.place}</span></span>`;
      const iconWidth = Math.max(size + 24, 96);
      const icon = L.divIcon({ className: "photo-map-marker-icon", iconSize: [iconWidth, size + 26], iconAnchor: [iconWidth / 2, size / 2], html: content });
      const marker = L.marker([post.lat, post.lng], { icon, zIndexOffset: isLive ? 700 : 200 + index }).addTo(map);
      marker.on("click", () => onSelectPost(post));
      layers.push(marker);
    });
    if (routeVisible && selectedPost) {
      const points = routeData?.geometry?.length >= 2
        ? routeData.geometry.map((point) => [point.lat, point.lng])
        : [[origin.lat, origin.lng], [selectedPost.lat, selectedPost.lng]];
      layers.push(L.polyline(points, { color: "#1d58d8", weight: 7, opacity: 0.95, lineCap: "round", className: "photo-map-route-line" }).addTo(map));
      layers.push(L.circleMarker([selectedPost.lat, selectedPost.lng], { radius: 10, color: "#fff", weight: 3, fillColor: "#1d58d8", fillOpacity: 1 }).addTo(map));
      panPhotoMapToPost(map, selectedPost);
    }
    layersRef.current = layers;
  }, [origin.lat, origin.lng, posts, selectedPost?.id, routeVisible, routeData?.geometry?.length]);

  return (
    <>
      <div ref={containerRef} data-swipe-lock="true" style={{ position: "absolute", inset: 0, zIndex: 0, background: "#edf0f0" }} />
      {typeof L === "undefined" && <div className="photo-map-fallback-grid" />}
      <button type="button" data-swipe-lock="true" onClick={onLocate} className="photo-map-locate" aria-label="我在这里" title="我在这里">⌁</button>
    </>
  );
}

function PhotoMapDetailSheet({ post, routeVisible, routeLoading, onClose, onNavigate, onLike }) {
  if (!post) return null;
  return (
    <section data-swipe-lock="true" className="photo-map-detail-sheet">
      <button type="button" onClick={onClose} className="photo-map-sheet-close" aria-label="关闭详情">×</button>
      <div className="photo-map-sheet-handle" />
      <div className="photo-map-detail-media" style={{ background: post.kind === "note" ? "#f8d77c" : PHOTO_MAP_TONES[post.tone] || PHOTO_MAP_TONES.sunset }}>
        {post.kind === "note" ? <span>{post.caption}</span> : <span>附近照片占位图</span>}
        <em>{post.is_live ? "刚发布 · 演示" : "示例数据"}</em>
      </div>
      <div className="photo-map-detail-copy">
        <div className="photo-map-detail-meta"><strong>@{post.author}</strong><span>{photoMapTime(post.age_hours)}</span><span>·</span><span>{post.place}</span></div>
        <p>{post.caption}</p>
        <div className="photo-map-detail-actions">
          <button type="button" onClick={onLike}>♡ {post.likes || 0} <small>演示</small></button>
          <button type="button" onClick={() => {}}>◌ {post.comments || 0} <small>演示</small></button>
          <button type="button" className="photo-map-route-button" onClick={onNavigate}>{routeLoading ? "路线计算中" : routeVisible ? "已显示路线" : "按路线去这里"} →</button>
        </div>
      </div>
    </section>
  );
}

function PhotoMapTimeline({ posts, filter, onFilter, onSelectPost, open, onClose }) {
  if (!open) return null;
  return (
    <section data-swipe-lock="true" className="photo-map-timeline">
      <div className="photo-map-sheet-handle" />
      <div className="photo-map-timeline-title"><div><strong>附近 · 最近</strong><span>演示占位内容</span></div><button type="button" onClick={onClose}>×</button></div>
      <div className="photo-map-filter-row">
        {[['today', '今天'], ['week', '本周']].map(([value, label]) => <button key={value} type="button" onClick={() => onFilter(value)} className={filter === value ? "is-active" : ""}>{label}</button>)}
      </div>
      <div className="photo-map-timeline-list">
        {posts.map((post) => <button type="button" key={post.id} onClick={() => onSelectPost(post)} className="photo-map-timeline-card">
          <span style={{ background: post.kind === "note" ? "#f8d77c" : PHOTO_MAP_TONES[post.tone] || PHOTO_MAP_TONES.sunset }}>{post.kind === "note" ? "便签" : "占位图"}</span>
          <i><b>{post.place}</b><small>{photoMapTime(post.age_hours)} · @{post.author}</small></i><em>示例</em>
        </button>)}
      </div>
    </section>
  );
}

function PhotoMapPublishSheet({ open, onClose, onPublish }) {
  if (!open) return null;
  return <section data-swipe-lock="true" className="photo-map-publish-sheet">
    <div className="photo-map-sheet-handle" />
    <button type="button" onClick={onClose} className="photo-map-sheet-close" aria-label="关闭发布">×</button>
    <strong>发布一张照片</strong>
    <p>正式 UGC 上传尚未接入；此操作会在你的当前位置发布一条标有“演示”的实时气泡。</p>
    <div className="photo-map-publish-preview">照片占位图</div>
    <button type="button" className="photo-map-publish-confirm" onClick={onPublish}>发布演示照片</button>
  </section>;
}

// app.jsx 每次重渲染都会新建 feed 页组件（匿名箭头函数），App 状态变化（如 /api/route、/api/sunset
// 数据到达，或 onSelectDestination 回写）会把本场景卸载重挂，本地 useState 全部丢失。
// 用模块级缓存保存 UI 状态，保证重挂后详情卡、按需路线与已发布演示气泡不丢失。
const PHOTO_MAP_UI_CACHE = { filter: "today", selectedPost: null, livePosts: [], timelineOpen: false, publishOpen: false, routeVisible: false };
function usePhotoMapPersistedState(key) {
  const [value, setValue] = usePhotoMapState(PHOTO_MAP_UI_CACHE[key]);
  const set = (next) => {
    const resolved = typeof next === "function" ? next(PHOTO_MAP_UI_CACHE[key]) : next;
    PHOTO_MAP_UI_CACHE[key] = resolved;
    setValue(resolved);
  };
  return [value, set];
}

function ScenePhotoMap({ sunsetPayload, routeData, routeLoading, onSelectDestination }) {
  const fallback = sunsetPayload?.meta?.coordinates ?? { lat: 22.4867, lng: 113.9385 }; // 深圳·后海演示中心，与 app.jsx DEMO_LOCATIONS.shenzhen 一致
  const { location, locate } = usePhotoMapLocation(fallback);
  const [filter, setFilter] = usePhotoMapPersistedState("filter");
  const [selectedPost, setSelectedPost] = usePhotoMapPersistedState("selectedPost");
  const [livePosts, setLivePosts] = usePhotoMapPersistedState("livePosts");
  const [timelineOpen, setTimelineOpen] = usePhotoMapPersistedState("timelineOpen");
  const [publishOpen, setPublishOpen] = usePhotoMapPersistedState("publishOpen");
  const [routeVisible, setRouteVisible] = usePhotoMapPersistedState("routeVisible");
  const mapRef = usePhotoMapRef(null);
  const posts = usePhotoMapMemo(() => makePhotoMapPosts(location, livePosts), [location.lat, location.lng, livePosts]);
  const filteredPosts = usePhotoMapMemo(() => posts.filter((post) => filter === "week" || post.age_hours <= 24), [posts, filter]);

  const selectPost = (post) => { setSelectedPost(post); setRouteVisible(false); setTimelineOpen(false); };
  const navigateToPost = () => {
    if (!selectedPost) return;
    setRouteVisible(true);
    onSelectDestination?.({ name: selectedPost.place, coordinates: { lat: selectedPost.lat, lng: selectedPost.lng }, distance: "步行约 8 分钟" });
  };
  const publishDemo = () => {
    // 发布落点取当前地图视口中心附近（地图可能已被平移，不再使用定位坐标）。
    const center = mapRef.current?.getCenter?.() || { lat: location.lat, lng: location.lng };
    const live = { id: `live-${Date.now()}`, lat: center.lat + 0.0007, lng: center.lng - 0.0008, place: "我在这里", author: "我", caption: "刚刚发布的一张演示照片", age_hours: 0, likes: 0, comments: 0, tone: "sunset", size: 80, is_live: true };
    setLivePosts((current) => [...current, live]);
    setSelectedPost(live);
    setPublishOpen(false);
  };
  // 右边缘手势区：仅在该窄条内检测左滑 ≥48px 打开附近时间流，地图其余区域交给 Leaflet 拖拽。
  const edgeSwipeStart = usePhotoMapRef(null);
  const onEdgeSwipeStart = (event) => { edgeSwipeStart.current = event.touches?.[0]?.clientX ?? event.clientX; };
  const onEdgeSwipeEnd = (event) => {
    const end = event.changedTouches?.[0]?.clientX ?? event.clientX;
    if (edgeSwipeStart.current !== null && edgeSwipeStart.current - end >= 48) setTimelineOpen(true);
    edgeSwipeStart.current = null;
  };

  return <div className="photo-map-scene">
    <PhotoMapLeaflet origin={location} posts={filteredPosts} selectedPost={selectedPost} routeVisible={routeVisible} routeData={routeData} onSelectPost={selectPost} onLocate={locate} onMapReady={(map) => { mapRef.current = map; }} />
    <header className="photo-map-header"><div><h1>追·光地图</h1><p>{location.source === "live" ? "已定位到你附近" : location.source === "waiting" ? "正在获取实时位置" : "定位不可用，显示演示区域"}</p></div></header>
    <div className="photo-map-demo-notice"><span>附近真实帖子暂时为空</span><small>以下为功能占位示例</small></div>
    <div className="photo-map-filter-row photo-map-map-filter" data-swipe-lock="true">
      {[['today', '今天'], ['week', '本周']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? "is-active" : ""}>{label}</button>)}
    </div>
    <div className="photo-map-edge-zone" data-swipe-lock="true" aria-hidden="true" onTouchStart={onEdgeSwipeStart} onTouchEnd={onEdgeSwipeEnd} onPointerDown={onEdgeSwipeStart} onPointerUp={onEdgeSwipeEnd}><span className="photo-map-edge-handle" /></div>
    <button type="button" data-swipe-lock="true" className="photo-map-timeline-hint" onClick={() => setTimelineOpen(true)}>← 右滑看附近照片</button>
    {routeVisible && <div className="photo-map-route-notice">路线已按需显示 <button type="button" onClick={() => setRouteVisible(false)}>收起</button></div>}
    <button type="button" data-swipe-lock="true" className="photo-map-publish-button" aria-label="发布照片" onClick={() => setPublishOpen(true)}>+</button>
    <PhotoMapDetailSheet post={selectedPost} routeVisible={routeVisible} routeLoading={routeLoading} onClose={() => { setSelectedPost(null); setRouteVisible(false); }} onNavigate={navigateToPost} onLike={() => setSelectedPost((post) => ({ ...post, likes: (post.likes || 0) + 1 }))} />
    <PhotoMapTimeline posts={filteredPosts} filter={filter} onFilter={setFilter} onSelectPost={selectPost} open={timelineOpen} onClose={() => setTimelineOpen(false)} />
    <PhotoMapPublishSheet open={publishOpen} onClose={() => setPublishOpen(false)} onPublish={publishDemo} />
    <style>{PHOTO_MAP_CSS}</style>
  </div>;
}

const PHOTO_MAP_CSS = `
.photo-map-scene{position:absolute;inset:0;overflow:hidden;background:#edf0f0;color:#17191d;font-family:var(--font-cn),-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;touch-action:pan-y}
.photo-map-header{position:absolute;top:0;left:0;right:0;z-index:500;padding:88px 22px 38px;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,255,255,.86) 67%,rgba(255,255,255,0));pointer-events:auto}.photo-map-header h1{margin:0;font-size:29px;letter-spacing:-1.5px;line-height:1;font-weight:800}.photo-map-header p{margin:10px 0 0;font-size:13px;color:#676c72;font-weight:600}
.photo-map-demo-notice{position:absolute;z-index:510;left:22px;top:171px;display:grid;gap:2px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.88);box-shadow:0 6px 18px rgba(45,50,58,.12);font-size:10px;color:#4b535e}.photo-map-demo-notice span{font-weight:800}.photo-map-demo-notice small{font-size:9px;color:#8c949c}
.photo-map-filter-row{display:flex;gap:6px}.photo-map-filter-row button{border:0;border-radius:999px;padding:7px 13px;background:#fff;color:#707780;font:700 12px inherit;box-shadow:0 4px 12px rgba(45,50,58,.10);cursor:pointer}.photo-map-filter-row button.is-active{background:#1d58d8;color:#fff}.photo-map-map-filter{position:absolute;top:169px;right:20px;z-index:510}
.photo-map-locate{position:absolute;right:20px;bottom:112px;z-index:510;width:48px;height:48px;border:0;border-radius:50%;background:#fff;box-shadow:0 8px 22px rgba(42,48,55,.2);font-size:28px;line-height:1;color:#172033;cursor:pointer}.photo-map-timeline-hint{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);z-index:505;border:0;border-radius:999px;padding:9px 15px;background:rgba(255,255,255,.92);box-shadow:0 6px 18px rgba(42,48,55,.15);font:700 11px inherit;color:#3e4652;white-space:nowrap;cursor:pointer}.photo-map-publish-button{position:absolute;z-index:540;right:20px;bottom:38px;width:65px;height:65px;border:0;border-radius:50%;background:#090b0e;color:#fff;font:400 48px/1 Arial,sans-serif;box-shadow:0 14px 28px rgba(0,0,0,.26);cursor:pointer}.photo-map-route-notice{position:absolute;left:20px;bottom:36px;z-index:510;border-radius:99px;background:#1d58d8;color:#fff;padding:9px 13px;font-size:11px;font-weight:700}.photo-map-route-notice button{margin-left:8px;border:0;background:transparent;color:#fff;font:inherit;text-decoration:underline;cursor:pointer}.photo-map-edge-zone{position:absolute;right:0;top:210px;bottom:190px;width:28px;z-index:520;touch-action:none}.photo-map-edge-handle{position:absolute;right:5px;top:50%;width:4px;height:56px;border-radius:99px;background:rgba(23,25,29,.16);transform:translateY(-50%)}
.photo-map-location-icon{background:transparent!important;border:0!important}.photo-map-location-dot{position:absolute;left:19px;top:19px;width:16px;height:16px;border-radius:50%;background:#2474e8;border:3px solid #fff;box-shadow:0 2px 7px rgba(20,66,133,.35)}.photo-map-location-cone{position:absolute;left:15px;top:0;border-left:12px solid transparent;border-right:12px solid transparent;border-bottom:29px solid rgba(36,116,232,.18);transform:rotate(-26deg);transform-origin:50% 34px}
.photo-map-marker-icon{background:transparent!important;border:0!important}.photo-map-marker-stack{display:flex;flex-direction:column;align-items:center;gap:5px;transform:rotate(var(--tilt))}.photo-map-marker-label{display:inline-flex;align-items:center;gap:3px;max-width:88px;padding:2px 7px;border-radius:6px;background:rgba(255,255,255,.95);box-shadow:0 2px 7px rgba(30,39,47,.28);color:#11151b;font:800 9px/1.3 inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.photo-map-marker-label:before{content:"";flex:none;width:5px;height:5px;border-radius:50%;background:#1d58d8}.photo-map-bubble-marker{position:relative;display:block;width:var(--size);height:var(--size);padding:4px;border:3px solid #fff;border-radius:9px;background:#fff;box-shadow:0 5px 16px rgba(30,39,47,.3);cursor:pointer;overflow:visible}.photo-map-marker-image{display:block;width:100%;height:100%;border-radius:4px;background:var(--tone)}.photo-map-marker-image:after{content:"";display:block;width:54%;height:21%;margin:48% auto 0;border-radius:99px;background:rgba(255,255,255,.34);filter:blur(3px)}.photo-map-marker-demo{position:absolute;right:-4px;top:-9px;border:1px solid rgba(255,255,255,.8);border-radius:99px;background:#333c49;color:#fff;padding:2px 5px;font:700 8px/1 inherit;white-space:nowrap;transform:rotate(calc(var(--tilt) * -1))}.photo-map-bubble-marker.is-live{animation:photo-map-pop .65s cubic-bezier(.16,.85,.25,1.25) both;box-shadow:0 0 0 7px rgba(29,88,216,.18),0 7px 18px rgba(30,39,47,.35)}.photo-map-note-marker{width:80px;min-height:55px;padding:9px;border:0;border-radius:8px;background:#f7d77b;color:#564823;box-shadow:0 5px 13px rgba(53,42,16,.2);font:700 10px/1.25 inherit;text-align:left;transform:rotate(var(--tilt));cursor:pointer}.photo-map-route-line{filter:drop-shadow(0 1px 2px rgba(255,255,255,.9))}@keyframes photo-map-pop{from{transform:scale(.2);opacity:0}70%{transform:scale(1.12)}to{transform:scale(1);opacity:1}}
.photo-map-detail-sheet,.photo-map-timeline,.photo-map-publish-sheet{position:absolute;left:0;right:0;bottom:0;z-index:700;border-radius:24px 24px 0 0;background:rgba(255,255,255,.98);box-shadow:0 -15px 44px rgba(25,32,40,.23);animation:photo-map-sheet-in .28s ease-out both}.photo-map-detail-sheet{min-height:430px;padding:12px 18px 25px}.photo-map-sheet-handle{width:34px;height:4px;margin:0 auto 14px;border-radius:99px;background:#d3d8dd}.photo-map-sheet-close{position:absolute;right:17px;top:14px;width:27px;height:27px;border:0;border-radius:50%;background:#eef1f3;color:#5c6570;font-size:20px;line-height:24px;cursor:pointer}.photo-map-detail-media{height:150px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.92);font-size:12px;font-weight:800;position:relative;overflow:hidden}.photo-map-detail-media:before{content:"";position:absolute;width:130%;height:48px;top:-8px;left:-15px;background:rgba(255,255,255,.18);transform:rotate(-12deg)}.photo-map-detail-media span,.photo-map-detail-media em{position:relative}.photo-map-detail-media em{position:absolute;top:8px;right:9px;padding:3px 6px;border-radius:5px;background:rgba(0,0,0,.35);font-style:normal;font-size:9px}.photo-map-detail-copy{padding:11px 2px 0}.photo-map-detail-meta{display:flex;gap:5px;align-items:center;font-size:11px;color:#747c85}.photo-map-detail-meta strong{color:#1b222d}.photo-map-detail-copy p{margin:7px 0 11px;font-size:14px;line-height:1.4;color:#252c36;font-weight:600}.photo-map-detail-actions{display:flex;gap:7px;align-items:center}.photo-map-detail-actions button{border:0;border-radius:9px;background:#eef1f4;padding:8px 10px;color:#47515e;font:700 11px inherit;cursor:pointer}.photo-map-detail-actions small{font-size:8px;color:#9299a2}.photo-map-detail-actions .photo-map-route-button{margin-left:auto;background:#1d58d8;color:#fff;padding-inline:13px}
.photo-map-timeline{min-height:306px;padding:12px 18px 24px}.photo-map-timeline-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.photo-map-timeline-title div{display:grid;gap:2px}.photo-map-timeline-title strong{font-size:18px}.photo-map-timeline-title span{font-size:10px;color:#8a929a}.photo-map-timeline-title button{border:0;background:#eef1f3;width:28px;height:28px;border-radius:50%;font-size:20px;color:#5c6570;cursor:pointer}.photo-map-timeline-list{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.photo-map-timeline-card{min-width:0;padding:0;border:0;background:transparent;text-align:left;cursor:pointer}.photo-map-timeline-card>span{display:grid;place-items:center;height:78px;border-radius:9px;color:rgba(255,255,255,.9);font-size:9px;font-weight:800}.photo-map-timeline-card i{display:grid;gap:3px;margin-top:5px;font-style:normal}.photo-map-timeline-card b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#27303b;font-size:10px}.photo-map-timeline-card small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7d858e;font-size:8px}.photo-map-timeline-card em{font-style:normal;color:#9aa1a9;font-size:8px}
.photo-map-publish-sheet{padding:13px 21px 27px;text-align:center}.photo-map-publish-sheet strong{display:block;font-size:18px}.photo-map-publish-sheet p{margin:8px auto 13px;max-width:290px;color:#727b85;font-size:11px;line-height:1.45}.photo-map-publish-preview{height:72px;border-radius:12px;display:grid;place-items:center;background:${PHOTO_MAP_TONES.sunset};color:#fff;font-size:11px;font-weight:800}.photo-map-publish-confirm{width:100%;margin-top:12px;border:0;border-radius:12px;background:#11151b;color:#fff;padding:13px;font:800 14px inherit;cursor:pointer}@keyframes photo-map-sheet-in{from{transform:translateY(105%)}to{transform:translateY(0)}}.photo-map-fallback-grid{position:absolute;inset:0;background-image:linear-gradient(90deg,rgba(143,155,163,.12) 1px,transparent 1px),linear-gradient(rgba(143,155,163,.12) 1px,transparent 1px);background-size:30px 30px}
`;

Object.assign(window, { ScenePhotoMap });
