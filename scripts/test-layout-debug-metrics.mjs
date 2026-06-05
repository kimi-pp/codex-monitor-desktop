import assert from "node:assert/strict";
import {
  LAYOUT_DEBUG_METRICS_ELEMENT_ID,
  publishLayoutDebugMetricsPayload
} from "../src/animation/layout-debug-metrics.ts";

function createFakeDocument() {
  const nodes = new Map();
  const head = {
    appended: [],
    appendChild(node) {
      this.appended.push(node);
      nodes.set(node.id, node);
      return node;
    }
  };

  return {
    head,
    getElementById(id) {
      return nodes.get(id) ?? null;
    },
    createElement(tagName) {
      return {
        id: "",
        tagName: tagName.toUpperCase(),
        type: "",
        textContent: "",
        remove() {
          nodes.delete(this.id);
        }
      };
    }
  };
}

const payload = {
  canvas: { width: 1280, height: 720 },
  agents: [
    {
      agentId: "agent-aurora",
      actionKey: "flatAgentPantryCoffeeSheet",
      currentFrame: 3,
      holdDurationMs: 14_000
    }
  ]
};

const documentRef = createFakeDocument();
const windowRef = {};
Object.preventExtensions(windowRef);

publishLayoutDebugMetricsPayload(payload, {
  enabled: true,
  documentRef,
  windowRef
});

const element = documentRef.getElementById(LAYOUT_DEBUG_METRICS_ELEMENT_ID);
assert.ok(element, "metrics JSON element should be created even when window cannot accept expando properties");
assert.equal(element.type, "application/json");
assert.deepEqual(JSON.parse(element.textContent), payload);

publishLayoutDebugMetricsPayload(payload, {
  enabled: false,
  documentRef,
  windowRef
});

assert.equal(documentRef.getElementById(LAYOUT_DEBUG_METRICS_ELEMENT_ID), null);

console.log("layout debug metrics transport tests passed");
