import { customToolDialogReducer, initialCustomToolDialogState } from "./custom-tool-dialog.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialCustomToolDialogState) => actions.reduce(customToolDialogReducer, state);

const httpTool = {
  key: "lookup",
  system: false,
  description: "d",
  schema: { type: "object", properties: { q: { type: "string" } } },
  agents: ["main"],
  enabled: false,
  kind: "http",
  exec: { method: "POST", url: "https://x/{q}", headers: { A: "b" }, timeout_ms: 5000, use_recording_proxy: true },
  deferred: true,
};

test("editLoaded fills the form from a tool and clears the test panel", () => {
  const s = reduce([
    { type: "testChanged", patch: { paramsText: "{}" } },
    { type: "testChanged", patch: { result: { output: "x", is_error: false } } },
    { type: "editLoaded", edit: httpTool },
  ]);
  assert.equal(s.form.key, "lookup");
  assert.equal(s.form.kind, "http");
  assert.equal(s.form.ex.method, "POST");
  assert.equal(s.form.ex.headers, JSON.stringify({ A: "b" }, null, 2));
  assert.equal(s.form.ex.timeout_ms, "5000");
  assert.equal(s.form.ex.code, "");
  assert.equal(s.form.ex.use_recording_proxy, true);
  assert.equal(s.form.schemaText, JSON.stringify(httpTool.schema, null, 2));
  assert.deepEqual(s.form.bound, ["main"]);
  assert.equal(s.form.deferred, true);
  assert.equal(s.form.enabled, false);
  assert.deepEqual(s.test, { paramsText: "", result: null });
});

test("editLoaded with an empty schema leaves the schema text empty; 'new' resets to defaults", () => {
  const s = reduce([{ type: "editLoaded", edit: { ...httpTool, schema: {}, exec: undefined, kind: undefined } }]);
  assert.equal(s.form.schemaText, "");
  assert.equal(s.form.kind, "shell");
  assert.equal(s.form.ex.method, "GET");
  const reset = reduce([{ type: "editLoaded", edit: "new" }], s);
  assert.deepEqual(reset.form, initialCustomToolDialogState.form);
});

test("exec fields merge into the current exec; agents toggle on and off", () => {
  const s = reduce([
    { type: "execFieldChanged", patch: { url: "u" } },
    { type: "execFieldChanged", patch: { method: "PUT" } },
    { type: "agentToggled", agent: "a" },
    { type: "agentToggled", agent: "b" },
    { type: "agentToggled", agent: "a" },
  ]);
  assert.equal(s.form.ex.url, "u");
  assert.equal(s.form.ex.method, "PUT");
  assert.deepEqual(s.form.bound, ["b"]);
});
