import { Graphics, MeshSimple, Texture } from "pixi.js";
import type { AgentStatus } from "../shared/types";
import { STATUS_SCREEN_COLORS } from "./scene-config";
import type { AwayScreenSession, IdleDeskActivity, ScreenPoint, ScreenQuad } from "./scene-types";
import { FULL_FRAME_MESH_UVS, getSpriteSheetFrameTexture } from "./sprite-frame-textures";

export type SpriteSheetPlayback = {
  columns: number;
  rows: number;
  fps: number;
  seed: number;
};

export function drawGeneratedScreenPanel(
  graphics: Graphics,
  status: AgentStatus,
  time: number,
  quad: ScreenQuad
) {
  const screenColor = STATUS_SCREEN_COLORS[status];
  drawScreenQuad(graphics, quad, screenColor, 0x071012);
  drawScreenLine(graphics, quad, 0.1, 0.86, 0.18, 0x94d7cc, 1, 0.32);
  drawScreenLine(graphics, quad, 0.08, 0.78, 0.84, 0xffffff, 2, 0.08);

  if (status === "idle") {
    drawLeisureMiniScreen(graphics, time, quad);
  } else if (status === "error") {
    drawScreenBlock(graphics, quad, 0.16, 0.34, 0.82, 0.42, 0xe76f51);
    drawScreenBlock(graphics, quad, 0.22, 0.66, 0.74, 0.74, 0xe76f51);
  } else if (status === "blocked") {
    graphics
      .moveTo(...pointTuple(pointOnQuad(quad, 0.5, 0.24)))
      .lineTo(...pointTuple(pointOnQuad(quad, 0.65, 0.78)))
      .lineTo(...pointTuple(pointOnQuad(quad, 0.35, 0.78)))
      .closePath()
      .fill(0xf4c95d);
  } else if (status === "offline") {
    drawScreenLine(graphics, quad, 0.26, 0.74, 0.58, 0x758184, 2, 1);
  } else {
    drawCodeMiniScreen(graphics, time, quad, status);
  }
}

export function drawAwayScreenPanel(
  graphics: Graphics,
  mesh: MeshSimple,
  screensaverTexture: Texture | undefined,
  time: number,
  quad: ScreenQuad,
  session: AwayScreenSession
) {
  if (session.mode === "desktop") {
    drawStaticDesktopPanel(graphics, quad, session.seed);
    return;
  }

  if (!screensaverTexture) {
    drawProceduralScreensaverPanel(graphics, time, quad, session.seed);
    return;
  }

  updateScreensaverMesh(mesh, screensaverTexture, time, quad, session.seed);
  drawScreenOutline(graphics, quad, 0x071012, 1, 0.9);
  drawScreenLine(graphics, quad, 0.08, 0.92, 0.12, 0x9ff4ff, 1, 0.08);
  drawScreensaverGlints(graphics, time, quad, session.seed);
}

export function drawSpriteSheetScreenPanel(
  graphics: Graphics,
  mesh: MeshSimple,
  texture: Texture,
  time: number,
  quad: ScreenQuad,
  playback: SpriteSheetPlayback
) {
  updateSpriteSheetMesh(mesh, texture, time, quad, playback);
  drawScreenOutline(graphics, quad, 0x071012, 1, 0.9);
}

export function drawIdleDeskScreenPanel(
  graphics: Graphics,
  activity: IdleDeskActivity,
  time: number,
  quad: ScreenQuad,
  seed: number
) {
  if (activity === "video") {
    drawVideoLeisureScreen(graphics, time, quad, seed);
  } else if (activity === "music") {
    drawMusicLeisureScreen(graphics, time, quad, seed);
  } else {
    drawGameLeisureScreen(graphics, time, quad, seed);
  }
}

export function mapSpriteSourceQuad(
  texture: Texture | undefined,
  sourceQuad: ScreenQuad,
  spriteX: number,
  spriteY: number,
  renderedWidth: number,
  anchorX: number,
  anchorY: number
): ScreenQuad {
  if (!texture) {
    return sourceQuad;
  }

  const scale = renderedWidth / texture.width;
  return sourceQuad.map((point) => ({
    x: spriteX + (point.x - texture.width * anchorX) * scale,
    y: spriteY + (point.y - texture.height * anchorY) * scale
  })) as ScreenQuad;
}

