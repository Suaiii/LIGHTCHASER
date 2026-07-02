(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.LightchaserAICameraCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const FILTER_PRESETS = {
    "iPhone Rich Contrast": { label: "iPhone 深调高反差", brightness: -2, contrast: 1.16, saturation: 1.04, warmth: 0 },
    "iPhone Vibrant": { label: "iPhone 鲜明", brightness: 4, contrast: 1.06, saturation: 1.18, warmth: 0 },
    "iPhone Warm": { label: "iPhone 暖色", brightness: 4, contrast: 1.02, saturation: 1.08, warmth: 18 },
    "iPhone Cool": { label: "iPhone 冷色", brightness: 6, contrast: 1.04, saturation: 1.02, warmth: -16 },
    "FUJIFILM PROVIA": { label: "富士 PROVIA 标准", brightness: 2, contrast: 1.02, saturation: 1.05, warmth: 2 },
    "FUJIFILM Velvia": { label: "富士 Velvia 鲜艳", brightness: 4, contrast: 1.12, saturation: 1.28, warmth: 2 },
    "FUJIFILM ASTIA": { label: "富士 ASTIA 柔和", brightness: 5, contrast: 0.92, saturation: 1.04, warmth: 8 },
    "FUJIFILM Classic Chrome": { label: "富士 Classic Chrome", brightness: 1, contrast: 1.12, saturation: 0.78, warmth: -2 },
    "FUJIFILM Classic Neg.": { label: "富士 Classic Neg.", brightness: 0, contrast: 1.18, saturation: 0.92, warmth: 4 },
    "FUJIFILM ETERNA": { label: "富士 ETERNA 电影", brightness: 3, contrast: 0.88, saturation: 0.72, warmth: 0 },
    "FUJIFILM ACROS": { label: "富士 ACROS 黑白", brightness: 0, contrast: 1.2, saturation: 0, warmth: 0, grayscale: true },
    "Google Dynamic": { label: "Google Dynamic 鲜活", brightness: 5, contrast: 1.07, saturation: 1.16, warmth: 0 },
    "Google Night Sight": { label: "Google Night Sight", brightness: 20, contrast: 1.08, saturation: 1.02, warmth: -4 },
    "Google Portrait": { label: "Google Portrait 柔肤", brightness: 6, contrast: 0.94, saturation: 1.06, warmth: 10 },
    "Clear Scan": { label: "清晰扫描", brightness: 18, contrast: 1.28, saturation: 0.2, warmth: -6 },
  };

  const SCENE_FILTERS = {
    portrait: { label: "人像", filters: ["Google Portrait", "FUJIFILM ASTIA", "iPhone Warm"] },
    food: { label: "美食", filters: ["iPhone Vibrant", "Google Dynamic", "FUJIFILM Velvia"] },
    night: { label: "夜景", filters: ["Google Night Sight", "iPhone Cool", "FUJIFILM ETERNA"] },
    landscape: { label: "风景", filters: ["FUJIFILM Velvia", "Google Dynamic", "FUJIFILM PROVIA"] },
    indoor: { label: "室内", filters: ["iPhone Cool", "Google Portrait", "FUJIFILM PROVIA"] },
    street: { label: "街拍", filters: ["FUJIFILM Classic Neg.", "FUJIFILM Classic Chrome", "iPhone Rich Contrast"] },
    document: { label: "文档", filters: ["Clear Scan", "FUJIFILM ACROS", "iPhone Cool"] },
    general: { label: "普通", filters: ["Google Dynamic", "FUJIFILM PROVIA", "FUJIFILM ETERNA"] },
  };

  const LIGHT_FILTER_OVERRIDES = {
    "偏暗": {
      night: "Google Night Sight",
      portrait: "Google Portrait",
      document: "Clear Scan",
      general: "Google Night Sight",
    },
    "过曝": {
      portrait: "FUJIFILM ASTIA",
      food: "FUJIFILM PROVIA",
      landscape: "FUJIFILM PROVIA",
      street: "FUJIFILM Classic Chrome",
      general: "FUJIFILM ETERNA",
    },
    "偏冷": {
      portrait: "iPhone Warm",
      food: "iPhone Warm",
      indoor: "iPhone Warm",
      general: "iPhone Warm",
    },
    "偏暖": {
      portrait: "iPhone Cool",
      food: "FUJIFILM PROVIA",
      indoor: "iPhone Cool",
      general: "iPhone Cool",
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function classifyLight(frameStats) {
    const brightness = frameStats?.brightness ?? 0.5;
    const warmth = frameStats?.warmth ?? 0;
    if (brightness < 0.38) return "偏暗";
    if (brightness > 0.78) return "过曝";
    if (warmth > 0.14) return "偏暖";
    if (warmth < -0.14) return "偏冷";
    return "正常";
  }

  function chooseFilter(scene, light) {
    const config = SCENE_FILTERS[scene] || SCENE_FILTERS.general;
    const lightOverrides = LIGHT_FILTER_OVERRIDES[light];
    const override = lightOverrides?.[scene] || lightOverrides?.general;
    if (override && FILTER_PRESETS[override]) return override;
    return config.filters[0];
  }

  function recommendFilters(scene, light) {
    const config = SCENE_FILTERS[scene] || SCENE_FILTERS.general;
    const primary = chooseFilter(scene, light);
    const fallback = SCENE_FILTERS.general.filters;
    return [primary, ...config.filters, ...fallback]
      .filter((filter, index, filters) => FILTER_PRESETS[filter] && filters.indexOf(filter) === index)
      .slice(0, 3);
  }

  function inferScene(samples) {
    const scores = {};
    for (const sample of samples) {
      const scene = sample.scene || "general";
      scores[scene] = (scores[scene] || 0) + (Number.isFinite(sample.confidence) ? sample.confidence : 0.5);
    }
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return { scene: sorted[0]?.[0] || "general", confidence: Number((sorted[0]?.[1] || 0).toFixed(3)) };
  }

  function averageStats(samples) {
    if (!samples.length) return { brightness: 0.5, warmth: 0 };
    const totals = samples.reduce((acc, sample) => {
      acc.brightness += sample.frameStats?.brightness ?? 0.5;
      acc.warmth += sample.frameStats?.warmth ?? 0;
      return acc;
    }, { brightness: 0, warmth: 0 });
    return { brightness: totals.brightness / samples.length, warmth: totals.warmth / samples.length };
  }

  function calculateCropBox(frame, subjectBox, aspectRatio) {
    const width = frame.width;
    const height = frame.height;
    const targetRatio = aspectRatio || width / height;
    const subject = subjectBox || { x: width * 0.25, y: height * 0.2, width: width * 0.5, height: height * 0.56 };
    let cropWidth = Math.max(subject.width * 1.55, width * 0.58);
    let cropHeight = cropWidth / targetRatio;

    if (cropHeight < subject.height * 1.55) {
      cropHeight = Math.max(subject.height * 1.55, height * 0.58);
      cropWidth = cropHeight * targetRatio;
    }
    if (cropWidth > width) {
      cropWidth = width;
      cropHeight = cropWidth / targetRatio;
    }
    if (cropHeight > height) {
      cropHeight = height;
      cropWidth = cropHeight * targetRatio;
    }

    const subjectCenterX = subject.x + subject.width / 2;
    const subjectCenterY = subject.y + subject.height / 2;
    const thirdsBiasY = subjectCenterY < height * 0.5 ? -0.06 * cropHeight : 0.04 * cropHeight;
    return {
      x: Math.round(clamp(subjectCenterX - cropWidth / 2, 0, width - cropWidth)),
      y: Math.round(clamp(subjectCenterY - cropHeight / 2 + thirdsBiasY, 0, height - cropHeight)),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight),
    };
  }

  function buildCaptureDecision(options) {
    const samples = options.samples || [];
    const frame = options.frame || { width: 1080, height: 1440 };
    const aiComposition = Boolean(options.aiComposition);
    const aiFilter = Boolean(options.aiFilter);
    const stableSamples = samples.slice(-Math.min(5, samples.length || 1));
    const sceneResult = inferScene(stableSamples);
    const light = classifyLight(averageStats(stableSamples));
    const filters = recommendFilters(sceneResult.scene, light);
    const subjectBox = [...stableSamples].reverse().find((sample) => sample.subjectBox)?.subjectBox;
    const cropBox = aiComposition
      ? calculateCropBox(frame, subjectBox, frame.width / frame.height)
      : { x: 0, y: 0, width: frame.width, height: frame.height };

    return {
      mode: aiComposition || aiFilter ? "ai-capture" : "standard",
      scene: sceneResult.scene,
      sceneLabel: SCENE_FILTERS[sceneResult.scene]?.label || SCENE_FILTERS.general.label,
      sceneConfidence: sceneResult.confidence,
      light,
      recommendedFilters: filters,
      appliedFilter: aiFilter ? filters[0] : null,
      cropBox,
      outputs: {
        original: true,
        aiCrop: aiComposition,
        aiCropFilter: aiComposition && aiFilter,
      },
    };
  }

  return { SCENE_FILTERS, FILTER_PRESETS, classifyLight, recommendFilters, calculateCropBox, buildCaptureDecision };
});
