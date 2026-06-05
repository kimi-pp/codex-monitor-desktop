import { Rectangle, Texture } from "pixi.js";

export const FULL_FRAME_MESH_UVS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);

export type SpriteSheetFrameRectOptions = {
  frame: number;
  columns: number;
  rows: number;
  textureWidth: number;
  textureHeight: number;
  insetPx?: number;
  insetX?: number;
  insetY?: number;
};

export type SpriteSheetFrameTextureOptions = Omit<SpriteSheetFrameRectOptions, "textureWidth" | "textureHeight">;

const frameTextureCache = new WeakMap<Texture, Map<string, Texture>>();
let warnedBrowserCropUnavailable = false;

export function getSpriteSheetFrameRect(options: SpriteSheetFrameRectOptions) {
  const columns = Math.max(1, Math.floor(options.columns));
  const rows = Math.max(1, Math.floor(options.rows));
  const frameCount = columns * rows;
  const frame = ((Math.floor(options.frame) % frameCount) + frameCount) % frameCount;
  const column = frame % columns;
  const row = Math.floor(frame / columns);
  const frameWidth = options.textureWidth / columns;
  const frameHeight = options.textureHeight / rows;
  const insetX = Math.max(0, options.insetX ?? options.insetPx ?? 0);
  const insetY = Math.max(0, options.insetY ?? options.insetPx ?? 0);

  return {
    x: column * frameWidth + insetX,
    y: row * frameHeight + insetY,
    width: Math.max(0, frameWidth - insetX * 2),
    height: Math.max(0, frameHeight - insetY * 2)
  };
}

export function getSpriteSheetFrameTexture(texture: Texture, options: SpriteSheetFrameTextureOptions) {
  const rect = getSpriteSheetFrameRect({
    ...options,
    textureWidth: texture.width,
    textureHeight: texture.height
  });
  const cacheKey = [
    options.frame,
    options.columns,
    options.rows,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  ].join(":");
  let textureFrames = frameTextureCache.get(texture);
  if (!textureFrames) {
    textureFrames = new Map<string, Texture>();
    frameTextureCache.set(texture, textureFrames);
  }

  let frameTexture = textureFrames.get(cacheKey);
  if (!frameTexture) {
    frameTexture = createFrameTexture(texture, rect);
    textureFrames.set(cacheKey, frameTexture);
  }

  return frameTexture;
}

function createFrameTexture(
  texture: Texture,
  rect: { x: number; y: number; width: number; height: number }
) {
  if (typeof document === "undefined") {
    return createSubFrameTexture(texture, rect);
  }

  const frameTexture = createCroppedFrameTexture(texture, rect);
  if (frameTexture) {
    return frameTexture;
  }

  if (!warnedBrowserCropUnavailable) {
    warnedBrowserCropUnavailable = true;
    console.warn("Spritesheet frame crop failed; hiding frame instead of using sub-texture fallback.", {
      textureWidth: texture.width,
      textureHeight: texture.height,
      rect
    });
  }
  return Texture.EMPTY;
}

function createSubFrameTexture(
  texture: Texture,
  rect: { x: number; y: number; width: number; height: number }
) {
  return new Texture({
    source: texture.source,
    frame: new Rectangle(rect.x, rect.y, rect.width, rect.height),
    orig: new Rectangle(0, 0, rect.width, rect.height)
  });
}

function createCroppedFrameTexture(
  texture: Texture,
  rect: { x: number; y: number; width: number; height: number }
) {
  if (typeof document === "undefined" || rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  const resource = texture.source.resource;
  if (!isCanvasDrawable(resource)) {
    return undefined;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
  const context = canvas.getContext("2d");
  if (!context) {
    return undefined;
  }

  try {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      resource,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return Texture.from(canvas);
  } catch {
    return undefined;
  }
}

function isCanvasDrawable(resource: unknown): resource is CanvasImageSource {
  if (!resource || typeof resource !== "object") {
    return false;
  }

  return [
    "HTMLImageElement",
    "HTMLCanvasElement",
    "HTMLVideoElement",
    "SVGImageElement",
    "ImageBitmap",
    "OffscreenCanvas",
    "VideoFrame"
  ].some((constructorName) => {
    const constructor = (globalThis as Record<string, unknown>)[constructorName];
    return typeof constructor === "function" &&
      resource instanceof (constructor as { new(...args: never[]): object });
  });
}
