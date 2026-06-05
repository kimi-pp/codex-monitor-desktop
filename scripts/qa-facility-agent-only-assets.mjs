import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const root = process.cwd();
const artifactsDir = join(root, "artifacts");
const flatDir = join(root, "public", "assets", "generated", "flat");
const restroomStyleAuditPath = join(artifactsDir, "facility-agent-style-audit-restroom.json");

const partialSummaryPaths = [
  join(artifactsDir, "facility-agent-only-pantry-seat-a-summary.json"),
  join(artifactsDir, "facility-agent-only-pantry-seat-b-summary.json"),
  join(artifactsDir, "facility-agent-only-restroom-toilet-summary.json"),
  join(artifactsDir, "facility-agent-only-restroom-toilet-device-frontcamera-summary.json"),
  join(artifactsDir, "facility-agent-only-restroom-toilet-meditate-frontcamera-summary.json")
];

const expectedAssets = [
  { fileName: "flatAgentPantrySeatACoffeeSheet.png", seatId: "pantrySeatA", facingLabel: "downRight", actionId: "coffee" },
  { fileName: "flatAgentPantrySeatASnackSheet.png", seatId: "pantrySeatA", facingLabel: "downRight", actionId: "snack" },
  { fileName: "flatAgentPantrySeatADeviceSheet.png", seatId: "pantrySeatA", facingLabel: "downRight", actionId: "device" },
  { fileName: "flatAgentPantrySeatADrinkSheet.png", seatId: "pantrySeatA", facingLabel: "downRight", actionId: "drink" },
  { fileName: "flatAgentPantrySeatBCoffeeSheet.png", seatId: "pantrySeatB", facingLabel: "downLeft", actionId: "coffee" },
  { fileName: "flatAgentPantrySeatBSnackSheet.png", seatId: "pantrySeatB", facingLabel: "downLeft", actionId: "snack" },
  { fileName: "flatAgentPantrySeatBDeviceSheet.png", seatId: "pantrySeatB", facingLabel: "downLeft", actionId: "device" },
  { fileName: "flatAgentPantrySeatBDrinkSheet.png", seatId: "pantrySeatB", facingLabel: "downLeft", actionId: "drink" },
  { fileName: "flatAgentRestroomToiletDeviceSheet.png", seatId: "restroomToilet", facingLabel: "frontCamera", actionId: "device" },
  { fileName: "flatAgentRestroomToiletMeditateSheet.png", seatId: "restroomToilet", facingLabel: "frontCamera", actionId: "meditate" }
];

mkdirSync(artifactsDir, { recursive: true });

const partialAssets = new Map();
for (const path of partialSummaryPaths) {
  if (!existsSync(path)) {
    continue;
  }
  const payload = JSON.parse(readJsonText(path));
  for (const asset of payload.assets ?? []) {
    partialAssets.set(asset.fileName, asset);
  }
  const singleAssetFileName = payload.fileName ?? (payload.asset ? `${payload.asset}.png` : undefined);
  if (singleAssetFileName) {
    partialAssets.set(singleAssetFileName, payload);
  }
}

const restroomStyleAudit = existsSync(restroomStyleAuditPath)
  ? JSON.parse(readJsonText(restroomStyleAuditPath))
  : undefined;
const restroomStyleAuditByName = new Map((restroomStyleAudit?.assets ?? []).map((asset) => [asset.fileName, asset]));

const assets = expectedAssets.map((expected) => {
  const path = join(flatDir, expected.fileName);
  const png = readPng(path);
  const partial = partialAssets.get(expected.fileName) ?? {};
  const isRestroomToiletAsset = expected.fileName.startsWith("flatAgentRestroomToilet");
  const ciceroAuditEntry = isRestroomToiletAsset
    ? restroomStyleAuditByName.get(expected.fileName)
    : undefined;
  const agentIdentity = isRestroomToiletAsset
    ? {
        ...partial.agentIdentity,
        twoWhiteEyes: partial.agentIdentity?.twoWhiteEyes ?? ciceroAuditEntry?.twoWhiteEyes,
        frontCameraFacing: partial.agentIdentity?.frontCameraFacing ?? ciceroAuditEntry?.frontCameraFacing
      }
    : partial.agentIdentity;
  return {
    ...expected,
    path,
    width: png.width,
    height: png.height,
    bitDepth: png.bitDepth,
    colorType: png.colorType,
    colorTypeName: png.colorTypeName,
    sha256: png.sha256,
    alphaPixels: png.alphaPixels,
    alphaBbox: png.alphaBbox,
    maxFrameAlphaBboxWidth: png.maxFrameAlphaBboxWidth,
    maxFrameAlphaBboxHeight: png.maxFrameAlphaBboxHeight,
    generationMethod: partial.generationMethod,
    promptHash: partial.promptHash,
    styleReferenceKeys: partial.styleReferenceKeys ?? [],
    sourceImagegenOutputs: partial.sourceImagegenOutputs ?? partial.sourceImagegenPaths ?? [],
    postProcessing: partial.postProcessing,
    ciceroConsistencyStatus: isRestroomToiletAsset
      ? ciceroAuditEntry?.ciceroConsistencyStatus
      : partial.ciceroConsistencyStatus,
    ciceroVisualVerdict: isRestroomToiletAsset
      ? ciceroAuditEntry?.styleVerdict
      : partial.ciceroVisualVerdict,
    ciceroStyleAudit: ciceroAuditEntry,
    agentIdentity,
    styleSourceKey: partial.styleSourceKey,
    styleSourceSha256: partial.styleSourceSha256,
    visibleWidth: partial.visibleWidth ?? partial.qa?.visibleWidth ?? png.maxFrameAlphaBboxWidth ?? png.alphaBbox?.width ?? 0,
    hipAnchors: partial.hipAnchors ?? partial.qa?.hipAnchors ?? [],
    agentOnly: partial.agentOnly === true || partial.agentIdentity?.agentOnly === true || ciceroAuditEntry?.agentOnly === true,
    includesSeatOrFurniture: partial.includesSeatOrFurniture === true && partial.agentIdentity?.noToiletOrFurniture !== true
  };
});

const summary = {
  contract: "facility-agent-only-v2",
  generatedAt: new Date().toISOString(),
  frameWidth: 272,
  frameHeight: 724,
  frames: 8,
  rows: 1,
  fps: 6,
  assets
};

const outputPath = join(artifactsDir, "facility-agent-only-assets-summary.json");
writeFileSync(outputPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  outputPath,
  assetCount: assets.length,
  allRgba: assets.every((asset) => asset.colorTypeName === "RGBA"),
  allHaveAlpha: assets.every((asset) => Boolean(asset.alphaBbox)),
  allHaveAnchors: assets.every((asset) => asset.hipAnchors.length === 8)
}, null, 2));

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

  const frameBboxes = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const frameMinX = frame * 272;
    const frameMaxX = frameMinX + 271;
    frameBboxes.push(getAlphaBbox(rows, frameMinX, frameMaxX));
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
    maxFrameAlphaBboxWidth: Math.max(...frameBboxes.map((bbox) => bbox?.width ?? 0)),
    maxFrameAlphaBboxHeight: Math.max(...frameBboxes.map((bbox) => bbox?.height ?? 0))
  };
}

function readJsonText(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function getAlphaBbox(rows, minFrameX, maxFrameX) {
  let minX = maxFrameX;
  let minY = rows.length;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = minFrameX; x <= maxFrameX; x += 1) {
      if (row[x * 4 + 3] === 0) {
        continue;
      }
      minX = Math.min(minX, x - minFrameX);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x - minFrameX);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX >= 0
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;
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
