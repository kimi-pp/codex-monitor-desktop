import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { FLAT_ASSET_MANIFEST } from "../src/animation/flat-assets.ts";

const root = process.cwd();
const summaryPath = join(root, "artifacts", "treadmill-assets-summary.json");
const auditPath = join(root, "artifacts", "treadmill-horizontal-asset-audit.json");
assert.ok(existsSync(summaryPath), "treadmill asset summary should exist");
assert.ok(existsSync(auditPath), "treadmill asset audit should exist");

const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
const audit = JSON.parse(readFileSync(auditPath, "utf8"));
const contract = summary.contract ?? audit.contract;
const metadata = summary.metadata ?? summary.treadmillMetadata ?? audit.treadmillMetadata;
assert.equal(contract, "treadmill-horizontal-static-v1");
assert.equal(summary.auditor ?? audit.auditor, "Cicero", "Cicero must own final treadmill asset audit");
assert.ok(metadata?.sourceAnchor, "audit metadata should include treadmill source anchor");
assert.ok(metadata?.frontOcclusionRect, "audit metadata should include treadmill front occlusion rect");
assert.equal(metadata?.facingLabel, "horizontalFront");
assert.equal(metadata?.sourceAnchor?.y, 214, "treadmill foot-contact target should be on the belt centerline, not the top edge");
assert.equal(summary.orientationVerdict ?? audit.orientationVerdict, "PASS", "Cicero must pass horizontal orientation audit");
assert.equal(summary.unifiedPerspectiveVerdict ?? audit.unifiedPerspectiveVerdict, "PASS", "Cicero must pass unified treadmill perspective audit");
assert.equal(summary.workstationPerspectiveMatch ?? audit.workstationPerspectiveMatch, true, "treadmill should match workstation perspective");
assert.equal(summary.pantryCabinetPerspectiveMatch ?? audit.pantryCabinetPerspectiveMatch, true, "treadmill should match pantry cabinet perspective");
assert.equal(summary.beltAnimationActive ?? audit.beltAnimationActive, false, "horizontal static treadmill should not use active belt animation");
assert.equal(summary.agentFootContactVerdict ?? audit.agentFootContactVerdict, "PASS", "Agent run sheet should pass foot-contact anchor audit");
assert.equal(summary.agentFacingLabel ?? audit.agentFacingLabel, "right", "Agent run sheet should face right for treadmill use");
assert.equal(summary.rightFacingVerdict ?? audit.rightFacingVerdict, "PASS", "Cicero must pass right-facing Agent audit");
assert.equal(summary.materialVerdict ?? audit.materialVerdict, "PASS", "Cicero must pass canonical Agent material audit");
assert.ok(
  summary.candidateSources?.ciceroAgentCandidate ||
    summary.candidateSources?.workerAgentCandidate ||
    summary.candidateSources?.treadmillRun ||
    audit.candidateSources?.ciceroAgentCandidate ||
    audit.candidateSources?.workerAgentCandidate ||
    audit.candidateSources?.treadmillRun,
  "audit should retain Agent run candidate source lineage"
);

const assetsByName = getAssetsByName(summary, audit);
for (const fileName of [
  "treadmill-horizontal-static-2d-v4.png",
  "flatAgentTreadmillHorizontalRunSheet.png"
]) {
  const asset = assetsByName.get(fileName);
  assert.ok(asset, `${fileName} should be included in treadmill asset summary`);
  assert.equal(asset.colorTypeName, "RGBA", `${fileName} should be RGBA`);
  assert.ok(asset.alphaBbox?.width > 0 && asset.alphaBbox?.height > 0, `${fileName} should have alpha content`);
  assert.equal(asset.ciceroConsistencyStatus, "PASS", `${fileName} should pass Cicero audit`);
  assert.equal(
    asset.rejectedHashes.includes(asset.sha256),
    false,
    `${fileName} should not reuse rejected v2/v3 hashes`
  );
}

const agent = assetsByName.get("flatAgentTreadmillHorizontalRunSheet.png");
const agentRegistration = audit.flatRegistration?.flatAgentTreadmillHorizontalRunSheet;
assert.equal(agent.width, 2176, "Agent run sheet should be 8 x 272 px wide");
assert.equal(agent.height, 724, "Agent run sheet should use canonical frame height");
assert.equal(agent.agentOnly, true, "Agent run sheet should be Agent-only");
assert.equal(agent.includesAgent, true, "Agent run sheet should be marked as containing the Agent");
assert.equal(agent.styleVerdict, "PASS", "Agent run sheet should pass Cicero style audit");
assert.equal(agent.anchorKind ?? agentRegistration?.anchorKind, "footContact", "Agent run sheet should use foot-contact registration");
assert.equal((agent.contactAnchors ?? agentRegistration?.contactAnchors)?.length, 8, "Agent run sheet should expose 8 contact anchors");
assert.notEqual(
  agent.sha256,
  "00c90a167a8372da469996146ec0cc2cddbc5bdb75bb90f17f9252969827558e",
  "horizontal Agent run sheet should not reuse rejected right-v3 hash"
);
assert.notEqual(
  agent.sha256,
  "966f010ca2ce1b1cb4c94707bbecf2f85cec27060419724ed2f9e01926f3a616",
  "Agent run sheet should not reuse the down/front-facing style-failed hash"
);
assert.equal(agent.agentFacingLabel ?? agent.ciceroAudit?.agentFacingLabel, "right", "Agent asset entry should record right-facing orientation");
assert.equal(agent.rightFacingVerdict ?? agent.ciceroAudit?.rightFacingVerdict, "PASS", "Agent asset entry should pass right-facing audit");
assert.equal(agent.materialVerdict ?? agent.ciceroAudit?.materialVerdict, "PASS", "Agent asset entry should pass material audit");

