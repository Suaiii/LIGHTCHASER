const {
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

function testLightClassification() {
  assertEqual(classifyLight({ brightness: 0.2, warmth: 0 }), "偏暗", "dark light");
  assertEqual(classifyLight({ brightness: 0.86, warmth: 0 }), "过曝", "overexposed light");
  assertEqual(classifyLight({ brightness: 0.5, warmth: 0.2 }), "偏暖", "warm light");
  assertEqual(classifyLight({ brightness: 0.5, warmth: -0.2 }), "偏冷", "cool light");
  assertEqual(classifyLight({ brightness: 0.5, warmth: 0 }), "正常", "normal light");
}

function testFilterRecommendation() {
  assertEqual(recommendFilters("portrait", "偏暗")[0], "暖肤提亮", "dark portrait filter");
  assertEqual(recommendFilters("food", "正常")[0], "鲜艳暖色", "food filter");
  assertEqual(recommendFilters("night", "偏暗")[0], "夜景提亮", "night filter");
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
      { scene: "portrait", confidence: 0.9, frameStats: { brightness: 0.28, warmth: 0.1 }, subjectBox: { x: 430, y: 250, width: 260, height: 520 } },
      { scene: "portrait", confidence: 0.85, frameStats: { brightness: 0.3, warmth: 0.08 }, subjectBox: { x: 450, y: 270, width: 260, height: 520 } },
    ],
  });

  assertEqual(decision.mode, "ai-capture", "decision mode");
  assertEqual(decision.scene, "portrait", "stable scene");
  assertEqual(decision.light, "偏暗", "stable light");
  assertEqual(decision.appliedFilter, "暖肤提亮", "auto-applied filter");
  assert(decision.cropBox.width < 1200 || decision.cropBox.height < 1600, "AI composition should crop");
  assert(decision.outputs.original, "original output");
  assert(decision.outputs.aiCrop, "ai crop output");
  assert(decision.outputs.aiCropFilter, "ai crop filter output");
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
  testLightClassification();
  testFilterRecommendation();
  testCropMaintainsPreviewRatio();
  testAiDecisionLocksStableSampleWindow();
  testStandardDecisionDoesNotApplyAi();
  console.log("AI camera core tests passed");
}

main();
