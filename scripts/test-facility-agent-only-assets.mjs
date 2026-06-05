import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { FLAT_ASSET_MANIFEST } from "../src/animation/flat-assets.ts";

const root = process.cwd();
const summaryPath = join(root, "artifacts", "facility-agent-only-assets-summary.json");
const restroomStyleAuditPath = join(root, "artifacts", "facility-agent-style-audit-restroom.json");

const expectedAssets = [
  "flatAgentPantrySeatACoffeeSheet.png",
  "flatAgentPantrySeatASnackSheet.png",
  "flatAgentPantrySeatADeviceSheet.png",
  "flatAgentPantrySeatADrinkSheet.png",
  "flatAgentPantrySeatBCoffeeSheet.png",
  "flatAgentPantrySeatBSnackSheet.png",
  "flatAgentPantrySeatBDeviceSheet.png",
  "flatAgentPantrySeatBDrinkSheet.png",
  "flatAgentRestroomToiletDeviceSheet.png",
  "flatAgentRestroomToiletMeditateSheet.png"
];

const legacyAssets = [
  "flatAgentPantryCoffeeSheet.png",
  "flatAgentPantrySnackSheet.png",
  "flatAgentPantryDeviceSheet.png",
  "flatAgentPantryDrinkSheet.png",
  "flatAgentRestroomDeviceSheet.png",
  "flatAgentRestroomMeditateSheet.png"
];
const rejectedRestroomStyleHashes = new Set([
  "7b7926481536f9ab5e48fec29fcb50df44dcb2e2e0e3f24a9038d5abbcac5694",
  "9fabecc68befbdb4101a0c936c9c6db8baf134c6f90cd65ebe048b500b20e8c3"
]);
assert.ok(existsSync(summaryPath), "facility Agent-only asset summary should exist");
assert.ok(existsSync(restroomStyleAuditPath), "Cicero restroom style audit report should exist");

const summary = JSON.parse(readJsonText(summaryPath));
const restroomStyleAudit = JSON.parse(readJsonText(restroomStyleAuditPath));
assert.equal(summary.contract, "facility-agent-only-v2");
assert.equal(summary.frameWidth, 272);
assert.equal(summary.frameHeight, 724);
assert.equal(summary.frames, 8);
assert.equal(summary.rows, 1);
assert.equal(summary.fps, 6);

const assetsByName = new Map(summary.assets.map((asset) => [asset.fileName, asset]));
assert.equal(restroomStyleAudit.auditor, "Cicero", "restroom style audit must be owned by Cicero");
assert.equal(restroomStyleAudit.reviewRound, 2, "restroom style audit should reflect the second-round human style rejection");
assert.equal(restroomStyleAudit.pathWiringChecked, true, "restroom style audit should confirm the active renderer asset path was checked");
assert.match(
  restroomStyleAudit.humanFeedback ?? "",
  /style|material|画风|材质/i,
  "restroom style audit should record the human material/style mismatch feedback"
);
assert.ok(
  Array.isArray(restroomStyleAudit.canonicalReferences) &&
    restroomStyleAudit.canonicalReferences.length >= 4 &&
    restroomStyleAudit.canonicalReferences.every((reference) => typeof reference.sha256 === "string" && reference.sha256.length === 64),
  "Cicero audit should include canonical Agent reference hashes"
);
const restroomStyleAuditByName = new Map((restroomStyleAudit.assets ?? []).map((asset) => [asset.fileName, asset]));
const legacyHashes = new Set(legacyAssets.map((fileName) => hashAsset(fileName)));

