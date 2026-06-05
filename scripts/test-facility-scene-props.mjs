import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FACILITY_RECTS_SOURCE,
  FACILITY_SCENE_PROP_Z_INDEX,
  GENERATED_ASSETS,
  OFFICE_BACKGROUND_SOURCE,
  PANTRY_COUNTERTOP_SURFACE_SOURCE,
  PANTRY_LAYER_RECTS_SOURCE,
  RESTROOM_PRIVACY_LAYER_RECTS_SOURCE,
  WORKSTATION_DESKTOP_SURFACE_SOURCE
} from "../src/animation/scene-config.ts";

assert.ok(
  FACILITY_SCENE_PROP_Z_INDEX.pantryCounterFridge < FACILITY_SCENE_PROP_Z_INDEX.pantryTableChairsBack,
  "pantry counter/fridge must render behind table/chairs back"
);
assert.ok(
  FACILITY_SCENE_PROP_Z_INDEX.restroomPrivacyBack < FACILITY_SCENE_PROP_Z_INDEX.pantryTableChairsBack,
  "enlarged restroom privacy layer must render below pantry table/chairs so overlap cannot visually occlude them"
);
assert.ok(
  FACILITY_SCENE_PROP_Z_INDEX.restroomPrivacyBack < FACILITY_SCENE_PROP_Z_INDEX.restroomToiletBack,
  "restroom privacy wall/floor layer must render behind the toilet back layer"
);
assert.ok(
  FACILITY_SCENE_PROP_Z_INDEX.pantryTableChairsBack < FACILITY_SCENE_PROP_Z_INDEX.treadmillStatic,
  "scene prop z-order should remain explicit across generated props"
);
assert.equal(GENERATED_ASSETS.pantryCounterFridge, "./assets/generated/pantry-counter-fridge-2d-v2.png");
assert.equal(
  GENERATED_ASSETS.restroomPrivacyBack,
  "./assets/generated/restroom-privacy-back-2d-v1.png",
  "restroom should restore the previous approved wall/floor texture"
);
assert.equal("pantryBarCounter" in GENERATED_ASSETS, false, "pantry should not reference generated replacement bar assets");
assert.equal("pantryAppliances" in GENERATED_ASSETS, false, "pantry should not reference generated replacement appliance assets");
assert.ok(PANTRY_LAYER_RECTS_SOURCE.counterFridge.width > 300, "original pantry counter/fridge texture should be scaled up");
assert.ok(PANTRY_LAYER_RECTS_SOURCE.tableChairs.width > 220, "pantry table/chairs should follow the same overall scale");
assert.ok(
  PANTRY_COUNTERTOP_SURFACE_SOURCE.width >= WORKSTATION_DESKTOP_SURFACE_SOURCE.width * 2,
  "pantry bar countertop surface should be at least two workstation desktop surfaces wide"
);
assert.ok(
  Math.abs(PANTRY_COUNTERTOP_SURFACE_SOURCE.depth - WORKSTATION_DESKTOP_SURFACE_SOURCE.depth) <= 0.01,
  "pantry bar countertop surface depth should match workstation desktop surface depth"
);
assert.ok(
  PANTRY_COUNTERTOP_SURFACE_SOURCE.width <= PANTRY_LAYER_RECTS_SOURCE.counterFridge.width,
  "pantry countertop surface should be measured inside the original counter/fridge layer"
);
assert.ok(
  RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.width > FACILITY_RECTS_SOURCE.restroom.width,
  "restroom privacy wall/floor layer should scale independently larger than the toilet layer"
);
assert.equal(
  RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.width,
  300,
  "restroom privacy layer should use the doubled enlarged source width"
);
assert.equal(
  RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.x,
  -25,
  "restroom privacy layer should stay left enough to avoid pantry overlap while remaining visually attached to the toilet"
);
assert.equal(
  RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.y,
  716,
  "restroom privacy layer should move upward so the visible alpha stays inside the office canvas"
);

