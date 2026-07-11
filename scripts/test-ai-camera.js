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

function ratioValue(ratioName) {
  if (ratioName === "1:1") return 1;
  if (ratioName === "16:9") return 16 / 9;
  if (ratioName === "3:4") return 3 / 4;
  return 4 / 3;
}

function assertCropMatchesEffectiveRatio(decision, message) {
  const actual = decision.cropBox.width / decision.cropBox.height;
  const expected = ratioValue(decision.effectiveAspectRatio);
  assert(Math.abs(actual - expected) < 0.02, `${message}: expected ${expected}, got ${actual}`);
}

function testHiddenAttributeCanHideCameraOverlay() {
  const html = fs.readFileSync(path.join(__dirname, "../public/ai-camera.html"), "utf8");
  assert(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/.test(html), "hidden attribute should override overlay display rules");
}

function testFilterDrawerIsACompactBottomSheet() {
  const html = fs.readFileSync(path.join(__dirname, "../public/ai-camera.html"), "utf8");
  const drawerRule = html.match(/\.filter-drawer\s*\{([^}]*)\}/)?.[1] || "";
  assert(/bottom:\s*0;/.test(drawerRule) && /height:\s*min\(390px,\s*52dvh\);/.test(drawerRule), "filter drawer should be anchored to the bottom at a bounded height");
  assert(!/inset:\s*0;/.test(drawerRule), "filter drawer should not cover the whole viewfinder");
  assert(/\.filter-strip\s*\{[\s\S]*?align-items:\s*flex-start;/.test(html), "filter cards should pack against the top of the compact sheet");
}

function testVisionUsesCocoPixelBboxFormat() {
  const js = fs.readFileSync(path.join(__dirname, "../public/vision-engine.js"), "utf8");
  assert(js.includes("const [rawX, rawY, rawWidth, rawHeight] = det.bbox;"), "vision should read COCO bbox as x, y, width, height");
  assert(js.includes("const x = Math.max(0, rawX);"), "vision should not rescale COCO pixel coordinates a second time");
  assert(js.includes("COMPOSITION_SUBJECT_CLASSES"), "vision should gate composition to subject classes");
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
  assert(/aspectRatio:\s*savedAspectRatio\(savedSettings\.aspectRatio\)/.test(js), "aspect ratio should restore from saved settings");
  assert(/aiComposition:\s*savedBoolean\("aiComposition",\s*false\)/.test(js), "new users should default AI composition off");
  assert(/aiFilter:\s*savedBoolean\("aiFilter",\s*false\)/.test(js), "new users should default AI filter off");
  assert(!/savedSettings\.aiComposition\s*!==\s*false/.test(js), "AI composition should not default on when settings are missing");
  assert(!/savedSettings\.aiFilter\s*!==\s*false/.test(js), "AI filter should not default on when settings are missing");
}

function testAutoRatioFrontendWiring() {
  const js = fs.readFileSync(path.join(__dirname, "../public/ai-camera.js"), "utf8");
  assert(/const AUTO_RATIO_STABLE_COUNT = 3;/.test(js), "auto ratio should require three stable recommendations");
  assert(/manualAspectRatio:\s*state\.aspectRatio/.test(js), "live decisions should receive the current user ratio");
  assert(/aspectRatioMode:\s*state\.aiComposition\s*\?\s*"auto"\s*:\s*"manual"/.test(js), "live AI composition should request auto ratio planning");
  assert(/captureAspectRatio\s*=\s*state\.lastDecision\?\.effectiveAspectRatio\s*\|\|\s*state\.aspectRatio/.test(js), "capture should use the decision effective ratio");
  assert(/recommendedAspectRatio:\s*state\.lastDecision\?\.recommendedAspectRatio\s*\|\|\s*framedDecision\.recommendedAspectRatio/.test(js), "metadata should include recommended ratio");
  assert(/effectiveAspectRatio:\s*captureAspectRatio/.test(js), "metadata should include effective ratio");
  assert(/ratioReason:\s*state\.lastDecision\?\.ratioReason\s*\|\|\s*framedDecision\.ratioReason/.test(js), "metadata should include ratio reason");
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

  assert(names.has("F_PROVIA"), "catalog should include PROVIA");
  assert(names.has("F_VELVIA"), "catalog should include Velvia");
  assert(names.has("MONO_HIGH"), "catalog should include high-contrast monochrome");
}

function testLightClassification() {
  assertEqual(classifyLight({ brightness: 0.2, warmth: 0 }), "偏暗", "dark light");
  assertEqual(classifyLight({ brightness: 0.86, warmth: 0 }), "过曝", "overexposed light");
  assertEqual(classifyLight({ brightness: 0.5, warmth: 0.2 }), "偏暖", "warm light");
  assertEqual(classifyLight({ brightness: 0.5, warmth: -0.2 }), "偏冷", "cool light");
  assertEqual(classifyLight({ brightness: 0.5, warmth: 0 }), "正常", "normal light");
}

