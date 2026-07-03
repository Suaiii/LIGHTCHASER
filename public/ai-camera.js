const core = window.LightchaserAICameraCore;
const filterPresets = core.FILTER_PRESETS;
const filterous = window.filterous;

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

const app = document.getElementById("cameraApp");
const viewfinder = document.getElementById("viewfinder");
const video = document.getElementById("camera");
const preview = document.getElementById("preview");
const ctx = preview.getContext("2d", { willReadFrequently: true });
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
const ratioButtons = Array.from(document.querySelectorAll(".ratio-button"));
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
  aspectRatio: savedSettings.aspectRatio || "4:3",
  aiComposition: savedBoolean("aiComposition", false),
  aiFilter: savedBoolean("aiFilter", false),
  samples: [],
  lastDecision: null,
  lastMetadata: null,
  photos: loadJson(STORAGE_KEY, []),
  activePhotoId: null,
  activeVariantKey: "final",
  sunsetSnapshot: null,
  captureBusy: false,
};

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

function saveSettings() {
  const payload = {
    deviceId: state.activeDeviceId,
    facingMode: state.facingMode,
    grid: state.grid,
    aspectRatio: state.aspectRatio,
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
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

function setAppMode() {
  app.dataset.ratio = state.aspectRatio;
  app.classList.toggle("grid-on", state.grid);
  app.classList.toggle("debug-on", state.debug);
  gridButton.setAttribute("aria-pressed", String(state.grid));
  compositionToggle.setAttribute("aria-pressed", String(state.aiComposition));
  filterToggle.setAttribute("aria-pressed", String(state.aiFilter));
  ratioButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.ratio === state.aspectRatio);
  });
  if (!state.aiComposition) {
    cropBoxEl.hidden = true;
  }
  saveSettings();
  updateDecision();
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

function ensureCanvasSize() {
  const size = sourceSize();
  if (preview.width !== size.width || preview.height !== size.height) {
    preview.width = size.width;
    preview.height = size.height;
  }
}

function drawPreview() {
  const source = currentSource();
  if (sourceReady(source)) {
    ensureCanvasSize();
    ctx.drawImage(source, 0, 0, preview.width, preview.height);
  }
  requestAnimationFrame(drawPreview);
}

function sampleFrame() {
  const source = currentSource();
  if (!sourceReady(source)) return null;
  ensureCanvasSize();
  const sampleWidth = 96;
  const sampleHeight = Math.max(54, Math.round(sampleWidth * preview.height / preview.width));
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
  let centerMassX = 0;
  let centerMassY = 0;
  let mass = 0;
  let activePixels = 0;

  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const index = i / 4;
    const x = index % sampleWidth;
    const y = Math.floor(index / sampleWidth);
    const brightness = (r + g + b) / 765;
    total += brightness;
    warmth += (r - b) / 255;
    if (brightness > 0.72) brightPixels += 1;
    if (brightness < 0.24) darkPixels += 1;
    if (r > g * 1.08 && r > b * 1.22 && brightness > 0.32) saturatedWarm += 1;
    const weight = Math.max(0, brightness - 0.18);
    if (weight > 0.08) activePixels += 1;
    centerMassX += x * weight;
    centerMassY += y * weight;
    mass += weight;
  }

  const pixels = imageData.length / 4;
  const frameStats = { brightness: total / pixels, warmth: warmth / pixels };
  const scene = inferDemoScene(frameStats, brightPixels / pixels, darkPixels / pixels, saturatedWarm / pixels);
  const subjectBox = inferSubjectBox(centerMassX, centerMassY, mass, activePixels / pixels, pixels, sampleWidth, sampleHeight, preview.width, preview.height);
  const subjectBoxes = subjectBox ? [subjectBox] : [];
  return { scene: scene.scene, confidence: scene.confidence, frameStats, subjectBox, subjectBoxes, at: Date.now() };
}

