const core = window.LightchaserAICameraCore;
const filterPresets = core.FILTER_PRESETS;
const filterous = window.filterous;
const vision = window.LightchaserVision;

const FILTEROUS_PRESETS = {
  "iPhone Rich Contrast": "clarendon",
  "iPhone Vibrant": "juno",
  "iPhone Warm": "valencia",
  "iPhone Cool": "lark",
  "FUJIFILM PROVIA": "ludwig",
  "FUJIFILM Velvia": "lofi",
  "FUJIFILM ASTIA": "reyes",
  "FUJIFILM Classic Chrome": "gingham",
  "FUJIFILM Classic Neg.": "brooklyn",
  "FUJIFILM ETERNA": "aden",
  "FUJIFILM ACROS": "inkwell",
  "Google Dynamic": "clarendon",
  "Google Night Sight": "skyline",
  "Google Portrait": "crema",
  "Clear Scan": "moon",
};

const STORAGE_KEY = "lightchaser.camera.photos.v1";
const SETTINGS_KEY = "lightchaser.camera.settings.v1";
const MAX_PHOTOS = 12;
const VALID_ASPECT_RATIOS = new Set(["1:1", "3:4", "4:3", "16:9"]);
const AUTO_RATIO_STABLE_COUNT = 3;
const VISION_RUNTIME_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tf-backend-wasm.min.js",
  "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js",
];

const app = document.getElementById("cameraApp");
const viewfinder = document.getElementById("viewfinder");
const video = document.getElementById("camera");
const cropBoxEl = document.getElementById("cropBox");
const focusRing = document.getElementById("focusRing");
const sunsetChip = document.getElementById("sunsetChip");
const scenePill = document.getElementById("scenePill");
const tipChip = document.getElementById("tipChip");
const startGate = document.getElementById("startGate");
const startButton = document.getElementById("startButton");
const retryButton = document.getElementById("retryButton");
const statusEl = document.getElementById("status");
const captureButton = document.getElementById("captureButton");
const switchButton = document.getElementById("switchButton");
const thumbnailButton = document.getElementById("thumbnailButton");
const gridButton = document.getElementById("gridButton");
const compositionToggle = document.getElementById("compositionToggle");
const filterToggle = document.getElementById("filterToggle");
const busyLayer = document.getElementById("busyLayer");
const reviewLayer = document.getElementById("reviewLayer");
const reviewImage = document.getElementById("reviewImage");
const reviewTitle = document.getElementById("reviewTitle");
const reviewMeta = document.getElementById("reviewMeta");
const closeReviewButton = document.getElementById("closeReviewButton");
const variantTabs = document.getElementById("variantTabs");
const downloadLink = document.getElementById("downloadLink");
const deletePhotoButton = document.getElementById("deletePhotoButton");
const debugPanel = document.getElementById("debugPanel");
const debugJson = document.getElementById("debugJson");
const sampleMediaButton = document.getElementById("sampleMediaButton");
const mediaInput = document.getElementById("mediaInput");
const downloadMetadataButton = document.getElementById("downloadMetadataButton");

const query = new URLSearchParams(window.location.search);
const savedSettings = loadJson(SETTINGS_KEY, {});
const state = {
  stream: null,
  devices: [],
  activeDeviceId: savedSettings.deviceId || null,
  facingMode: savedSettings.facingMode || "environment",
  sourceType: "camera",
  imageSource: null,
  debug: query.get("debug") === "1",
  grid: savedSettings.grid !== false,
  aspectRatio: savedAspectRatio(savedSettings.aspectRatio),
  aiComposition: savedBoolean("aiComposition", false),
  aiFilter: savedBoolean("aiFilter", false),
  pageVisible: true,
  pendingResume: false,
  samples: [],
  lastDecision: null,
  lastMetadata: null,
  lastVisionSample: null,
  visionInitStarted: false,
  photos: [],
  activePhotoId: null,
  activeVariantKey: "final",
  sunsetSnapshot: null,
  captureBusy: false,
  aspectRatioCandidate: null,
  aspectRatioCandidateCount: 0,
  // 滤镜抽屉状态
  lockedFilter: savedString("lockedFilter", null) || null,
  drawerBrand: null,          // 抽屉当前展示的 brand;null = 原生
  filterDrawerOpen: false,
  visionWarmupTimer: null,
};

let visionRuntimePromise = null;

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function savedBoolean(key, fallback) {
  return typeof savedSettings[key] === "boolean" ? savedSettings[key] : fallback;
}

function savedString(key, fallback) {
  return typeof savedSettings[key] === "string" ? savedSettings[key] : fallback;
}

function savedAspectRatio(value) {
  return VALID_ASPECT_RATIOS.has(value) ? value : "3:4";
}

function saveSettings() {
  const payload = {
    deviceId: state.activeDeviceId,
    facingMode: state.facingMode,
    grid: state.grid,
    aspectRatio: state.aspectRatio,
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    lockedFilter: state.lockedFilter,
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  } catch (error) {
    // Settings are nice to keep, but never block the camera.
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setBusy(active, message = "正在处理照片") {
  busyLayer.textContent = message;
  busyLayer.classList.toggle("active", Boolean(active));
}

function setAppMode({ updateDecision: shouldUpdateDecision = true } = {}) {
  app.dataset.ratio = state.aspectRatio;
  app.classList.toggle("grid-on", state.grid);
  app.classList.toggle("debug-on", state.debug);
  gridButton.setAttribute("aria-pressed", String(state.grid));
  compositionToggle.setAttribute("aria-pressed", String(state.aiComposition));
  filterToggle.setAttribute("aria-pressed", String(state.aiFilter));
  if (!state.aiComposition) {
    cropBoxEl.hidden = true;
  }
  saveSettings();
  if (shouldUpdateDecision) updateDecision();
}

function sourceReady(source) {
  if (!source) return false;
  if (source instanceof HTMLImageElement) return source.complete && source.naturalWidth > 0;
  return source.readyState >= 2;
}

function currentSource() {
  return state.sourceType === "image" ? state.imageSource : video;
}

function sourceSize(source = currentSource()) {
  return {
    width: source?.videoWidth || source?.naturalWidth || 1280,
    height: source?.videoHeight || source?.naturalHeight || 720,
  };
}

function canProcessLiveSource() {
  return state.pageVisible
    && !reviewLayer.classList.contains("active")
    && sourceReady(currentSource());
}

function setupLifecycle() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseCamera();
    else resumeCamera();
  });
  window.addEventListener("pagehide", pauseCamera);
}

function pauseCamera() {
  state.pageVisible = false;
  if (state.sourceType === "camera" && state.stream) {
    stopCameraStream();
    state.pendingResume = true;
  }
}

function resumeCamera() {
  state.pageVisible = true;
  if (state.pendingResume) {
    state.pendingResume = false;
    startCamera(state.activeDeviceId);
  }
}

function sampleFrame() {
  const source = currentSource();
  if (!sourceReady(source)) return null;
  const frame = sourceSize();
  // 优先用 vision engine（COCO-SSD 检测），失败回退像素统计
  if (vision?.ready) {
    return sampleFrameWithVision(source, frame);
  }
  return sampleFrameWithStats(source, frame);
}

function sampleFrameWithVision(source, frame) {
  // 异步检测：返回一个占位 sample，真正的检测通过 detectLoop 异步填充
  // 这里只返回当前缓存的 lastVisionSample，避免阻塞 RAF
  return state.lastVisionSample || null;
}

async function detectLoop() {
  if (!vision?.ready || state.captureBusy) return;
  const source = currentSource();
  if (!sourceReady(source)) return;
  const frame = sourceSize();
  try {
    const sample = await vision.detect(source, frame);
    if (sample) {
      state.lastVisionSample = sample;
    }
  } catch (error) {
    // 检测失败，保留旧 sample
  }
}

