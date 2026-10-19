import test from "node:test";
import assert from "node:assert/strict";
import { buildCommands, filterCommands, fuzzyMatch, registerCommandProvider } from "../src/lib/commands.js";

test("fuzzyMatch: subsequence matches, non-subsequence does not", () => {
  assert.ok(fuzzyMatch("app", "src/App.js"));
  assert.ok(fuzzyMatch("sap", "src/App.js"));
  assert.equal(fuzzyMatch("xyz", "src/App.js"), null);
  assert.deepEqual(fuzzyMatch("", "anything"), { score: 0, indexes: [] });
});

test("fuzzyMatch: exact substring and word starts outrank scattered letters", () => {
  assert.ok(fuzzyMatch("app", "App.js").score > fuzzyMatch("app", "a_p_p.js").score);
  assert.ok(fuzzyMatch("ind", "index.js").score > fuzzyMatch("ind", "wind.js").score);
});

test("fuzzyMatch: indexes point at the matched characters", () => {
  assert.deepEqual(fuzzyMatch("aj", "App.js").indexes, [0, 4]);
});

const sample = [
  { id: "1", title: "Simpan semua file", group: "Aksi" },
  { id: "2", title: "App.js", subtitle: "src", group: "File" },
  { id: "3", title: "index.js", subtitle: "src", group: "File", keywords: "src/index.js" },
];

test("filterCommands: empty query keeps provider order", () => {
  assert.deepEqual(filterCommands(sample, "").map((r) => r.command.id), ["1", "2", "3"]);
});

test("filterCommands: ranks best title first and drops non-matches", () => {
  assert.equal(filterCommands(sample, "app")[0].command.id, "2");
  assert.equal(filterCommands(sample, "zzzz").length, 0);
});

test("filterCommands: falls back to subtitle/keywords/group, honours limit", () => {
  assert.equal(filterCommands(sample, "aksi")[0].command.id, "1");
  assert.equal(filterCommands(sample, "js", 1).length, 1);
});

test("buildCommands: disabled and duplicate ids are removed", () => {
  const ctx = { active: "", files: ["a.js", "a.js"], save() {}, createFile() {}, renameFile() {}, deleteFile() {}, importFolder() {} };
  const ids = buildCommands(ctx).map((c) => c.id);
  assert.ok(!ids.includes("action:rename"), "rename needs an active file");
  assert.ok(!ids.includes("action:delete"));
  assert.equal(ids.filter((id) => id === "file:a.js").length, 1);
});

test("buildCommands: run() reaches the context, custom providers can be added and removed", () => {
  const calls = [];
  const ctx = { active: "src/App.js", files: ["src/App.js"], save: () => calls.push("save"), openFile: (p) => calls.push("open:" + p) };
  const unregister = registerCommandProvider(() => [{ id: "custom:x", title: "Custom", group: "Test", run: () => calls.push("custom") }]);
  const cmds = buildCommands(ctx);
  cmds.find((c) => c.id === "action:save").run();
  cmds.find((c) => c.id === "file:src/App.js").run();
  cmds.find((c) => c.id === "custom:x").run();
  assert.deepEqual(calls, ["save", "open:src/App.js", "custom"]);
  unregister();
  assert.ok(!buildCommands(ctx).some((c) => c.id === "custom:x"));
});

test("buildCommands: a throwing provider does not break the others", () => {
  const unregister = registerCommandProvider(() => { throw new Error("boom"); });
  const origError = console.error; console.error = () => {};
  try { assert.ok(buildCommands({ active: "", files: [] }).length > 0); } finally { console.error = origError; unregister(); }
});
