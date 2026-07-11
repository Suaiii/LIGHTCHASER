/* LIGHTCHASER · Photo Renderer Web Worker
 *
 * 把滤镜管线放到 worker 线程,主线程立刻返回,worker 异步返回 finalDataUrl。
 * 主线程不会阻塞 100~500ms 的 ImageData 像素循环。
 *
 * 协议:
 *   main → worker: { id, type:'render', imageData, filterKey, preset, sceneContext }
 *                  transferable: [imageData.data.buffer]
 *   worker → main: { id, type:'rendered', finalImageData, pipeline, renderTimeMs }
 *                  transferable: [finalImageData.data.buffer]
 *
 * 注意:Worker 里没有 window / document,所以 LUT 工厂和 layer 类都得自己实现/内嵌一份。
 * 简化路径:Worker 只跑 ToneLayer + GrainLayer + VignetteLayer(纯像素循环,无 DOM 依赖);
 * LUT 在 Step 5 后会内嵌在 worker 文件里。
 */

(function (root) {
  "use strict";

  // ── ToneLayer (mirror of main-thread) ──
  function ToneLayer(tone) {
    this.tone = tone || {};
  }
  ToneLayer.prototype.apply = function (imageData) {
    const t = this.tone;
    const brightness = Number(t.brightness) || 0;
    const contrast = Number(t.contrast) || 1;
    const saturation = Number(t.saturation) || 1;
    const warmth = Number(t.warmth) || 0;
    const grayscale = !!t.grayscale;
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      if (grayscale) { r = gray; g = gray; b = gray; }
      else {
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
  };

  // ── GrainLayer ──
  function GrainLayer(density) {
    this.density = Math.max(0, Math.min(1, Number(density) || 0));
  }
  const GRAIN_AMPLITUDE = 30;
  function hash32(x, y, channel) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + channel * 1274126177;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967295;
  }
  GrainLayer.prototype.apply = function (imageData) {
    if (this.density <= 0) return;
    const data = imageData.data;
    const amp = this.density * GRAIN_AMPLITUDE;
    for (let y = 0; y < imageData.height; y += 2) {
      for (let x = 0; x < imageData.width; x += 2) {
        const i = (y * imageData.width + x) * 4;
        data[i]     = Math.max(0, Math.min(255, data[i]     + (hash32(x, y, 0) - 0.5) * amp));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (hash32(x, y, 1) - 0.5) * amp));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (hash32(x, y, 2) - 0.5) * amp));
      }
    }
  };

  // ── VignetteLayer ──
  function VignetteLayer(strength) {
    this.strength = Math.max(0, Math.min(1, Number(strength) || 0));
  }
  const VIGNETTE_POWER = 2.0;
  const VIGNETTE_RADIUS = 0.72;
  VignetteLayer.prototype.apply = function (imageData) {
    if (this.strength <= 0) return;
    const data = imageData.data;
    const w = imageData.width, h = imageData.height;
    const cx = w * 0.5, cy = h * 0.5;
    const maxR = Math.hypot(cx, cy);
    const radius = maxR * VIGNETTE_RADIUS;
    for (let y = 0; y < h; y++) {
      const dy = y - cy;
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const d = Math.hypot(dx, dy) / radius;
        if (d <= 1) continue;
        const falloff = Math.pow((d - 1) / (1 / VIGNETTE_RADIUS), VIGNETTE_POWER);
        const k = Math.max(0, 1 - this.strength * falloff);
        const i = (y * w + x) * 4;
        data[i] *= k; data[i + 1] *= k; data[i + 2] *= k;
      }
    }
  };

  // ── CubeLUTLayer (Step 5) —— worker 自己的简化版,因为 worker 没有 importScripts 外部 JS ──
  // LUT 数据由主线程在 postMessage 时一并传过来(worker 第一次 render 时缓存)。
  // 注意:为了让 worker 真正可用,preset.lutKey 触发主线程把 LUT 数组 + LUT 数据放进 preset 里。
  const LUT_CACHE = {};
  function CubeLUTLayer(lutData, strength) {
    this.lut = lutData || null;
    this.strength = Math.max(0, Math.min(1, Number(strength) || 0));
    this.N = 64;
  }
  CubeLUTLayer.prototype.apply = function (imageData) {
    if (!this.lut || this.strength <= 0) return;
    const data = imageData.data;
    const lut = this.lut;
    const N = this.N;
    const invN = 1 / (256 / N);
    const s = this.strength;
    const is = 1 - s;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
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
  };

  function buildPipeline(preset) {
    if (!preset) return [];
    const layers = [];
    // LUT(主线程传过来的 preset.lutData)
    if (preset.lut && preset.lutData) {
      layers.push(new CubeLUTLayer(preset.lutData, preset.lutStrength ?? 1.0));
    }
    if (preset.tone) layers.push(new ToneLayer(preset.tone));
    if (preset.grain) layers.push(new GrainLayer(preset.grain));
    if (preset.vignette) layers.push(new VignetteLayer(preset.vignette));
    return layers;
  }

  self.addEventListener("message", function (e) {
    const msg = e.data || {};
    if (msg.type !== "render") return;
    const started = (self.performance && self.performance.now) ? self.performance.now() : Date.now();
    try {
      const imageData = msg.imageData;
      if (!imageData || !imageData.data) {
        throw new Error("missing_image_data");
      }
      const layers = buildPipeline(msg.preset);
      for (const layer of layers) {
        if (layer && typeof layer.apply === "function") layer.apply(imageData);
      }
      const renderTimeMs = Math.round(((self.performance && self.performance.now) ? self.performance.now() : Date.now()) - started);
      // 注意:transferable 后 imageData.data.buffer 在主线程会被分离,所以这里直接传
      self.postMessage({
        id: msg.id,
        type: "rendered",
        finalImageData: imageData,
        pipeline: layers.map((l) => {
          const cn = l.constructor && l.constructor.name;
          if (cn === "CubeLUTLayer") return "lut";
          if (cn === "ToneLayer") return "tone";
          if (cn === "GrainLayer") return "grain";
          if (cn === "VignetteLayer") return "vignette";
          return cn ? cn.toLowerCase() : "unknown";
        }),
        renderTimeMs,
      }, [imageData.data.buffer]);
    } catch (err) {
      self.postMessage({ id: msg.id, type: "error", error: err && err.message ? err.message : String(err) });
    }
  });

  root.__photoRendererReady = true;
})(typeof globalThis !== "undefined" ? globalThis : self);