function sampleFrameWithStats(source, frame) {
  // 原像素统计法（fallback）
  const sampleWidth = 96;
  const sampleHeight = Math.max(54, Math.round(sampleWidth * frame.height / frame.width));
  const canvas = document.createElement("canvas");
  const sampleCtx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  sampleCtx.drawImage(source, 0, 0, sampleWidth, sampleHeight);
  const imageData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let total = 0;
  let warmth = 0;
  let brightPixels = 0;
  let saturatedWarm = 0;
  let darkPixels = 0;

  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const brightness = (r + g + b) / 765;
    total += brightness;
    warmth += (r - b) / 255;
    if (brightness > 0.72) brightPixels += 1;
    if (brightness < 0.24) darkPixels += 1;
    if (r > g * 1.08 && r > b * 1.22 && brightness > 0.32) saturatedWarm += 1;
  }

  const pixels = imageData.length / 4;
  const frameStats = { brightness: total / pixels, warmth: warmth / pixels };
  const scene = inferDemoScene(frameStats, brightPixels / pixels, darkPixels / pixels, saturatedWarm / pixels);
  // 亮度重心不等于拍摄主体。降级模式只提供场景和光线建议，绝不虚构主体裁切。
  return { scene: scene.scene, confidence: scene.confidence, frameStats, subjectBox: null, subjectBoxes: [], at: Date.now() };
}

function inferDemoScene(frameStats, brightRatio, darkRatio, warmRatio) {
  if (darkRatio > 0.34 && brightRatio > 0.08) return { scene: "night", confidence: 0.82 };
  if (warmRatio > 0.22) return { scene: "food", confidence: 0.76 };
  if (frameStats.brightness > 0.62 && Math.abs(frameStats.warmth) < 0.08) return { scene: "landscape", confidence: 0.68 };
  if (frameStats.warmth > 0.05) return { scene: "portrait", confidence: 0.66 };
  if (frameStats.brightness < 0.45) return { scene: "indoor", confidence: 0.64 };
  return { scene: "street", confidence: 0.58 };
}

function resetAspectRatioStability() {
  state.aspectRatioCandidate = null;
  state.aspectRatioCandidateCount = 0;
}

function applyStableAspectRatio(decision) {
  const candidate = decision?.recommendedAspectRatio;
  if (
    !state.aiComposition
    || !VALID_ASPECT_RATIOS.has(candidate)
    || candidate === state.aspectRatio
    || decision.decisionReason === "low_scene_confidence"
  ) {
    resetAspectRatioStability();
    return;
  }

  if (state.aspectRatioCandidate === candidate) {
    state.aspectRatioCandidateCount += 1;
  } else {
    state.aspectRatioCandidate = candidate;
    state.aspectRatioCandidateCount = 1;
  }

  if (state.aspectRatioCandidateCount >= AUTO_RATIO_STABLE_COUNT) {
    state.aspectRatio = candidate;
    resetAspectRatioStability();
    setAppMode({ updateDecision: false });
  }
}

function updateDecision() {
  if (!sourceReady(currentSource()) || state.captureBusy) return;
  const sample = sampleFrame();
  if (!sample) return;
  state.samples.push(sample);
  state.samples = state.samples.slice(-10);
  const ratioDecision = core.buildCaptureDecision({
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    frame: sourceSize(),
    samples: state.samples,
    previousDecision: state.lastDecision,
    manualAspectRatio: state.aspectRatio,
    aspectRatioMode: state.aiComposition ? "auto" : "manual",
  });
  applyStableAspectRatio(ratioDecision);
  const decision = state.aiComposition && ratioDecision.recommendedAspectRatio === state.aspectRatio
    ? ratioDecision
    : core.buildCaptureDecision({
      aiComposition: state.aiComposition,
      aiFilter: state.aiFilter,
      frame: sourceSize(),
      samples: state.samples,
      previousDecision: state.lastDecision,
      manualAspectRatio: state.aspectRatio,
      aspectRatioMode: "manual",
    });
  decision.recommendedAspectRatio = ratioDecision.recommendedAspectRatio;
  decision.ratioReason = ratioDecision.ratioReason;
  decision.compositionGuideText = ratioDecision.compositionGuideText;
  state.lastDecision = decision;
  renderDecision(state.lastDecision);
}

async function updateDecisionWithVision() {
  if (!sourceReady(currentSource()) || state.captureBusy) return;
  if (vision?.ready) {
    await detectLoop();
  }
  updateDecision();
}

let detectRunning = false;
function scheduleDetect() {
  setTimeout(async () => {
    if (detectRunning || !canProcessLiveSource()) { scheduleDetect(); return; }
    detectRunning = true;
    try {
      await updateDecisionWithVision();
    } finally {
      detectRunning = false;
      scheduleDetect();
    }
  }, 1000);
}

function renderDecision(decision) {
  scenePill.textContent = `${decision.sceneLabel} · ${decision.light}`;
  const tip = cameraTip(decision);
  tipChip.textContent = tip.text;
  tipChip.className = `chip ${tip.kind}`;
  if (state.aiComposition && decision.output?.applyComposition) {
    positionCropBox(decision.cropBox);
    cropBoxEl.hidden = false;
  } else {
    cropBoxEl.hidden = true;
  }
  renderDebug();
}

function cameraTip(decision) {
  if (decision.light === "偏暗") return { text: "光线偏暗，建议稳住手机或寻找亮部", kind: "warn" };
  if (decision.light === "过曝") return { text: "画面偏亮，轻点高光区域可降低曝光", kind: "warn" };
  if (state.aiComposition && decision.compositionGuideText && decision.recommendedAspectRatio) {
    return { text: `AI 推荐 ${decision.recommendedAspectRatio} · ${decision.compositionGuideText}`, kind: "good" };
  }
  if (decision.light === "偏暖") return { text: "色温偏暖，AI 会自动做轻微冷却", kind: "" };
  if (decision.light === "偏冷") return { text: "色温偏冷，AI 会自动补暖", kind: "" };
  if (!state.aiComposition && !state.aiFilter) return { text: "普通拍照模式，可从右侧开启 AI 构图或 AI 滤镜", kind: "" };
  if (!state.aiComposition && state.aiFilter && decision.appliedFilter) return { text: `${filterLabel(decision.appliedFilter)} 已准备好`, kind: "good" };
  if (state.sunsetSnapshot?.scoreLabel) return { text: `${state.sunsetSnapshot.scoreLabel} · ${state.sunsetSnapshot.recommendation?.direction || "留意光线方向"}`, kind: "good" };
  return { text: "构图稳定，按下快门即可拍摄", kind: "good" };
}

function positionCropBox(cropBox) {
  // 用 video（用户实际所见）的渲染矩形，
  // 这样 cropBox 与 object-fit:cover 的可见画面严格对齐。
  const stage = video.getBoundingClientRect();
  const videoW = video.videoWidth || sourceSize().width;
  const videoH = video.videoHeight || sourceSize().height;
  // object-fit: cover：取较大缩放比，溢出部分被裁
  const scale = Math.max(stage.width / videoW, stage.height / videoH);
  const renderedWidth = videoW * scale;
  const renderedHeight = videoH * scale;
  const offsetX = (stage.width - renderedWidth) / 2;
  const offsetY = (stage.height - renderedHeight) / 2;
  cropBoxEl.style.left = `${offsetX + cropBox.x * scale}px`;
  cropBoxEl.style.top = `${offsetY + cropBox.y * scale}px`;
  cropBoxEl.style.width = `${cropBox.width * scale}px`;
  cropBoxEl.style.height = `${cropBox.height * scale}px`;
}