export function drawScreenMask(graphics: Graphics, quad: ScreenQuad) {
  graphics
    .moveTo(quad[0].x, quad[0].y)
    .lineTo(quad[1].x, quad[1].y)
    .lineTo(quad[2].x, quad[2].y)
    .lineTo(quad[3].x, quad[3].y)
    .closePath()
    .fill(0xffffff);
}

function drawStaticDesktopPanel(graphics: Graphics, quad: ScreenQuad, seed: number) {
  drawScreenQuad(graphics, quad, 0x122535, 0x071012);
  drawScreenBlock(graphics, quad, 0, 0.72, 1, 1, 0x0d1925);
  drawScreenBlock(graphics, quad, 0.04, 0.78, 0.16, 0.91, 0x1b3d54);
  drawScreenBlock(graphics, quad, 0.19, 0.79, 0.29, 0.9, 0x235f6e);
  drawScreenBlock(graphics, quad, 0.74, 0.8, 0.94, 0.9, 0x2f4350);
  drawScreenLine(graphics, quad, 0.05, 0.54, 0.18, 0x71d0ff, 2, 0.28);
  drawScreenLine(graphics, quad, 0.12, 0.66, 0.27, 0x9ae9ff, 1, 0.18);
  drawScreenLine(graphics, quad, 0.44, 0.88, 0.54, 0x67e3bb, 2, 0.18);

  const desktopIcons = [
    { u: 0.08, v: 0.16, color: 0xf0c76c, folder: true },
    { u: 0.08, v: 0.36, color: 0x80d0ff, folder: false },
    { u: 0.08, v: 0.56, color: 0xc5dbec, folder: false },
    { u: 0.22, v: 0.17, color: 0x69c2a1, folder: true },
    { u: 0.22, v: 0.38, color: 0xf7f4df, folder: false },
    { u: 0.36, v: 0.17, color: 0xb7c9ff, folder: false }
  ];
  desktopIcons.forEach((icon, index) => {
    const offset = seededUnit(seed, index) * 0.008;
    drawDesktopIcon(graphics, quad, icon.u + offset, icon.v, icon.color, icon.folder);
  });

  drawScreenBlock(graphics, quad, 0.04, 0.92, 0.96, 0.98, 0x101923);
  drawScreenBlock(graphics, quad, 0.07, 0.935, 0.12, 0.965, 0x5ed1c0);
  drawScreenBlock(graphics, quad, 0.79, 0.938, 0.94, 0.96, 0x71828d);
}

function drawDesktopIcon(
  graphics: Graphics,
  quad: ScreenQuad,
  u: number,
  v: number,
  color: number,
  folder: boolean
) {
  if (folder) {
    drawScreenBlock(graphics, quad, u, v + 0.025, u + 0.095, v + 0.108, color);
    drawScreenBlock(graphics, quad, u + 0.01, v, u + 0.06, v + 0.04, 0xffde86);
    drawScreenBlock(graphics, quad, u + 0.012, v + 0.13, u + 0.09, v + 0.145, 0xaed2d6);
    return;
  }

  drawScreenBlock(graphics, quad, u, v, u + 0.078, v + 0.108, color);
  drawScreenBlock(graphics, quad, u + 0.012, v + 0.018, u + 0.066, v + 0.032, 0xffffff);
  drawScreenBlock(graphics, quad, u + 0.012, v + 0.048, u + 0.058, v + 0.058, 0xffffff);
  drawScreenBlock(graphics, quad, u + 0.012, v + 0.13, u + 0.083, v + 0.145, 0xaed2d6);
}

function updateScreensaverMesh(
  mesh: MeshSimple,
  texture: Texture,
  time: number,
  quad: ScreenQuad,
  seed: number
) {
  const frame = Math.floor(time / 950 + seed * 4) % 4;
  const frameTexture = getSpriteSheetFrameTexture(texture, {
    frame,
    columns: 2,
    rows: 2,
    insetX: texture.width * 0.004,
    insetY: texture.height * 0.004
  });

  mesh.texture = frameTexture;
  mesh.vertices = new Float32Array([
    quad[0].x,
    quad[0].y,
    quad[1].x,
    quad[1].y,
    quad[2].x,
    quad[2].y,
    quad[3].x,
    quad[3].y
  ]);
  setMeshFullFrameUvs(mesh);
  mesh.visible = true;
}

