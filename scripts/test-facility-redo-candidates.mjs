import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const root = process.cwd();
const candidateRoot = join(root, "artifacts", "facility-redo-candidates");
const styleReferenceKeys = [
  "flatAgentTypingBodySheet",
  "flatAgentThinkingBodySheet",
  "flatAgentIdleDeskBodySheet"
];

const groups = [
  {
    name: "pantrySeatA",
    seatId: "pantrySeatA",
    facingLabel: "downRight",
    actions: ["coffee", "snack", "device", "drink"]
  },
  {
    name: "pantrySeatB",
    seatId: "pantrySeatB",
    facingLabel: "downLeft",
    actions: ["coffee", "snack", "device", "drink"]
  },
  {
    name: "restroomToilet",
    seatId: "restroomToilet",
    facingLabel: "downRight",
    actions: ["device", "meditate"],
    allowHoldForVisualReview: true
  }
];

for (const group of groups) {
  const summaryPath = join(candidateRoot, group.name, "qa-summary.json");
  const promptsPath = join(candidateRoot, group.name, "prompts.json");
  assert.ok(existsSync(summaryPath), `${group.name} should have qa-summary.json`);
  assert.ok(existsSync(promptsPath), `${group.name} should have prompts.json`);

  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const prompts = JSON.parse(readFileSync(promptsPath, "utf8"));
  assert.equal(summary.status, "DONE", `${group.name} summary should be DONE`);
  assert.equal(summary.contract?.width, 2176, `${group.name} contract width should be 2176`);
  assert.equal(summary.contract?.height, 724, `${group.name} contract height should be 724`);
  assert.equal(summary.contract?.frames, 8, `${group.name} contract frames should be 8`);
  assert.equal(summary.contract?.rows, 1, `${group.name} contract rows should be 1`);
  assert.equal(summary.contract?.fps, 6, `${group.name} contract fps should be 6`);

  const promptAssetsByAction = new Map((prompts.assets ?? []).map((asset) => [asset.actionId, asset]));
  const assetsByAction = new Map((summary.assets ?? []).map((asset) => [asset.actionId, asset]));
  for (const actionId of group.actions) {
    const asset = assetsByAction.get(actionId);
    assert.ok(asset, `${group.name}/${actionId} should exist in qa-summary`);
    assert.ok(promptAssetsByAction.has(actionId), `${group.name}/${actionId} should exist in prompts`);
    assertCandidateAsset(asset, group, actionId);
  }
}

console.log("facility redo candidate tests passed");

