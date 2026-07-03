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

  const MIN_SCENE_CONFIDENCE = 0.52;
  const MIN_SUBJECT_CONFIDENCE = 0.35;
  const FILTER_SWITCH_CONFIDENCE = 0.72;
  const SUBJECT_PADDING_RATIO = 0.08;
  const DEFAULT_COMPOSITION_AREA_RATIO = 0.88;
  const MAX_NOTICEABLE_CROP_AREA_RATIO = 0.92;

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
      const confidence = clamp(Number.isFinite(sample.confidence) ? sample.confidence : 0.5, 0, 1);
      scores[scene] = (scores[scene] || 0) + confidence;
    }
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topScene = sorted[0]?.[0] || "general";
    const topScore = sorted[0]?.[1] || 0;
    const confidence = samples.length ? topScore / samples.length : 0;
    if (confidence < MIN_SCENE_CONFIDENCE) {
      return { scene: "general", confidence: Number(confidence.toFixed(3)), rawScene: topScene, reason: "low_scene_confidence" };
    }
    return { scene: topScene, confidence: Number(confidence.toFixed(3)), rawScene: topScene, reason: "scene_stable" };
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

  function fullFrameCrop(frame) {
    return { x: 0, y: 0, width: frame.width, height: frame.height };
  }

  function cropAreaRatio(frame, cropBox) {
    return (cropBox.width * cropBox.height) / (frame.width * frame.height);
  }

  function centeredCrop(frame, areaRatio = DEFAULT_COMPOSITION_AREA_RATIO) {
    const scale = Math.sqrt(clamp(areaRatio, 0.01, 1));
    const width = Math.round(frame.width * scale);
    const height = Math.round(frame.height * scale);
    return {
      x: Math.round((frame.width - width) / 2),
      y: Math.round((frame.height - height) / 2),
      width,
      height,
    };
  }

  function containsBox(cropBox, subjectBox) {
    return cropBox.x <= subjectBox.x
      && cropBox.y <= subjectBox.y
      && cropBox.x + cropBox.width >= subjectBox.x + subjectBox.width
      && cropBox.y + cropBox.height >= subjectBox.y + subjectBox.height;
  }

  function cropAroundSubject(frame, subjectBox, aspectRatio, areaRatio = DEFAULT_COMPOSITION_AREA_RATIO) {
    const targetRatio = aspectRatio || frame.width / frame.height;
    const scale = Math.sqrt(clamp(areaRatio, 0.01, 1));
    let cropWidth = frame.width * scale;
    let cropHeight = cropWidth / targetRatio;

    if (cropHeight > frame.height * scale) {
      cropHeight = frame.height * scale;
      cropWidth = cropHeight * targetRatio;
    }

    cropWidth = Math.min(cropWidth, frame.width);
    cropHeight = Math.min(cropHeight, frame.height);

    const subjectCenterX = subjectBox.x + subjectBox.width / 2;
    const subjectCenterY = subjectBox.y + subjectBox.height / 2;
    const cropBox = {
      x: Math.round(clamp(subjectCenterX - cropWidth / 2, 0, frame.width - cropWidth)),
      y: Math.round(clamp(subjectCenterY - cropHeight / 2, 0, frame.height - cropHeight)),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight),
    };

    return cropBox;
  }

  function chooseCompositionCrop(frame, subjectBox) {
    if (!subjectBox) {
      return {
        cropBox: centeredCrop(frame),
        status: "applied",
        reason: "center_safe_crop",
      };
    }

    const aspectRatio = frame.width / frame.height;
    const naturalCrop = calculateCropBox(frame, subjectBox, aspectRatio);
    if (cropAreaRatio(frame, naturalCrop) <= MAX_NOTICEABLE_CROP_AREA_RATIO) {
      return {
        cropBox: naturalCrop,
        status: "applied",
        reason: "subject_crop",
      };
    }

    const strongerCrop = cropAroundSubject(frame, subjectBox, aspectRatio);
    if (containsBox(strongerCrop, subjectBox)) {
      return {
        cropBox: strongerCrop,
        status: "applied",
        reason: "subject_crop",
      };
    }

    return {
      cropBox: naturalCrop,
      status: "applied",
      reason: "protected_full_frame",
    };
  }

  function sampleSubjectBoxes(sample) {
    const boxes = Array.isArray(sample.subjectBoxes) ? sample.subjectBoxes : [sample.subjectBox];
    return boxes
      .filter((box) => {
        const confidence = Number.isFinite(box?.confidence) ? box.confidence : 0;
        return box && box.width > 0 && box.height > 0 && confidence >= MIN_SUBJECT_CONFIDENCE;
      });
  }

  function latestSubjectBoxes(samples) {
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const boxes = sampleSubjectBoxes(samples[index]);
      if (boxes.length) return boxes;
    }
    return [];
  }

  function mergeSubjectBoxes(frame, boxes) {
    if (!boxes.length) return null;
    const paddingX = frame.width * SUBJECT_PADDING_RATIO;
    const paddingY = frame.height * SUBJECT_PADDING_RATIO;
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    const x = clamp(left - paddingX, 0, frame.width);
    const y = clamp(top - paddingY, 0, frame.height);
    const maxRight = clamp(right + paddingX, 0, frame.width);
    const maxBottom = clamp(bottom + paddingY, 0, frame.height);
    return { x, y, width: maxRight - x, height: maxBottom - y };
  }

  function chooseAppliedFilter(options) {
    const previousDecision = options.previousDecision;
    const candidate = options.candidate;
    const sceneResult = options.sceneResult;
    const aiFilter = options.aiFilter;
    if (!aiFilter) return { filter: null, reason: "ai_filter_off" };
    if (sceneResult.reason === "low_scene_confidence") {
      return { filter: candidate, reason: "low_scene_confidence" };
    }
    if (
      previousDecision?.appliedFilter &&
      previousDecision.scene &&
      previousDecision.scene !== sceneResult.scene &&
      sceneResult.confidence < FILTER_SWITCH_CONFIDENCE
    ) {
      return { filter: previousDecision.appliedFilter, reason: "held_previous_filter" };
    }
    return { filter: candidate, reason: "scene_light_match" };
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
    const subjectBoxes = latestSubjectBoxes(stableSamples);
    const subjectBox = mergeSubjectBoxes(frame, subjectBoxes);
    const compositionDecision = aiComposition
      ? chooseCompositionCrop(frame, subjectBox)
      : { cropBox: fullFrameCrop(frame), status: "off", reason: "ai_composition_off" };
    const compositionSkippedReason = compositionDecision.status === "skipped" ? compositionDecision.reason : null;
    const cropBox = compositionDecision.cropBox;
    const filterDecision = chooseAppliedFilter({
      aiFilter,
      candidate: filters[0],
      previousDecision: options.previousDecision,
      sceneResult,
    });
    const aiCropEnabled = aiComposition && compositionDecision.status === "applied";
    const aiFilterEnabled = aiFilter && Boolean(filterDecision.filter);

    return {
      mode: aiComposition || aiFilter ? "ai-capture" : "standard",
      scene: sceneResult.scene,
      sceneLabel: SCENE_FILTERS[sceneResult.scene]?.label || SCENE_FILTERS.general.label,
      sceneConfidence: sceneResult.confidence,
      rawScene: sceneResult.rawScene,
      decisionReason: sceneResult.reason,
      light,
      recommendedFilters: filters,
      appliedFilter: filterDecision.filter,
      filterDecisionReason: filterDecision.reason,
      cropBox,
      subjectBox,
      subjectCount: subjectBoxes.length,
      compositionSkippedReason,
      compositionStatus: compositionDecision.status,
      compositionReason: compositionDecision.reason,
      cropAreaRatio: Number(cropAreaRatio(frame, cropBox).toFixed(3)),
      outputs: {
        original: true,
        aiCrop: aiCropEnabled,
        aiCropFilter: aiCropEnabled && aiFilterEnabled,
        aiFilter: !aiCropEnabled && aiFilterEnabled,
      },
    };
  }

  return { SCENE_FILTERS, FILTER_PRESETS, classifyLight, recommendFilters, calculateCropBox, buildCaptureDecision };
});