async function initVisionEngine() {
  if (state.visionInitStarted || !vision) return;
  state.visionInitStarted = true;
  setStatus("正在加载 AI 视觉模型（首次较慢）...");
  try {
    await loadVisionRuntime();
    const ok = await vision.init((stage) => {
      if (stage === "backend") setStatus("正在初始化 AI 计算后端...");
      else if (stage === "model") setStatus("正在下载物体检测模型...");
      else if (stage === "done") setStatus("AI 视觉模型就绪。");
    });
    if (ok) {
      scenePill.textContent = `AI 视觉就绪 · ${vision.backend}`;
    } else {
      scenePill.textContent = `AI 视觉未启用 · 回退像素统计`;
      setStatus(`模型加载失败：${vision.loadError || "未知"}，已回退到像素统计模式`);
    }
  } catch (error) {
    scenePill.textContent = "AI 视觉未启用 · 回退像素统计";
  }
}

function loadVisionRuntime() {
  if (window.tf && window.cocoSsd) return Promise.resolve();
  if (visionRuntimePromise) return visionRuntimePromise;
  visionRuntimePromise = VISION_RUNTIME_SCRIPTS.reduce(
    (promise, src) => promise.then(() => loadScript(src)),
    Promise.resolve()
  );
  return visionRuntimePromise;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`script_load_failed:${src}`));
    document.head.appendChild(script);
  });
}

function queueVisionWarmup(delay = 1600) {
  if (state.visionInitStarted || vision?.ready || state.visionWarmupTimer) return;
  state.visionWarmupTimer = setTimeout(() => {
    state.visionWarmupTimer = null;
    initVisionEngine();
  }, delay);
}

async function startCamera(preferredDeviceId = state.activeDeviceId) {
  setStatus("正在启动摄像头...");
  startButton.disabled = true;
  retryButton.disabled = true;
  startButton.textContent = "正在启动...";
  stopCameraStream();
  resetAspectRatioStability();
  try {
    const stream = await openCameraStream(preferredDeviceId);
    state.stream = stream;
    state.sourceType = "camera";
    state.imageSource = null;
    video.hidden = false;
    video.srcObject = stream;
    video.src = "";
    await video.play();
    const videoTrack = stream.getVideoTracks()[0];
    state.activeDeviceId = videoTrack?.getSettings?.().deviceId || preferredDeviceId || null;
    await refreshDevices();
    startGate.hidden = true;
    captureButton.disabled = false;
    switchButton.disabled = state.devices.length < 2;
    setStatus("摄像头已启动。");
    queueVisionWarmup();
  } catch (error) {
    captureButton.disabled = true;
    startGate.hidden = false;
    retryButton.hidden = false;
    state.activeDeviceId = null;
    startButton.textContent = "重试启动相机";
    setStatus(cameraErrorMessage(error));
  } finally {
    startButton.disabled = false;
    retryButton.disabled = false;
  }
  saveSettings();
}

