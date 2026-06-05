import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const MAX_TILE_WIDTH = 1024;
const MAX_TILE_HEIGHT = 768;

export async function captureCanvasScreenshot(cdp) {
  const viewport = await getCanvasViewport(cdp);
  const tiles = [];
  for (let y = 0; y < viewport.height; y += MAX_TILE_HEIGHT) {
    for (let x = 0; x < viewport.width; x += MAX_TILE_WIDTH) {
      const width = Math.min(MAX_TILE_WIDTH, viewport.width - x);
      const height = Math.min(MAX_TILE_HEIGHT, viewport.height - y);
      if (process.env.QA_CAPTURE_DEBUG === "1") {
        console.error(`capture tile ${x},${y} ${width}x${height} of ${viewport.width}x${viewport.height}`);
      }
      tiles.push({
        x,
        y,
        width,
        height,
        data: await captureCanvasTile(cdp, x, y, width, height)
      });
    }
  }
  return composePngFromTiles({ ...viewport, tiles });
}

async function getCanvasViewport(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      if (!document.querySelector("canvas")) {
        return null;
      }
      return { width: window.innerWidth, height: window.innerHeight };
    })()`,
    returnByValue: true
  });

  const viewport = result.result?.value;
  if (!viewport?.width || !viewport?.height) {
    throw new Error("Unable to read QA canvas viewport");
  }
  return viewport;
}

async function captureCanvasTile(cdp, x, y, width, height) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const source = document.querySelector("canvas");
      if (!source) {
        return null;
      }
      const output = document.createElement("canvas");
      output.width = ${width};
      output.height = ${height};
      const context = output.getContext("2d");
      if (!context) {
        return null;
      }
      context.fillStyle = "#f2f4ef";
      context.fillRect(0, 0, output.width, output.height);
      const rect = source.getBoundingClientRect();
      context.drawImage(source, rect.left - ${x}, rect.top - ${y}, rect.width, rect.height);
      return output.toDataURL("image/png").split(",")[1];
    })()`,
    returnByValue: true
  });

  const data = result.result?.value;
  if (!data) {
    throw new Error(`Unable to export QA canvas tile at ${x},${y}`);
  }
  return data;
}

function composePngFromTiles(tileSet) {
  const rgba = Buffer.alloc(tileSet.width * tileSet.height * 4, 0);
  for (const tile of tileSet.tiles) {
    const decoded = decodePng(Buffer.from(tile.data, "base64"));
    if (decoded.width !== tile.width || decoded.height !== tile.height) {
      throw new Error(`Tile dimensions do not match metadata at ${tile.x},${tile.y}`);
    }
    for (let row = 0; row < decoded.height; row += 1) {
      const sourceStart = row * decoded.width * 4;
      const sourceEnd = sourceStart + decoded.width * 4;
      const targetStart = ((tile.y + row) * tileSet.width + tile.x) * 4;
      decoded.rgba.copy(rgba, targetStart, sourceStart, sourceEnd);
    }
  }
  return encodePngRgba(tileSet.width, tileSet.height, rgba);
}

function decodePng(bytes) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Tile is not a PNG");
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

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported tile PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let cursor = 0;
  let previous = Buffer.alloc(stride);
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
      const source = x * channels;
      const target = (y * width + x) * 4;
      rgba[target] = row[source];
      rgba[target + 1] = row[source + 1];
      rgba[target + 2] = row[source + 2];
      rgba[target + 3] = channels === 4 ? row[source + 3] : 255;
    }
    previous = row;
  }
  return { width, height, rgba };
}

function encodePngRgba(width, height, rgba) {
  const scanlineLength = width * 4 + 1;
  const raw = Buffer.alloc(scanlineLength * height);
  for (let y = 0; y < height; y += 1) {
    const target = y * scanlineLength;
    raw[target] = 0;
    rgba.copy(raw, target + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", deflateSync(raw, { level: 6 })),
    makeChunk("IEND", Buffer.alloc(0))
  ]);
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
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

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();
