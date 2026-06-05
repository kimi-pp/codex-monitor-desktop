import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  readResidentAgentRegistryForWorkspace
} from "../electron/providers/codex-resident-agent-registry.ts";

const fixtureRoot = mkdtempSync(path.join(tmpdir(), "codex-resident-agent-registry-"));
try {
  const codexAnimation = path.join(fixtureRoot, "codex_Animation");
  mkdirSync(codexAnimation, { recursive: true });
  const architectId = "11111111-1111-4111-8111-111111111111";
  const assetOwnerId = "22222222-2222-4222-8222-222222222222";
  writeFileSync(
    path.join(codexAnimation, "AGENT.md"),
    [
      `- Handle ID: \`${architectId}\``,
      `- Handle ID: \`${assetOwnerId}\``
    ].join("\n"),
    "utf8"
  );

  const codexRegistry = readResidentAgentRegistryForWorkspace(codexAnimation);
  assert.equal(codexRegistry.hasRegistryFile, true);
  assert.equal(codexRegistry.hasResidentRegistry, true);
  assert.equal(codexRegistry.ids.size, 2);
  assert.ok(codexRegistry.ids.has(architectId));
  assert.ok(codexRegistry.ids.has(assetOwnerId));
  assert.match(codexRegistry.sourcePath ?? "", /AGENT\.md$/);

  const taser = path.join(fixtureRoot, "TASER_CODEX");
  mkdirSync(path.join(taser, "project_memory"), { recursive: true });
  const taserResidentIds = [
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
    "66666666-6666-4666-8666-666666666666",
    "77777777-7777-4777-8777-777777777777",
    "88888888-8888-4888-8888-888888888888"
  ];
  const staleExplorerId = "99999999-9999-4999-8999-999999999999";
  writeFileSync(
    path.join(taser, "project_memory", "AGENT_REGISTRY.md"),
    [
      "| Agent | Session ID | Runtime Status | Role | Current Interpretation |",
      "|---|---|---:|---|---|",
      `| Feynman | \`${taserResidentIds[0]}\` | \`open\` | Statistical audit | Runtime restored. |`,
      `| Chandrasekhar | \`${taserResidentIds[1]}\` | \`open\` | Engineering review | Runtime restored. |`,
      `| Hypatia | \`${taserResidentIds[2]}\` | \`open\` | Literature expert | Runtime restored. |`,
      `| Darwin | \`${taserResidentIds[3]}\` | \`open\` | Biomedical review | Runtime restored. |`,
      `| Kepler | \`${taserResidentIds[4]}\` | runtime_confirmed_on_2026-05-25 | Benchmark specialist | Runtime confirmed. |`,
      `| Curie | \`${taserResidentIds[5]}\` | runtime_created_on_2026-05-25 | Presentation specialist | Runtime created. |`,
      `| Dirac | \`${staleExplorerId}\` | closed | Stale explorer | runtime not_found. |`
    ].join("\n"),
    "utf8"
  );

  const taserRegistry = readResidentAgentRegistryForWorkspace(taser);
  for (const expectedId of taserResidentIds) {
    assert.ok(taserRegistry.ids.has(expectedId), `TASER resident registry should include ${expectedId}`);
  }
  assert.equal(taserRegistry.ids.has(staleExplorerId), false);
  assert.equal(taserRegistry.ids.size, 6, "TASER registry should exclude stale explorer rows");
  assert.match(taserRegistry.sourcePath ?? "", /AGENT_REGISTRY\.md$/);

  const quant = path.join(fixtureRoot, "Quant_trading");
  mkdirSync(path.join(quant, "docs", "superpowers"), { recursive: true });
  writeFileSync(
    path.join(quant, "docs", "superpowers", "agent-registry.md"),
    [
      "| Agent ID | Nickname | Role | Status | Closed | Output / Handoff |",
      "|---|---|---|---|---|---|",
      "| `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` | Meitner | Planning audit | completed | 2026-05-30 | Handoff. |",
      "| `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb` | Cicero | Final review | shutdown | 2026-05-30 | Closed. |"
    ].join("\n"),
    "utf8"
  );

  const quantRegistry = readResidentAgentRegistryForWorkspace(quant);
  assert.equal(quantRegistry.hasRegistryFile, true, "Quant registry file should be detected");
  assert.equal(quantRegistry.hasResidentRegistry, false, "completed Quant workers are not residents");
  assert.equal(quantRegistry.ids.size, 0, "completed Quant registry rows should not become monitored agents");
  assert.match(quantRegistry.sourcePath ?? "", /agent-registry\.md$/);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("codex resident agent registry tests passed");
