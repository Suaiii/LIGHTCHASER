/**
 * Lightchaser Vision Engine
 * 封装 COCO-SSD 物体检测，输出与现有 buildCaptureDecision 兼容的 sample 结构。
 *
 * 用法：
 *   await window.LightchaserVision.init();
 *   const sample = await window.LightchaserVision.detect(videoEl, frame);
 *   // sample = { scene, confidence, frameStats, subjectBox, subjectBoxes, detections, at }
 *
 * 失败时 init() 会标记 ready=false，调用方应回退到原像素统计法。
 */
(function (root) {

  const state = {
    model: null,
    ready: false,
    loading: false,
    loadError: null,
    backend: null,
  };

  // COCO 80 类 → 现有 8 场景映射
  const CLASS_TO_SCENE = {
    person: "portrait",
    tie: "portrait",
    // 食物
    "dining table": "food",
    "wine glass": "food",
    cup: "food",
    fork: "food",
    knife: "food",
    spoon: "food",
    bowl: "food",
    banana: "food",
    apple: "food",
    sandwich: "food",
    orange: "food",
    broccoli: "food",
    carrot: "food",
    "hot dog": "food",
    pizza: "food",
    donut: "food",
    cake: "food",
    // 街拍
    bicycle: "street",
    car: "street",
    motorcycle: "street",
    airplane: "street",
    bus: "street",
    train: "street",
    truck: "street",
    boat: "street",
    "traffic light": "street",
    "fire hydrant": "street",
    "stop sign": "street",
    "parking meter": "street",
    bench: "street",
    umbrella: "street",
    handbag: "street",
    suitcase: "street",
    backpack: "street",
    "sports ball": "street",
    "baseball bat": "street",
    "baseball glove": "street",
    "skateboard": "street",
    "tennis racket": "street",
    // 风景（户外动物 + 户外运动）
    bird: "landscape",
    cat: "landscape",
    dog: "landscape",
    horse: "landscape",
    sheep: "landscape",
    cow: "landscape",
    elephant: "landscape",
    bear: "landscape",
    zebra: "landscape",
    giraffe: "landscape",
    frisbee: "landscape",
    skis: "landscape",
    snowboard: "landscape",
    kite: "landscape",
    surfboard: "landscape",
    // 室内
    chair: "indoor",
    couch: "indoor",
    "potted plant": "indoor",
    bed: "indoor",
    toilet: "indoor",
    sink: "indoor",
    refrigerator: "indoor",
    oven: "indoor",
    microwave: "indoor",
    toaster: "indoor",
    "hair drier": "indoor",
    "toothbrush": "indoor",
    // 文档
    book: "document",
    clock: "document",
    vase: "document",
    scissors: "document",
    "tv": "document",
    laptop: "document",
    keyboard: "document",
    mouse: "document",
    remote: "document",
    "cell phone": "document",
  };

  const MIN_SCORE = 0.45;
  const MAX_DETECTIONS = 8;
  // 环境物件参与场景识别，但不能因为面积大就被当作构图主体。
  const COMPOSITION_SUBJECT_CLASSES = new Set([
    "person", "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe",
    "banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
    "bowl", "cup", "wine glass",
  ]);

  function classToScene(className) {
    return CLASS_TO_SCENE[className] || "general";
  }

  async function ensureBackends() {
    const tf = root.tf;
    if (!tf) throw new Error("tfjs_not_loaded");
    // 优先 WebGPU，回退 WebGL，再回退 WASM，最后 CPU
    const candidates = ["webgpu", "webgl", "wasm", "cpu"];
    for (const name of candidates) {
      try {
        if (name === "wasm" && root.tfWasm) {
          await root.tfWasm.setWasmPaths(root.tfWasmPaths || undefined);
        }
        await tf.setBackend(name);
        await tf.ready();
        if (tf.getBackend() === name) {
          state.backend = name;
          return name;
        }
      } catch (error) {
        // 继续尝试下一个
      }
    }
    throw new Error("no_backend_available");
  }

  async function init(onProgress) {
    if (state.ready || state.loading) return state.ready;
    state.loading = true;
    try {
      if (typeof onProgress === "function") onProgress("backend");
      await ensureBackends();
      if (typeof onProgress === "function") onProgress("model");
      const cocoSsd = root.cocoSsd;
      if (!cocoSsd) throw new Error("coco_ssd_not_loaded");
      state.model = await cocoSsd.load({
        base: "lite_mobilenet_v2",
      });
      state.ready = true;
      state.loadError = null;
      if (typeof onProgress === "function") onProgress("done");
    } catch (error) {
      state.loadError = error?.message || String(error);
      state.ready = false;
      // 不抛出，让调用方用 fallback
    } finally {
      state.loading = false;
    }
    return state.ready;
  }

  function sourceToInput(source) {
    // COCO-SSD 接受 HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData
    return source;
  }

  function pickPrimaryDetection(detections, frame) {
    if (!detections.length) return null;
    // COCO-SSD bbox 为 [x, y, width, height]。按置信度和面积选主体，避免背景物件主导裁切。
    let best = null;
    let bestScore = 0;
    for (const det of detections) {
      if (!COMPOSITION_SUBJECT_CLASSES.has(det.class)) continue;
      const [, , width, height] = det.bbox;
      const areaRatio = Math.max(0, width * height) / Math.max(1, frame.width * frame.height);
      const score = (det.score || 0) * (0.65 + Math.min(0.35, Math.sqrt(areaRatio)));
      if (score > bestScore) {
        bestScore = score;
        best = det;
      }
    }
    return best;
  }

  function detectionToBox(det, frame) {
    if (!det) return null;
    const [rawX, rawY, rawWidth, rawHeight] = det.bbox;
    const x = Math.max(0, rawX);
    const y = Math.max(0, rawY);
    const width = Math.min(frame.width - x, rawWidth);
    const height = Math.min(frame.height - y, rawHeight);
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      confidence: Number(det.score?.toFixed(3) || 0.5),
      class: det.class,
      scene: classToScene(det.class),
    };
  }

  function aggregateScene(detections) {
    if (!detections.length) {
      return { scene: "general", confidence: 0.4, reason: "no_detection" };
    }
    // 投票：按置信度加权
    const scores = {};
    for (const det of detections) {
      const scene = classToScene(det.class);
      scores[scene] = (scores[scene] || 0) + (det.score || 0.5);
    }
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topScene = sorted[0][0];
    const topScore = sorted[0][1];
    const total = sorted.reduce((sum, [, v]) => sum + v, 0);
    const confidence = total > 0 ? Math.min(0.98, topScore / total + 0.15) : 0.5;
    return { scene: topScene, confidence: Number(confidence.toFixed(3)), reason: "detection_vote" };
  }

  function computeFrameStats(source, frame) {
    // 简单降采样亮度/暖度统计（保留给 classifyLight 使用）
    try {
      const canvas = document.createElement("canvas");
      const w = 48;
      const h = Math.max(28, Math.round(w * frame.height / frame.width));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let total = 0;
      let warmth = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        total += (r + g + b) / 765;
        warmth += (r - b) / 255;
      }
      return { brightness: total / pixels, warmth: warmth / pixels };
    } catch (error) {
      return { brightness: 0.5, warmth: 0 };
    }
  }

  async function detect(source, frame) {
    if (!state.ready || !state.model) {
      return null;
    }
    const input = sourceToInput(source);
    let raw = [];
    try {
      raw = await state.model.detect(input, MAX_DETECTIONS, MIN_SCORE);
    } catch (error) {
      return null;
    }
    if (!raw || !raw.length) {
      return {
        scene: "general",
        confidence: 0.42,
        frameStats: computeFrameStats(source, frame),
        subjectBox: null,
        subjectBoxes: [],
        detections: [],
        at: Date.now(),
      };
    }

    const detections = raw.map((det) => ({
      class: det.class,
      score: Number(det.score?.toFixed(3) || 0),
      bbox: det.bbox,
    }));

    const subjectBoxes = detections
      .filter((det) => COMPOSITION_SUBJECT_CLASSES.has(det.class))
      .map((det) => detectionToBox(det, frame))
      .filter((box) => box && box.width > 4 && box.height > 4);

    const primary = pickPrimaryDetection(raw, frame);
    const subjectBox = detectionToBox(primary, frame);
    const sceneResult = aggregateScene(detections);

    return {
      scene: sceneResult.scene,
      confidence: sceneResult.confidence,
      frameStats: computeFrameStats(source, frame),
      subjectBox,
      subjectBoxes,
      detections: detections.map((d) => ({
        class: d.class,
        score: d.score,
        scene: classToScene(d.class),
      })),
      at: Date.now(),
    };
  }

  root.LightchaserVision = {
    init,
    detect,
    get ready() { return state.ready; },
    get loading() { return state.loading; },
    get backend() { return state.backend; },
    get loadError() { return state.loadError; },
    CLASS_TO_SCENE,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