function testFilterRecommendation() {
  assertEqual(recommendFilters("portrait", "偏暗")[0], "FRESH_GLOW", "dark portrait filter");
  assertEqual(recommendFilters("food", "正常")[0], "F_VELVIA", "food filter");
  assertEqual(recommendFilters("night", "偏暗")[0], "F_BLEACH_BYPASS", "night filter");
  assertEqual(recommendFilters("street", "正常")[0], "F_C_CHROME", "street filter");
  assertEqual(recommendFilters("landscape", "偏暖")[0], "A_VISTA_PLUS_200", "warm landscape correction");
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
  assertEqual(decision.appliedFilter, "FRESH_GLOW", "auto-applied filter");
  assert(decision.sceneConfidence <= 1, "scene confidence should be normalized");
  assertEqual(decision.compositionSkippedReason, null, "clear subject should allow AI composition");
  assert(decision.cropBox.width < 1200 || decision.cropBox.height < 1600, "AI composition should crop");
  assert(decision.output.applyComposition, "subject crop should be applied");
  assert(decision.output.applyLockedFilter, "AI filter should be applied");
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
  assertEqual(decision.appliedFilter, "A_VISTA_PLUS_200", "warm low-confidence frame should use a general corrective filter");
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
    manualAspectRatio: "3:4",
    aspectRatioMode: "auto",
    frame: { width: 1200, height: 1600 },
    samples: [
      { scene: "landscape", confidence: 0.68, frameStats: { brightness: 0.66, warmth: 0.02 } },
      { scene: "landscape", confidence: 0.7, frameStats: { brightness: 0.64, warmth: 0.01 } },
    ],
  });

  assertEqual(decision.compositionStatus, "skipped", "unclear subject should not trigger a speculative crop");
  assertEqual(decision.compositionReason, "subject_unconfirmed", "unclear subject should explain why it was left alone");
  assertEqual(decision.recommendedAspectRatio, "16:9", "open landscape should recommend wide ratio");
  assertEqual(decision.effectiveAspectRatio, "16:9", "auto landscape should apply wide ratio");
  assertEqual(decision.ratioReason, "landscape_wide_scene", "open landscape ratio reason");
  assertEqual(decision.cropBox.height, 1600, "unconfirmed subject should retain the full frame for the capture crop stage");
  assert(!decision.output.applyComposition, "unconfirmed subject should not emit an AI crop");
}

