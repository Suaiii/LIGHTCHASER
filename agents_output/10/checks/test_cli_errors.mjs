// AGENT_10 CLI 错误格式测试；用法: node --test agents_output/10/checks/test_cli_errors.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const VALIDATOR = path.resolve(TEST_DIR, "../validate_photos.mjs");
const REFRESH = path.resolve(TEST_DIR, "../refresh_photo_times.mjs");

function assertSingleLineError(scriptPath, args, expectedPrefix) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
  const stderr = result.stderr.trim();
  assert.equal(result.status, 1, `${path.basename(scriptPath)} ${args.join(" ")} must exit 1`);
  assert.equal(result.stdout, "");
  assert.equal(stderr.split(/\r?\n/).length, 1, stderr);
  assert.match(stderr, new RegExp(`^${expectedPrefix} ERROR:`));
  assert.doesNotMatch(stderr, /\n\s*at |file:\/\//);
}

test("validator reports missing option values and unknown options as one line", () => {
  const cases = [
    ["--date"],
    ["--date", "--now", "2026-07-16T00:00:00+08:00"],
    ["--now"],
    ["--ledger"],
    ["--ledger", "--schema", "x"],
    ["--schema"],
    ["--schema", "--now", "2026-07-16T00:00:00+08:00"],
    ["--unknown"],
  ];
  for (const args of cases) assertSingleLineError(VALIDATOR, args, "validate_photos");
});

test("refresh reports missing option values and unknown options as one line", () => {
  const cases = [
    ["--date"],
    ["--date", "--now", "2026-07-16T00:00:00+08:00"],
    ["--now"],
    ["--now", "--date", "2026-07-16"],
    ["--unknown"],
  ];
  for (const args of cases) assertSingleLineError(REFRESH, args, "refresh_photo_times");
});
