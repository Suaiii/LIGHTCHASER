const core = window.LightchaserAICameraCore;

const video = document.getElementById("camera");
const preview = document.getElementById("preview");
const ctx = preview.getContext("2d", { willReadFrequently: true });
const cropBoxEl = document.getElementById("cropBox");
const scenePill = document.getElementById("scenePill");
const filterPill = document.getElementById("filterPill");
const countdownEl = document.getElementById("countdown");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const startButton = document.getElementById("startButton");
const captureButton = document.getElementById("captureButton");
const downloadButton = document.getElementById("downloadButton");
const compositionToggle = document.getElementById("compositionToggle");
const filterToggle = document.getElementById("filterToggle");

const state = {
  stream: null,
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
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  if (preview.width !== width || preview.height !== height) {
    preview.width = width;
    preview.height = height;
  }
}

function drawPreview() {
  if (video.readyState >= 2) {
    ensureCanvasSize();
    ctx.drawImage(video, 0, 0, preview.width, preview.height);
    if (state.aiFilter && state.lastDecision?.appliedFilter) {
      applyFilter(ctx, preview.width, preview.height, state.lastDecision.appliedFilter);
    }
  }
  requestAnimationFrame(drawPreview);
}

function sampleFrame() {
  if (!preview.width || !preview.height || video.readyState < 2) return null;
  const sampleWidth = 96;
  const sampleHeight = Math.max(54, Math.round(sampleWidth * preview.height / preview.width));
  const canvas = document.createElement("canvas");
  const sampleCtx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  sampleCtx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
  const imageData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let total = 0;
  let warmth = 0;
  let brightPixels = 0;
  let saturatedWarm = 0;
  let darkPixels = 0;
  let centerMassX = 0;
  let centerMassY = 0;
  let mass = 0;

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
    centerMassX += x * weight;
    centerMassY += y * weight;
    mass += weight;
  }

  const pixels = imageData.length / 4;
  const frameStats = { brightness: total / pixels, warmth: warmth / pixels };
  const scene = inferDemoScene(frameStats, brightPixels / pixels, darkPixels / pixels, saturatedWarm / pixels);
  const subjectBox = inferSubjectBox(centerMassX, centerMassY, mass, sampleWidth, sampleHeight, preview.width, preview.height);
  return { scene: scene.scene, confidence: scene.confidence, frameStats, subjectBox, at: Date.now() };
}

function inferDemoScene(frameStats, brightRatio, darkRatio, warmRatio) {
  if (darkRatio > 0.34 && brightRatio > 0.08) return { scene: "night", confidence: 0.82 };
  if (warmRatio > 0.22) return { scene: "food", confidence: 0.76 };
  if (frameStats.brightness > 0.62 && Math.abs(frameStats.warmth) < 0.08) return { scene: "landscape", confidence: 0.68 };
  if (frameStats.warmth > 0.05) return { scene: "portrait", confidence: 0.66 };
  if (frameStats.brightness < 0.45) return { scene: "indoor", confidence: 0.64 };
  return { scene: "street", confidence: 0.58 };
}

function inferSubjectBox(centerMassX, centerMassY, mass, sampleWidth, sampleHeight, frameWidth, frameHeight) {
  if (!mass) return null;
  const cx = (centerMassX / mass / sampleWidth) * frameWidth;
  const cy = (centerMassY / mass / sampleHeight) * frameHeight;
  const width = frameWidth * 0.42;
  const height = frameHeight * 0.58;
  return {
    x: Math.max(0, Math.min(frameWidth - width, cx - width / 2)),
    y: Math.max(0, Math.min(frameHeight - height, cy - height / 2)),
    width,
    height,
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
  });
  renderDecision(state.lastDecision);
}

function renderDecision(decision) {
  scenePill.textContent = `${decision.sceneLabel} · ${decision.light}`;
  filterPill.textContent = decision.appliedFilter ? `滤镜：${decision.appliedFilter}` : `推荐：${decision.recommendedFilters.join(" / ")}`;
  if (state.aiComposition) {
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
    r = gray + (r - gray) * settings.saturation;
    g = gray + (g - gray) * settings.saturation;
    b = gray + (b - gray) * settings.saturation;
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
  if (filterName.includes("暖") || filterName.includes("肤")) return { brightness: 10, contrast: 0.98, saturation: 1.08, warmth: 12 };
  if (filterName.includes("夜景")) return { brightness: 24, contrast: 1.08, saturation: 1.02, warmth: -4 };
  if (filterName.includes("鲜艳") || filterName.includes("天空")) return { brightness: 8, contrast: 1.08, saturation: 1.22, warmth: 3 };
  if (filterName.includes("胶片") || filterName.includes("高对比")) return { brightness: 2, contrast: 1.18, saturation: 0.92, warmth: 5 };
  if (filterName.includes("清透") || filterName.includes("白平衡")) return { brightness: 12, contrast: 1.02, saturation: 1.04, warmth: -6 };
  return { brightness: 6, contrast: 1.04, saturation: 1.06, warmth: 0 };
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
      audio: false,
    });
    state.stream = stream;
    video.srcObject = stream;
    await video.play();
    captureButton.disabled = false;
    startButton.textContent = "摄像头已启动";
    setStatus("摄像头已启动。关闭 AI 功能时拍照将保存原图；打开 AI 功能时拍照会进入 3 秒倒计时。");
  } catch (error) {
    setStatus(`摄像头启动失败：${error.message}`);
  }
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
  original.getContext("2d").drawImage(video, 0, 0, preview.width, preview.height);
  const samples = captureSamples.length ? captureSamples : state.samples;
  const decision = core.buildCaptureDecision({
    aiComposition: state.aiComposition,
    aiFilter: state.aiFilter,
    frame: { width: preview.width, height: preview.height },
    samples,
  });
  const crop = cropCanvas(original, decision.cropBox);
  const filtered = cropCanvas(original, decision.cropBox);
  if (decision.appliedFilter) {
    applyFilter(filtered.getContext("2d"), filtered.width, filtered.height, decision.appliedFilter);
  }

  const outputs = [
    { key: "original", title: "original.jpg", canvas: original },
  ];
  if (state.aiComposition) outputs.push({ key: "ai_crop", title: "ai_crop.jpg", canvas: crop });
  if (state.aiFilter) outputs.push({ key: "ai_crop_filter", title: state.aiComposition ? "ai_crop_filter.jpg" : "ai_filter.jpg", canvas: filtered });

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
    })),
  };
  renderResults(outputs, state.lastMetadata);
  downloadButton.disabled = false;
  state.capturing = false;
  captureButton.disabled = false;
  setStatus(`拍照完成：${decision.sceneLabel} / ${decision.light}${decision.appliedFilter ? ` / 已套用 ${decision.appliedFilter}` : ""}`);
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
captureButton.addEventListener("click", capture);
downloadButton.addEventListener("click", downloadMetadata);
setInterval(updateDecision, 1000);
drawPreview();