async function openCameraStream(preferredDeviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("media_devices_unavailable");
  }

  const attempts = [];
  if (preferredDeviceId) {
    attempts.push({
      label: "saved-device",
      constraints: { video: { deviceId: { exact: preferredDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
    });
  }
  attempts.push({
    label: "preferred-facing",
    constraints: { video: { facingMode: { ideal: state.facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
  });
  attempts.push({
    label: "any-camera",
    constraints: { video: true, audio: false },
  });

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(attempt.constraints);
    } catch (error) {
      lastError = error;
      if (attempt.label === "saved-device" && isMissingDeviceError(error)) {
        state.activeDeviceId = null;
        saveSettings();
      }
    }
  }
  throw lastError || new Error("camera_unavailable");
}

function isMissingDeviceError(error) {
  return error?.name === "NotFoundError"
    || error?.name === "OverconstrainedError"
    || /not found|notfound|device/i.test(error?.message || "");
}

function cameraErrorMessage(error) {
  const name = error?.name || "";
  const message = error?.message || "";
  if (name === "NotAllowedError" || /permission|denied/i.test(message)) {
    return "相机权限被拒绝。请在浏览器地址栏允许摄像头权限，然后点击重试。";
  }
  if (isMissingDeviceError(error)) {
    return "没有检测到可用摄像头，或上次保存的摄像头已失效。请确认设备连接后点击重试；也可打开 ?debug=1 用示例照片验证拍照流程。";
  }
  if (name === "NotReadableError" || /could not start|in use|busy/i.test(message)) {
    return "摄像头被其他应用占用，或浏览器暂时无法启动摄像头。请关闭占用摄像头的应用后重试。";
  }
  if (message === "media_devices_unavailable") {
    return "当前浏览器不支持网页摄像头，建议使用 Chrome 或 Safari 打开本地预览。";
  }
  return `摄像头启动失败：${message || name || "未知错误"}`;
}

async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    state.devices = devices.filter((device) => device.kind === "videoinput");
  } catch (error) {
    state.devices = [];
  }
}

async function switchCamera() {
  if (state.devices.length < 2) return;
  const currentIndex = state.devices.findIndex((device) => device.deviceId === state.activeDeviceId);
  const next = state.devices[(currentIndex + 1 + state.devices.length) % state.devices.length];
  if (!next) return;
  const oldDeviceId = state.activeDeviceId;
  const oldStream = state.stream;
  state.activeDeviceId = next.deviceId;
  setBusy(true, "正在切换摄像头");
  try {
    const newStream = await openCameraStream(next.deviceId);
    if (oldStream) {
      for (const track of oldStream.getTracks()) track.stop();
    }
    state.stream = newStream;
    state.sourceType = "camera";
    state.imageSource = null;
    video.hidden = false;
    video.srcObject = newStream;
    video.src = "";
    await video.play();
    await refreshDevices();
    startGate.hidden = true;
    captureButton.disabled = false;
    switchButton.disabled = state.devices.length < 2;
    setStatus("已切换摄像头。");
    saveSettings();
  } catch (error) {
    state.activeDeviceId = oldDeviceId;
    if (oldStream && !state.stream) {
      state.stream = oldStream;
      video.srcObject = oldStream;
    }
    setStatus(`切换失败：${cameraErrorMessage(error)}，已保持在当前摄像头`);
  } finally {
    setBusy(false);
  }
}

function stopCameraStream() {
  if (!state.stream) return;
  for (const track of state.stream.getTracks()) {
    track.stop();
  }
  state.stream = null;
}

async function capturePhoto() {
  if (state.captureBusy || !sourceReady(currentSource())) return;
  state.captureBusy = true;
  captureButton.disabled = true;
  setBusy(true, "正在拍摄");
  const shotStarted = performance.now();
  try {
    const originalCanvas = await captureOriginalCanvas();
    const shutterLatencyMs = Math.round(performance.now() - shotStarted);
    const samples = state.samples.length ? state.samples.slice(-8) : [sampleFrame()].filter(Boolean);
    const photo = await buildPhotoRecord(originalCanvas, samples, shutterLatencyMs);
    savePhotoRecord(photo);
    openReview(photo.id, photo.defaultVariantKey);
  } catch (error) {
    setStatus(`拍照失败：${error.message}`);
    showCaptureRetry(error.message);
  } finally {
    state.captureBusy = false;
    captureButton.disabled = !sourceReady(currentSource());
    setBusy(false);
  }
}

let captureRetryTimer = null;
function showCaptureRetry(message) {
  busyLayer.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = `拍照失败：${message}`;
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "secondary-button";
  retryBtn.textContent = "重试";
  retryBtn.style.minHeight = "40px";
  retryBtn.addEventListener("click", () => {
    hideCaptureRetry();
    capturePhoto();
  });
  busyLayer.appendChild(text);
  busyLayer.appendChild(retryBtn);
  busyLayer.classList.add("active");
  if (captureRetryTimer) clearTimeout(captureRetryTimer);
  captureRetryTimer = setTimeout(hideCaptureRetry, 6000);
}

function hideCaptureRetry() {
  if (captureRetryTimer) { clearTimeout(captureRetryTimer); captureRetryTimer = null; }
  busyLayer.classList.remove("active");
  busyLayer.textContent = "正在处理照片";
}

async function captureOriginalCanvas() {
  const source = currentSource();
  const size = sourceSize(source);
  const canvas = makeCanvas(size.width, size.height);
  canvas.getContext("2d").drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

function imageBitmapToCanvas(bitmap) {
  const canvas = makeCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  return canvas;
}

async function buildPhotoRecord(originalCanvas, samples, shutterLatencyMs) {
  // Step 3: 1 次快门 → 1 张 final 成片。所有"用了什么"写到 metadata 供调试/二修。
  const samplesForDecision = samples.length ? samples : [sampleFrame()].filter(Boolean);
  const captureAspectRatio = state.lastDecision?.effectiveAspectRatio || state.aspectRatio;
  const aspectCrop = aspectCropBox(originalCanvas, captureAspectRatio);
  const framedCanvas = cropCanvas(originalCanvas, aspectCrop);

  const framedDecision = core.buildCaptureDecision({
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    sourceType: state.sourceType,
    frame: { width: framedCanvas.width, height: framedCanvas.height },
    samples: normalizeSamplesForFrame(samplesForDecision, aspectCrop),
    previousDecision: state.lastDecision,
    manualAspectRatio: captureAspectRatio,
    aspectRatioMode: "manual",
  });
  // 用户在滤镜抽屉手动锁定一个滤镜 → 改写 decision.output.selectedFilterKey
  applyLockedFilter(framedDecision, state.lockedFilter);

  // 1. 构图裁剪(如果 AI 构图开启且有 cropBox)
  let processedCanvas = framedCanvas;
  let cropBoxApplied = null;
  if (framedDecision.output?.applyComposition && framedDecision.cropBox) {
    processedCanvas = cropCanvas(framedCanvas, framedDecision.cropBox);
    cropBoxApplied = framedDecision.cropBox;
  }

  // 2. 应用滤镜管线(单一滤镜,locked 优先,否则 AI 推荐)
  const filterKey = framedDecision.output?.selectedFilterKey || null;
  let pipelineNames = [];
  let renderTimeMs = 0;
  let renderMode = "skip";
  if (filterKey && filterPresets[filterKey]) {
    // Step 4:用 PhotoRenderer(worker 或 main thread 异步)替代同步 applyFilterToCanvas
    const renderer = getPhotoRenderer();
    const renderStarted = performance.now();
    if (renderer) {
      const result = await renderer.render({
        sourceCanvas: processedCanvas,
        filterKey,
        preset: filterPresets[filterKey],
        sceneContext: { aspectRatio: captureAspectRatio, crop: cropBoxApplied },
      });
      // main-thread 模式下 result.finalCanvas === sourceCanvas(已 in-place 修改)
      // worker 模式下 result.finalCanvas 是重建的 canvas
      if (result?.finalCanvas && result.finalCanvas !== processedCanvas) {
        processedCanvas = result.finalCanvas;
      }
      pipelineNames = result?.pipeline || [];
      renderTimeMs = result?.renderTimeMs || 0;
      renderMode = result?.renderMode || renderer.mode;
    } else {
      // 完全没有 renderer 模块 → fallback 老 applyFilterToCanvas
      await applyFilterToCanvas(processedCanvas, filterKey);
      pipelineNames = pipelineNamesFromPreset(filterPresets[filterKey]);
      renderMode = "fallback";
    }
    const renderTotalMs = Math.round(performance.now() - renderStarted);
    // 全链路 latency(含 await 调度)
    renderTimeMs = renderTimeMs || renderTotalMs;
  }

  const finalDataUrl = await canvasToDataUrl(processedCanvas, "image/jpeg", 0.94);

  const metadata = {
    id: crypto.randomUUID ? crypto.randomUUID() : `photo-${Date.now()}`,
    createdAt: new Date().toISOString(),
    shutterLatencyMs,
    sourceType: state.sourceType,
    aspectRatio: captureAspectRatio,
    manualAspectRatio: state.aspectRatio,
    recommendedAspectRatio: state.lastDecision?.recommendedAspectRatio || framedDecision.recommendedAspectRatio,
    effectiveAspectRatio: captureAspectRatio,
    ratioReason: state.lastDecision?.ratioReason || framedDecision.ratioReason,
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    lockedFilter: state.lockedFilter,
    filterApplied: filterKey,
    filterEngine: filterKey ? filterEngineName(filterKey) : null,
    filterousFilter: filterKey ? filterousFilterName(filterKey) : null,
    cropApplied: cropBoxApplied,
    pipeline: pipelineNames,
    renderTimeMs,
    renderMode,
    decision: framedDecision,
    sunsetSnapshot: state.sunsetSnapshot,
    sampleCount: samplesForDecision.length,
    samples: samplesForDecision.map((sample) => ({
      at: sample.at,
      scene: sample.scene,
      confidence: sample.confidence,
      frameStats: sample.frameStats,
      subjectBox: sample.subjectBox,
      subjectBoxes: sample.subjectBoxes,
    })),
  };

  state.lastMetadata = metadata;
  return {
    id: metadata.id,
    createdAt: metadata.createdAt,
    title: buildPhotoTitle(framedDecision),
    defaultVariantKey: "final",
    variants: [{
      key: "final",
      label: "成片",
      dataUrl: finalDataUrl,
      width: processedCanvas.width,
      height: processedCanvas.height,
    }],
    metadata,
  };
}

function pipelineNamesFromPreset(preset) {
  if (!preset) return [];
  const names = [];
  if (preset.lut && window.LightchaserFilterLUTs?.LUT_FACTORY?.[preset.lut]) {
    names.push("lut");
  }
  if (preset.tone) names.push("tone");
  if (preset.grain) names.push("grain");
  if (preset.vignette) names.push("vignette");
  return names;
}

function aspectCropBox(source, ratioName) {
  const targetRatio = ratioValue(ratioName);
  const sourceRatio = source.width / source.height;
  let width = source.width;
  let height = source.height;
  let x = 0;
  let y = 0;
  if (sourceRatio > targetRatio) {
    width = Math.round(source.height * targetRatio);
    x = Math.round((source.width - width) / 2);
  } else if (sourceRatio < targetRatio) {
    height = Math.round(source.width / targetRatio);
    y = Math.round((source.height - height) / 2);
  }
  return { x, y, width, height };
}

function ratioValue(ratioName) {
  if (ratioName === "1:1") return 1;
  if (ratioName === "16:9") return 16 / 9;
  if (ratioName === "3:4") return 3 / 4;
  return 4 / 3;
}

function normalizeSamplesForFrame(samples, aspectCrop) {
  if (!samples.length) return samples;
  return samples.map((sample) => {
    const resizeBox = (box) => {
      if (!box) return box;
      const left = Math.max(0, box.x - aspectCrop.x);
      const top = Math.max(0, box.y - aspectCrop.y);
      const right = Math.min(aspectCrop.width, box.x + box.width - aspectCrop.x);
      const bottom = Math.min(aspectCrop.height, box.y + box.height - aspectCrop.y);
      if (right <= left || bottom <= top) return null;
      return {
        ...box,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      };
    };
    return {
      ...sample,
      subjectBox: resizeBox(sample.subjectBox),
      subjectBoxes: Array.isArray(sample.subjectBoxes) ? sample.subjectBoxes.map(resizeBox).filter(Boolean) : sample.subjectBoxes,
    };
  });
}

function buildPhotoTitle(decision) {
  const filter = decision.appliedFilter ? filterLabel(decision.appliedFilter) : "原图";
  return `${decision.sceneLabel} · ${decision.light} · ${filter}`;
}

let idbAvailable = true;
let idbDB = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!idbAvailable || !window.indexedDB) {
      idbAvailable = false;
      reject(new Error("idb_unavailable"));
      return;
    }
    if (idbDB) { resolve(idbDB); return; }
    const req = indexedDB.open("lightchaser-camera", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", { keyPath: "id" }).createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => { idbDB = req.result; resolve(idbDB); };
    req.onerror = () => { idbAvailable = false; reject(req.error); };
  });
}