function updateSpriteSheetMesh(
  mesh: MeshSimple,
  texture: Texture,
  time: number,
  quad: ScreenQuad,
  playback: SpriteSheetPlayback
) {
  const frameCount = playback.columns * playback.rows;
  const frame = (Math.floor(time / (1000 / playback.fps)) + Math.floor(playback.seed * frameCount)) % frameCount;
  const frameTexture = getSpriteSheetFrameTexture(texture, {
    frame,
    columns: playback.columns,
    rows: playback.rows,
    insetX: texture.width * 0.0015,
    insetY: texture.height * 0.0015
  });

  mesh.texture = frameTexture;
  mesh.vertices = new Float32Array([
    quad[0].x,
    quad[0].y,
    quad[1].x,
    quad[1].y,
    quad[2].x,
    quad[2].y,
    quad[3].x,
    quad[3].y
  ]);
  setMeshFullFrameUvs(mesh);
  mesh.visible = true;
}

function setMeshFullFrameUvs(mesh: MeshSimple) {
  const uvBuffer = mesh.geometry.getBuffer("aUV");
  uvBuffer.data = FULL_FRAME_MESH_UVS;
  uvBuffer.update();
}

function drawProceduralScreensaverPanel(
  graphics: Graphics,
  time: number,
  quad: ScreenQuad,
  seed: number
) {
  drawScreenQuad(graphics, quad, 0x020b12, 0x071012);
  drawScreensaverRibbon(graphics, quad, time, seed, 0, 0x48e8ff, 2, 0.72);
  drawScreensaverRibbon(graphics, quad, time, seed, 1.7, 0x80f6ff, 1, 0.42);
  drawScreensaverRibbon(graphics, quad, time, seed, 3.1, 0x2dbbcc, 1, 0.3);
  drawScreensaverGlints(graphics, time, quad, seed);
}

function drawScreensaverRibbon(
  graphics: Graphics,
  quad: ScreenQuad,
  time: number,
  seed: number,
  offset: number,
  color: number,
  width: number,
  alpha: number
) {
  const phase = time / 1500 + seed * 6 + offset;
  for (let index = 0; index <= 26; index += 1) {
    const u = index / 26;
    const v = 0.5 + Math.sin(u * 7 + phase) * 0.18 + Math.sin(u * 15 + phase * 0.7) * 0.04;
    const point = pointOnQuad(quad, u, clamp(v, 0.08, 0.92));
    if (index === 0) {
      graphics.moveTo(point.x, point.y);
    } else {
      graphics.lineTo(point.x, point.y);
    }
  }
  graphics.stroke({ color, width, alpha, cap: "round", join: "round" });
}

function drawScreensaverGlints(
  graphics: Graphics,
  time: number,
  quad: ScreenQuad,
  seed: number
) {
  const phase = time / 2500;
  for (let index = 0; index < 14; index += 1) {
    const u = seededUnit(seed + phase * 0.07, index);
    const v = 0.18 + seededUnit(seed + 4.2, index) * 0.64;
    const point = pointOnQuad(quad, u, v);
    graphics
      .circle(point.x, point.y, 0.55 + seededUnit(seed + 9.4, index) * 1.1)
      .fill({ color: 0x7fefff, alpha: 0.18 + seededUnit(seed + 1.2, index) * 0.32 });
  }
}

function drawCodeMiniScreen(graphics: Graphics, time: number, quad: ScreenQuad, status: AgentStatus) {
  const cursor = Math.sin(time / 210) > 0 ? 1 : 0;
  const accent = status === "thinking" ? 0x7aa7ff : 0x64e0bd;
  const secondary = status === "thinking" ? 0xb7c9ff : 0xa7f2dd;
  const warning = status === "thinking" ? 0xf1c94c : 0xffd166;

  drawScreenBlock(graphics, quad, 0.1, 0.16, 0.34, 0.24, secondary);
  drawScreenBlock(graphics, quad, 0.38, 0.16, 0.62, 0.24, accent);
  drawScreenBlock(graphics, quad, 0.66, 0.16, 0.9, 0.24, warning);
  drawScreenBlock(graphics, quad, 0.12, 0.34, 0.72, 0.41, accent);
  drawScreenBlock(graphics, quad, 0.18, 0.49, 0.52, 0.56, secondary);
  drawScreenBlock(graphics, quad, 0.58, 0.49, 0.86, 0.56, 0x78d4ff);
  drawScreenBlock(graphics, quad, 0.12, 0.66, 0.78, 0.73, accent);
  if (cursor) {
    drawScreenBlock(graphics, quad, 0.82, 0.66, 0.88, 0.73, 0xffffff);
  }
}

