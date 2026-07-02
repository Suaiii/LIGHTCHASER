(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.LightchaserAICameraCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const SCENE_FILTERS = {
    portrait: { label: "人像", filters: ["暖肤提亮", "柔和清透", "低对比胶片"] },
    food: { label: "美食", filters: ["鲜艳暖色", "微锐化", "高饱和"] },
    night: { label: "夜景", filters: ["夜景提亮", "保留高光", "冷暖平衡"] },
    landscape: { label: "风景", filters: ["鲜艳通透", "轻胶片", "增强天空"] },
    indoor: { label: "室内", filters: ["白平衡清透", "轻提亮", "自然暖调"] },
    street: { label: "街拍", filters: ["高对比胶片", "微颗粒", "冷调街景"] },
    document: { label: "文档", filters: ["清晰扫描", "去黄提亮", "高对比黑白"] },
    general: { label: "普通", filters: ["自然增强", "轻微提亮", "柔和胶片"] },
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
    if (light === "偏暗") return scene === "night" ? "夜景提亮" : config.filters.find((filter) => filter.includes("提亮")) || "轻微提亮";
    if (light === "过曝") return scene === "portrait" ? "柔和清透" : "保留高光";
    if (light === "偏冷") return config.filters.find((filter) => filter.includes("暖")) || "自然暖调";
    if (light === "偏暖") return config.filters.find((filter) => filter.includes("清透")) || "白平衡清透";
    return config.filters[0];
  }

  function recommendFilters(scene, light) {
    const config = SCENE_FILTERS[scene] || SCENE_FILTERS.general;
    const primary = chooseFilter(scene, light);
    return [primary, ...config.filters.filter((filter) => filter !== primary)].slice(0, 3);
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

  return { SCENE_FILTERS, classifyLight, recommendFilters, calculateCropBox, buildCaptureDecision };
});
