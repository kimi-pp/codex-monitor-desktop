import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { FLAT_ASSET_MANIFEST, READY_FLAT_ASSET_KEYS } from "../src/animation/flat-assets.ts";

const root = process.cwd();
const auditPath = join(root, "artifacts", "walk-agent-assets-audit.json");
const flatDir = join(root, "public", "assets", "generated", "flat");

const expectedAssets = [
  { key: "flatAgentWalkUpSheet", fileName: "flatAgentWalkUpSheet.png", direction: "up", action: "walkUp", fps: 8 },
  { key: "flatAgentWalkDownSheet", fileName: "flatAgentWalkDownSheet.png", direction: "down", action: "walkDown", fps: 8 },
  { key: "flatAgentWalkLeftSheet", fileName: "flatAgentWalkLeftSheet.png", direction: "left", action: "walkLeft", fps: 6 },
  { key: "flatAgentWalkRightSheet", fileName: "flatAgentWalkRightSheet.png", direction: "right", action: "walkRight", fps: 6 }
];

for (const expected of expectedAssets) {
  const spec = FLAT_ASSET_MANIFEST[expected.key];
  assert.ok(spec, `${expected.key} should be present in FLAT_ASSET_MANIFEST`);
  assert.equal(spec.path, `./assets/generated/flat/${expected.fileName}`);
  assert.equal(spec.columns, 16, `${expected.key} should use 16 frames`);
  assert.equal(spec.rows, 1, `${expected.key} should use one row`);
  assert.equal(spec.fps, expected.fps, `${expected.key} should use direction-specific natural walk pacing`);
  assert.equal(spec.frameWidth, 272, `${expected.key} frame width should remain 272`);
  assert.equal(spec.frameHeight, 724, `${expected.key} frame height should remain 724`);
}

for (const legacyKey of [
  "flatAgentWalkNESheet",
  "flatAgentWalkNWSheet",
  "flatAgentWalkSESheet",
  "flatAgentWalkSWSheet"
]) {
  assert.ok(!READY_FLAT_ASSET_KEYS.includes(legacyKey), `${legacyKey} should not be part of ready walk assets`);
}

assert.ok(existsSync(auditPath), "Cicero walk asset audit report is required");
const audit = JSON.parse(readFileSync(auditPath, "utf8").replace(/^\uFEFF/, ""));
assert.equal(audit.auditor, "Cicero", "walk asset PASS can only be assigned by Cicero");
assert.equal(audit.status, "PASS", "Cicero walk audit status should be PASS");
assert.equal(audit.blockingReason ?? "", "", "Cicero PASS audit must not include a blockingReason");
assert.equal(
  (audit.ciceroImagegenAttempts ?? []).some((attempt) => attempt.result === "failed"),
  false,
  "Cicero PASS audit must not retain failed imagegen attempts as the final generation outcome"
);
assert.equal(audit.readyForManifest, true, audit.blockingReason ?? "Cicero audit should approve walk assets for manifest");
const auditAssetList = Array.isArray(audit.assets) ? audit.assets : Object.values(audit.assets ?? {});
const auditAssets = new Map(auditAssetList.map((asset) => [asset.fileName ?? asset.key ?? asset.target?.fileName, asset]));

for (const expected of expectedAssets) {
  const auditEntry = auditAssets.get(expected.fileName) ?? auditAssets.get(expected.key);
  assert.ok(auditEntry, `${expected.fileName} should have a Cicero audit entry`);
  assert.equal(auditEntry.auditor ?? audit.auditor, "Cicero", `${expected.fileName} audit entry should be owned by Cicero`);
  assert.equal(auditEntry.styleVerdict, "PASS", `${expected.fileName} style verdict should be PASS`);
  assert.equal(auditEntry.readyForManifest, true, `${expected.fileName} should be approved for manifest`);
  assert.equal(auditEntry.generationMethod, "imagegen", `${expected.fileName} should be imagegen-generated`);
  assert.equal(auditEntry.agentOnly, true, `${expected.fileName} should be Agent-only`);
  assert.equal(auditEntry.twoWhiteEyes, true, `${expected.fileName} should keep two white eyes`);
  assert.equal(auditEntry.tealCollar, true, `${expected.fileName} should keep teal collar`);
  assert.equal(auditEntry.direction, expected.direction, `${expected.fileName} direction mismatch`);
  assert.equal(auditEntry.action, expected.action, `${expected.fileName} action mismatch`);
  assert.ok(Array.isArray(auditEntry.contactAnchors), `${expected.fileName} should include contactAnchors`);
  assert.equal(auditEntry.contactAnchors.length, 16, `${expected.fileName} should include 16 contact anchors`);

  const spec = FLAT_ASSET_MANIFEST[expected.key];
  assert.equal(spec.status, "ready", `${expected.key} should only be ready after Cicero PASS`);
  assert.equal(spec.registration?.anchorKind, "footContact", `${expected.key} should register by foot contact`);
  assert.equal(spec.registration?.contactAnchors?.length, 16, `${expected.key} manifest should include 16 contact anchors`);

  const png = readPngHeader(join(flatDir, expected.fileName));
  assert.equal(png.width, 4352, `${expected.fileName} PNG width should be 16 * 272`);
  assert.equal(png.height, 724, `${expected.fileName} PNG height should be 724`);
  assert.equal(png.colorType, 6, `${expected.fileName} should be RGBA`);
}

console.log("agent walk asset gate tests passed");

function readPngHeader(path) {
  assert.ok(existsSync(path), `PNG missing: ${path}`);
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path} should be a PNG`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8, `${path} should use 8-bit channels`);
  return { width, height, bitDepth, colorType };
}