function idbRequest(store, mode, method, ...args) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = tx.objectStore(store)[method](...args);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function putPhoto(photo) {
  return idbRequest("photos", "readwrite", "put", photo).catch(() => {
    savePhotoToLocal(photo);
  });
}

function deletePhotoFromIDB(id) {
  return idbRequest("photos", "readwrite", "delete", id).catch(() => {});
}

function getAllPhotos() {
  return idbRequest("photos", "readonly", "getAll").catch(() => []);
}

function savePhotoToLocal(photo) {
  try {
    const all = loadJson(STORAGE_KEY, []);
    const filtered = all.filter((p) => p.id !== photo.id);
    filtered.unshift(photo);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_PHOTOS)));
  } catch (error) {
    // localStorage also full — photo lives only in memory this session
  }
}

async function loadPhotosFromStore() {
  try {
    const all = await getAllPhotos();
    if (all && all.length) {
      state.photos = all.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, MAX_PHOTOS);
      renderThumbnail();
      return;
    }
  } catch (error) {
    // fall through to localStorage
  }
  // 一次性迁移：localStorage 旧数据搬入 IDB
  const legacy = loadJson(STORAGE_KEY, null);
  if (legacy && legacy.length) {
    state.photos = legacy.slice(0, MAX_PHOTOS);
    renderThumbnail();
    for (const p of state.photos) { await putPhoto(p); }
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }
}

function savePhotoRecord(photo) {
  state.photos = [photo, ...state.photos.filter((item) => item.id !== photo.id)].slice(0, MAX_PHOTOS);
  renderThumbnail();
  renderDebug();
  putPhoto(photo).catch(() => {
    setStatus("照片已生成，但持久化存储不可用，刷新后可能不会保留。");
  });
}

function activePhoto() {
  return state.photos.find((photo) => photo.id === state.activePhotoId) || state.photos[0] || null;
}

function activeVariant(photo = activePhoto()) {
  if (!photo) return null;
  return photo.variants.find((variant) => variant.key === state.activeVariantKey)
    || photo.variants.find((variant) => variant.key === photo.defaultVariantKey)
    || photo.variants[0];
}

function openReview(photoId = state.photos[0]?.id, variantKey = null) {
  const photo = state.photos.find((item) => item.id === photoId) || state.photos[0];
  if (!photo) return;
  state.activePhotoId = photo.id;
  state.activeVariantKey = variantKey || photo.defaultVariantKey || "final";
  renderReview();
  reviewLayer.classList.add("active");
}

function closeReview() {
  reviewLayer.classList.remove("active");
}

function renderReview() {
  const photo = activePhoto();
  const variant = activeVariant(photo);
  if (!photo || !variant) return;
  reviewImage.src = variant.dataUrl;
  reviewTitle.textContent = variant.label;
  reviewMeta.textContent = `${photo.title} · ${formatTime(photo.createdAt)}`;
  downloadLink.href = variant.dataUrl;
  downloadLink.download = `lightchaser-${variant.key}-${photo.id}.jpg`;
  // Step 3:variants 只有 1 张时(variants.length <= 1)tab 容器整体隐藏
  // DOM 保留以维持 review panel 结构,只是 CSS 控制不可见。
  if (variantTabs) {
    if (Array.isArray(photo.variants) && photo.variants.length <= 1) {
      variantTabs.hidden = true;
      variantTabs.innerHTML = "";
    } else {
      variantTabs.hidden = false;
      variantTabs.innerHTML = "";
      for (const item of photo.variants) {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = `variant-tab${item.key === variant.key ? " active" : ""}`;
        tab.textContent = item.label;
        tab.addEventListener("click", () => {
          state.activeVariantKey = item.key;
          renderReview();
        });
        variantTabs.appendChild(tab);
      }
    }
  }
  state.lastMetadata = photo.metadata;
  downloadMetadataButton.disabled = false;
  renderDebug();
}

function renderThumbnail() {
  const photo = state.photos[0];
  if (!photo) {
    thumbnailButton.innerHTML = '<span class="thumbnail-empty">□</span>';
    return;
  }
  const variant = photo.variants.find((item) => item.key === photo.defaultVariantKey) || photo.variants[0];
  thumbnailButton.innerHTML = `<img alt="最近照片" src="${variant.dataUrl}">`;
}

let lastDeletedPhoto = null;
let undoTimer = null;

function deleteActivePhoto() {
  const photo = activePhoto();
  if (!photo) return;
  lastDeletedPhoto = photo;
  state.photos = state.photos.filter((item) => item.id !== photo.id);
  deletePhotoFromIDB(photo.id);
  renderThumbnail();
  if (state.photos.length) {
    openReview(state.photos[0].id, state.photos[0].defaultVariantKey);
  } else {
    closeReview();
  }
  showUndoToast();
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { lastDeletedPhoto = null; hideUndoToast(); }, 5000);
}

function showUndoToast() {
  const toast = document.getElementById("undoToast");
  if (toast) toast.hidden = false;
}

function hideUndoToast() {
  const toast = document.getElementById("undoToast");
  if (toast) toast.hidden = true;
}

function undoDelete() {
  if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
  if (lastDeletedPhoto) {
    savePhotoRecord(lastDeletedPhoto);
    openReview(lastDeletedPhoto.id, lastDeletedPhoto.defaultVariantKey);
    lastDeletedPhoto = null;
  }
  hideUndoToast();
}

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" }).format(new Date(value));
  } catch (error) {
    return "";
  }
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

let photoRenderer = null;

function getPhotoRenderer() {
  if (!photoRenderer && window.LightchaserFilterLayers?.createRenderer) {
    photoRenderer = window.LightchaserFilterLayers.createRenderer();
  }
  return photoRenderer;
}

function cloneCanvas(source) {
  const canvas = makeCanvas(source.width, source.height);
  canvas.getContext("2d").drawImage(source, 0, 0);
  return canvas;
}

function cropCanvas(source, cropBox) {
  const canvas = makeCanvas(cropBox.width, cropBox.height);
  canvas.getContext("2d").drawImage(source, cropBox.x, cropBox.y, cropBox.width, cropBox.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToDataUrl(canvas, type = "image/jpeg", quality = 0.92) {
  return new Promise((resolve) => {
    if (!canvas.toBlob) {
      resolve(canvas.toDataURL(type, quality));
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(canvas.toDataURL(type, quality));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }, type, quality);
  });
}

async function applyFilterToCanvas(canvas, filterName) {
  const preset = filterPresets[filterName];
  if (!preset) return canvas;
  // Filterous 2 路径:filterous 库主要做色彩 LUT,颗粒和暗角由本地 layer pipeline 统一补足。
  // 当前先跳过 filterous,直接走 layer pipeline (颗粒+暗角是这次重构的主要收益,filterous 后续再接入)。
  if (window.LightchaserFilterLayers && typeof window.LightchaserFilterLayers.buildDefaultPipeline === "function") {
    const layers = window.LightchaserFilterLayers.buildDefaultPipeline(preset);
    return window.LightchaserFilterLayers.applyPipeline(canvas, layers);
  }
  // fallback: 用老 applyLocalFilter 函数定义 (以防 layer 模块加载失败)
  applyLocalFilter(canvas.getContext("2d"), canvas.width, canvas.height, filterName);
  return canvas;
}

function cloneCanvasForFilterous(canvas) {
  const input = cloneCanvas(canvas);
  Object.defineProperty(input, "naturalWidth", { configurable: true, value: canvas.width });
  Object.defineProperty(input, "naturalHeight", { configurable: true, value: canvas.height });
  return input;
}

function filterousRender(sourceCanvas, filterousName, timeoutMs = 3000) {
  return Promise.race([
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      try {
        filterous.importImage(sourceCanvas)
          .applyInstaFilter(filterousName)
          .renderHtml(image);
      } catch (error) {
        reject(error);
      }
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("filterous_timeout")), timeoutMs);
    }),
  ]);
}

