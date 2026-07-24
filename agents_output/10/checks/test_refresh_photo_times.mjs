// AGENT_10 垫图时间刷新测试；用法: node --test agents_output/10/checks/test_refresh_photo_times.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(TEST_DIR, "../refresh_photo_times.mjs");
const RUN_DATE = "2026-07-16";
const RUN_NOW = "2026-07-16T23:30:45+08:00";

function fixture() {
  return {
    meta: { schema_version: "1.0", count: 6 },
    photos: [
      { id: "photo-001", status: "垫图", taken_at: "2020-01-01T12:00:00+08:00", caption: "keep-a" },
      { id: "photo-002", status: "垫图", taken_at: "2020-01-01T12:00:00+08:00", caption: "keep-b" },
      { id: "photo-003", status: "垫图", taken_at: "2020-01-01T12:00:00+08:00", caption: "keep-c" },
      { id: "photo-004", status: "垫图", taken_at: "2020-01-01T12:00:00+08:00", caption: "keep-d" },
      { id: "photo-005", status: "已核", taken_at: "2026-06-01T18:20:00+08:00", caption: "real-verified" },
      { id: "photo-006", status: "待核", taken_at: "2026-05-28T17:10:00+08:00", caption: "real-pending" },
    ],
  };
}

function runRefresh(inputPath, now = RUN_NOW) {
  return spawnSync(process.execPath, [SCRIPT_PATH, inputPath, "--now", now], {
    encoding: "utf8",
  });
}

function dateAge(dateText) {
  const toDay = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  return toDay(RUN_DATE) - toDay(dateText.slice(0, 10));
}

test("refreshes only placeholder timestamps into a useful D-7..D0 distribution", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes10-times-"));
  const inputPath = path.join(tempDir, "photos.json");
  const before = fixture();
  fs.writeFileSync(inputPath, `${JSON.stringify(before, null, 2)}\n`, "utf8");

  const result = runRefresh(inputPath);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const after = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const placeholders = after.photos.filter((photo) => photo.status === "垫图");
  const today = placeholders.filter((photo) => dateAge(photo.taken_at) === 0);
  const week = placeholders.filter((photo) => dateAge(photo.taken_at) >= 0 && dateAge(photo.taken_at) <= 6);
  assert.ok(placeholders.every((photo) => dateAge(photo.taken_at) >= 0 && dateAge(photo.taken_at) <= 7));
  assert.ok(today.length > 0, "today must be non-empty");
  assert.ok(week.length > today.length, "week must contain more records than today");
  assert.deepEqual(after.photos.slice(4), before.photos.slice(4), "real timestamps and records must remain unchanged");
});

test("is deterministic for the same run date and preserves every non-time field", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes10-idempotent-"));
  const inputPath = path.join(tempDir, "photos.json");
  const before = fixture();
  fs.writeFileSync(inputPath, `${JSON.stringify(before, null, 2)}\n`, "utf8");

  const firstResult = runRefresh(inputPath);
  assert.equal(firstResult.status, 0, firstResult.stderr || firstResult.stdout);
  const firstText = fs.readFileSync(inputPath, "utf8");
  const first = JSON.parse(firstText);

  const secondResult = runRefresh(inputPath);
  assert.equal(secondResult.status, 0, secondResult.stderr || secondResult.stdout);
  assert.equal(fs.readFileSync(inputPath, "utf8"), firstText);

  for (const original of before.photos.filter((photo) => photo.status === "垫图")) {
    const refreshed = first.photos.find((photo) => photo.id === original.id);
    const { taken_at: originalTime, ...originalRest } = original;
    const { taken_at: refreshedTime, ...refreshedRest } = refreshed;
    assert.notEqual(refreshedTime, originalTime);
    assert.deepEqual(refreshedRest, originalRest);
  }
});

test("does not create future D0 timestamps when refreshed just after midnight", () => {
  const earlyNow = "2026-07-16T00:05:00+08:00";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes10-midnight-"));
  const inputPath = path.join(tempDir, "photos.json");
  fs.writeFileSync(inputPath, `${JSON.stringify(fixture(), null, 2)}\n`, "utf8");

  const result = runRefresh(inputPath, earlyNow);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const after = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const placeholders = after.photos.filter((photo) => photo.status === "垫图");
  const today = placeholders.filter((photo) => photo.taken_at.startsWith(RUN_DATE));

  assert.ok(today.length > 0, "today must remain non-empty after a midnight refresh");
  assert.ok(placeholders.every((photo) => Date.parse(photo.taken_at) <= Date.parse(earlyNow)), "no refreshed timestamp may be in the future");
});

test("rejects duplicate placeholder ids before writing and leaves the file byte-identical", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes10-duplicate-id-"));
  const inputPath = path.join(tempDir, "photos.json");
  const data = fixture();
  data.photos[1].id = data.photos[0].id;
  const before = `${JSON.stringify(data, null, 4)}\n`;
  fs.writeFileSync(inputPath, before, "utf8");

  const result = runRefresh(inputPath);

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /垫图 id 重复: photo-001/);
  assert.equal(fs.readFileSync(inputPath, "utf8"), before);
  assert.deepEqual(fs.readdirSync(tempDir), ["photos.json"]);
});

test("rejects malformed placeholder ids before writing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes10-invalid-id-"));
  const inputPath = path.join(tempDir, "photos.json");
  const data = fixture();
  data.photos[0].id = "bad-id";
  const before = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(inputPath, before, "utf8");

  const result = runRefresh(inputPath);

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /垫图 id 格式错误: bad-id/);
  assert.equal(fs.readFileSync(inputPath, "utf8"), before);
});