for (const fileName of expectedAssets) {
  const asset = assetsByName.get(fileName);
  assert.ok(asset, `${fileName} should be included in facility Agent-only summary`);
  assert.equal(asset.agentOnly, true, `${fileName} should be marked as Agent-only`);
  assert.equal(asset.includesSeatOrFurniture, false, `${fileName} should not include chairs, tables, toilets, walls, or floors`);
  if (fileName.startsWith("flatAgentRestroomToilet")) {
    const auditEntry = restroomStyleAuditByName.get(fileName);
    assert.ok(auditEntry, `${fileName} should have a Cicero style audit entry`);
    assert.equal(auditEntry.auditor ?? restroomStyleAudit.auditor, "Cicero", `${fileName} audit entry should be owned by Cicero`);
    assert.equal(auditEntry.assetSha256, asset.sha256, `${fileName} Cicero audit hash should match the final asset summary`);
    assert.equal(auditEntry.styleVerdict, "PASS", `${fileName} should pass Cicero style audit`);
    assert.ok(Array.isArray(auditEntry.failureReasons), `${fileName} audit should include structured style history notes`);
    assert.equal(auditEntry.twoWhiteEyes, true, `${fileName} Cicero audit should confirm two white eyes`);
    assert.equal(auditEntry.frontCameraFacing, true, `${fileName} Cicero audit should confirm front-camera pose`);
    assert.equal(auditEntry.canonicalStyleMatch, true, `${fileName} Cicero audit should confirm canonical Agent style match`);
    assert.equal(auditEntry.bodyProportionMatch, true, `${fileName} Cicero audit should confirm body proportion match`);
    assert.equal(auditEntry.materialMatch, true, `${fileName} Cicero audit should confirm black-material rendering match`);
    assert.equal(auditEntry.silhouetteMatch, true, `${fileName} Cicero audit should confirm silhouette match`);
    assert.equal(auditEntry.ciceroConsistencyStatus, "PASS", `${fileName} Cicero audit should be the source of PASS status`);
    assert.ok(
      !rejectedRestroomStyleHashes.has(asset.sha256),
      `${fileName} should not reuse a restroom sheet rejected by human style review`
    );
    assert.ok(
      typeof auditEntry.replacedFromSha256 === "string" && rejectedRestroomStyleHashes.has(auditEntry.replacedFromSha256),
      `${fileName} audit should record the rejected hash it replaced`
    );
    assert.equal(asset.facingLabel, "frontCamera", `${fileName} should be marked frontCamera for toilet use`);
    assert.equal(asset.agentIdentity?.twoWhiteEyes, true, `${fileName} should record two-eye Agent identity QA`);
    assert.equal(asset.agentIdentity?.frontCameraFacing, true, `${fileName} should record front-camera Agent identity QA`);
  }
  assert.equal(asset.width, 2176, `${fileName} should be 8 x 272 px wide`);
  assert.equal(asset.height, 724, `${fileName} should use the canonical 724 px frame height`);
  assert.equal(asset.colorTypeName, "RGBA", `${fileName} should be RGBA`);
  assert.ok(asset.alphaBbox?.width > 0 && asset.alphaBbox?.height > 0, `${fileName} should have visible alpha`);
  const maxExpectedFrameWidth = fileName.startsWith("flatAgentRestroomToilet") ? 270 : 240;
  assert.ok(asset.maxFrameAlphaBboxWidth <= maxExpectedFrameWidth, `${fileName} per-frame alpha width should stay in Agent-only bounds`);
  assert.ok(asset.maxFrameAlphaBboxHeight <= 470, `${fileName} per-frame alpha height should stay in Agent-only bounds`);
  assert.ok(asset.maxFrameAlphaBboxHeight / asset.maxFrameAlphaBboxWidth <= 2.05, `${fileName} mascot seated silhouette ratio should stay in facility bounds`);
  assert.ok(getUniqueFrameCount(fileName) > 1, `${fileName} should contain motion frames, not one repeated static image`);
  assert.equal(asset.generationMethod, "imagegen", `${fileName} should be generated by imagegen, not programmatic body-sheet derivation`);
  assert.ok(!asset.styleSourceKey, `${fileName} should not declare a body sheet as its generated source`);
  assert.ok(Array.isArray(asset.styleReferenceKeys), `${fileName} should declare visual reference keys separately from generated source`);
  assert.ok(asset.styleReferenceKeys.includes("flatAgentIdleDeskBodySheet"), `${fileName} should reference the latest workstation Agent for visual consistency`);
  assert.ok(typeof asset.promptHash === "string" && asset.promptHash.length === 64, `${fileName} should record a prompt hash for reproducibility`);
  assert.equal(asset.ciceroConsistencyStatus, "PASS", `${fileName} should pass Cicero visual consistency review before becoming final`);
  assert.equal(asset.hipAnchors?.length, 8, `${fileName} should include one hip anchor per frame`);
  assert.ok(!legacyHashes.has(asset.sha256), `${fileName} should not be a byte-for-byte copy of a legacy facility action sheet`);

  const assetKey = fileName.replace(".png", "");
  const spec = FLAT_ASSET_MANIFEST[assetKey];
  assert.ok(spec?.registration, `${assetKey} should have renderer registration metadata`);
  assert.equal(spec.registration.visibleWidth, asset.visibleWidth, `${assetKey} visibleWidth should match asset QA`);
  assert.deepEqual(spec.registration.hipAnchors, asset.hipAnchors, `${assetKey} hip anchors should match asset QA`);
}

console.log("facility Agent-only asset tests passed");

function hashAsset(fileName) {
  const path = join(root, "public", "assets", "generated", "flat", fileName);
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJsonText(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function getUniqueFrameCount(fileName) {
  const path = join(root, "public", "assets", "generated", "flat", fileName);
  const png = readPngRows(path);
  const hashes = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const hash = createHash("sha256");
    for (let y = 0; y < png.rows.length; y += 1) {
      const start = frame * 272 * 4;
      const end = start + 272 * 4;
      hash.update(png.rows[y].subarray(start, end));
    }
    hashes.push(hash.digest("hex"));
  }
  return new Set(hashes).size;
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

  assert.equal(width, 2176, `${path} should be 2176 px wide`);
  assert.equal(height, 724, `${path} should be 724 px tall`);
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

  return { rows };
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
    return pa <= pb && pa <= pc ? left : pb <= pc ? up : pc <= pb ? upLeft : upLeft;
  }
  throw new Error(`Unsupported PNG filter: ${filter}`);
}