const root = process.cwd();
const restroomPrivacyAssetPath = join(root, "public", GENERATED_ASSETS.restroomPrivacyBack.replace(/^\//, ""));
const restroomPrivacyAuditPath = join(root, "artifacts", "restroom-privacy-back-asset-audit.json");
assert.ok(existsSync(restroomPrivacyAssetPath), "restroom privacy back asset should exist");
assert.ok(existsSync(restroomPrivacyAuditPath), "restroom privacy back asset audit should exist");

const restroomPrivacyAudit = JSON.parse(readFileSync(restroomPrivacyAuditPath, "utf8"));
assert.equal(restroomPrivacyAudit.auditor, "Cicero", "restroom privacy asset audit must preserve Cicero ownership for the image asset");
assert.equal(restroomPrivacyAudit.generationMethod, "imagegen", "restroom privacy image asset must remain imagegen-generated");
assert.equal(restroomPrivacyAudit.finalPath, "D:/codex_Animation/public/assets/generated/restroom-privacy-back-2d-v1.png");
assert.equal(restroomPrivacyAudit.width, 1122, "restroom privacy asset should match RESTROOM_ROOM_SOURCE width");
assert.equal(restroomPrivacyAudit.height, 1402, "restroom privacy asset should match RESTROOM_ROOM_SOURCE height");
assert.equal(restroomPrivacyAudit.transparentRgbaVerdict, "PASS", "restroom privacy asset should pass transparency QA");
assert.equal(restroomPrivacyAudit.privacyLayerVerdict, "PASS", "restroom privacy asset should pass privacy layer QA");
assert.equal(restroomPrivacyAudit.noToiletNoAgentVerdict, "PASS", "restroom privacy asset should not bake in toilet or Agent");
assert.equal(restroomPrivacyAudit.orientationVerdict, "PASS", "restroom privacy asset should pass orientation QA");
assert.equal(restroomPrivacyAudit.footprintVerdict, "PASS", "restroom privacy asset should pass footprint/size QA");
assert.equal(restroomPrivacyAudit.readyForManifest, true, "restroom privacy asset should be ready for manifest use");
assert.equal(
  restroomPrivacyAudit.activeRendererScaleContract?.mode,
  "restore-v1-scale-up",
  "audit should record that the active fix restores v1 and scales it in renderer"
);
assert.equal(
  restroomPrivacyAudit.activeRendererScaleContract?.sourceRect?.width,
  RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.width,
  "audit should record the active enlarged renderer rect"
);

const projectedPrivacyAlphaBbox = {
  x: RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.x +
    (restroomPrivacyAudit.alphaBbox.x / restroomPrivacyAudit.width) * RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.width,
  y: RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.y +
    (restroomPrivacyAudit.alphaBbox.y / restroomPrivacyAudit.width) * RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.width,
  width: (restroomPrivacyAudit.alphaBbox.width / restroomPrivacyAudit.width) * RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.width,
  height: (restroomPrivacyAudit.alphaBbox.height / restroomPrivacyAudit.width) * RESTROOM_PRIVACY_LAYER_RECTS_SOURCE.width
};
const pantryTable = {
  ...PANTRY_LAYER_RECTS_SOURCE.tableChairs,
  height: PANTRY_LAYER_RECTS_SOURCE.tableChairs.width * (1024 / 1536)
};
const alphaOverlapsPantryTable =
  Math.max(0, Math.min(projectedPrivacyAlphaBbox.x + projectedPrivacyAlphaBbox.width, pantryTable.x + pantryTable.width) -
    Math.max(projectedPrivacyAlphaBbox.x, pantryTable.x)) > 0 &&
  Math.max(0, Math.min(projectedPrivacyAlphaBbox.y + projectedPrivacyAlphaBbox.height, pantryTable.y + pantryTable.height) -
    Math.max(projectedPrivacyAlphaBbox.y, pantryTable.y)) > 0;
assert.equal(alphaOverlapsPantryTable, true, "doubled privacy layer is expected to spatially overlap the pantry edge after moving up");
assert.ok(
  projectedPrivacyAlphaBbox.x >= 0,
  `enlarged restroom privacy alpha bbox should stay inside the left canvas edge; x=${projectedPrivacyAlphaBbox.x}`
);
assert.ok(
  projectedPrivacyAlphaBbox.y + projectedPrivacyAlphaBbox.height <= OFFICE_BACKGROUND_SOURCE.height,
  `enlarged restroom privacy alpha bbox should stay inside the bottom canvas edge; bottom=${projectedPrivacyAlphaBbox.y + projectedPrivacyAlphaBbox.height}`
);

console.log("facility scene prop z-order tests passed");
