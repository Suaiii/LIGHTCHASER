/* LIGHTCHASER · 滤镜 RenderLayer 抽象
 *
 * 把胶片模拟拆成可组合的 layer: 调色 / 颗粒 / 暗角。
 * 每个 layer 在 canvas 的 ImageData 上原地修改像素。
 *
 * 设计目标:
 *  - ToneLayer 完全接管原 applyLocalFilter 的 4 维像素循环。
 *  - GrainLayer 用确定性的伪随机 (基于像素坐标 hash),拍两次颗粒 pattern 一致。
 *  - VignetteLayer 按到中心的归一化距离平方衰减 RGB。
 *  - buildDefaultPipeline(preset) 根据新结构化 preset 拼出 3 层。
 *  - applyPipeline(canvas, layers) 顺序执行。
 *
 * 暴露: window.LightchaserFilterLayers = { ToneLayer, GrainLayer, VignetteLayer, buildDefaultPipeline, applyPipeline }
 */
(function (root) {
  "use strict";

  // 颜色颗粒通道随机扰动幅度。density=1 时最大 ±30,密度大但不至于毁画面。
  const GRAIN_AMPLITUDE = 30;
  // 暗角衰减指数。>1 边缘衰减更陡,=2 是经典柔和暗角,这里 2.0。
  const VIGNETTE_POWER = 2.0;
  // 暗角起始半径比例。中心 strength=0 的归一化距离阈值。
  const VIGNETTE_RADIUS = 0.72;

  function ToneLayer(toneConfig) {
    this.tone = toneConfig || {};
  }

  ToneLayer.prototype.apply = function (ctx, width, height) {
    const t = this.tone;
    const brightness = Number(t.brightness) || 0;
    const contrast = Number(t.contrast) || 1;
    const saturation = Number(t.saturation) || 1;
    const warmth = Number(t.warmth) || 0;
    const grayscale = !!t.grayscale;

    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      if (grayscale) {
        r = gray;
        g = gray;
        b = gray;
      } else {
        r = gray + (r - gray) * saturation;
        g = gray + (g - gray) * saturation;
        b = gray + (b - gray) * saturation;
      }
      r = (r - 128) * contrast + 128 + brightness + warmth;
      g = (g - 128) * contrast + 128 + brightness + warmth * 0.2;
      b = (b - 128) * contrast + 128 + brightness - warmth;
      data[i]     = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
    ctx.putImageData(image, 0, 0);
  };

  function GrainLayer(density) {
    this.density = Math.max(0, Math.min(1, Number(density) || 0));
  }

  // 32-bit hash → [0, 1)。比 Math.random 稳定 (同坐标永远同结果),
  // 拍两张照片颗粒 pattern 一致,看起来才像真实胶片。
  function hash32(x, y, channel) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + channel * 1274126177;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967295;
  }

  GrainLayer.prototype.apply = function (ctx, width, height) {
    if (this.density <= 0) return;
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const amp = this.density * GRAIN_AMPLITUDE;
    // 用 1/4 步长采样 + 通道相关偏移,既省算力又让 R/G/B 各自独立抖,看起来是彩色颗粒。
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        const nR = hash32(x, y, 0) - 0.5;
        const nG = hash32(x, y, 1) - 0.5;
        const nB = hash32(x, y, 2) - 0.5;
        data[i]     = Math.max(0, Math.min(255, data[i]     + nR * amp));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + nG * amp));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + nB * amp));
      }
    }
    ctx.putImageData(image, 0, 0);
  };

  function VignetteLayer(strength) {
    this.strength = Math.max(0, Math.min(1, Number(strength) || 0));
  }

  VignetteLayer.prototype.apply = function (ctx, width, height) {
    if (this.strength <= 0) return;
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const cx = width * 0.5;
    const cy = height * 0.5;
    // 把每个像素到中心的距离归一化到 [0, 1] (最长对角线 / 2)
    const maxR = Math.hypot(cx, cy);
    const radius = maxR * VIGNETTE_RADIUS;
    for (let y = 0; y < height; y++) {
      const dy = y - cy;
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const d = Math.hypot(dx, dy) / radius;
        if (d <= 1) continue; // 中心区不衰减
        const falloff = Math.pow((d - 1) / (1 / VIGNETTE_RADIUS), VIGNETTE_POWER);
        const k = Math.max(0, 1 - this.strength * falloff);
        const i = (y * width + x) * 4;
        data[i]     = data[i]     * k;
        data[i + 1] = data[i + 1] * k;
        data[i + 2] = data[i + 2] * k;
      }
    }
    ctx.putImageData(image, 0, 0);
  };

  function buildDefaultPipeline(preset) {
    if (!preset) return [];
    const tone = preset.tone || preset; // 兼容老扁平 preset
    const layers = [];
    // Step 5:LUT 在最前面(直接影响色彩),只在 LUT 工厂可用时挂上
    if (preset.lut && root.LightchaserFilterLUTs?.LUT_FACTORY?.[preset.lut]) {
      try {
        const lut = root.LightchaserFilterLUTs.LUT_FACTORY[preset.lut]();
        layers.push(new CubeLUTLayer(lut, preset.lutStrength ?? 1.0));
      } catch (err) {
        // LUT 生成失败 → 跳过,不影响后续 layer
        if (typeof console !== "undefined") console.warn("[filter-layers] LUT gen failed", err);
      }
    }
    layers.push(new ToneLayer(tone));
    layers.push(new GrainLayer(preset.grain || 0));
    layers.push(new VignetteLayer(preset.vignette || 0));
    return layers;
  }

  // ── CubeLUTLayer (Step 5):64³ RGB LUT,无三线性插值,直接量化到 0..63 ──
  function CubeLUTLayer(lutData, strength) {
    this.lut = lutData instanceof Uint8Array ? lutData : null;
    this.strength = Math.max(0, Math.min(1, Number(strength) || 0));
    this.N = 64; // 64³
  }
  CubeLUTLayer.prototype.apply = function (ctx, width, height) {
    if (!this.lut || this.strength <= 0) return;
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const lut = this.lut;
    const N = this.N;
    const invN = 1 / (256 / N); // 4
    const s = this.strength;
    const is = 1 - s;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // 0..255 → 0..63
      const ri = (r * invN) | 0;
      const gi = (g * invN) | 0;
      const bi = (b * invN) | 0;
      const riC = ri < N ? ri : N - 1;
      const giC = gi < N ? gi : N - 1;
      const biC = bi < N ? bi : N - 1;
      const idx = (riC * N * N + giC * N + biC) * 3;
      const lr = lut[idx], lg = lut[idx + 1], lb = lut[idx + 2];
      data[i]     = Math.round(r * is + lr * s);
      data[i + 1] = Math.round(g * is + lg * s);
      data[i + 2] = Math.round(b * is + lb * s);
    }
    ctx.putImageData(image, 0, 0);
  };

  function applyPipeline(canvas, layers) {
    if (!canvas || !Array.isArray(layers) || layers.length === 0) return canvas;
    const ctx = canvas.getContext("2d");
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer && typeof layer.apply === "function") {
        layer.apply(ctx, canvas.width, canvas.height);
      }
    }
    return canvas;
  }

  root.LightchaserFilterLayers = {
    ToneLayer: ToneLayer,
    GrainLayer: GrainLayer,
    VignetteLayer: VignetteLayer,
    CubeLUTLayer: CubeLUTLayer,
    buildDefaultPipeline: buildDefaultPipeline,
    applyPipeline: applyPipeline,
    createRenderer: createRenderer,
    MainThreadPhotoRenderer: MainThreadPhotoRenderer,
    WorkerPhotoRenderer: WorkerPhotoRenderer,
    PhotoRenderer: PhotoRenderer,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);

