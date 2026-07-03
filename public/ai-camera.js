const core = window.LightchaserAICameraCore;
const filterPresets = core.FILTER_PRESETS;

const video = document.getElementById("camera");
const preview = document.getElementById("preview");
const ctx = preview.getContext("2d", { willReadFrequently: true });
const cropBoxEl = document.getElementById("cropBox");
const scenePill = document.getElementById("scenePill");
const compositionPill = document.getElementById("compositionPill");
const filterPill = document.getElementById("filterPill");
const countdownEl = document.getElementById("countdown");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const startButton = document.getElementById("startButton");
const mediaInput = document.getElementById("mediaInput");
const captureButton = document.getElementById("captureButton");
const downloadButton = document.getElementById("downloadButton");
const compositionToggle = document.getElementById("compositionToggle");
const filterToggle = document.getElementById("filterToggle");

const state = {
  stream: null,
  sourceType: "camera",
  imageSource: null,
  aiComposition: false,
  aiFilter: false,
  samples: [],
  lastDecision: null,
  lastMetadata: null,
  capturing: false,
};

function setStatus(message) {
  statusEl.textContent = message;
}

function toggle(button, key) {
  state[key] = !state[key];
  button.setAttribute("aria-checked", String(state[key]));
}

compositionToggle.addEventListener("click", () => toggle(compositionToggle, "aiComposition"));
filterToggle.addEventListener("click", () => toggle(filterToggle, "aiFilter"));

function ensureCanvasSize() {
  const source = currentSource();
  const width = source?.videoWidth || source?.naturalWidth || 1280;
  const height = source?.videoHeight || source?.naturalHeight || 720;
  if (preview.width !== width || preview.height !== height) {
    preview.width = width;
    preview.height = height;
  }
}

function drawPreview() {
  const source = currentSource();
  if (sourceReady(source)) {
    ensureCanvasSize();
    ctx.drawImage(source, 0, 0, preview.width, preview.height);
    if (state.aiFilter && state.lastDecision?.appliedFilter) {
      applyFilter(ctx, preview.width, preview.height, state.lastDecision.appliedFilter);
    }
  }
  requestAnimationFrame(drawPreview);
}

function sampleFrame() {
  const source = currentSource();
  if (!preview.width || !preview.height || !sourceReady(source)) return null;
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

function currentSource() {
  return state.sourceType === "image" ? state.imageSource : video;
}

function sourceReady(source) {
  if (!source) return false;
  if (source instanceof HTMLImageElement) return source.complete && source.naturalWidth > 0;
  return source.readyState >= 2;
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
  if (!preview.width || state.capturing) return;
  const sample = sampleFrame();
  if (!sample) return;
  state.samples.push(sample);
  state.samples = state.samples.slice(-10);
  state.lastDecision = core.buildCaptureDecision({
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    frame: { width: preview.width, height: preview.height },
    samples: state.samples,
    previousDecision: state.lastDecision,
  });
  renderDecision(state.lastDecision);
}

function renderDecision(decision) {
  scenePill.textContent = `${decision.sceneLabel} · ${decision.light}`;
  compositionPill.textContent = compositionLabel(decision);
  const recommendedLabels = decision.recommendedFilters.map(filterLabel);
  filterPill.textContent = decision.appliedFilter ? `滤镜：${filterLabel(decision.appliedFilter)}` : `推荐：${recommendedLabels.join(" / ")}`;
  if (state.aiComposition && decision.outputs.aiCrop) {
    positionCropBox(decision.cropBox);
    cropBoxEl.hidden = false;
  } else {
    cropBoxEl.hidden = true;
  }
}

function positionCropBox(cropBox) {
  const stage = preview.getBoundingClientRect();
  const ratio = Math.min(stage.width / preview.width, stage.height / preview.height);
  const renderedWidth = preview.width * ratio;
  const renderedHeight = preview.height * ratio;
  const offsetX = (stage.width - renderedWidth) / 2;
  const offsetY = (stage.height - renderedHeight) / 2;
  cropBoxEl.style.left = `${offsetX + cropBox.x * ratio}px`;
  cropBoxEl.style.top = `${offsetY + cropBox.y * ratio}px`;
  cropBoxEl.style.width = `${cropBox.width * ratio}px`;
  cropBoxEl.style.height = `${cropBox.height * ratio}px`;
}

function applyFilter(targetCtx, width, height, filterName) {
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

function compositionLabel(decision) {
  if (decision.compositionStatus === "off") return "AI 构图已关闭";
  const kept = Math.round((decision.cropAreaRatio || 1) * 100);
  if (decision.compositionStatus === "skipped") return "AI 构图已跳过";
  if (decision.compositionReason === "protected_full_frame") return `AI 构图已应用 · 主体保护 · 保留 ${kept}%`;
  return `AI 构图已应用 · 保留 ${kept}%`;
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
      audio: false,
    });
    state.stream = stream;
    state.sourceType = "camera";
    state.imageSource = null;
    video.srcObject = stream;
    video.hidden = false;
    await video.play();
    captureButton.disabled = false;
    startButton.textContent = "摄像头已启动";
    setStatus("摄像头已启动。关闭 AI 功能时拍照将保存原图；打开 AI 功能时拍照会进入 3 秒倒计时。");
  } catch (error) {
    setStatus(`摄像头启动失败：${error.message}。可选择图片/视频继续调试 AI 构图和 AI 滤镜。`);
  }
}

