import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const root = process.cwd();
const flatDir = join(root, "public", "assets", "generated", "flat");

const sheets = [
  { fileName: "flatAgentWalkUpSheet.png", columns: 16, rows: 1 },
  { fileName: "flatAgentWalkDownSheet.png", columns: 16, rows: 1 },
  { fileName: "flatAgentWalkLeftSheet.png", columns: 16, rows: 1 },
  { fileName: "flatAgentWalkRightSheet.png", columns: 16, rows: 1 },
  { fileName: "flatAgentTreadmillHorizontalRunSheet.png", columns: 8, rows: 1 }
];

const failures = [];

for (const sheet of sheets) {
  const png = readPng(join(flatDir, sheet.fileName));
  const frameWidth = png.width / sheet.columns;
  const frameHeight = png.height / sheet.rows;
  assert.ok(Number.isInteger(frameWidth), `${sheet.fileName} frame width should be integral`);
  assert.ok(Number.isInteger(frameHeight), `${sheet.fileName} frame height should be integral`);

  for (let frame = 0; frame < sheet.columns * sheet.rows; frame += 1) {
    const column = frame % sheet.columns;
    const row = Math.floor(frame / sheet.columns);
    const components = getFrameAlphaComponents(
      png,
      column * frameWidth,
      row * frameHeight,
      frameWidth,
      frameHeight
    );
    const largeComponents = components.filter((component) => component.pixels >= 160);
    const boundaryComponents = largeComponents.filter((component) =>
      component.minX <= 1 || component.maxX >= frameWidth - 2
    );
    const largest = largeComponents[0];
    const second = largeComponents[1];
    const hasCompetingHalfBody = Boolean(largest && second && second.pixels / largest.pixels >= 0.3);

    if (hasCompetingHalfBody || boundaryComponents.length > 0) {
      failures.push({
        fileName: sheet.fileName,
        frame,
        frameWidth,
        reason: boundaryComponents.length > 0 ? "edge-clipped-component" : "competing-half-body-components",
        largeComponents: largeComponents.map((component) => ({
          pixels: component.pixels,
          minX: component.minX,
          maxX: component.maxX,
          minY: component.minY,
          maxY: component.maxY
        }))
      });
    }
  }
}

assert.deepEqual(failures, [], "Agent spritesheet frames should not contain split or edge-clipped Agent components");

console.log("agent spritesheet frame boundary tests passed");

function readPng(path) {
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

  assert.equal(bitDepth, 8, `${path} should use 8-bit channels`);
  assert.equal(colorType, 6, `${path} should be RGBA`);

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

function getFrameAlphaComponents(png, sourceX, sourceY, width, height) {
  const solid = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = png.rows[sourceY + y];
    for (let x = 0; x < width; x += 1) {
      const alpha = row[(sourceX + x) * 4 + 3];
      solid[y * width + x] = alpha > 8 ? 1 : 0;
    }
  }

  const visited = new Uint8Array(width * height);
  const components = [];
  const stack = [];

  for (let start = 0; start < solid.length; start += 1) {
    if (!solid[start] || visited[start]) {
      continue;
    }

    visited[start] = 1;
    stack.push(start);
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (stack.length > 0) {
      const index = stack.pop();
      const x = index % width;
      const y = Math.floor(index / width);
      pixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (const next of [index - 1, index + 1, index - width, index + width]) {
        if (
          next < 0 ||
          next >= solid.length ||
          visited[next] ||
          !solid[next]
        ) {
          continue;
        }
        const nextX = next % width;
        if ((next === index - 1 && nextX !== x - 1) || (next === index + 1 && nextX !== x + 1)) {
          continue;
        }
        visited[next] = 1;
        stack.push(next);
      }
    }

    components.push({ pixels, minX, minY, maxX, maxY });
  }

  return components.sort((a, b) => b.pixels - a.pixels);
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
  throw new Error(`Unsupported PNG filter ${filter}`);
}
