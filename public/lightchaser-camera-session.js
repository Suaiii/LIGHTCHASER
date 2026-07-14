// 用途：为独立 AI 相机与追光 P4 提供共享决策、滤镜目录和拍摄计划；用法：LightchaserCameraSession.createCameraSession(options)。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LightchaserCameraSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  // spots.v1.json 使用产品语言；相机内核使用胶片预设 key。映射集中在这一处，
  // 避免页面、数据和成像实现分别维护一套近似关系。
  const FILTER_ALIAS_MAP = Object.freeze({
    blue_glass: "A_VISTA_PLUS_200",
    dusk_warm: "K_GOLD_200",
    film_fade: "F_NOSTALGIC_NEG",
    gallery_clean: "F_PROVIA",
    gold_rim: "A_OPTIMA_200",
    mono_city: "MONO_HIGH",
    soft_matte: "K_PORTRA_160",
    teal_orange: "F_C_CHROME",
    window_soft: "FRESH_GLOW",
  });

  const CONTEXT_SCENE_MAP = Object.freeze({
    sunset: "landscape",
    skyline: "landscape",
    exhibition: "indoor",
    cafe: "food",
  });

  function resolveProductFilterKeys(keys, presets) {
    const available = presets || {};
    return (Array.isArray(keys) ? keys : [])
      .map((key) => FILTER_ALIAS_MAP[key] || key)
      .filter((key, index, all) => available[key] && all.indexOf(key) === index);
  }

  function normalizeContextScene(scene) {
    return CONTEXT_SCENE_MAP[scene] || scene || "general";
  }

  function contextFallbackSample(context) {
    const scene = normalizeContextScene(context?.scene);
    return {
      scene,
      confidence: scene === "general" ? 0.42 : 0.64,
      frameStats: { brightness: 0.56, warmth: scene === "landscape" ? 0.1 : 0 },
      subjectBox: null,
      subjectBoxes: [],
      source: "spot-context",
      at: Date.now(),
    };
  }

  function previewCssForPreset(preset) {
    if (!preset) return "none";
    const tone = preset.tone || {};
    const brightness = Math.max(0.6, 1 + (Number(tone.brightness) || 0) / 100);
    const contrast = Math.max(0.5, Number(tone.contrast) || 1);
    const saturation = tone.grayscale ? 0 : Math.max(0, Number(tone.saturation) || 1);
    const warmth = Number(tone.warmth) || 0;
    const sepia = Math.max(0, Math.min(0.28, warmth / 90));
    const hue = warmth < 0 ? Math.max(-10, warmth / 2) : 0;
    return [
      `brightness(${brightness.toFixed(3)})`,
      `contrast(${contrast.toFixed(3)})`,
      `saturate(${saturation.toFixed(3)})`,
      sepia ? `sepia(${sepia.toFixed(3)})` : "",
      hue ? `hue-rotate(${hue.toFixed(1)}deg)` : "",
    ].filter(Boolean).join(" ") || "none";
  }

  function createCameraSession(options = {}) {
    const core = options.core || (typeof globalThis !== "undefined" ? globalThis.LightchaserAICameraCore : null);
    if (!core?.buildCaptureDecision || !core?.FILTER_PRESETS) {
      throw new Error("lightchaser_camera_core_unavailable");
    }

    const mode = options.mode === "guided" ? "guided" : "standalone";
    const state = {
      mode,
      context: options.context || {},
      aiComposition: typeof options.aiComposition === "boolean" ? options.aiComposition : mode === "guided",
      aiFilter: typeof options.aiFilter === "boolean" ? options.aiFilter : mode === "guided",
      manualAspectRatio: options.manualAspectRatio || "3:4",
      selectedFilterKey: null,
      samples: [],
      frame: options.frame || { width: 1080, height: 1440 },
      decision: null,
    };

    function spotFilterKeys() {
      return resolveProductFilterKeys(state.context?.filters, core.FILTER_PRESETS);
    }

    function rebuildDecision() {
      const samples = state.samples.length ? state.samples : [contextFallbackSample(state.context)];
      state.decision = core.buildCaptureDecision({
        aiComposition: state.aiComposition,
        aiFilter: state.aiFilter,
        frame: state.frame,
        samples,
        previousDecision: state.decision,
        manualAspectRatio: state.manualAspectRatio,
        aspectRatioMode: state.aiComposition ? "auto" : "manual",
      });
      return state.decision;
    }

    function activeFilterKey() {
      if (state.selectedFilterKey && core.FILTER_PRESETS[state.selectedFilterKey]) return state.selectedFilterKey;
      if (!state.aiFilter) return null;
      return state.decision?.appliedFilter || spotFilterKeys()[0] || null;
    }

    function snapshot() {
      const key = activeFilterKey();
      return {
        mode: state.mode,
        context: state.context,
        aiComposition: state.aiComposition,
        aiFilter: state.aiFilter,
        manualAspectRatio: state.manualAspectRatio,
        composeTemplate: state.context?.composeTemplate || state.context?.compose_template || "thirds",
        selectedFilterKey: state.selectedFilterKey,
        activeFilterKey: key,
        activeFilter: key ? core.FILTER_PRESETS[key] : null,
        spotFilterKeys: spotFilterKeys(),
        decision: state.decision,
        sampleCount: state.samples.length,
        frame: { ...state.frame },
        previewCss: previewCssForPreset(key ? core.FILTER_PRESETS[key] : null),
      };
    }

    function getFilterCatalog() {
      return Object.entries(core.FILTER_PRESETS).map(([key, preset]) => ({
        key,
        label: preset.label,
        brand: preset.brand,
        preset,
        demoPath: core.FILTER_DEMO_PATHS?.[key] || null,
      }));
    }

    function getFilterGroups() {
      const catalog = getFilterCatalog();
      return (core.BRAND_ORDER || []).map((brand) => ({
        brand,
        label: core.BRAND_LABEL?.[brand] || brand,
        filters: catalog.filter((filter) => filter.brand === brand),
      }));
    }

    function pushSample(sample, frame) {
      if (frame?.width && frame?.height) state.frame = frame;
      if (sample) {
        state.samples.push(sample);
        state.samples = state.samples.slice(-10);
      }
      rebuildDecision();
      return snapshot();
    }

    function configure(patch = {}) {
      if (patch.context && patch.context !== state.context) {
        state.context = patch.context;
        state.samples = [];
        state.decision = null;
      }
      if (typeof patch.aiComposition === "boolean") state.aiComposition = patch.aiComposition;
      if (typeof patch.aiFilter === "boolean") state.aiFilter = patch.aiFilter;
      if (patch.manualAspectRatio) state.manualAspectRatio = patch.manualAspectRatio;
      if (patch.frame?.width && patch.frame?.height) state.frame = patch.frame;
      rebuildDecision();
      return snapshot();
    }

    function selectFilter(filterKey) {
      if (filterKey != null && !core.FILTER_PRESETS[filterKey]) throw new Error("unknown_filter_key");
      state.selectedFilterKey = filterKey || null;
      return snapshot();
    }

    function getCapturePlan(frame) {
      if (frame?.width && frame?.height) {
        state.frame = frame;
        rebuildDecision();
      } else if (!state.decision) {
        rebuildDecision();
      }
      const current = snapshot();
      return {
        cropBox: current.decision?.cropBox || { x: 0, y: 0, width: state.frame.width, height: state.frame.height },
        effectiveAspectRatio: current.decision?.effectiveAspectRatio || state.manualAspectRatio,
        applyComposition: Boolean(state.aiComposition && current.decision?.output?.applyComposition),
        composeTemplate: current.composeTemplate,
        filterKey: current.activeFilterKey,
        preset: current.activeFilter,
        previewCss: current.previewCss,
        decision: current.decision,
      };
    }

    rebuildDecision();
    return {
      snapshot,
      configure,
      pushSample,
      selectFilter,
      getCapturePlan,
      getFilterCatalog,
      getFilterGroups,
    };
  }

  return {
    FILTER_ALIAS_MAP,
    createCameraSession,
    normalizeContextScene,
    previewCssForPreset,
    resolveProductFilterKeys,
  };
});