async function loadMediaFile(file) {
  if (!file) return;
  stopCameraStream();
  resultsEl.innerHTML = "";
  state.samples = [];
  state.lastDecision = null;
  state.lastMetadata = null;
  downloadButton.disabled = true;
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

  ensureCanvasSize();
  captureButton.disabled = false;
  setStatus(`已载入${file.type.startsWith("video/") ? "视频" : "图片"}调试素材。打开 AI 后拍照会进入 3 秒观察窗口并输出裁剪/滤镜结果。`);
}

function stopCameraStream() {
  if (!state.stream) return;
  for (const track of state.stream.getTracks()) {
    track.stop();
  }
  state.stream = null;
}

async function capture() {
  if (state.capturing) return;
  state.capturing = true;
  captureButton.disabled = true;
  resultsEl.innerHTML = "";
  const useCountdown = state.aiComposition || state.aiFilter;
  const captureSamples = [];

  if (useCountdown) {
    countdownEl.classList.add("active");
    for (let tick = 3; tick >= 1; tick -= 1) {
      countdownEl.textContent = tick;
      setStatus(`AI 正在观察画面并锁定稳定结果：${tick}`);
      const started = Date.now();
      while (Date.now() - started < 1000) {
        const sample = sampleFrame();
        if (sample) captureSamples.push(sample);
        await wait(250);
      }
    }
    countdownEl.classList.remove("active");
  } else {
    const sample = sampleFrame();
    if (sample) captureSamples.push(sample);
  }

  ensureCanvasSize();
  const original = makeCanvas(preview.width, preview.height);
  original.getContext("2d").drawImage(currentSource(), 0, 0, preview.width, preview.height);
  const samples = captureSamples.length ? captureSamples : state.samples;
  const decision = core.buildCaptureDecision({
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    sourceType: state.sourceType,
    frame: { width: preview.width, height: preview.height },
    samples,
    previousDecision: state.lastDecision,
  });
  const crop = cropCanvas(original, decision.cropBox);
  const filtered = cropCanvas(original, decision.cropBox);
  if (decision.appliedFilter) {
    applyFilter(filtered.getContext("2d"), filtered.width, filtered.height, decision.appliedFilter);
  }

  const outputs = [
    { key: "original", title: "original.jpg", canvas: original },
  ];
  if (decision.outputs.aiCrop) outputs.push({ key: "ai_crop", title: "ai_crop.jpg", canvas: crop });
  if (decision.outputs.aiCropFilter || decision.outputs.aiFilter) {
    outputs.push({
      key: decision.outputs.aiCropFilter ? "ai_crop_filter" : "ai_filter",
      title: decision.outputs.aiCropFilter ? "ai_crop_filter.jpg" : "ai_filter.jpg",
      canvas: filtered,
    });
  }

  state.lastMetadata = {
    createdAt: new Date().toISOString(),
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    decision,
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
  renderResults(outputs, state.lastMetadata);
  downloadButton.disabled = false;
  state.capturing = false;
  captureButton.disabled = false;
  setStatus(`拍照完成：${decision.sceneLabel} / ${decision.light} / ${compositionLabel(decision)}${decision.appliedFilter ? ` / 已套用 ${filterLabel(decision.appliedFilter)}` : ""}`);
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function cropCanvas(source, cropBox) {
  const canvas = makeCanvas(cropBox.width, cropBox.height);
  canvas.getContext("2d").drawImage(source, cropBox.x, cropBox.y, cropBox.width, cropBox.height, 0, 0, cropBox.width, cropBox.height);
  return canvas;
}

function renderResults(outputs, metadata) {
  resultsEl.innerHTML = "";
  for (const output of outputs) {
    const url = output.canvas.toDataURL("image/jpeg", 0.92);
    const article = document.createElement("article");
    article.className = "result";
    article.innerHTML = `<div class="result-title"><strong>${output.title}</strong><a download="${output.title}" href="${url}">下载</a></div><img alt="${output.title}" src="${url}">`;
    resultsEl.appendChild(article);
  }
  const metadataBlock = document.createElement("article");
  metadataBlock.className = "result";
  metadataBlock.innerHTML = `<div class="result-title"><strong>metadata.json</strong></div><code>${escapeHtml(JSON.stringify(metadata, null, 2))}</code>`;
  resultsEl.appendChild(metadataBlock);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function downloadMetadata() {
  if (!state.lastMetadata) return;
  const blob = new Blob([JSON.stringify(state.lastMetadata, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "metadata.json";
  link.click();
  URL.revokeObjectURL(url);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

startButton.addEventListener("click", startCamera);
mediaInput.addEventListener("change", () => {
  loadMediaFile(mediaInput.files[0]).catch((error) => setStatus(`调试素材载入失败：${error.message}`));
});
captureButton.addEventListener("click", capture);
downloadButton.addEventListener("click", downloadMetadata);
setInterval(updateDecision, 1000);
drawPreview();