function applyLockedFilter(decision, locked) {
  if (!locked || !core.FILTER_PRESETS[locked]) return;
  // 把 locked 写到 decision.output.selectedFilterKey(原 decision.appliedFilter 同步)
  const recommended = Array.isArray(decision.recommendedFilters) ? decision.recommendedFilters : [];
  const dedup = [locked, ...recommended.filter((k) => k !== locked)].slice(0, 3);
  decision.appliedFilter = locked;
  decision.recommendedFilters = dedup;
  decision.filterDecisionReason = "user_locked_filter";
  if (decision.output && typeof decision.output === "object") {
    decision.output.selectedFilterKey = locked;
    decision.output.applyLockedFilter = true;
    if (Array.isArray(decision.output.recommendedFilterKeys)) {
      decision.output.recommendedFilterKeys = dedup;
    }
  }
}

function applyLocalFilter(targetCtx, width, height, filterName) {
  const image = targetCtx.getImageData(0, 0, width, height);
  const data = image.data;
  const settings = filterSettings(filterName);
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    if (settings.grayscale) {
      r = gray;
      g = gray;
      b = gray;
    } else {
      r = gray + (r - gray) * settings.saturation;
      g = gray + (g - gray) * settings.saturation;
      b = gray + (b - gray) * settings.saturation;
    }
    r = (r - 128) * settings.contrast + 128 + settings.brightness + settings.warmth;
    g = (g - 128) * settings.contrast + 128 + settings.brightness + settings.warmth * 0.2;
    b = (b - 128) * settings.contrast + 128 + settings.brightness - settings.warmth;
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
  targetCtx.putImageData(image, 0, 0);
}

function filterSettings(filterName) {
  if (filterPresets[filterName]) {
    const p = filterPresets[filterName];
    return p.tone || p;
  }
  return { brightness: 6, contrast: 1.04, saturation: 1.06, warmth: 0 };
}

function filterLabel(filterName) {
  return filterPresets[filterName]?.label || filterName;
}

function filterousFilterName(filterName) {
  return FILTEROUS_PRESETS[filterName] || null;
}

function filterEngineName(filterName) {
  return filterous && filterousFilterName(filterName) ? "filterous-2" : "local-fallback";
}

