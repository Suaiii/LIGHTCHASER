(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.LightchaserAICameraCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  // 23 套胶片模拟 —— 5 大品牌分组(抖音风滤镜选择器配套)
  const FILTER_PRESETS = {
    // ─── 富士 8 ───
    // ─── 富士 8 ───
    F_PROVIA: {
      label: "PROVIA", brand: "fuji",
      tone: { brightness: 2,  contrast: 1.02, saturation: 1.05, warmth: 2,  grayscale: false },
      grain: 0.18, vignette: 0.18,
      iconColors: ["#ffd400", "#0b3b88"],
    },
    F_VELVIA: {
      label: "Velvia", brand: "fuji",
      tone: { brightness: 4,  contrast: 1.12, saturation: 1.28, warmth: 2,  grayscale: false },
      grain: 0.20, vignette: 0.22,
      lut: "velvia", lutStrength: 1.0,
      iconColors: ["#ffd400", "#1f8f3b"],
    },
    F_C_CHROME: {
      label: "Classic Chrome", brand: "fuji",
      tone: { brightness: 1,  contrast: 1.12, saturation: 0.78, warmth: -2, grayscale: false },
      grain: 0.24, vignette: 0.26,
      lut: "classic-chrome", lutStrength: 1.0,
      iconColors: ["#ffd400", "#222222"],
    },
    F_ASTIA: {
      label: "ASTIA", brand: "fuji",
      tone: { brightness: 5,  contrast: 0.92, saturation: 1.04, warmth: 8,  grayscale: false },
      grain: 0.14, vignette: 0.16,
      iconColors: ["#ffd400", "#f4b3b3"],
    },
    F_CLASSIC_NEG: {
      label: "Classic Neg.", brand: "fuji",
      tone: { brightness: 0,  contrast: 1.18, saturation: 0.92, warmth: 4,  grayscale: false },
      grain: 0.26, vignette: 0.32,
      iconColors: ["#ffd400", "#7d3c14"],
    },
    F_ACROS: {
      label: "ACROS", brand: "fuji",
      tone: { brightness: 0,  contrast: 1.22, saturation: 0,    warmth: 0,  grayscale: true  },
      grain: 0.30, vignette: 0.30,
      iconColors: ["#1a1a1a", "#cccccc"],
    },
    F_NOSTALGIC_NEG: {
      label: "Nostalgic Neg.", brand: "fuji",
      tone: { brightness: 4,  contrast: 1.06, saturation: 0.86, warmth: 16, grayscale: false },
      grain: 0.28, vignette: 0.34,
      iconColors: ["#ffd400", "#d8a264"],
    },
    F_BLEACH_BYPASS: {
      label: "Bleach Bypass", brand: "fuji",
      tone: { brightness: -4, contrast: 1.22, saturation: 0.62, warmth: -4, grayscale: false },
      grain: 0.30, vignette: 0.36,
      iconColors: ["#ffd400", "#5d6371"],
    },

    // ─── 柯达 5 ───
    K_PORTRA_160: {
      label: "Portra 160", brand: "kodak",
      tone: { brightness: 6,  contrast: 1.00, saturation: 0.78, warmth: 14, grayscale: false },
      grain: 0.18, vignette: 0.18,
      lut: "portra-400", lutStrength: 0.65,
      iconColors: ["#f5e0b8", "#a86c2c"],
    },
    K_PORTRA_400: {
      label: "Portra 400", brand: "kodak",
      tone: { brightness: 4,  contrast: 1.04, saturation: 0.92, warmth: 18, grayscale: false },
      grain: 0.22, vignette: 0.22,
      lut: "portra-400", lutStrength: 1.0,
      iconColors: ["#e8c987", "#3a2820"],
    },
    K_EKTAR_100: {
      label: "Ektar 100", brand: "kodak",
      tone: { brightness: 2,  contrast: 1.14, saturation: 1.22, warmth: -6, grayscale: false },
      grain: 0.16, vignette: 0.18,
      iconColors: ["#d75b29", "#1c1c1c"],
    },
    K_GOLD_200: {
      label: "Gold 200", brand: "kodak",
      tone: { brightness: 6,  contrast: 1.04, saturation: 1.06, warmth: 22, grayscale: false },
      grain: 0.22, vignette: 0.24,
      iconColors: ["#e6a91a", "#7c1f10"],
    },
    K_TRI_X_400: {
      label: "Tri-X 400", brand: "kodak",
      tone: { brightness: 0,  contrast: 1.32, saturation: 0,    warmth: 0,  grayscale: true  },
      grain: 0.36, vignette: 0.32,
      lut: "tri-x", lutStrength: 1.0,
      iconColors: ["#1c1c1c", "#e4c5a0"],
    },

    // ─── Agfa 4 ───
    A_VISTA_PLUS_200: {
      label: "Vista Plus 200", brand: "agfa",
      tone: { brightness: 4,  contrast: 1.02, saturation: 0.86, warmth: -14, grayscale: false },
      grain: 0.18, vignette: 0.22,
      iconColors: ["#0f6b56", "#e3edec"],
    },
    A_VISTA_200: {
      label: "Vista 200", brand: "agfa",
      tone: { brightness: 4,  contrast: 1.04, saturation: 1.08, warmth: -4, grayscale: false },
      grain: 0.20, vignette: 0.20,
      iconColors: ["#1f8f7a", "#f6e98a"],
    },
    A_OPTIMA_200: {
      label: "Optima 200", brand: "agfa",
      tone: { brightness: 4,  contrast: 1.06, saturation: 1.16, warmth: 10, grayscale: false },
      grain: 0.20, vignette: 0.22,
      iconColors: ["#bf2525", "#f5b830"],
    },
    A_ULTRA_100: {
      label: "Ultra 100", brand: "agfa",
      tone: { brightness: 2,  contrast: 1.04, saturation: 0.88, warmth: -2, grayscale: false },
      grain: 0.12, vignette: 0.16,
      iconColors: ["#9aa6a8", "#ffffff"],
    },

    // ─── 清新人像 3 ───
    FRESH_GLOW: {
      label: "清新发光", brand: "fresh",
      tone: { brightness: 10, contrast: 0.96, saturation: 0.96, warmth: 6,  grayscale: false },
      grain: 0.10, vignette: 0.10,
      iconColors: ["#9be0e8", "#fff7d8"],
    },
    SOFT_SKIN: {
      label: "柔肤", brand: "fresh",
      tone: { brightness: 8,  contrast: 0.92, saturation: 0.98, warmth: 8,  grayscale: false },
      grain: 0.10, vignette: 0.12,
      iconColors: ["#fce0d4", "#f6a89b"],
    },
    PORCELAIN_SKIN: {
      label: "瓷肌", brand: "fresh",
      tone: { brightness: 12, contrast: 0.90, saturation: 0.86, warmth: 4,  grayscale: false },
      grain: 0.08, vignette: 0.10,
      iconColors: ["#fff7f3", "#e3c4be"],
    },

    // ─── 黑白 3 ───
    MONO_CLASSIC: {
      label: "经典黑白", brand: "mono",
      tone: { brightness: 0,  contrast: 1.12, saturation: 0,    warmth: 0,  grayscale: true  },
      grain: 0.16, vignette: 0.18,
      iconColors: ["#222222", "#9a9a9a"],
    },
    MONO_FADE: {
      label: "褪色黑白", brand: "mono",
      tone: { brightness: 8,  contrast: 0.92, saturation: 0,    warmth: 0,  grayscale: true  },
      grain: 0.22, vignette: 0.22,
      iconColors: ["#5b5b5b", "#ffffff"],
    },
    MONO_HIGH: {
      label: "高反差黑白", brand: "mono",
      tone: { brightness: -4, contrast: 1.42, saturation: 0,    warmth: 0,  grayscale: true  },
      grain: 0.34, vignette: 0.30,
      iconColors: ["#000000", "#ffffff"],
    },
  };

  // 按品牌分组的索引 —— UI 渲染用
  const BRAND_ORDER = ["fuji", "kodak", "agfa", "fresh", "mono"];
  const BRAND_LABEL = {
    fuji: "富士",
    kodak: "柯达",
    agfa: "Agfa",
    fresh: "清新人像",
    mono: "黑白",
  };
  const PACKAGING_BY_BRAND = {
    fuji: "/assets/film-packaging-thumbnails/fuji.jpg",
    kodak: "/assets/film-packaging-thumbnails/kodak.jpg",
    agfa: "/assets/film-packaging-thumbnails/agfa.jpg",
    fresh: "/assets/film-packaging-thumbnails/fresh.jpg",
    mono: "/assets/film-packaging-thumbnails/mono.jpg",
  };
  // 胶片卡只需要展示尺寸；保留原图供其他高分辨率场景使用。
  const FILTER_DEMO_PATHS = {
    F_PROVIA:        "/assets/filter-thumbnails/f_provia.jpg",
    F_VELVIA:        "/assets/filter-thumbnails/f_velvia.jpg",
    F_C_CHROME:      "/assets/filter-thumbnails/f_c_chrome.jpg",
    F_ASTIA:         "/assets/filter-thumbnails/f_astia.jpg",
    F_CLASSIC_NEG:   "/assets/filter-thumbnails/f_classic_neg.jpg",
    F_ACROS:         "/assets/filter-thumbnails/f_acros.jpg",
    F_NOSTALGIC_NEG: "/assets/filter-thumbnails/f_nostalgic_neg.jpg",
    F_BLEACH_BYPASS: "/assets/filter-thumbnails/f_bleach_bypass.jpg",
    K_PORTRA_160:    "/assets/filter-thumbnails/k_portra_160.jpg",
    K_PORTRA_400:    "/assets/filter-thumbnails/k_portra_400.jpg",
    K_EKTAR_100:     "/assets/filter-thumbnails/k_ektar_100.jpg",
    K_GOLD_200:      "/assets/filter-thumbnails/k_gold_200.jpg",
    K_TRI_X_400:     "/assets/filter-thumbnails/k_tri_x_400.jpg",
    A_VISTA_PLUS_200:"/assets/filter-thumbnails/a_vista_plus_200.jpg",
    A_VISTA_200:     "/assets/filter-thumbnails/a_vista_200.jpg",
    A_OPTIMA_200:    "/assets/filter-thumbnails/a_optima_200.jpg",
    A_ULTRA_100:     "/assets/filter-thumbnails/a_ultra_100.jpg",
    FRESH_GLOW:      "/assets/filter-thumbnails/fresh_glow.jpg",
    SOFT_SKIN:       "/assets/filter-thumbnails/soft_skin.jpg",
    PORCELAIN_SKIN:  "/assets/filter-thumbnails/porcelain_skin.jpg",
    MONO_CLASSIC:    "/assets/filter-thumbnails/mono_classic.jpg",
    MONO_FADE:       "/assets/filter-thumbnails/mono_fade.jpg",
    MONO_HIGH:       "/assets/filter-thumbnails/mono_high.jpg",
  };
  const FILTERS_BY_BRAND = BRAND_ORDER.reduce((acc, brand) => {
    acc[brand] = Object.entries(FILTER_PRESETS)
      .filter(([, preset]) => preset.brand === brand)
      .map(([key]) => key);
    return acc;
  }, {});

  // 场景 → 推荐滤镜(全用新 key)
  const SCENE_FILTERS = {
    portrait:   { label: "人像",   filters: ["K_PORTRA_400", "F_ASTIA", "SOFT_SKIN"] },
    food:       { label: "美食",   filters: ["F_VELVIA", "A_OPTIMA_200", "K_GOLD_200"] },
    night:      { label: "夜景",   filters: ["F_CLASSIC_NEG", "MONO_HIGH", "K_PORTRA_400"] },
    landscape:  { label: "风景",   filters: ["F_VELVIA", "K_EKTAR_100", "F_PROVIA"] },
    indoor:     { label: "室内",   filters: ["K_PORTRA_160", "F_ASTIA", "FRESH_GLOW"] },
    street:     { label: "街拍",   filters: ["F_C_CHROME", "F_CLASSIC_NEG", "MONO_CLASSIC"] },
    document:   { label: "文档",   filters: ["MONO_HIGH", "F_ACROS", "MONO_CLASSIC"] },
    sunset:     { label: "夕阳",   filters: ["K_GOLD_200", "F_NOSTALGIC_NEG", "F_VELVIA"] },
    general:    { label: "普通",   filters: ["F_PROVIA", "K_PORTRA_400", "FRESH_GLOW"] },
  };

  const LIGHT_FILTER_OVERRIDES = {
    "偏暗": {
      night:     "F_BLEACH_BYPASS",
      portrait:  "FRESH_GLOW",
      food:      "FRESH_GLOW",
      landscape: "F_PROVIA",
      street:    "F_C_CHROME",
      general:   "F_BLEACH_BYPASS",
    },
    "过曝": {
      portrait:  "F_ASTIA",
      food:      "F_PROVIA",
      landscape: "A_VISTA_PLUS_200",
      street:    "F_C_CHROME",
      sunset:    "A_VISTA_PLUS_200",
      general:   "F_ASTIA",
    },
    "偏冷": {
      portrait: "K_PORTRA_400",
      food:     "K_GOLD_200",
      indoor:   "K_PORTRA_400",
      sunset:   "F_NOSTALGIC_NEG",
      general:  "K_PORTRA_400",
    },
    "偏暖": {
      portrait: "A_VISTA_PLUS_200",
      food:     "F_PROVIA",
      indoor:   "A_VISTA_PLUS_200",
      sunset:   "A_OPTIMA_200",
      general:  "A_VISTA_PLUS_200",
    },
  };

  const MIN_SCENE_CONFIDENCE = 0.52;
  const MIN_SUBJECT_CONFIDENCE = 0.35;
  const FILTER_SWITCH_CONFIDENCE = 0.72;
  const SUBJECT_PADDING_RATIO = 0.08;
  const DEFAULT_COMPOSITION_AREA_RATIO = 0.88;
  const MAX_NOTICEABLE_CROP_AREA_RATIO = 0.92;
  const ASPECT_RATIOS = {
    "1:1": 1,
    "3:4": 3 / 4,
    "4:3": 4 / 3,
    "16:9": 16 / 9,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function aspectRatioValue(ratioName, fallbackRatio) {
    return ASPECT_RATIOS[ratioName] || fallbackRatio || 3 / 4;
  }

  function closestAspectRatioName(frame) {
    const frameRatio = frame.width / frame.height;
    return Object.entries(ASPECT_RATIOS)
      .map(([name, value]) => ({ name, distance: Math.abs(value - frameRatio) }))
      .sort((a, b) => a.distance - b.distance)[0]?.name || "3:4";
  }

  function normalizeAspectRatioName(ratioName, frame) {
    if (ASPECT_RATIOS[ratioName]) return ratioName;
    return frame ? closestAspectRatioName(frame) : "3:4";
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
    // 主体靠近其原始一侧的三分线，另一侧自然留白；边界仍严格包住主体。
    const targetX = subjectCenterX < width * 0.5 ? cropWidth / 3 : cropWidth * 2 / 3;
    const targetY = cropHeight * 0.44;
    const minX = subject.x + subject.width - cropWidth;
    const maxX = subject.x;
    const minY = subject.y + subject.height - cropHeight;
    const maxY = subject.y;
    return {
      x: Math.round(clamp(clamp(subjectCenterX - targetX, minX, maxX), 0, width - cropWidth)),
      y: Math.round(clamp(clamp(subjectCenterY - targetY, minY, maxY), 0, height - cropHeight)),
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

  function centeredCrop(frame, aspectRatio, areaRatio = DEFAULT_COMPOSITION_AREA_RATIO) {
    const targetRatio = aspectRatio || frame.width / frame.height;
    const scale = Math.sqrt(clamp(areaRatio, 0.01, 1));
    let width = frame.width * scale;
    let height = width / targetRatio;
    if (height > frame.height * scale) {
      height = frame.height * scale;
      width = height * targetRatio;
    }
    if (width > frame.width) {
      width = frame.width;
      height = width / targetRatio;
    }
    if (height > frame.height) {
      height = frame.height;
      width = height * targetRatio;
    }
    width = Math.round(width);
    height = Math.round(height);
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

  function chooseCompositionCrop(frame, subjectBox, aspectRatio) {
    const targetRatio = aspectRatio || frame.width / frame.height;
    if (!subjectBox) {
      return {
        cropBox: fullFrameCrop(frame),
        status: "skipped",
        reason: "subject_unconfirmed",
      };
    }

    const naturalCrop = calculateCropBox(frame, subjectBox, targetRatio);
    if (cropAreaRatio(frame, naturalCrop) <= MAX_NOTICEABLE_CROP_AREA_RATIO) {
      return {
        cropBox: naturalCrop,
        status: "applied",
        reason: "subject_crop",
      };
    }

    const strongerCrop = cropAroundSubject(frame, subjectBox, targetRatio);
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

  function subjectGeometry(frame, subjectBox) {
    if (!subjectBox) {
      return { areaRatio: 0, subjectRatio: 0, heightRatio: 0, widthRatio: 0, tall: false, wide: false };
    }
    const areaRatio = (subjectBox.width * subjectBox.height) / (frame.width * frame.height);
    const subjectRatio = subjectBox.width / subjectBox.height;
    const heightRatio = subjectBox.height / frame.height;
    const widthRatio = subjectBox.width / frame.width;
    return {
      areaRatio,
      subjectRatio,
      heightRatio,
      widthRatio,
      tall: heightRatio >= 0.48 && subjectRatio <= 0.85,
      wide: widthRatio >= 0.46 && subjectRatio >= 1.15,
    };
  }

  function recommendAspectRatio(sceneResult, subjectBox, frame, manualAspectRatio) {
    const manual = normalizeAspectRatioName(manualAspectRatio, frame);
    if (!sceneResult || sceneResult.reason === "low_scene_confidence" || sceneResult.scene === "general") {
      return {
        recommendedAspectRatio: manual,
        ratioReason: sceneResult?.reason || "manual_default",
        compositionGuideText: "保持当前画幅",
      };
    }

    if (sceneResult.scene === "portrait") {
      return {
        recommendedAspectRatio: "3:4",
        ratioReason: "portrait_vertical",
        compositionGuideText: "人像竖幅，保留头顶和身体线条",
      };
    }

    if (sceneResult.scene === "food") {
      return {
        recommendedAspectRatio: "1:1",
        ratioReason: "food_square",
        compositionGuideText: "方幅收紧桌面主体",
      };
    }

    if (sceneResult.scene === "landscape") {
      const geometry = subjectGeometry(frame, subjectBox);
      if (geometry.tall) {
        return {
          recommendedAspectRatio: "3:4",
          ratioReason: "landscape_tall_subject",
          compositionGuideText: "竖向主体，保留高度",
        };
      }
      return {
        recommendedAspectRatio: "16:9",
        ratioReason: geometry.wide ? "landscape_wide_subject" : "landscape_wide_scene",
        compositionGuideText: "横幅保留天空和地平线",
      };
    }

    return {
      recommendedAspectRatio: manual,
      ratioReason: "manual_for_scene",
      compositionGuideText: "保持当前画幅",
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
    const manualAspectRatio = normalizeAspectRatioName(options.manualAspectRatio, frame);
    const aspectRatioMode = options.aspectRatioMode === "auto" ? "auto" : "manual";
    const stableSamples = samples.slice(-Math.min(5, samples.length || 1));
    const sceneResult = inferScene(stableSamples);
    const light = classifyLight(averageStats(stableSamples));
    const filters = recommendFilters(sceneResult.scene, light);
    const subjectBoxes = latestSubjectBoxes(stableSamples);
    const subjectBox = mergeSubjectBoxes(frame, subjectBoxes);
    const ratioPlan = recommendAspectRatio(sceneResult, subjectBox, frame, manualAspectRatio);
    const effectiveAspectRatio = aiComposition && aspectRatioMode === "auto"
      ? ratioPlan.recommendedAspectRatio
      : manualAspectRatio;
    const targetAspectRatio = aspectRatioValue(effectiveAspectRatio, frame.width / frame.height);
    const compositionDecision = aiComposition
      ? chooseCompositionCrop(frame, subjectBox, targetAspectRatio)
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
    // 单张 final 输出:不再枚举 4 个 variant,告诉下游该 apply 什么、用哪个 filter key、画幅是什么。
    const selectedFilterKey = aiFilterEnabled ? filterDecision.filter : null;

    return {
      mode: aiComposition || aiFilter ? "ai-capture" : "standard",
      scene: sceneResult.scene,
      sceneLabel: SCENE_FILTERS[sceneResult.scene]?.label || SCENE_FILTERS.general.label,
      sceneConfidence: sceneResult.confidence,
      rawScene: sceneResult.rawScene,
      decisionReason: sceneResult.reason,
      light,
      recommendedFilters: filters,
      manualAspectRatio,
      recommendedAspectRatio: ratioPlan.recommendedAspectRatio,
      effectiveAspectRatio,
      ratioReason: aiComposition && aspectRatioMode === "auto"
        ? ratioPlan.ratioReason
        : (aiComposition ? "manual_aspect_ratio" : "ai_composition_off"),
      compositionGuideText: ratioPlan.compositionGuideText,
      appliedFilter: selectedFilterKey,
      filterDecisionReason: filterDecision.reason,
      cropBox,
      subjectBox,
      subjectCount: subjectBoxes.length,
      compositionSkippedReason,
      compositionStatus: compositionDecision.status,
      compositionReason: compositionDecision.reason,
      cropAreaRatio: Number(cropAreaRatio(frame, cropBox).toFixed(3)),
      output: {
        applyComposition: aiCropEnabled,
        applyLockedFilter: Boolean(selectedFilterKey),
        selectedFilterKey,
        selectedAspectRatio: effectiveAspectRatio,
        sceneLabel: SCENE_FILTERS[sceneResult.scene]?.label || SCENE_FILTERS.general.label,
        sceneConfidence: sceneResult.confidence,
        lightClassification: light,
        recommendedFilterKeys: filters,
      },
    };
  }

  return {
    SCENE_FILTERS,
    FILTER_PRESETS,
    BRAND_ORDER,
    BRAND_LABEL,
    PACKAGING_BY_BRAND,
    FILTERS_BY_BRAND,
    FILTER_DEMO_PATHS,
    classifyLight,
    recommendFilters,
    recommendAspectRatio,
    calculateCropBox,
    buildCaptureDecision,
  };
});