function inferDemoScene(frameStats, brightRatio, darkRatio, warmRatio) {
  if (darkRatio > 0.34 && brightRatio > 0.08) return { scene: "night", confidence: 0.82 };
  if (warmRatio > 0.22) return { scene: "food", confidence: 0.76 };
  if (frameStats.brightness > 0.62 && Math.abs(frameStats.warmth) < 0.08) return { scene: "landscape", confidence: 0.68 };
  if (frameStats.warmth > 0.05) return { scene: "portrait", confidence: 0.66 };
  if (frameStats.brightness < 0.45) return { scene: "indoor", confidence: 0.64 };
  return { scene: "street", confidence: 0.58 };
}

function inferSubjectBox(centerMassX, centerMassY, mass, activeRatio, pixels, sampleWidth, sampleHeight, frameWidth, frameHeight) {
  if (!mass) return null;
  const cx = (centerMassX / mass / sampleWidth) * frameWidth;
  const cy = (centerMassY / mass / sampleHeight) * frameHeight;
  const width = frameWidth * 0.42;
  const height = frameHeight * 0.58;
  const averageWeight = mass / pixels;
  const confidence = activeRatio > 0.72 || activeRatio < 0.02
    ? 0.2
    : Math.max(0.2, Math.min(0.9, 0.75 - activeRatio * 0.65 + averageWeight * 0.4));
  return {
    x: Math.max(0, Math.min(frameWidth - width, cx - width / 2)),
    y: Math.max(0, Math.min(frameHeight - height, cy - height / 2)),
    width,
    height,
    confidence,
  };
}

function updateDecision() {
  if (!sourceReady(currentSource()) || state.captureBusy) return;
  const sample = sampleFrame();
  if (!sample) return;
  state.samples.push(sample);
  state.samples = state.samples.slice(-10);
  state.lastDecision = core.buildCaptureDecision({
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    frame: sourceSize(),
    samples: state.samples,
    previousDecision: state.lastDecision,
  });
  renderDecision(state.lastDecision);
}

function renderDecision(decision) {
  scenePill.textContent = `${decision.sceneLabel} · ${decision.light}`;
  const tip = cameraTip(decision);
  tipChip.textContent = tip.text;
  tipChip.className = `chip ${tip.kind}`;
  if (state.aiComposition && decision.outputs.aiCrop) {
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
  if (decision.light === "偏暖") return { text: "色温偏暖，AI 会自动做轻微冷却", kind: "" };
  if (decision.light === "偏冷") return { text: "色温偏冷，AI 会自动补暖", kind: "" };
  if (!state.aiComposition && !state.aiFilter) return { text: "普通拍照模式，可从右侧开启 AI 构图或 AI 滤镜", kind: "" };
  if (!state.aiComposition && state.aiFilter && decision.appliedFilter) return { text: `${filterLabel(decision.appliedFilter)} 已准备好`, kind: "good" };
  if (state.sunsetSnapshot?.scoreLabel) return { text: `${state.sunsetSnapshot.scoreLabel} · ${state.sunsetSnapshot.recommendation?.direction || "留意光线方向"}`, kind: "good" };
  return { text: "构图稳定，按下快门即可拍摄", kind: "good" };
}

function positionCropBox(cropBox) {
  const stage = preview.getBoundingClientRect();
  const ratio = Math.max(stage.width / preview.width, stage.height / preview.height);
  const renderedWidth = preview.width * ratio;
  const renderedHeight = preview.height * ratio;
  const offsetX = (stage.width - renderedWidth) / 2;
  const offsetY = (stage.height - renderedHeight) / 2;
  cropBoxEl.style.left = `${offsetX + cropBox.x * ratio}px`;
  cropBoxEl.style.top = `${offsetY + cropBox.y * ratio}px`;
  cropBoxEl.style.width = `${cropBox.width * ratio}px`;
  cropBoxEl.style.height = `${cropBox.height * ratio}px`;
}

async function startCamera(preferredDeviceId = state.activeDeviceId) {
  setStatus("正在启动摄像头...");
  startButton.disabled = true;
  retryButton.disabled = true;
  startButton.textContent = "正在启动...";
  stopCameraStream();
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
  } catch (error) {
    captureButton.disabled = true;
    startGate.hidden = false;
    retryButton.hidden = true;
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
  state.activeDeviceId = next.deviceId;
  setBusy(true, "正在切换摄像头");
  await startCamera(next.deviceId);
  setBusy(false);
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
    const decision = core.buildCaptureDecision({
      aiComposition: state.aiComposition,
      aiFilter: state.aiFilter,
      sourceType: state.sourceType,
      frame: { width: originalCanvas.width, height: originalCanvas.height },
      samples,
      previousDecision: state.lastDecision,
    });
    const photo = await buildPhotoRecord(originalCanvas, samples, shutterLatencyMs);
    savePhotoRecord(photo);
    openReview(photo.id, photo.defaultVariantKey);
  } catch (error) {
    setStatus(`拍照失败：${error.message}`);
  } finally {
    state.captureBusy = false;
    captureButton.disabled = !sourceReady(currentSource());
    setBusy(false);
  }
}

