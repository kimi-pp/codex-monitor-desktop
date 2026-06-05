import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Texture, TextureSource } from "pixi.js";

const root = process.cwd();
const officeRenderer = readFileSync(join(root, "src", "animation", "office-renderer.ts"), "utf8");
const screenRenderer = readFileSync(join(root, "src", "animation", "screen-renderer.ts"), "utf8");
const screenSessionStore = readFileSync(join(root, "src", "animation", "agent-screen-session.ts"), "utf8");
const sceneConfig = readFileSync(join(root, "src", "animation", "scene-config.ts"), "utf8");

for (const [name, source] of [
  ["office-renderer.ts", officeRenderer],
  ["screen-renderer.ts", screenRenderer]
]) {
  assert.ok(
    source.includes("getSpriteSheetFrameTexture"),
    `${name} should select spritesheet frames via frame textures, not by sliding mesh UVs`
  );
  assert.ok(
    !/getBuffer\("aUV"\)\.data\s*=\s*new Float32Array\(\[\s*left,\s*top,/m.test(source),
    `${name} should not animate spritesheets by mutating UV windows`
  );
}

const { FULL_FRAME_MESH_UVS, getSpriteSheetFrameRect, getSpriteSheetFrameTexture } = await import(
  "../src/animation/sprite-frame-textures.ts"
);

assert.deepEqual(Array.from(FULL_FRAME_MESH_UVS), [0, 0, 1, 0, 1, 1, 0, 1]);
assert.ok(
  officeRenderer.includes("const flatAgentMesh = new Sprite(Texture.EMPTY);"),
  "flat Agent sheets should use Sprite texture swapping instead of MeshSimple UV playback"
);
assert.ok(
  !officeRenderer.includes("const flatAgentMesh = new MeshSimple"),
  "flat Agent sheets should not be backed by MeshSimple"
);

const frameHelperSource = readFileSync(join(root, "src", "animation", "sprite-frame-textures.ts"), "utf8");
assert.ok(
  frameHelperSource.includes("context.drawImage(") && frameHelperSource.includes("Texture.from(canvas)"),
  "browser playback should crop sheet frames into standalone frame textures"
);
assert.ok(
  !frameHelperSource.includes("createCroppedFrameTexture(texture, rect) ?? createSubFrameTexture(texture, rect)"),
  "browser playback must not silently fall back to sub-textures when canvas cropping is unavailable"
);
assert.ok(
  frameHelperSource.includes("Texture.EMPTY"),
  "browser playback should fail closed to a blank frame instead of reusing the old sub-texture path"
);

for (const key of [
  "workingTerminalBuildRun",
  "workingCodeEditorActive",
  "workingDiffReviewActive",
  "thinkingPlanningBoard",
  "thinkingSearchAnalysis",
  "thinkingArchitectureMap"
]) {
  assert.ok(screenSessionStore.includes(key), `${key} should be part of the work screen variant pool`);
  assert.ok(sceneConfig.includes(key), `${key} should be loaded as a generated screen asset`);
}

assert.deepEqual(
  getSpriteSheetFrameRect({
    frame: 7,
    columns: 16,
    rows: 1,
    textureWidth: 4352,
    textureHeight: 724
  }),
  { x: 1904, y: 0, width: 272, height: 724 }
);

assert.deepEqual(
  getSpriteSheetFrameRect({
    frame: 3,
    columns: 2,
    rows: 2,
    textureWidth: 2048,
    textureHeight: 1024,
    insetPx: 4
  }),
  { x: 1028, y: 516, width: 1016, height: 504 }
);

const source = new TextureSource({ width: 4352, height: 724 });
const texture = new Texture({ source });
const frame0 = getSpriteSheetFrameTexture(texture, { frame: 0, columns: 16, rows: 1 });
const frame1 = getSpriteSheetFrameTexture(texture, { frame: 1, columns: 16, rows: 1 });
const frame1Again = getSpriteSheetFrameTexture(texture, { frame: 1, columns: 16, rows: 1 });

assert.equal(frame0.frame.x, 0);
assert.equal(frame0.frame.width, 272);
assert.equal(frame1.frame.x, 272);
assert.equal(frame1.frame.width, 272);
assert.notEqual(frame0, frame1, "different animation frames should use different Texture objects");
assert.equal(frame1, frame1Again, "frame textures should be cached instead of recreated every tick");

const originalDocument = globalThis.document;
const originalHTMLCanvasElement = globalThis.HTMLCanvasElement;
const originalConsoleWarn = console.warn;
let cropFailureWarned = false;

class FakeCanvasDrawable {}

try {
  globalThis.HTMLCanvasElement = FakeCanvasDrawable;
  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, "canvas");
      return {
        width: 0,
        height: 0,
        getContext(contextType) {
          assert.equal(contextType, "2d");
          return {
            clearRect() {},
            drawImage() {
              throw new Error("simulated browser crop failure");
            }
          };
        }
      };
    }
  };
  console.warn = () => {
    cropFailureWarned = true;
  };

  const browserTexture = {
    width: 64,
    height: 64,
    source: {
      resource: new FakeCanvasDrawable()
    }
  };
  const emptyFrame = getSpriteSheetFrameTexture(browserTexture, { frame: 0, columns: 1, rows: 1 });
  assert.equal(
    emptyFrame,
    Texture.EMPTY,
    "browser crop exceptions should fail closed to Texture.EMPTY"
  );
  assert.equal(cropFailureWarned, true, "browser crop failure should emit the one-time warning");
} finally {
  console.warn = originalConsoleWarn;
  if (originalDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = originalDocument;
  }
  if (originalHTMLCanvasElement === undefined) {
    delete globalThis.HTMLCanvasElement;
  } else {
    globalThis.HTMLCanvasElement = originalHTMLCanvasElement;
  }
}

console.log("spritesheet frame playback tests passed");