/* ===========================================================================
 * Step 4: PhotoRenderer 抽象
 *  - MainThreadPhotoRenderer:在主线程同步跑 layer pipeline(用作 fallback / 调试)
 *  - WorkerPhotoRenderer:把 ImageData transferable 丢给 worker 异步跑
 *  - createRenderer():自动选 Worker(若可用),否则 MainThread
 * 协议 (worker ↔ main):
 *   main → worker:{ id, type:'render', imageData, filterKey, preset }  ([imageData.data.buffer] transferable)
 *   worker → main:{ id, type:'rendered', finalImageData, pipeline, renderTimeMs }  ([data.buffer] transferable)
 * =========================================================================== */
function PhotoRenderer() {}
PhotoRenderer.prototype.mode = "unknown";

function MainThreadPhotoRenderer() {
  this.mode = "main-thread";
}
MainThreadPhotoRenderer.prototype = Object.create(PhotoRenderer.prototype);
MainThreadPhotoRenderer.prototype.constructor = MainThreadPhotoRenderer;

MainThreadPhotoRenderer.prototype.render = function (input) {
  const started = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  const preset = input.preset || (input.filterKey && (globalThis.LightchaserAICameraCore?.FILTER_PRESETS?.[input.filterKey]));
  const layers = globalThis.LightchaserFilterLayers.buildDefaultPipeline(preset || {});
  const ctx = input.sourceCanvas.getContext("2d");
  for (const layer of layers) {
    if (layer && typeof layer.apply === "function") {
      layer.apply(ctx, input.sourceCanvas.width, input.sourceCanvas.height);
    }
  }
  const finalCanvas = input.sourceCanvas;
  const renderTimeMs = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - started);
  return Promise.resolve({
    finalCanvas,
    pipeline: pipelineNamesFromLayers(layers, preset),
    renderTimeMs,
    renderMode: this.mode,
  });
};