function drawLeisureMiniScreen(
  graphics: Graphics,
  time: number,
  quad: ScreenQuad
) {
  const blink = Math.sin(time / 220) > 0 ? 1 : 0;

  drawScreenBlock(graphics, quad, 0.1, 0.12, 0.9, 0.24, 0xf1c94c);
  drawScreenBlock(graphics, quad, 0.14, 0.34, 0.42, 0.76, 0x59c16d);
  drawScreenBlock(graphics, quad, 0.48, 0.36, 0.68, 0.68, 0x91d7f2);
  drawScreenBlock(graphics, quad, 0.74, 0.34, 0.9, 0.42, 0xfff2a6);
  drawScreenBlock(graphics, quad, 0.74, 0.56, 0.88, 0.64, 0xff8a65);
  drawScreenBlock(graphics, quad, 0.22 + blink * 0.1, 0.72, 0.29 + blink * 0.1, 0.84, 0xffffff);
}

function drawVideoLeisureScreen(
  graphics: Graphics,
  time: number,
  quad: ScreenQuad,
  seed: number
) {
  const progress = (time / 4800 + seed) % 1;
  drawScreenQuad(graphics, quad, 0x10141b, 0x05070a);
  drawScreenBlock(graphics, quad, 0.05, 0.08, 0.72, 0.78, 0x1a2330);
  drawScreenBlock(graphics, quad, 0.08, 0.12, 0.69, 0.72, 0x24384d);
  drawScreenBlock(graphics, quad, 0.1, 0.15, 0.68, 0.42, 0x355d73);
  drawScreenBlock(graphics, quad, 0.12, 0.45, 0.32, 0.68, 0xf1c15f);
  drawScreenBlock(graphics, quad, 0.34, 0.48, 0.66, 0.69, 0x77c6dd);
  drawScreenBlock(graphics, quad, 0.05, 0.82, 0.72, 0.88, 0x2c3340);
  drawScreenBlock(graphics, quad, 0.05, 0.82, 0.05 + 0.67 * progress, 0.88, 0xf45d48);
  drawScreenBlock(graphics, quad, 0.78, 0.1, 0.94, 0.22, 0x29323d);
  drawScreenBlock(graphics, quad, 0.78, 0.28, 0.94, 0.4, 0x29323d);
  drawScreenBlock(graphics, quad, 0.78, 0.46, 0.94, 0.58, 0x29323d);
  drawScreenBlock(graphics, quad, 0.78, 0.64, 0.94, 0.76, 0x29323d);
}

function drawMusicLeisureScreen(
  graphics: Graphics,
  time: number,
  quad: ScreenQuad,
  seed: number
) {
  const pulse = 0.5 + Math.sin(time / 260 + seed * 9) * 0.5;
  drawScreenQuad(graphics, quad, 0x121a24, 0x05070a);
  drawScreenBlock(graphics, quad, 0.06, 0.1, 0.36, 0.64, 0x224b55);
  drawScreenBlock(graphics, quad, 0.1, 0.15, 0.32, 0.57, 0x43c7b3);
  drawScreenBlock(graphics, quad, 0.44, 0.14, 0.88, 0.2, 0xf0f6f2);
  drawScreenBlock(graphics, quad, 0.44, 0.26, 0.78, 0.31, 0x7f8f99);
  drawScreenBlock(graphics, quad, 0.44, 0.42, 0.9, 0.46, 0x2e3c48);
  drawScreenBlock(graphics, quad, 0.44, 0.42, 0.44 + 0.46 * pulse, 0.46, 0x64e0bd);
  drawScreenBlock(graphics, quad, 0.46, 0.56, 0.5, 0.64, 0xffffff);
  drawScreenBlock(graphics, quad, 0.56, 0.54, 0.61, 0.66, 0xffffff);
  drawScreenBlock(graphics, quad, 0.67, 0.56, 0.71, 0.64, 0xffffff);
  for (let index = 0; index < 9; index += 1) {
    const u = 0.42 + index * 0.055;
    const height = 0.08 + seededUnit(seed + time / 900, index) * 0.18;
    drawScreenBlock(graphics, quad, u, 0.82 - height, u + 0.025, 0.82, 0x7de7d2);
  }
}

