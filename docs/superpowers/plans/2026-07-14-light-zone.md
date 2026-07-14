# Light Zone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two lightweight, truthful ways to show where sunset light is without affecting map interaction performance.

**Architecture:** Put pure sun-ray geometry in a small UMD module that works in Node tests and the browser. The existing MapLibre page consumes its GeoJSON outputs through regular line/circle/symbol layers, enabled only by a URL mode.

**Tech Stack:** JavaScript, MapLibre GL JS, SunCalc, Node assertions, Playwright E2E.

---

### Task 1: Pure light-zone geometry

**Files:**
- Create: `public/light-zone.js`
- Create: `scripts/test-light-zone.js`

- [x] Write Node assertions for destination bearing, unobstructed candidates, blocked candidates, and below-horizon states.
- [x] Run `node scripts/test-light-zone.js` and verify it fails because the module does not exist.
- [x] Implement local-meter conversion, ray-segment intersection, and angular-horizon evaluation.
- [x] Run `node scripts/test-light-zone.js` and verify all assertions pass.

### Task 2: MapLibre proposal layers

**Files:**
- Modify: `public/追·光.html`
- Modify: `public/light-map-gl.jsx`
- Create: `scripts/e2e/light-zone.mjs`

- [x] Add an E2E test that expects `axis`, `spots`, and `both` URL modes to create only their declared layers.
- [x] Run the E2E test and verify it fails because no proposal layers exist.
- [x] Load `light-zone.js` before the JSX files.
- [x] Add low-contrast sun-axis and candidate-state GeoJSON layers, defaulting to off.
- [x] Recompute only after map load, settled movement, tile completion, or sun-time remount.
- [x] Run the E2E test and verify all modes pass with zero page errors.

### Task 3: Performance and regression

**Files:**
- Modify: `docs/hermes/HERMES-03-提案.md`
- Modify: `DEVLOG.md`

- [x] Run `node scripts/e2e/tower-steps.mjs` with the feature off and with `lightZone=both`.
- [x] Run `node scripts/e2e/rotation-invariance.mjs` and `npm run test:api`.
- [x] Record timing, layer counts, and remaining manual 3-second-test requirement.
- [x] Commit the verified proposal implementation.
- [ ] Push `codex/hermes-03-lightzone`, update Issue #18, and open the Draft PR.