async function loadSunsetSnapshot() {
  try {
    const params = await locationParams();
    const response = await fetch(`/api/sunset?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.sunsetSnapshot = await response.json();
    renderSunsetChip();
  } catch (error) {
    try {
      const response = await fetch("/api/sunset?city=shanghai", { cache: "no-store" });
      state.sunsetSnapshot = await response.json();
      renderSunsetChip();
    } catch (fallbackError) {
      sunsetChip.textContent = "离线拍摄";
      sunsetChip.className = "chip warn";
    }
  }
}

function locationParams() {
  return new Promise((resolve) => {
    const fallback = new URLSearchParams({ city: "shanghai" });
    if (!navigator.geolocation) {
      resolve(fallback);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(new URLSearchParams({
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
        }));
      },
      () => resolve(fallback),
      { enableHighAccuracy: false, timeout: 3200, maximumAge: 10 * 60 * 1000 }
    );
  });
}

function renderSunsetChip() {
  const data = state.sunsetSnapshot;
  if (!data) return;
  const peak = data.peakTime || data.timeline?.peakTime || "";
  const spot = data.recommendation?.spot || "推荐机位";
  const score = Number.isFinite(data.score) ? `${Math.round(data.score)}分` : (data.scoreLabel || "追光");
  sunsetChip.textContent = `${score} · ${peak} · ${spot}`;
  sunsetChip.className = "chip good";
}

function showFocusAt(event) {
  const rect = viewfinder.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  focusRing.style.left = `${x}px`;
  focusRing.style.top = `${y}px`;
  focusRing.classList.remove("active");
  void focusRing.offsetWidth;
  focusRing.classList.add("active");

  const track = state.sourceType === "camera" ? state.stream?.getVideoTracks?.()[0] : null;
  if (!track) {
    tipChip.textContent = "已标记对焦区域，浏览器将自动调整";
    return;
  }
  const nx = Math.max(0, Math.min(1, x / rect.width));
  const ny = Math.max(0, Math.min(1, y / rect.height));
  applyFocusConstraints(track, nx, ny);
}

async function applyFocusConstraints(track, nx, ny) {
  const caps = typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
  const advanced = {};
  const poi = [{ x: nx, y: ny }];
  if (Array.isArray(caps.focusMode) && caps.focusMode.includes("manual")) {
    advanced.focusMode = "manual";
    advanced.pointsOfInterest = poi;
  }
  if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
    advanced.exposureMode = "continuous";
    advanced.exposurePointOfInterest = poi;
  }
  if (!Object.keys(advanced).length) {
    tipChip.textContent = "当前设备不支持手动对焦，浏览器自动处理";
    return;
  }
  try {
    await track.applyConstraints({ advanced: [advanced] });
    tipChip.textContent = "已锁定对焦与曝光区域";
  } catch (error) {
    tipChip.textContent = "对焦区域已标记，设备自动调整中";
  }
}

async function loadMediaFile(file) {
  if (!file) return;
  stopCameraStream();
  state.samples = [];
  state.lastDecision = null;
  resetAspectRatioStability();
  const prevUrl = state._lastBlobUrl;
  state._lastBlobUrl = null;
  const url = URL.createObjectURL(file);
  state._lastBlobUrl = url;
  try {
    if (file.type.startsWith("video/")) {
      state.sourceType = "video";
      state.imageSource = null;
      video.hidden = false;
      video.srcObject = null;
      video.src = url;
      video.loop = true;
      video.muted = true;
      await video.play();
    } else {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      state.sourceType = "image";
      state.imageSource = image;
      video.hidden = true;
    }
    startGate.hidden = true;
    captureButton.disabled = false;
  } finally {
    if (prevUrl && prevUrl !== url) URL.revokeObjectURL(prevUrl);
  }
}

async function loadSampleMedia() {
  stopCameraStream();
  if (state._lastBlobUrl) {
    URL.revokeObjectURL(state._lastBlobUrl);
    state._lastBlobUrl = null;
  }
  state.samples = [];
  state.lastDecision = null;
  resetAspectRatioStability();
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = "/assets/jingansi/fig2.jpeg";
  });
  state.sourceType = "image";
  state.imageSource = image;
  video.hidden = true;
  startGate.hidden = true;
  captureButton.disabled = false;
  setStatus("已载入示例照片，可直接点击快门验证拍后流程。");
}

function downloadMetadata() {
  const metadata = state.lastMetadata || activePhoto()?.metadata;
  if (!metadata) return;
  const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "metadata.json";
  link.click();
  URL.revokeObjectURL(url);
}

function renderDebug() {
  if (!state.debug) return;
  const payload = {
    capabilities: {
      imageCapture: Boolean(window.ImageCapture),
      devices: state.devices.length,
      sourceType: state.sourceType,
    },
    vision: {
      ready: vision?.ready || false,
      backend: vision?.backend || null,
      loadError: vision?.loadError || null,
      lastSample: state.lastVisionSample ? {
        scene: state.lastVisionSample.scene,
        confidence: state.lastVisionSample.confidence,
        detections: state.lastVisionSample.detections,
      } : null,
    },
    settings: {
      aspectRatio: state.aspectRatio,
      aspectRatioCandidate: state.aspectRatioCandidate,
      aspectRatioCandidateCount: state.aspectRatioCandidateCount,
      grid: state.grid,
      aiComposition: state.aiComposition,
      aiFilter: state.aiFilter,
      lockedFilter: state.lockedFilter,
    },
    sunset: state.sunsetSnapshot,
    decision: state.lastDecision,
    metadata: state.lastMetadata,
  };
  debugJson.textContent = JSON.stringify(payload, null, 2);
}

// ============ 滤镜抽屉 (抖音风 胶片滤镜选择器) ============
const filterDrawer = document.getElementById("filterDrawer");
const filterTabs = document.getElementById("filterTabs");
const filterStrip = document.getElementById("filterStrip");
const filterDrawerCloseBtn = document.getElementById("filterDrawerClose");
const filterDrawerApplyBtn = document.getElementById("filterDrawerApply");
const filterDrawerApplied = document.getElementById("filterDrawerApplied");
const filterDetailOverlay = document.getElementById("filterDetailOverlay");
const filterDetailName = document.getElementById("filterDetailName");
const filterDetailSub = document.getElementById("filterDetailSub");
const filterDetailDesc = document.getElementById("filterDetailDesc");
const filterDetailGrid = document.getElementById("filterDetailGrid");
const filterDetailCloseBtn = document.getElementById("filterDetailClose");

// 屏幕展示名 + 长描述 —— 与 manifest 字段对齐(放在 ai-camera.js 内部方便复用)
const FILTER_DISPLAY_NAMES = {
  F_PROVIA: "F PROVIA",
  F_VELVIA: "F Velvia",
  F_C_CHROME: "F C-Chrome",
  F_ASTIA: "F ASTIA",
  F_CLASSIC_NEG: "F Classic Neg.",
  F_ACROS: "F ACROS",
  F_NOSTALGIC_NEG: "F Nostalgic Neg.",
  F_BLEACH_BYPASS: "F Bleach Bypass",
  K_PORTRA_160: "K Portra 160",
  K_PORTRA_400: "K Portra 400",
  K_EKTAR_100: "K Ektar 100",
  K_GOLD_200: "K Gold 200",
  K_TRI_X_400: "K Tri-X 400",
  A_VISTA_PLUS_200: "A Vista Plus 200",
  A_VISTA_200: "A Vista 200",
  A_OPTIMA_200: "A Optima 200",
  A_ULTRA_100: "A Ultra 100",
  FRESH_GLOW: "Fresh Glow",
  SOFT_SKIN: "Soft Skin",
  PORCELAIN_SKIN: "Porcelain",
  MONO_CLASSIC: "Mono Classic",
  MONO_FADE: "Mono Fade",
  MONO_HIGH: "Mono High",
};
const FILTER_LONG_DESCRIPTIONS = {
  F_PROVIA: "真实准确的色彩还原,风景和日常的基准负片",
  F_VELVIA: "极致饱和与对比,风景摄影的不二之选",
  F_C_CHROME: "纪实冷调,街头与人文的胶片质感",
  F_ASTIA: "低反差柔和过渡,人像与肤色的温柔表达",
  F_CLASSIC_NEG: "高对比暖调,街头与夜景的复古胶片",
  F_ACROS: "高细节黑白,纹理与人像的银盐美感",
  F_NOSTALGIC_NEG: "复古暖黄,家庭相册式的怀旧情绪",
  F_BLEACH_BYPASS: "低饱和高对比电影感,雨夜与冷峻",
  K_PORTRA_160: "极低饱和奶白,柔和到骨子里的肤色",
  K_PORTRA_400: "暖色温柔,日常人像的首选负片",
  K_EKTAR_100: "鲜艳冷感,自然风景的高饱和表达",
  K_GOLD_200: "日光金黄,生活街拍的胶片温度",
  K_TRI_X_400: "高对比黑白,街头摄影的传承者",
  A_VISTA_PLUS_200: "偏冷淡雅,极简与建筑的冷静表达",
  A_VISTA_200: "鲜艳自然,夏日与生活的清爽",
  A_OPTIMA_200: "暖色鲜艳,花园与植物的浓郁",
  A_ULTRA_100: "高细节低饱和,城市与建筑的精确纹理",
  FRESH_GLOW: "柔和高亮通透感,清新日系的皮肤美感",
  SOFT_SKIN: "极致柔肤的人像优化,日常也能像写真",
  PORCELAIN_SKIN: "极致干净光滑白皙,瓷器般的肤质",
  MONO_CLASSIC: "标准黑白,干净中性的人像与风景",
  MONO_FADE: "高光轻度褪色的胶片感,复古温情",
  MONO_HIGH: "极端高对比,低光街头的张力",
};

let activeDrawerBrand = null; // null = 原生

function filterDisplayName(key) {
  if (!key) return "";
  return FILTER_DISPLAY_NAMES[key] || core.FILTER_PRESETS[key]?.label || key;
}

function openFilterDrawer() {
  if (state.filterDrawerOpen) return;
  // 默认 tab:从锁定滤镜推 / 否则第一个品牌
  if (activeDrawerBrand === null) {
    if (state.lockedFilter && core.FILTER_PRESETS[state.lockedFilter]?.brand) {
      activeDrawerBrand = core.FILTER_PRESETS[state.lockedFilter].brand;
    } else {
      activeDrawerBrand = core.BRAND_ORDER[0];
    }
  }
  state.filterDrawerOpen = true;
  renderFilterTabs();
  renderFilterCards();
  updateFilterDrawerApplied();
  filterDrawer.classList.add("active");
  filterDrawer.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    const selected = filterStrip.querySelector('.filter-card[aria-pressed="true"]');
    if (selected?.scrollIntoView) {
      selected.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
    }
  }, 50);
}

function closeFilterDrawer() {
  if (!state.filterDrawerOpen) return;
  state.filterDrawerOpen = false;
  filterDrawer.classList.remove("active");
  filterDrawer.setAttribute("aria-hidden", "true");
}

function renderFilterTabs() {
  filterTabs.innerHTML = "";
  // 原生
  {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.role = "tab";
    tab.className = "filter-tab";
    tab.dataset.brand = "";
    tab.textContent = "原生";
    tab.setAttribute("aria-pressed", String(activeDrawerBrand === null));
    tab.addEventListener("click", () => {
      activeDrawerBrand = null;
      renderFilterTabs();
      renderFilterCards();
    });
    filterTabs.appendChild(tab);
  }
  for (const brand of core.BRAND_ORDER) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.role = "tab";
    tab.className = "filter-tab";
    tab.dataset.brand = brand;
    tab.textContent = core.BRAND_LABEL[brand] || brand;
    tab.setAttribute("aria-pressed", String(activeDrawerBrand === brand));
    tab.addEventListener("click", () => {
      activeDrawerBrand = brand;
      renderFilterTabs();
      renderFilterCards();
    });
    filterTabs.appendChild(tab);
  }
}

function renderFilterCards() {
  filterStrip.innerHTML = "";
  filterStrip.classList.remove("is-native");
  if (activeDrawerBrand === null) {
    filterStrip.classList.add("is-native");
    filterStrip.appendChild(buildNativeCard());
    return;
  }
  const list = core.FILTERS_BY_BRAND[activeDrawerBrand] || [];
  for (const key of list) {
    const card = buildFilterCard(key);
    if (card) filterStrip.appendChild(card);
  }
}

function buildNativeCard() {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "filter-card is-native";
  card.setAttribute("aria-pressed", String(state.lockedFilter === null));
  card.setAttribute("role", "option");
  card.setAttribute("aria-selected", String(state.lockedFilter === null));
  card.dataset.filterKey = "";
  card.innerHTML = `
    <div class="filter-card-frame">
      <div class="filter-card-native-circle">原</div>
    </div>
    <div class="filter-card-meta">
      <div class="filter-card-info">
        <div class="filter-card-name">原生</div>
        <div class="filter-card-sub">不套滤镜</div>
      </div>
    </div>
  `;
  card.addEventListener("click", () => {
    state.lockedFilter = null;
    state.aiFilter = false;
    saveSettings();
    setAppMode();
    renderFilterCards();
    updateFilterDrawerApplied();
    setTimeout(closeFilterDrawer, 100);
    resetCaptureSnapshotState();
  });
  return card;
}

function buildFilterCard(key) {
  const preset = core.FILTER_PRESETS[key];
  if (!preset) return null;
  const card = document.createElement("button");
  card.type = "button";
  card.className = "filter-card";
  card.setAttribute("aria-pressed", String(state.lockedFilter === key));
  card.setAttribute("aria-selected", String(state.lockedFilter === key));
  card.setAttribute("role", "option");
  card.dataset.filterKey = key;
  const filterName = filterDisplayName(key);
  const label = preset.label || "";
  const demoUrl = core.FILTER_DEMO_PATHS[key] || "";
  const packUrl = core.PACKAGING_BY_BRAND[preset.brand] || "";
  const tint = (preset.iconColors && preset.iconColors[0]) || "#2c2c2c";
  card.innerHTML = `
    <div class="filter-card-frame" style="background:${hexAlpha(tint, 0.32)};">
      <div class="filter-card-sprocket">
        ${Array(6).fill('<span class="sprocket-hole"></span>').join("")}
      </div>
      <div class="filter-card-image">
        <img src="${demoUrl}" alt="${filterName}" loading="lazy" decoding="async" fetchpriority="low" />
      </div>
      <button class="filter-card-detail" type="button" aria-label="详情" data-action="detail">详</button>
    </div>
    <div class="filter-card-meta">
      <div class="filter-card-info">
        <div class="filter-card-name">${filterName}</div>
        <div class="filter-card-sub">${label}</div>
      </div>
      <div class="filter-card-pack" style="background-image:url('${packUrl}')"></div>
    </div>
  `;
  card.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.action === "detail") {
      showFilterDetail(key);
      event.stopPropagation();
      return;
    }
    state.lockedFilter = key;
    state.aiFilter = true;
    saveSettings();
    setAppMode();
    renderFilterCards();
    updateFilterDrawerApplied();
    setTimeout(closeFilterDrawer, 100);
  });
  return card;
}

function updateFilterDrawerApplied() {
  if (!state.lockedFilter) {
    filterDrawerApplied.innerHTML = "当前未应用 / <b>原生</b>";
  } else {
    filterDrawerApplied.innerHTML = `当前应用 <b>${filterDisplayName(state.lockedFilter)}</b>`;
  }
}

function showFilterDetail(key) {
  const preset = core.FILTER_PRESETS[key];
  if (!preset) return;
  filterDetailName.textContent = filterDisplayName(key);
  const brandLabel = core.BRAND_LABEL[preset.brand] || "";
  filterDetailSub.textContent = `${brandLabel} · ${preset.label}`;
  filterDetailDesc.textContent = FILTER_LONG_DESCRIPTIONS[key] || preset.label;
  const tone = preset.tone || {};
  const contrast = Math.round((tone.contrast - 1) * 100);
  const saturation = Math.round((tone.saturation - 1) * 100);
  filterDetailGrid.innerHTML = `
    <dt>亮度</dt><dd>${tone.brightness > 0 ? "+" : ""}${tone.brightness}</dd>
    <dt>对比</dt><dd>${contrast > 0 ? "+" : ""}${contrast}%</dd>
    <dt>饱和</dt><dd>${saturation > 0 ? "+" : ""}${saturation}%</dd>
    <dt>暖度</dt><dd>${tone.warmth > 0 ? "+" : ""}${tone.warmth}</dd>
    <dt>模式</dt><dd>${tone.grayscale ? "黑白" : "彩色"}</dd>
  `;
  filterDetailOverlay.classList.add("active");
  filterDetailOverlay.setAttribute("aria-hidden", "false");
}

function hideFilterDetail() {
  filterDetailOverlay.classList.remove("active");
  filterDetailOverlay.setAttribute("aria-hidden", "true");
}

function hexAlpha(hex, alpha) {
  // #rrggbb + 0..1
  if (typeof hex !== "string" || hex[0] !== "#" || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resetCaptureSnapshotState() {
  // 切换滤镜时清掉一些缓存,让下一次决策立即反映
  state.lastDecision = null;
  state.samples = [];
  resetAspectRatioStability();
}

startButton.addEventListener("click", () => startCamera());
retryButton.addEventListener("click", () => startCamera());
captureButton.addEventListener("click", capturePhoto);
switchButton.addEventListener("click", switchCamera);
thumbnailButton.addEventListener("click", () => openReview());
closeReviewButton.addEventListener("click", closeReview);
deletePhotoButton.addEventListener("click", deleteActivePhoto);
document.getElementById("undoButton")?.addEventListener("click", undoDelete);
downloadMetadataButton.addEventListener("click", downloadMetadata);
sampleMediaButton.addEventListener("click", () => {
  loadSampleMedia().catch((error) => setStatus(`示例照片载入失败：${error.message}`));
});
mediaInput.addEventListener("change", () => {
  loadMediaFile(mediaInput.files[0]).catch((error) => setStatus(`调试素材载入失败：${error.message}`));
});
gridButton.addEventListener("click", () => {
  state.grid = !state.grid;
  setAppMode();
});
compositionToggle.addEventListener("click", () => {
  if (!sourceReady(currentSource())) {
    setStatus("请先启动相机或载入照片，再开启 AI 构图");
    return;
  }
  state.aiComposition = !state.aiComposition;
  resetAspectRatioStability();
  setAppMode();
  if (state.aiComposition) queueVisionWarmup(0);
});
filterToggle.addEventListener("click", () => {
  // 选滤镜不需要源可用;只在拍照时才走 sourceReady 检查
  if (state.aiFilter) {
    // 已开 → 关掉,同时清掉已选滤镜
    state.aiFilter = false;
    state.lockedFilter = null;
    saveSettings();
    setAppMode();
    if (state.filterDrawerOpen) closeFilterDrawer();
    if (!sourceReady(currentSource())) setStatus("AI 滤镜已关闭。下次拍照不会套滤镜。");
  } else {
    // 开 → 自动打开抽屉让用户选
    state.aiFilter = true;
    setAppMode();
    saveSettings();
    queueVisionWarmup(0);
    openFilterDrawer();
  }
});
filterDrawerCloseBtn?.addEventListener("click", closeFilterDrawer);
filterDrawerApplyBtn?.addEventListener("click", closeFilterDrawer);
filterDetailCloseBtn?.addEventListener("click", hideFilterDetail);
filterDetailOverlay?.addEventListener("click", (e) => {
  if (e.target === filterDetailOverlay) hideFilterDetail();
});
viewfinder.addEventListener("click", showFocusAt);

setAppMode();
renderThumbnail();
loadPhotosFromStore();
loadSunsetSnapshot();
setupLifecycle();
scheduleDetect();

// Debug 模式:暴露 state 和核心 helper 给浏览器控制台
if (query.get("debug") === "1") {
  window.state = state;
  window.activePhoto = activePhoto;
  window.activeVariant = activeVariant;
}