function drawGameLeisureScreen(
  graphics: Graphics,
  time: number,
  quad: ScreenQuad,
  seed: number
) {
  const playerX = 0.18 + ((time / 2800 + seed) % 1) * 0.48;
  drawScreenQuad(graphics, quad, 0x0b1320, 0x05070a);
  drawScreenBlock(graphics, quad, 0.05, 0.08, 0.95, 0.78, 0x14324d);
  drawScreenBlock(graphics, quad, 0.05, 0.64, 0.95, 0.78, 0x2e5f45);
  drawScreenBlock(graphics, quad, 0.12, 0.28, 0.22, 0.64, 0x9bc46b);
  drawScreenBlock(graphics, quad, 0.38, 0.18, 0.5, 0.64, 0xd9a556);
  drawScreenBlock(graphics, quad, 0.68, 0.33, 0.8, 0.64, 0x9277c7);
  drawScreenBlock(graphics, quad, playerX, 0.5, playerX + 0.08, 0.64, 0xfff2a6);
  drawScreenBlock(graphics, quad, 0.07, 0.11, 0.22, 0.16, 0xf7d35d);
  drawScreenBlock(graphics, quad, 0.74, 0.1, 0.93, 0.19, 0x0f1c2a);
  drawScreenBlock(graphics, quad, 0.77, 0.13, 0.83, 0.16, 0x6fe6ff);
  drawScreenBlock(graphics, quad, 0.85, 0.13, 0.9, 0.16, 0xff6f61);
  drawScreenBlock(graphics, quad, 0.08, 0.84, 0.92, 0.9, 0x18283a);
  drawScreenBlock(graphics, quad, 0.08, 0.84, 0.08 + 0.84 * seededUnit(seed + 2.4, 0), 0.9, 0x6fe6ff);
}

function drawScreenQuad(graphics: Graphics, quad: ScreenQuad, fill: number, stroke: number) {
  graphics
    .moveTo(quad[0].x, quad[0].y)
    .lineTo(quad[1].x, quad[1].y)
    .lineTo(quad[2].x, quad[2].y)
    .lineTo(quad[3].x, quad[3].y)
    .closePath()
    .fill(fill)
    .stroke({ color: stroke, width: 1, alpha: 0.92 });
}

function drawScreenOutline(
  graphics: Graphics,
  quad: ScreenQuad,
  color: number,
  width: number,
  alpha: number
) {
  graphics
    .moveTo(quad[0].x, quad[0].y)
    .lineTo(quad[1].x, quad[1].y)
    .lineTo(quad[2].x, quad[2].y)
    .lineTo(quad[3].x, quad[3].y)
    .closePath()
    .stroke({ color, width, alpha });
}

function drawScreenLine(
  graphics: Graphics,
  quad: ScreenQuad,
  fromU: number,
  toU: number,
  v: number,
  color: number,
  width: number,
  alpha: number
) {
  const from = pointOnQuad(quad, fromU, v);
  const to = pointOnQuad(quad, toU, v);
  graphics
    .moveTo(from.x, from.y)
    .lineTo(to.x, to.y)
    .stroke({ color, width, alpha });
}

function drawScreenBlock(
  graphics: Graphics,
  quad: ScreenQuad,
  left: number,
  top: number,
  right: number,
  bottom: number,
  color: number
) {
  const p0 = pointOnQuad(quad, left, top);
  const p1 = pointOnQuad(quad, right, top);
  const p2 = pointOnQuad(quad, right, bottom);
  const p3 = pointOnQuad(quad, left, bottom);
  graphics
    .moveTo(p0.x, p0.y)
    .lineTo(p1.x, p1.y)
    .lineTo(p2.x, p2.y)
    .lineTo(p3.x, p3.y)
    .closePath()
    .fill(color);
}

function pointOnQuad(quad: ScreenQuad, u: number, v: number) {
  const left = lerpPoint(quad[0], quad[3], v);
  const right = lerpPoint(quad[1], quad[2], v);
  return lerpPoint(left, right, u);
}

function lerpPoint(from: ScreenPoint, to: ScreenPoint, amount: number): ScreenPoint {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount
  };
}

function pointTuple(point: ScreenPoint): [number, number] {
  return [point.x, point.y];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function seededUnit(seed: number, index: number) {
  return fract(Math.sin(seed * 9283.13 + index * 371.91) * 43758.5453);
}

function fract(value: number) {
  return value - Math.floor(value);
}
