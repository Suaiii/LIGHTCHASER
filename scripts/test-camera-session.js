// 用途：验证共享 CameraSession 与 P4 全量滤镜接线；用法：npm run test:camera-session。
const fs = require("fs");
const path = require("path");

const core = require("../lib/ai-camera-core");
const {
  FILTER_ALIAS_MAP,
  createCameraSession,
  resolveProductFilterKeys,
} = require("../lib/lightchaser-camera-session");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message}: expected ${expected}, got ${actual}`);
}

function testGuidedSessionDefaultsToVisibleAI() {
  const session = createCameraSession({
    core,
    mode: "guided",
    context: {
      scene: "sunset",
      composeTemplate: "thirds",
      filters: ["dusk_warm", "film_fade", "teal_orange"],
    },
  });
  const snapshot = session.snapshot();
  assert(snapshot.aiComposition, "guided camera should default AI composition on");
  assert(snapshot.aiFilter, "guided camera should default AI filter on");
  assertEqual(snapshot.composeTemplate, "thirds", "guided session should retain spot composition template");
}

function testStandaloneSessionKeepsManualDefaults() {
  const session = createCameraSession({ core, mode: "standalone" });
  const snapshot = session.snapshot();
  assert(!snapshot.aiComposition, "standalone camera should keep AI composition off by default");
  assert(!snapshot.aiFilter, "standalone camera should keep AI filter off by default");
}

function testFullFilterCatalogIsExposed() {
  const session = createCameraSession({ core, mode: "guided" });
  const catalog = session.getFilterCatalog();
  const groups = session.getFilterGroups();
  assertEqual(catalog.length, Object.keys(core.FILTER_PRESETS).length, "drawer should expose every filter preset");
  assertEqual(catalog.length, 23, "camera filter drawer should contain all 23 filters");
  assertEqual(groups.length, core.BRAND_ORDER.length, "drawer should expose every brand group");
  assertEqual(groups.flatMap((group) => group.filters).length, 23, "brand groups should contain the full catalog without filtering");
}

function testProductFilterAliasesResolveToCanonicalPresets() {
  const productKeys = [
    "blue_glass",
    "dusk_warm",
    "film_fade",
    "gallery_clean",
    "gold_rim",
    "mono_city",
    "soft_matte",
    "teal_orange",
    "window_soft",
  ];
  assertEqual(Object.keys(FILTER_ALIAS_MAP).length, productKeys.length, "all product filter names should have one canonical mapping");
  const resolved = resolveProductFilterKeys(productKeys, core.FILTER_PRESETS);
  assertEqual(resolved.length, productKeys.length, "all product filters should resolve");
  assert(resolved.every((key) => core.FILTER_PRESETS[key]), "every resolved filter should exist in the AI camera catalog");
}

function testSessionBuildsStableCapturePlan() {
  const session = createCameraSession({
    core,
    mode: "guided",
    context: { scene: "sunset", filters: ["dusk_warm", "film_fade", "teal_orange"] },
  });
  const frame = { width: 1200, height: 1600 };
  session.pushSample({
    scene: "landscape",
    confidence: 0.88,
    frameStats: { brightness: 0.62, warmth: 0.12 },
    subjectBox: null,
    subjectBoxes: [],
  }, frame);
  const snapshot = session.snapshot();
  assert(snapshot.decision, "sample should produce a capture decision");
  assertEqual(snapshot.decision.effectiveAspectRatio, "16:9", "guided landscape should receive the AI wide ratio");
  assertEqual(snapshot.activeFilterKey, "F_VELVIA", "vision scene and light should lead the guided recommendation");

  session.selectFilter("F_VELVIA");
  assertEqual(session.snapshot().activeFilterKey, "F_VELVIA", "manual selection should override the recommendation");
  session.selectFilter(null);
  assertEqual(session.snapshot().activeFilterKey, "F_VELVIA", "clearing manual selection should restore the guided recommendation");

  const capturePlan = session.getCapturePlan({ width: 1920, height: 1080 });
  assert(capturePlan.cropBox.x >= 0 && capturePlan.cropBox.y >= 0, "capture plan should stay inside the new frame origin");
  assert(capturePlan.cropBox.x + capturePlan.cropBox.width <= 1920, "capture plan should be rebuilt for the capture width");
  assert(capturePlan.cropBox.y + capturePlan.cropBox.height <= 1080, "capture plan should be rebuilt for the capture height");
}

function testMainPrototypeLoadsSharedCameraModulesBeforeReactPanel() {
  const html = fs.readFileSync(path.join(__dirname, "../public/追·光.html"), "utf8");
  const coreIndex = html.indexOf("ai-camera-core.browser.js");
  const layersIndex = html.indexOf("ai-camera-filter-layers.js");
  const sessionIndex = html.indexOf("lightchaser-camera-session.js");
  const panelIndex = html.indexOf("subpanels.jsx");
  assert(coreIndex >= 0 && layersIndex >= 0 && sessionIndex >= 0, "main prototype should load all shared camera modules");
  assert(coreIndex < sessionIndex && layersIndex < sessionIndex && sessionIndex < panelIndex, "camera modules should load before the React camera adapter");
}

function testQuickShootUsesFullCatalogDrawer() {
  const source = fs.readFileSync(path.join(__dirname, "../public/subpanels.jsx"), "utf8");
  assert(source.includes("getFilterGroups()"), "P4 should render the shared full filter groups");
  assert(source.includes("胶片风格 · 23"), "P4 drawer should disclose the full 23-filter catalog");
  assert(!source.includes("const QUICKSHOOT_FILTERS"), "P4 should not keep the old four-filter hard-coded strip");
}

function run() {
  testGuidedSessionDefaultsToVisibleAI();
  testStandaloneSessionKeepsManualDefaults();
  testFullFilterCatalogIsExposed();
  testProductFilterAliasesResolveToCanonicalPresets();
  testSessionBuildsStableCapturePlan();
  testMainPrototypeLoadsSharedCameraModulesBeforeReactPanel();
  testQuickShootUsesFullCatalogDrawer();
  console.log("Camera session integration tests passed");
}

run();
