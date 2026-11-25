import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homedir } from "node:os";

const dir = await mkdtemp(join(tmpdir(), "skillsentinel-test-"));
process.env.SKILLSENTINEL_DATA_DIR = dir;
const core = await import("../src/core.js");

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("token math ignores invalid values and cache (already part of input)", () => {
  assert.equal(core.tokensFromUsage({ input: 100, output: 20, reasoning: 5, cache: { read: 80, write: 10 } }), 125);
  assert.equal(core.tokensFromUsage({ input: "100", output: null }), 0);
  assert.equal(core.tokensFromUsage(undefined), 0);
});

test("injected tokens come from skill body length", () => {
  assert.equal(core.injectedTokens("a".repeat(400)), 100);
  assert.equal(core.injectedTokens(undefined), 0);
});

test("scope is user, project, or plugin", () => {
  const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  assert.equal(core.classifyScope(join(config, "opencode", "skills", "report", "SKILL.md"), "/work/project"), "user");
  assert.equal(core.classifyScope(join(homedir(), ".agents", "skills", "find-skills", "SKILL.md"), "/work/project"), "user");
  assert.equal(core.classifyScope("/work/project/.opencode/skills/local/SKILL.md", "/work/project"), "project");
  assert.equal(core.classifyScope("/some/node_modules/skills/remote/SKILL.md", "/work/project"), "plugin");
  assert.equal(core.classifyScope("", "/work/project"), "unknown");
});

test("formatters are compact and readable", () => {
  assert.equal(core.formatTokens(0), "0");
  assert.equal(core.formatTokens(999), "999");
  assert.equal(core.formatTokens(1234), "1.2k");
  assert.equal(core.formatDelta(1200), "+1.2k");
  assert.equal(core.formatDelta(-1200), "-1.2k");
  assert.equal(core.formatDelta(0), "±0");
});

test("timeline appends, reads newest first, filters, and prunes", async () => {
  const now = Date.now();
  await core.appendRecord({ at: now, skill: "report", sessionID: "s1", project: "/work/alpha", injectedTokens: 100 });
  await core.appendRecord({ at: now - 2_000, skill: "omarchy", sessionID: "s2", project: "/work/beta", injectedTokens: 200 });
  await core.appendRecord({ at: now - 10 * 86_400_000, skill: "old", sessionID: "s3", project: "/work/alpha", injectedTokens: 300 });

  const all = await core.readRecords();
  assert.equal(all.length, 3);
  assert.equal(all[0].skill, "report");

  const alpha = await core.readRecords({ project: "/work/alpha" });
  assert.deepEqual(alpha.map((row) => row.skill), ["report", "old"]);

  const recent = await core.readRecords({ since: 1 });
  assert.deepEqual(recent.map((row) => row.skill), ["report", "omarchy"]);

  const kept = await core.prune({ days: 1 });
  assert.equal(kept, 2);
  assert.equal((await core.readRecords()).length, 2);
});