function WorkerPhotoRenderer() {
  this.mode = "worker";
  this.nextId = 1;
  this.pending = new Map();
  this.worker = null;
  this.failed = false;
  try {
    this.worker = new Worker("/workers/photo-renderer.worker.js");
    this.worker.addEventListener("message", (e) => this._onMessage(e));
    this.worker.addEventListener("error", (e) => this._onError(e));
  } catch (err) {
    this.failed = true;
  }
}
WorkerPhotoRenderer.prototype = Object.create(PhotoRenderer.prototype);
WorkerPhotoRenderer.prototype.constructor = WorkerPhotoRenderer;

WorkerPhotoRenderer.prototype._onMessage = function (e) {
  const data = e.data || {};
  const p = this.pending.get(data.id);
  if (!p) return;
  this.pending.delete(data.id);
  if (data.type === "rendered" && data.finalImageData) {
    // 把 worker 传回的 ImageData 重建到一个 OffscreenCanvas(若有)/ 普通 canvas
    const finalCanvas = createCanvasFromImageData(data.finalImageData);
    p.resolve({
      finalCanvas,
      pipeline: data.pipeline || [],
      renderTimeMs: data.renderTimeMs || 0,
      renderMode: this.mode,
    });
  } else {
    p.reject(new Error(data.error || "worker_render_failed"));
  }
};

WorkerPhotoRenderer.prototype._onError = function (e) {
  this.failed = true;
  for (const [, p] of this.pending) p.reject(new Error("worker_error: " + (e.message || "unknown")));
  this.pending.clear();
};

WorkerPhotoRenderer.prototype.render = function (input) {
  const self = this;
  if (!this.worker || this.failed) {
    return new MainThreadPhotoRenderer().render(input);
  }
  const id = this.nextId++;
  const ctx = input.sourceCanvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, input.sourceCanvas.width, input.sourceCanvas.height);
  const preset = input.preset || (input.filterKey && (globalThis.LightchaserAICameraCore?.FILTER_PRESETS?.[input.filterKey]));
    return new Promise((resolve, reject) => {
    self.pending.set(id, { resolve, reject });
    try {
      // 把 LUT 数据注入 preset(worker 没有 LUT 工厂,需要主线程预先 bake 进去)
      const presetForWorker = preset ? { ...preset } : null;
      if (presetForWorker && presetForWorker.lut && globalThis.LightchaserFilterLUTs?.LUT_FACTORY?.[presetForWorker.lut]) {
        try {
          presetForWorker.lutData = globalThis.LightchaserFilterLUTs.LUT_FACTORY[presetForWorker.lut]();
        } catch (_) { /* LUT 失败 worker 会自动跳过 */ }
      }
      self.worker.postMessage({
        id,
        type: "render",
        imageData,
        filterKey: input.filterKey || null,
        preset: presetForWorker,
        sceneContext: input.sceneContext || null,
      }, [imageData.data.buffer]);
    } catch (err) {
      self.pending.delete(id);
      // transferable 失败 → fallback 主线程
      new MainThreadPhotoRenderer().render(input).then(resolve, reject);
    }
  });
};

function createRenderer() {
  if (typeof Worker !== "undefined") {
    try {
      const r = new WorkerPhotoRenderer();
      if (r.worker) return r;
    } catch (_) {}
  }
  return new MainThreadPhotoRenderer();
}

function pipelineNamesFromLayers(layers, preset) {
  const names = [];
  // layers 顺序匹配 buildDefaultPipeline;统一用小写 key
  for (const layer of layers) {
    if (!layer) continue;
    const cn = layer.constructor && layer.constructor.name;
    if (cn === "CubeLUTLayer") names.push("lut");
    else if (cn === "ToneLayer") names.push("tone");
    else if (cn === "GrainLayer") names.push("grain");
    else if (cn === "VignetteLayer") names.push("vignette");
  }
  // preset.lut 但没 layer 时(worker LUT 数据没传过来)补一个 'lut' tag
  if (preset && preset.lut && !names.includes("lut")) names.unshift("lut");
  // 去重保持顺序
  return names.filter((n, i) => names.indexOf(n) === i);
}

function createCanvasFromImageData(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d").putImageData(imageData, 0, 0);
  return canvas;
}