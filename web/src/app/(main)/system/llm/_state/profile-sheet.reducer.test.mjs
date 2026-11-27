import { createProfileSheetState, profileSheetReducer } from "./profile-sheet.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const form = {
  name: "",
  format: "anthropic",
  model: "",
  baseUrl: "",
  proxy: "",
  apiKey: "",
  rps: "0",
  rpm: "0",
  cw: "0",
  thinkingType: "none",
  effort: "none",
  priority: "0",
  poolExclude: false,
  streaming: true,
  maxTokens: "0",
  maxTokensField: "none",
  sessionHeaderKey: "",
  userAgent: "",
  customHeaders: "",
  clearCustomHeaders: false,
  retry: {},
};
const initial = createProfileSheetState(form, "");
const reduce = (actions, state = initial) => actions.reduce(profileSheetReducer, state);

test("custom headers: typing cancels clear; ticking clear empties the typed headers", () => {
  const cleared = reduce([
    { type: "customHeadersChanged", customHeaders: "A: b" },
    { type: "clearCustomHeadersChanged", clear: true },
  ]);
  assert.equal(cleared.form.customHeaders, "");
  assert.equal(cleared.form.clearCustomHeaders, true);
  const typed = reduce([{ type: "customHeadersChanged", customHeaders: "C: d" }], cleared);
  assert.equal(typed.form.clearCustomHeaders, false);
  const unticked = reduce(
    [
      { type: "customHeadersChanged", customHeaders: "E: f" },
      { type: "clearCustomHeadersChanged", clear: false },
    ],
    cleared,
  );
  assert.equal(unticked.form.customHeaders, "E: f");
});

test("model picker: loading clears the list and filter, closing clears the filter, picking sets the model", () => {
  const loaded = reduce([
    { type: "modelsLoadStarted" },
    { type: "modelsLoaded", models: ["a", "b"] },
    { type: "request/finished", key: "models" },
    { type: "modelQueryChanged", query: "a" },
  ]);
  assert.deepEqual(loaded.models, { items: ["a", "b"], open: true, query: "a" });
  assert.equal(loaded.requests.models.pending, false);
  const restarted = reduce([{ type: "modelsLoadStarted" }], loaded);
  assert.deepEqual(restarted.models.items, []);
  assert.equal(restarted.models.query, "");
  assert.equal(restarted.requests.models.pending, true);
  assert.equal(reduce([{ type: "modelsOpenChanged", open: false }], loaded).models.query, "");
  assert.equal(reduce([{ type: "modelsOpenChanged", open: true }], loaded).models.query, "a");
  const picked = reduce([{ type: "modelPicked", model: "b" }], loaded);
  assert.equal(picked.form.model, "b");
  assert.equal(picked.models.open, false);
});

test("opened replaces the form and drops the model list but keeps in-flight requests", () => {
  const busy = reduce([
    { type: "request/started", key: "save" },
    { type: "modelsLoaded", models: ["x"] },
    { type: "formFieldChanged", patch: { name: "old" } },
  ]);
  const s = reduce([{ type: "opened", form: { ...form, name: "new" }, keyHint: "sk-…1234" }], busy);
  assert.equal(s.form.name, "new");
  assert.equal(s.keyHint, "sk-…1234");
  assert.deepEqual(s.models, { items: [], open: false, query: "" });
  assert.equal(s.requests.save.pending, true);
});
