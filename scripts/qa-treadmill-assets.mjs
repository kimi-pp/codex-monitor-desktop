import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const root = process.cwd();
const artifactsDir = join(root, "artifacts");
const auditPath = join(artifactsDir, "treadmill-horizontal-asset-audit.json");
const outputPath = join(artifactsDir, "treadmill-assets-summary.json");

const expectedAssets = [
  {
    key: "treadmillHorizontalStatic",
    fileName: "treadmill-horizontal-static-2d-v4.png",
    path: join(root, "public", "assets", "generated", "treadmill-horizontal-static-2d-v4.png"),
    kind: "environment",
    frames: 1,
    rejectedHashes: [
      "2fcf1db073b9dd0cc2741bf31e1508cf7fe0a4d812517a05055520734f980a24",
      "78bb7b5baede993c2c06c748aa222876a7d1a5a0a2fdfc9576b64371164e1650"
    ]
  },
  {
    key: "flatAgentTreadmillHorizontalRunSheet",
    fileName: "flatAgentTreadmillHorizontalRunSheet.png",
    path: join(root, "public", "assets", "generated", "flat", "flatAgentTreadmillHorizontalRunSheet.png"),
    kind: "agent",
    frames: 8,
    rejectedHashes: [
      "00c90a167a8372da469996146ec0cc2cddbc5bdb75bb90f17f9252969827558e",
      "82f9aea2df18cfcd2b1127e949927d4cc7176d9b5e845ed62a8a0d997ee748ee",
      "966f010ca2ce1b1cb4c94707bbecf2f85cec27060419724ed2f9e01926f3a616"
    ]
  }
];

mkdirSync(artifactsDir, { recursive: true });
if (!existsSync(auditPath)) {
  throw new Error(`Missing Cicero treadmill asset audit: ${auditPath}`);
}

const audit = JSON.parse(readJsonText(auditPath));

const assets = expectedAssets.map((expected) => {
  const png = readPng(expected.path);
  const finalAsset = audit.finalAssets?.[expected.key];
  const registration = audit.flatRegistration?.[expected.key];
  const auditEntry = {
    ...finalAsset,
    ...registration,
    ciceroConsistencyStatus: getCiceroStatus(expected.kind, audit),
    styleVerdict: expected.kind === "agent" ? audit.agentStyleVerdict : audit.unifiedPerspectiveVerdict,
    agentFacingLabel: expected.kind === "agent" ? audit.agentFacingLabel : undefined,
    rightFacingVerdict: expected.kind === "agent" ? audit.rightFacingVerdict : undefined,
    materialVerdict: expected.kind === "agent" ? audit.materialVerdict : undefined,
    agentOnly: expected.kind === "agent" ? audit.agentOnlyVerdict === "PASS" : undefined,
    includesAgent: expected.kind === "agent",
    anchorKind: expected.kind === "agent" ? registration?.anchorKind : undefined,
    contactAnchors: expected.kind === "agent" ? registration?.contactAnchors : undefined,
    candidateSources: audit.candidateSources
  };
  return {
    ...expected,
    ...png,
    rejectedHashes: expected.rejectedHashes,
    ciceroAudit: auditEntry,
    ciceroConsistencyStatus: auditEntry?.ciceroConsistencyStatus,
    styleVerdict: auditEntry?.styleVerdict,
    agentFacingLabel: auditEntry?.agentFacingLabel,
    rightFacingVerdict: auditEntry?.rightFacingVerdict,
    materialVerdict: auditEntry?.materialVerdict,
    agentOnly: expected.kind === "agent" ? auditEntry?.agentOnly === true : undefined,
    includesAgent: auditEntry?.includesAgent === true,
    anchorKind: auditEntry?.anchorKind,
    contactAnchors: auditEntry?.contactAnchors
  };
});

const summary = {
  contract: "treadmill-horizontal-static-v1",
  generatedAt: new Date().toISOString(),
  auditPath,
  auditor: audit.auditor,
  orientationVerdict: audit.orientationVerdict,
  unifiedPerspectiveVerdict: audit.unifiedPerspectiveVerdict,
  workstationPerspectiveMatch: audit.workstationPerspectiveMatch,
  pantryCabinetPerspectiveMatch: audit.pantryCabinetPerspectiveMatch,
  beltAnimationActive: audit.beltAnimationActive === true,
  agentFootContactVerdict: audit.agentFootContactVerdict,
  agentFacingLabel: audit.agentFacingLabel,
  rightFacingVerdict: audit.rightFacingVerdict,
  materialVerdict: audit.materialVerdict,
  metadata: audit.treadmillMetadata,
  flatRegistration: audit.flatRegistration,
  candidateSources: audit.candidateSources,
  numericGateResults: audit.numericGateResults,
  assets
};

writeFileSync(outputPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  outputPath,
  assetCount: assets.length,
  allRgba: assets.every((asset) => asset.colorTypeName === "RGBA"),
  allHaveAlpha: assets.every((asset) => Boolean(asset.alphaBbox)),
  auditor: audit.auditor
}, null, 2));

function readJsonText(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function getCiceroStatus(kind, audit) {
  if (kind === "agent") {
    return audit.agentStyleVerdict === "PASS" &&
      audit.agentFacingLabel === "right" &&
      audit.rightFacingVerdict === "PASS" &&
      audit.materialVerdict === "PASS" &&
      audit.agentOnlyVerdict === "PASS" &&
      audit.agentTwoEyesVerdict === "PASS" &&
      audit.agentFootContactVerdict === "PASS"
      ? "PASS"
      : "FAIL";
  }
  return audit.orientationVerdict === "PASS" &&
    audit.unifiedPerspectiveVerdict === "PASS" &&
    audit.workstationPerspectiveMatch === true &&
    audit.pantryCabinetPerspectiveMatch === true
    ? "PASS"
    : "FAIL";
}

function readPng(path) {
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`Not a PNG: ${path}`);
  }

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

  const colorTypeName = colorType === 6 ? "RGBA" : colorType === 2 ? "RGB" : `type-${colorType}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (colorType !== 6 || bitDepth !== 8) {
    return { width, height, bitDepth, colorType, colorTypeName, sha256, alphaPixels: 0, alphaBbox: null };
  }

  const raw = inflateSync(Buffer.concat(idat));
  const channels = 4;
  const stride = width * channels;
  let cursor = 0;
  let previous = Buffer.alloc(stride);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let alphaPixels = 0;
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

    for (let x = 0; x < width; x += 1) {
      if (row[x * channels + 3] === 0) {
        continue;
      }
      alphaPixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    rows.push(row);
    previous = row;
  }

  return {
    width,
    height,
    bitDepth,
    colorType,
    colorTypeName,
    sha256,
    alphaPixels,
    alphaBbox: alphaPixels > 0
      ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null,
    frameHashes: getFrameHashes(rows, width, height)
  };
}

function getFrameHashes(rows, width, height) {
  const frameCount = width % 8 === 0 ? 8 : 1;
  const frameWidth = width / frameCount;
  const hashes = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const hash = createHash("sha256");
    for (let y = 0; y < height; y += 1) {
      const start = frame * frameWidth * 4;
      const end = start + frameWidth * 4;
      hash.update(rows[y].subarray(start, end));
    }
    hashes.push(hash.digest("hex"));
  }
  return hashes;
}

function getPngPredictor(filter, left, up, upLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  if (filter === 4) {
    const p = left + up - upLeft;
    const pa = Math.abs(p - left);
    const pb = Math.abs(p - up);
    const pc = Math.abs(p - upLeft);
    return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
  }
  throw new Error(`Unsupported PNG filter: ${filter}`);
}