function testAiCompositionSkipsLowConfidenceSubjectBox() {
  const decision = buildCaptureDecision({
    aiComposition: true,
    aiFilter: false,
    manualAspectRatio: "3:4",
    aspectRatioMode: "auto",
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

  assertEqual(decision.compositionStatus, "skipped", "low-confidence subject should not trigger a speculative crop");
  assertEqual(decision.compositionReason, "subject_unconfirmed", "low-confidence subject should be ignored");
  assertEqual(decision.effectiveAspectRatio, "16:9", "weak subject should not block landscape wide ratio");
  assert(!decision.output.applyComposition, "low-confidence subject should not emit an AI crop");
}

function testLandscapeTallSubjectRecommendsPortraitRatio() {
  const decision = buildCaptureDecision({
    aiComposition: true,
    aiFilter: false,
    manualAspectRatio: "16:9",
    aspectRatioMode: "auto",
    frame: { width: 1200, height: 1600 },
    samples: [
      {
        scene: "landscape",
        confidence: 0.82,
        frameStats: { brightness: 0.66, warmth: 0.02 },
        subjectBox: { x: 440, y: 180, width: 260, height: 1040, confidence: 0.85 },
      },
    ],
  });

  assertEqual(decision.recommendedAspectRatio, "3:4", "tall landscape subject should recommend portrait ratio");
  assertEqual(decision.effectiveAspectRatio, "3:4", "auto tall landscape should apply portrait ratio");
  assertEqual(decision.ratioReason, "landscape_tall_subject", "tall landscape ratio reason");
  assertCropMatchesEffectiveRatio(decision, "tall landscape crop ratio");
}

function testPortraitAndFoodRecommendSceneRatios() {
  const portrait = buildCaptureDecision({
    aiComposition: true,
    aiFilter: false,
    manualAspectRatio: "16:9",
    aspectRatioMode: "auto",
    frame: { width: 1600, height: 1200 },
    samples: [
      { scene: "portrait", confidence: 0.88, frameStats: { brightness: 0.55, warmth: 0.04 }, subjectBox: { x: 620, y: 160, width: 300, height: 780, confidence: 0.9 } },
    ],
  });
  const food = buildCaptureDecision({
    aiComposition: true,
    aiFilter: false,
    manualAspectRatio: "16:9",
    aspectRatioMode: "auto",
    frame: { width: 1600, height: 1200 },
    samples: [
      { scene: "food", confidence: 0.86, frameStats: { brightness: 0.58, warmth: 0.16 }, subjectBox: { x: 430, y: 260, width: 620, height: 520, confidence: 0.82 } },
    ],
  });

  assertEqual(portrait.effectiveAspectRatio, "3:4", "portrait should recommend portrait ratio");
  assertEqual(food.effectiveAspectRatio, "1:1", "food should recommend square ratio");
  assertCropMatchesEffectiveRatio(portrait, "portrait crop ratio");
  assertCropMatchesEffectiveRatio(food, "food crop ratio");
}

function testLowConfidenceKeepsCurrentRatio() {
  const decision = buildCaptureDecision({
    aiComposition: true,
    aiFilter: false,
    manualAspectRatio: "4:3",
    aspectRatioMode: "auto",
    frame: { width: 1200, height: 1600 },
    samples: [
      { scene: "landscape", confidence: 0.2, frameStats: { brightness: 0.54, warmth: 0.02 } },
      { scene: "food", confidence: 0.16, frameStats: { brightness: 0.54, warmth: 0.02 } },
    ],
  });

  assertEqual(decision.scene, "general", "low-confidence scene should remain general");
  assertEqual(decision.recommendedAspectRatio, "4:3", "low-confidence scene should keep current recommendation");
  assertEqual(decision.effectiveAspectRatio, "4:3", "low-confidence scene should keep current effective ratio");
}

function testAiCompositionOffKeepsCurrentEffectiveRatio() {
  const decision = buildCaptureDecision({
    aiComposition: false,
    aiFilter: false,
    manualAspectRatio: "4:3",
    aspectRatioMode: "auto",
    frame: { width: 1200, height: 1600 },
    samples: [{ scene: "food", confidence: 0.9, frameStats: { brightness: 0.5, warmth: 0.2 } }],
  });

  assertEqual(decision.effectiveAspectRatio, "4:3", "AI composition off should not auto-apply scene ratio");
  assertEqual(decision.ratioReason, "ai_composition_off", "AI composition off ratio reason");
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
      appliedFilter: "K_PORTRA_400",
    },
    samples: [
      { scene: "street", confidence: 0.9, frameStats: { brightness: 0.5, warmth: 0.01 } },
      { scene: "street", confidence: 0.8, frameStats: { brightness: 0.5, warmth: 0.01 } },
      { scene: "portrait", confidence: 0.1, frameStats: { brightness: 0.5, warmth: 0.01 } },
    ],
  });

  assertEqual(decision.appliedFilter, "K_PORTRA_400", "unstable scene switch should hold previous filter");
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
      appliedFilter: "K_PORTRA_400",
    },
    samples: [
      { scene: "food", confidence: 0.18, frameStats: { brightness: 0.55, warmth: 0.18 } },
      { scene: "street", confidence: 0.16, frameStats: { brightness: 0.55, warmth: 0.18 } },
    ],
  });

  assertEqual(decision.scene, "general", "low confidence should fall back to general even with a previous decision");
  assertEqual(decision.appliedFilter, "A_VISTA_PLUS_200", "low confidence should use general light correction instead of previous filter");
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
  testFilterDrawerIsACompactBottomSheet();
  testVisionUsesCocoPixelBboxFormat();
  testAiControlsLiveInRightRailAndDefaultOff();
  testAiSettingsDefaultToStandardCamera();
  testAutoRatioFrontendWiring();
  testFilterCatalogIntegrity();
  testLightClassification();
  testFilterRecommendation();
  testCropMaintainsPreviewRatio();
  testAiDecisionLocksStableSampleWindow();
  testLowConfidenceFallsBackToGeneralFilter();
  testRepeatedWeakSceneStillFallsBack();
  testAiCompositionSkipsWhenSubjectIsUnclear();
  testAiCompositionSkipsLowConfidenceSubjectBox();
  testLandscapeTallSubjectRecommendsPortraitRatio();
  testPortraitAndFoodRecommendSceneRatios();
  testLowConfidenceKeepsCurrentRatio();
  testAiCompositionOffKeepsCurrentEffectiveRatio();
  testAiCompositionHasNoticeableMinimumCropForReliableSubject();
  testAiCompositionProtectsMultipleSubjects();
  testAiFilterHoldsPreviousFilterOnUnstableSwitch();
  testLowConfidenceBeatsPreviousFilterHold();
  testStandardDecisionDoesNotApplyAi();
  console.log("AI camera core tests passed");
}

main();