async function captureOriginalCanvas() {
  const track = state.stream?.getVideoTracks?.()[0];
  if (state.sourceType === "camera" && track && window.ImageCapture) {
    try {
      const imageCapture = new ImageCapture(track);
      const blob = await imageCapture.takePhoto();
      const bitmap = await createImageBitmap(blob);
      return imageBitmapToCanvas(bitmap);
    } catch (error) {
      // Browser/device support is inconsistent; the video fallback is reliable.
    }
  }

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
  const variants = [];
  const aspectCrop = aspectCropBox(originalCanvas, state.aspectRatio);
  const framedCanvas = cropCanvas(originalCanvas, aspectCrop);
  const original = await canvasToDataUrl(framedCanvas, "image/jpeg", 0.94);
  variants.push({ key: "original", label: "原图", dataUrl: original, width: framedCanvas.width, height: framedCanvas.height });

  let finalKey = "original";
  const framedDecision = core.buildCaptureDecision({
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    sourceType: state.sourceType,
    frame: { width: framedCanvas.width, height: framedCanvas.height },
    samples: normalizeSamplesForFrame(samples, aspectCrop),
    previousDecision: state.lastDecision,
  });
  const crop = cropCanvas(framedCanvas, framedDecision.cropBox);
  if (framedDecision.outputs.aiCrop) {
    const cropDataUrl = await canvasToDataUrl(crop, "image/jpeg", 0.94);
    variants.push({ key: "ai_crop", label: "AI 构图", dataUrl: cropDataUrl, width: crop.width, height: crop.height });
    finalKey = "ai_crop";
  }

  if (framedDecision.outputs.aiCropFilter || framedDecision.outputs.aiFilter) {
    const filterSource = framedDecision.outputs.aiCropFilter ? cropCanvas(framedCanvas, framedDecision.cropBox) : cloneCanvas(framedCanvas);
    const filtered = await applyFilterToCanvas(filterSource, framedDecision.appliedFilter);
    const key = framedDecision.outputs.aiCropFilter ? "ai_crop_filter" : "ai_filter";
    const label = framedDecision.outputs.aiCropFilter ? "AI 成片" : "AI 滤镜";
    const filteredDataUrl = await canvasToDataUrl(filtered, "image/jpeg", 0.94);
    variants.push({ key, label, dataUrl: filteredDataUrl, width: filtered.width, height: filtered.height });
    finalKey = key;
  }

  const metadata = {
    id: crypto.randomUUID ? crypto.randomUUID() : `photo-${Date.now()}`,
    createdAt: new Date().toISOString(),
    shutterLatencyMs,
    sourceType: state.sourceType,
    aspectRatio: state.aspectRatio,
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    filterEngine: framedDecision.appliedFilter ? filterEngineName(framedDecision.appliedFilter) : null,
    filterousFilter: framedDecision.appliedFilter ? filterousFilterName(framedDecision.appliedFilter) : null,
    decision: framedDecision,
    sunsetSnapshot: state.sunsetSnapshot,
    sampleCount: samples.length,
    samples: samples.map((sample) => ({
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
    defaultVariantKey: finalKey,
    variants,
    metadata,
  };
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

function savePhotoRecord(photo) {
  state.photos = [photo, ...state.photos.filter((item) => item.id !== photo.id)].slice(0, MAX_PHOTOS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.photos));
  } catch (error) {
    setStatus("照片已生成，但本地存储空间不足，刷新后可能不会保留。");
  }
  renderThumbnail();
  renderDebug();
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
  state.activeVariantKey = variantKey || photo.defaultVariantKey;
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

function deleteActivePhoto() {
  const photo = activePhoto();
  if (!photo) return;
  state.photos = state.photos.filter((item) => item.id !== photo.id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.photos));
  } catch (error) {
    // Ignore local cleanup failures.
  }
  renderThumbnail();
  if (state.photos.length) {
    openReview(state.photos[0].id, state.photos[0].defaultVariantKey);
  } else {
    closeReview();
  }
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
  const filterousName = filterousFilterName(filterName);
  if (!filterous || !filterousName) {
    applyLocalFilter(canvas.getContext("2d"), canvas.width, canvas.height, filterName);
    return canvas;
  }

  const input = cloneCanvasForFilterous(canvas);
  try {
    const filteredImage = await filterousRender(input, filterousName);
    const output = makeCanvas(canvas.width, canvas.height);
    output.getContext("2d").drawImage(filteredImage, 0, 0, output.width, output.height);
    return output;
  } catch (error) {
    applyLocalFilter(canvas.getContext("2d"), canvas.width, canvas.height, filterName);
    return canvas;
  }
}

function cloneCanvasForFilterous(canvas) {
  const input = cloneCanvas(canvas);
  Object.defineProperty(input, "naturalWidth", { configurable: true, value: canvas.width });
  Object.defineProperty(input, "naturalHeight", { configurable: true, value: canvas.height });
  return input;
}

function filterousRender(sourceCanvas, filterousName) {
  return new Promise((resolve, reject) => {
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
  });
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
  if (filterPresets[filterName]) return filterPresets[filterName];
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
  tipChip.textContent = "已锁定当前区域，浏览器会自动处理对焦/曝光";
}

async function loadMediaFile(file) {
  if (!file) return;
  stopCameraStream();
  state.samples = [];
  state.lastDecision = null;
  const url = URL.createObjectURL(file);
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
}

async function loadSampleMedia() {
  stopCameraStream();
  state.samples = [];
  state.lastDecision = null;
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
    settings: {
      aspectRatio: state.aspectRatio,
      grid: state.grid,
      aiComposition: state.aiComposition,
      aiFilter: state.aiFilter,
    },
    sunset: state.sunsetSnapshot,
    decision: state.lastDecision,
    metadata: state.lastMetadata,
  };
  debugJson.textContent = JSON.stringify(payload, null, 2);
}

startButton.addEventListener("click", () => startCamera());
retryButton.addEventListener("click", () => startCamera());
captureButton.addEventListener("click", capturePhoto);
switchButton.addEventListener("click", switchCamera);
thumbnailButton.addEventListener("click", () => openReview());
closeReviewButton.addEventListener("click", closeReview);
deletePhotoButton.addEventListener("click", deleteActivePhoto);
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
  state.aiComposition = !state.aiComposition;
  setAppMode();
});
filterToggle.addEventListener("click", () => {
  state.aiFilter = !state.aiFilter;
  setAppMode();
});
ratioButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.aspectRatio = button.dataset.ratio;
    setAppMode();
  });
});
viewfinder.addEventListener("click", showFocusAt);

setAppMode();
renderThumbnail();
loadSunsetSnapshot();
setInterval(updateDecision, 1000);
drawPreview();
