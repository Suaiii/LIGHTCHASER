const fs = require("fs");
const path = require("path");

const {
  SCENE_FILTERS,
  FILTER_PRESETS,
  classifyLight,
  recommendFilters,
  calculateCropBox,
  buildCaptureDecision,
} = require("../lib/ai-camera-core");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message}: expected ${expected}, got ${actual}`);
}

function testHiddenAttributeCanHideCameraOverlay() {
  const html = fs.readFileSync(path.join(__dirname, "../public/ai-camera.html"), "utf8");
  assert(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/.test(html), "hidden attribute should override overlay display rules");
}

function testAiControlsLiveInRightRailAndDefaultOff() {
  const html = fs.readFileSync(path.join(__dirname, "../public/ai-camera.html"), "utf8");
  assert(html.includes('<nav class="ai-group" aria-label="AI 拍摄辅助">'), "AI controls should live in the right-side rail");
  assert(html.indexOf('<nav class="ai-group"') > html.indexOf("</header>"), "AI controls should be outside the top toolbar");
  assert(/id="compositionToggle"[^>]*aria-pressed="false"[^>]*>AI构图<\/button>/.test(html), "AI composition should render off by default");
  assert(/id="filterToggle"[^>]*aria-pressed="false"[^>]*>AI滤镜<\/button>/.test(html), "AI filter should render off by default");
  assert(!html.includes("自动构图和滤镜。"), "start copy should not imply AI starts automatically");
}

function testAiSettingsDefaultToStandardCamera() {
  const js = fs.readFileSync(path.join(__dirname, "../public/ai-camera.js"), "utf8");
  assert(/aiComposition:\s*savedBoolean\("aiComposition",\s*false\)/.test(js), "new users should default AI composition off");
  assert(/aiFilter:\s*savedBoolean\("aiFilter",\s*false\)/.test(js), "new users should default AI filter off");
  assert(!/savedSettings\.aiComposition\s*!==\s*false/.test(js), "AI composition should not default on when settings are missing");
  assert(!/savedSettings\.aiFilter\s*!==\s*false/.test(js), "AI filter should not default on when settings are missing");
}

function testFilterCatalogIntegrity() {
  const names = new Set();
  for (const [scene, config] of Object.entries(SCENE_FILTERS)) {
    assert(config.filters.length === 3, `${scene} should expose three filters`);
    for (const filter of config.filters) {
      assert(FILTER_PRESETS[filter], `${scene} references missing filter preset ${filter}`);
      names.add(filter);
    }
  }

  assert(names.has("iPhone Rich Contrast"), "catalog should include authorized iPhone-style filter");
  assert(names.has("FUJIFILM Velvia"), "catalog should include authorized Fujifilm-style filter");
  assert(names.has("Google Night Sight"), "catalog should include authorized Google-style filter");
}

function testLightClassification() {
  assertEqual(classifyLight({ brightness: 0.2, warmth: 0 }), "偏暗", "dark light");
  assertEqual(classifyLight({ brightness: 0.86, warmth: 0 }), "过曝", "overexposed light");
  assertEqual(classifyLight({ brightness: 0.5, warmth: 0.2 }), "偏暖", "warm light");
  assertEqual(classifyLight({ brightness: 0.5, warmth: -0.2 }), "偏冷", "cool light");
  assertEqual(classifyLight({ brightness: 0.5, warmth: 0 }), "正常", "normal light");
}

function testFilterRecommendation() {
  assertEqual(recommendFilters("portrait", "偏暗")[0], "Google Portrait", "dark portrait filter");
  assertEqual(recommendFilters("food", "正常")[0], "iPhone Vibrant", "food filter");
  assertEqual(recommendFilters("night", "偏暗")[0], "Google Night Sight", "night filter");
  assertEqual(recommendFilters("street", "正常")[0], "FUJIFILM Classic Neg.", "street filter");
  assertEqual(recommendFilters("landscape", "偏暖")[0], "iPhone Cool", "warm landscape correction");
}

function testCropMaintainsPreviewRatio() {
  const crop = calculateCropBox(
    { width: 1200, height: 1600 },
    { x: 420, y: 320, width: 280, height: 500 },
    1200 / 1600
  );
  const ratio = crop.width / crop.height;

  assert(Math.abs(ratio - 0.75) < 0.01, `crop should preserve preview ratio, got ${ratio}`);
  assert(crop.x >= 0 && crop.y >= 0, "crop should stay inside frame origin");
  assert(crop.x + crop.width <= 1200, "crop should stay inside frame width");
  assert(crop.y + crop.height <= 1600, "crop should stay inside frame height");
}

function testAiDecisionLocksStableSampleWindow() {
  const decision = buildCaptureDecision({
    aiComposition: true,
    aiFilter: true,
    frame: { width: 1200, height: 1600 },
    samples: [
      { scene: "street", confidence: 0.4, frameStats: { brightness: 0.5, warmth: 0 } },
      { scene: "portrait", confidence: 0.9, frameStats: { brightness: 0.28, warmth: 0.1 }, subjectBox: { x: 430, y: 250, width: 260, height: 520, confidence: 0.82 } },
      { scene: "portrait", confidence: 0.85, frameStats: { brightness: 0.3, warmth: 0.08 }, subjectBox: { x: 450, y: 270, width: 260, height: 520, confidence: 0.82 } },
    ],
  });

  assertEqual(decision.mode, "ai-capture", "decision mode");
  assertEqual(decision.scene, "portrait", "stable scene");
  assertEqual(decision.light, "偏暗", "stable light");
  assertEqual(decision.appliedFilter, "Google Portrait", "auto-applied filter");
  assert(decision.sceneConfidence <= 1, "scene confidence should be normalized");
  assertEqual(decision.compositionSkippedReason, null, "clear subject should allow AI composition");
  assert(decision.cropBox.width < 1200 || decision.cropBox.height < 1600, "AI composition should crop");
  assert(decision.outputs.original, "original output");
  assert(decision.outputs.aiCrop, "ai crop output");
  assert(decision.outputs.aiCropFilter, "ai crop filter output");
}

function testLowConfidenceFallsBackToGeneralFilter() {
  const decision = buildCaptureDecision({
    aiComposition: false,
    aiFilter: true,
    frame: { width: 1200, height: 1600 },
    samples: [
      { scene: "food", confidence: 0.18, frameStats: { brightness: 0.55, warmth: 0.18 } },
      { scene: "portrait", confidence: 0.2, frameStats: { brightness: 0.55, warmth: 0.18 } },
      { scene: "street", confidence: 0.16, frameStats: { brightness: 0.55, warmth: 0.18 } },
    ],
  });

  assertEqual(decision.scene, "general", "low-confidence scene should fall back to general");
  assert(decision.sceneConfidence < 0.52, "low-confidence decision should expose low confidence");
  assertEqual(decision.appliedFilter, "iPhone Cool", "warm low-confidence frame should use a general corrective filter");
  assertEqual(decision.decisionReason, "low_scene_confidence", "low-confidence fallback reason");
}

function testRepeatedWeakSceneStillFallsBack() {
  const decision = buildCaptureDecision({
    aiComposition: false,
    aiFilter: true,
    frame: { width: 1200, height: 1600 },
    samples: Array.from({ length: 5 }, () => ({
      scene: "food",
      confidence: 0.22,
      frameStats: { brightness: 0.54, warmth: 0.16 },
    })),
  });

  assertEqual(decision.scene, "general", "repeated weak scene should not become certain");
  assertEqual(decision.decisionReason, "low_scene_confidence", "repeated weak scene fallback reason");
}

function testAiCompositionSkipsWhenSubjectIsUnclear() {
  const decision = buildCaptureDecision({
    aiComposition: true,
    aiFilter: false,
    frame: { width: 1200, height: 1600 },
    samples: [
      { scene: "landscape", confidence: 0.68, frameStats: { brightness: 0.66, warmth: 0.02 } },
      { scene: "landscape", confidence: 0.7, frameStats: { brightness: 0.64, warmth: 0.01 } },
    ],
  });

  assertEqual(decision.compositionStatus, "applied", "unclear subject should still apply visible composition");
  assertEqual(decision.compositionReason, "center_safe_crop", "unclear subject should use center safe crop");
  assert(decision.cropAreaRatio >= 0.85 && decision.cropAreaRatio <= 0.92, `center crop should keep 85%-92%, got ${decision.cropAreaRatio}`);
  assert(decision.cropBox.x > 0, "center crop should trim horizontal edge");
  assert(decision.cropBox.y > 0, "center crop should trim vertical edge");
  assert(decision.outputs.aiCrop, "center-safe composition should emit ai crop output");
}

function testAiCompositionSkipsLowConfidenceSubjectBox() {
  const decision = buildCaptureDecision({
    aiComposition: true,
    aiFilter: false,
    frame: { width: 1200, height: 1600 },
    samples: [
      {
        scene: "landscape",
        confidence: 0.7,
        frameStats: { brightness: 0.66, warmth: 0.02 },
        subjectBox: { x: 300, y: 360, width: 500, height: 700, confidence: 0.2 },
      },
    ],
  });

  assertEqual(decision.compositionStatus, "applied", "low-confidence subject should still apply visible composition");
  assertEqual(decision.compositionReason, "center_safe_crop", "low-confidence subject should fall back to center safe crop");
  assert(decision.cropAreaRatio >= 0.85 && decision.cropAreaRatio <= 0.92, `low-confidence subject crop should keep 85%-92%, got ${decision.cropAreaRatio}`);
}

function testAiCompositionHasNoticeableMinimumCropForReliableSubject() {
  const decision = buildCaptureDecision({
    aiComposition: true,
    aiFilter: false,
    frame: { width: 1280, height: 720 },
    samples: [
      {
        scene: "landscape",
        confidence: 0.72,
        frameStats: { brightness: 0.66, warmth: 0.02 },
        subjectBox: { x: 400, y: 160, width: 520, height: 360, confidence: 0.82 },
      },
    ],
  });

  assertEqual(decision.compositionStatus, "applied", "reliable subject should apply AI composition");
  assertEqual(decision.compositionReason, "subject_crop", "reliable subject should use subject crop");
  assert(decision.cropAreaRatio <= 0.92, `reliable subject crop should be noticeable, got ${decision.cropAreaRatio}`);
  assert(decision.cropBox.x <= decision.subjectBox.x, "crop should include subject left edge");
  assert(decision.cropBox.y <= decision.subjectBox.y, "crop should include subject top edge");
  assert(decision.cropBox.x + decision.cropBox.width >= decision.subjectBox.x + decision.subjectBox.width, "crop should include subject right edge");
  assert(decision.cropBox.y + decision.cropBox.height >= decision.subjectBox.y + decision.subjectBox.height, "crop should include subject bottom edge");
}

function testAiCompositionProtectsMultipleSubjects() {
  const decision = buildCaptureDecision({
    aiComposition: true,
    aiFilter: false,
    frame: { width: 1200, height: 1600 },
    samples: [
      {
        scene: "portrait",
        confidence: 0.8,
        frameStats: { brightness: 0.52, warmth: 0.04 },
        subjectBoxes: [
          { x: 120, y: 420, width: 220, height: 520, confidence: 0.75 },
          { x: 860, y: 420, width: 220, height: 520, confidence: 0.75 },
        ],
      },
    ],
  });

  assertEqual(decision.compositionSkippedReason, null, "clear multi-subject frame should crop");
  assert(decision.cropBox.x <= 120, "crop should include the left subject");
  assert(decision.cropBox.x + decision.cropBox.width >= 1080, "crop should include the right subject");
}

function testAiFilterHoldsPreviousFilterOnUnstableSwitch() {
  const decision = buildCaptureDecision({
    aiComposition: false,
    aiFilter: true,
    frame: { width: 1200, height: 1600 },
    previousDecision: {
      scene: "portrait",
      sceneConfidence: 0.84,
      appliedFilter: "Google Portrait",
    },
    samples: [
      { scene: "street", confidence: 0.9, frameStats: { brightness: 0.5, warmth: 0.01 } },
      { scene: "street", confidence: 0.8, frameStats: { brightness: 0.5, warmth: 0.01 } },
      { scene: "portrait", confidence: 0.1, frameStats: { brightness: 0.5, warmth: 0.01 } },
    ],
  });

  assertEqual(decision.appliedFilter, "Google Portrait", "unstable scene switch should hold previous filter");
  assertEqual(decision.filterDecisionReason, "held_previous_filter", "filter hold reason");
}

function testLowConfidenceBeatsPreviousFilterHold() {
  const decision = buildCaptureDecision({
    aiComposition: false,
    aiFilter: true,
    frame: { width: 1200, height: 1600 },
    previousDecision: {
      scene: "portrait",
      sceneConfidence: 0.84,
      appliedFilter: "Google Portrait",
    },
    samples: [
      { scene: "food", confidence: 0.18, frameStats: { brightness: 0.55, warmth: 0.18 } },
      { scene: "street", confidence: 0.16, frameStats: { brightness: 0.55, warmth: 0.18 } },
    ],
  });

  assertEqual(decision.scene, "general", "low confidence should fall back to general even with a previous decision");
  assertEqual(decision.appliedFilter, "iPhone Cool", "low confidence should use general light correction instead of previous filter");
  assertEqual(decision.filterDecisionReason, "low_scene_confidence", "low confidence should explain filter choice");
}

function testStandardDecisionDoesNotApplyAi() {
  const decision = buildCaptureDecision({
    aiComposition: false,
    aiFilter: false,
    frame: { width: 800, height: 600 },
    samples: [{ scene: "food", confidence: 0.9, frameStats: { brightness: 0.5, warmth: 0 } }],
  });

  assertEqual(decision.mode, "standard", "standard mode");
  assertEqual(decision.appliedFilter, null, "filter should not apply when AI filter is off");
  assertEqual(decision.cropBox.width, 800, "standard crop width");
  assertEqual(decision.cropBox.height, 600, "standard crop height");
}

function main() {
  testHiddenAttributeCanHideCameraOverlay();
  testAiControlsLiveInRightRailAndDefaultOff();
  testAiSettingsDefaultToStandardCamera();
  testFilterCatalogIntegrity();
  testLightClassification();
  testFilterRecommendation();
  testCropMaintainsPreviewRatio();
  testAiDecisionLocksStableSampleWindow();
  testLowConfidenceFallsBackToGeneralFilter();
  testRepeatedWeakSceneStillFallsBack();
  testAiCompositionSkipsWhenSubjectIsUnclear();
  testAiCompositionSkipsLowConfidenceSubjectBox();
  testAiCompositionHasNoticeableMinimumCropForReliableSubject();
  testAiCompositionProtectsMultipleSubjects();
  testAiFilterHoldsPreviousFilterOnUnstableSwitch();
  testLowConfidenceBeatsPreviousFilterHold();
  testStandardDecisionDoesNotApplyAi();
  console.log("AI camera core tests passed");
}

main();
