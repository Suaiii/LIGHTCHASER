// AGENT_10 照片 validator 回归测试；用法: node --test agents_output/10/checks/test_validate_photos.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(TEST_DIR, "../validate_photos.mjs");
const BASE_DATA = JSON.parse(fs.readFileSync(path.resolve(TEST_DIR, "../photos.v1.json"), "utf8"));
const LATE_NOW = "2026-07-16T23:59:00+08:00";

function dateBefore(dateText, offsetDays) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

function validData(dateText = "2026-07-16") {
  const data = structuredClone(BASE_DATA);
  data.photos.forEach((photo, index) => {
    const ageDays = index % 8;
    const time = ageDays === 0 ? "00:00:00" : "12:00:00";
    photo.taken_at = `${dateBefore(dateText, ageDays)}T${time}+08:00`;
  });
  return data;
}

function writeData(data) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes10-validator-"));
  const dataPath = path.join(tempDir, "photos.json");
  fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return { tempDir, dataPath };
}

function runValidator(dataPath, { now = LATE_NOW, ledgerPath } = {}) {
  const args = [SCRIPT_PATH, dataPath, "--now", now];
  if (ledgerPath) args.push("--ledger", ledgerPath);
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  return { ...result, output: `${result.stdout}${result.stderr}` };
}

function makeRealPhoto(data, overrides = {}) {
  Object.assign(data.photos[0], {
    status: "已核",
    image: "https://authorized.example/photo-001.jpg",
    author_name: "授权作者",
    caption: "深圳湾已授权真实照片",
    credit: "授权作者",
    consent_ref: "agents_output/07/consent_ledger.csv#row-2",
    consent_scope: "location_ok",
    score_at_taken: null,
    ...overrides,
  });
}

function writeLedger(tempDir, row, withProof = false) {
  const ledgerDir = path.join(tempDir, "ledger");
  fs.mkdirSync(path.join(ledgerDir, "consents"), { recursive: true });
  const ledgerPath = path.join(ledgerDir, "consent_ledger.csv");
  const header = "行号,创作者昵称,平台,联系日期,图片链接,机位id,授权状态,凭证截图路径,署名要求,访谈与否,备注";
  fs.writeFileSync(ledgerPath, `${header}\n${row}\n`, "utf8");
  if (withProof) fs.writeFileSync(path.join(ledgerDir, "consents", "2.png"), "proof", "utf8");
  return ledgerPath;
}

test("uses the real Asia/Shanghai day and rejects stale seeds after midnight", () => {
  const data = validData("2026-07-15");
  data.photos.forEach((photo) => { photo.taken_at = "2026-07-15T00:00:00+08:00"; });
  const { dataPath } = writeData(data);
  const result = runValidator(dataPath, { now: "2026-07-16T00:05:00+08:00" });

  assert.notEqual(result.status, 0);
  assert.match(result.output, /“今天”集合为空；请先运行 refresh_photo_times\.mjs/);
});

test("rejects any taken_at later than the injected current instant", () => {
  const data = validData();
  data.photos[0].taken_at = "2026-07-16T00:06:00+08:00";
  const { dataPath } = writeData(data);
  const result = runValidator(dataPath, { now: "2026-07-16T00:05:00+08:00" });

  assert.notEqual(result.status, 0);
  assert.match(result.output, /taken_at 晚于当前时刻/);
});

test("rejects the existing example ledger row because it is not authorized", () => {
  const data = validData();
  makeRealPhoto(data, {
    image: "https://example/post/xxx",
    author_name: "示例·晚霞猎人",
    credit: "示例·晚霞猎人",
    consent_ref: "agents_output/07/consent_ledger.csv#row-1",
  });
  const { dataPath } = writeData(data);
  const result = runValidator(dataPath);

  assert.notEqual(result.status, 0);
  assert.match(result.output, /示例行不可用于真实照片/);
  assert.match(result.output, /授权状态未同意: 已触达/);
});

test("accepts a real photo only when the injected ledger row and proof fully match", () => {
  const data = validData();
  makeRealPhoto(data);
  const { tempDir, dataPath } = writeData(data);
  const row = "2,授权作者,可颂,2026-07-15,https://authorized.example/photo-001.jpg,szw-001,已同意,consents/2.png,授权作者,否,授权范围=location_ok";
  const ledgerPath = writeLedger(tempDir, row, true);
  const result = runValidator(dataPath, { ledgerPath });

  assert.equal(result.status, 0, result.output);
});

test("fails conservatively when ledger proof or explicit consent scope is missing", () => {
  const data = validData();
  makeRealPhoto(data);
  const { tempDir, dataPath } = writeData(data);
  const row = "2,授权作者,可颂,2026-07-15,https://authorized.example/photo-001.jpg,szw-001,已同意,,授权作者,否,";
  const ledgerPath = writeLedger(tempDir, row);
  const result = runValidator(dataPath, { ledgerPath });

  assert.notEqual(result.status, 0);
  assert.match(result.output, /授权凭证路径为空/);
  assert.match(result.output, /授权范围缺失/);
});

test("mirrors additionalProperties false at root, meta, and photo levels", () => {
  const cases = [
    ["root", (data) => { data.extra_field = true; }, /root 禁止额外字段: extra_field/],
    ["meta", (data) => { data.meta.extra_field = true; }, /meta 禁止额外字段: extra_field/],
    ["photo", (data) => { data.photos[0].extra_field = true; }, /photos\[0\].*禁止额外字段: extra_field/],
  ];
  for (const [label, mutate, expected] of cases) {
    const data = validData();
    mutate(data);
    const { dataPath } = writeData(data);
    const result = runValidator(dataPath);
    assert.notEqual(result.status, 0, `${label} extra field should fail`);
    assert.match(result.output, expected);
  }
});

test("rejects wrong meta constants and empty schema strings", () => {
  const cases = [
    [(data) => { data.meta.schema_version = 1; }, /meta\.schema_version 必须为字符串常量 1\.0/],
    [(data) => { data.meta.agent = "AGENT_09"; }, /meta\.agent 必须为常量 AGENT_10/],
    [(data) => { data.photos[0].caption = ""; }, /caption 不得为空/],
  ];
  for (const [mutate, expected] of cases) {
    const data = validData();
    mutate(data);
    const { dataPath } = writeData(data);
    const result = runValidator(dataPath);
    assert.notEqual(result.status, 0);
    assert.match(result.output, expected);
  }
});