function assertCandidateAsset(asset, group, actionId) {
  const frameHashes = getFrameHashes(asset.path);
  const uniqueFrameCount = new Set(frameHashes).size;

  assert.equal(asset.seatId, group.seatId, `${asset.fileName} seatId should match`);
  assert.equal(asset.facingLabel, group.facingLabel, `${asset.fileName} facingLabel should match`);
  assert.equal(asset.actionId, actionId, `${asset.fileName} actionId should match`);
  assert.equal(asset.width, 2176, `${asset.fileName} should be 2176 px wide`);
  assert.equal(asset.height, 724, `${asset.fileName} should be 724 px tall`);
  assert.equal(asset.colorTypeName, "RGBA", `${asset.fileName} should be RGBA`);
  assert.equal(asset.generationMethod, "imagegen", `${asset.fileName} should use normalized imagegen generationMethod`);
  assert.equal(asset.agentOnly, true, `${asset.fileName} should be marked Agent-only`);
  assert.equal(asset.includesSeatOrFurniture, false, `${asset.fileName} should not include furniture metadata`);
  assert.equal(asset.fps, 6, `${asset.fileName} fps should be 6`);
  assert.equal(asset.frameWidth, 272, `${asset.fileName} frameWidth should be 272`);
  assert.equal(asset.frameHeight, 724, `${asset.fileName} frameHeight should be 724`);
  assert.ok(typeof asset.sha256 === "string" && asset.sha256.length === 64, `${asset.fileName} should record sha256`);
  assert.ok(typeof asset.promptHash === "string" && asset.promptHash.length === 64, `${asset.fileName} should record promptHash`);
  assert.ok(Array.isArray(asset.sourceImagegenOutputs) && asset.sourceImagegenOutputs.length > 0, `${asset.fileName} should record imagegen source outputs`);
  assert.ok(Array.isArray(asset.styleReferenceKeys), `${asset.fileName} should record styleReferenceKeys`);
  for (const referenceKey of styleReferenceKeys) {
    assert.ok(asset.styleReferenceKeys.includes(referenceKey), `${asset.fileName} should reference ${referenceKey}`);
  }
  assert.equal(asset.hipAnchors?.length, 8, `${asset.fileName} should include 8 hip anchors`);
  assert.equal(asset.frameAlphaBboxes?.length, 8, `${asset.fileName} should include 8 frame alpha bboxes`);
  assert.ok(uniqueFrameCount > 1, `${asset.fileName} should contain motion frames, not one repeated static image`);
  assert.deepEqual(
    asset.transparentCornerAlpha,
    { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
    `${asset.fileName} corners should be transparent`
  );

  for (const [frameIndex, bbox] of asset.frameAlphaBboxes.entries()) {
    assert.ok(bbox.width > 0 && bbox.height > 0, `${asset.fileName} frame ${frameIndex} should have visible alpha`);
    assert.ok(bbox.x > 0, `${asset.fileName} frame ${frameIndex} should not touch left frame edge`);
    assert.ok(bbox.x + bbox.width < 272, `${asset.fileName} frame ${frameIndex} should not touch right frame edge`);
    assert.ok(bbox.width <= 240, `${asset.fileName} frame ${frameIndex} width should stay within Agent-only bounds`);
    assert.ok(bbox.height <= 470, `${asset.fileName} frame ${frameIndex} height should stay within Agent-only bounds`);
    assert.ok(bbox.height / bbox.width <= 2.05, `${asset.fileName} frame ${frameIndex} mascot seated silhouette ratio should be <= 2.05`);
  }
}

function getFrameHashes(path) {
  const png = readPngRows(path);
  assert.equal(png.width, 2176, `${path} decoded width should be 2176`);
  assert.equal(png.height, 724, `${path} decoded height should be 724`);

  const frameHashes = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const hash = createHash("sha256");
    for (let y = 0; y < png.rows.length; y += 1) {
      const start = frame * 272 * 4;
      const end = start + 272 * 4;
      hash.update(png.rows[y].subarray(start, end));
    }
    frameHashes.push(hash.digest("hex"));
  }
  return frameHashes;
}

function readPngRows(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path} should be a PNG`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  assert.equal(bitDepth, 8, `${path} should be 8-bit PNG`);
  assert.equal(colorType, 6, `${path} should be RGBA PNG`);

  const raw = inflateSync(Buffer.concat(idat));
  const channels = 4;
  const stride = width * channels;
  let cursor = 0;
  let previous = Buffer.alloc(stride);
  const rows = [];

  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor++];
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const value = raw[cursor++];
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? previous[x - channels] : 0;
      row[x] = (value + getPngPredictor(filter, left, up, upLeft)) & 0xff;
    }
    rows.push(row);
    previous = row;
  }

  return { width, height, rows };
}

function getPngPredictor(filter, left, up, upLeft) {
  if (filter === 0) {
    return 0;
  }
  if (filter === 1) {
    return left;
  }
  if (filter === 2) {
    return up;
  }
  if (filter === 3) {
    return Math.floor((left + up) / 2);
  }
  if (filter === 4) {
    const p = left + up - upLeft;
    const pa = Math.abs(p - left);
    const pb = Math.abs(p - up);
    const pc = Math.abs(p - upLeft);
    return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
  }
  throw new Error(`Unsupported PNG filter: ${filter}`);
}