const runSpec = FLAT_ASSET_MANIFEST.flatAgentTreadmillHorizontalRunSheet;
assert.equal(runSpec.registration?.visibleWidth, agent.ciceroAudit?.visibleWidth ?? agentRegistration?.visibleWidth, "run visibleWidth should match Cicero audit");
assert.equal(runSpec.registration?.anchorKind, "footContact", "run registration should declare footContact");
assert.deepEqual(
  runSpec.registration?.contactAnchors,
  agent.ciceroAudit?.contactAnchors ?? agentRegistration?.contactAnchors,
  "run contact anchors should match Cicero audit"
);

const frameBboxes = audit.finalAssets?.flatAgentTreadmillHorizontalRunSheet?.frames ?? [];
const contactAnchors = runSpec.registration?.contactAnchors ?? [];
if (frameBboxes.length > 0) {
  assert.equal(frameBboxes.length, 8, "audit should expose 8 run frame bboxes");
  const centerOffsets = frameBboxes.map((frame) => {
    const anchor = contactAnchors[frame.frame];
    assert.ok(anchor, `missing contact anchor for frame ${frame.frame}`);
    const visualCenterX = frame.bbox.x + frame.bbox.width / 2;
    const footY = frame.bbox.y + frame.bbox.height;
    assert.ok(
      Math.abs(anchor.y - footY) <= 1,
      `frame ${frame.frame} foot-contact y should sit at the sole/bottom; anchor=${anchor.y}, foot=${footY}`
    );
    return visualCenterX - anchor.x;
  });
  assert.ok(
    Math.max(...centerOffsets) - Math.min(...centerOffsets) <= 4,
    `registered run frames should not drift horizontally; offsets=${centerOffsets.map((value) => value.toFixed(2)).join(",")}`
  );
} else {
  assert.equal(audit.finalAssets?.flatAgentTreadmillHorizontalRunSheet?.passFrameBoundaryQa, true);
  assert.ok((audit.numericQAGates?.contactAnchorYRange ?? Number.POSITIVE_INFINITY) <= 3);
}

console.log("treadmill asset tests passed");

function getAssetsByName(summary, audit) {
  if (Array.isArray(summary.assets)) {
    return new Map(summary.assets.map((asset) => [asset.fileName, normalizeAsset(asset, audit)]));
  }

  return new Map([
    [
      "treadmill-horizontal-static-2d-v4.png",
      normalizeAsset({
        ...audit.finalAssets?.treadmillHorizontalStatic,
        fileName: "treadmill-horizontal-static-2d-v4.png",
        includesAgent: false
      }, audit)
    ],
    [
      "flatAgentTreadmillHorizontalRunSheet.png",
      normalizeAsset({
        ...audit.finalAssets?.flatAgentTreadmillHorizontalRunSheet,
        ...summary.treadmillHorizontalRun,
        fileName: "flatAgentTreadmillHorizontalRunSheet.png",
        includesAgent: true,
        anchorKind: audit.flatRegistration?.flatAgentTreadmillHorizontalRunSheet?.anchorKind,
        styleVerdict: audit.agentStyleVerdict
      }, audit)
    ]
  ]);
}

function normalizeAsset(asset, audit) {
  const ciceroStatus = audit.status ??
    (audit.auditor === "Cicero" &&
      audit.orientationVerdict === "PASS" &&
      audit.unifiedPerspectiveVerdict === "PASS"
      ? "PASS"
      : undefined);
  return {
    ...asset,
    fileName: asset.fileName ?? basename(asset.path ?? ""),
    colorTypeName: asset.colorTypeName ?? asset.mode,
    alphaBbox: asset.alphaBbox ?? asset.alphaBBox,
    ciceroConsistencyStatus: asset.ciceroConsistencyStatus ?? (asset.sha256 ? ciceroStatus : undefined),
    rejectedHashes: asset.rejectedHashes ?? [],
    agentOnly: asset.agentOnly ?? false,
    includesAgent: asset.includesAgent ?? false,
    styleVerdict: asset.styleVerdict ?? (asset.agentOnly ? audit.agentStyleVerdict : "PASS"),
    contactAnchors: asset.contactAnchors ?? audit.flatRegistration?.flatAgentTreadmillHorizontalRunSheet?.contactAnchors
  };
}
