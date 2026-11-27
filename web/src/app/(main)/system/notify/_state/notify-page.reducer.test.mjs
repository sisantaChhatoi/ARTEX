import { initNotifyPageState, notifyPageReducer } from "./notify-page.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const form = (kind) => ({
  name: "",
  kind,
  mode: "realtime",
  enabled: true,
  ratePerMin: "",
  config: {},
  minSeverity: "",
  includeText: "",
  excludeText: "",
  taskIDsText: "",
  assetIDsText: "",
  onStatusChange: false,
});
const initial = initNotifyPageState(form("dingtalk"));
const reduce = (actions, state = initial) => actions.reduce(notifyPageReducer, state);

const meta = { enabled: false, public_base_url: "https://x", digest_interval_min: "15", kinds: [], stats: {} };

test("meta load refills the URL and digest inputs", () => {
  const s = reduce([
    { type: "globalsChanged", patch: { baseURL: "typed", summaryMax: "9" } },
    { type: "metaLoaded", meta },
  ]);
  assert.equal(s.meta, meta);
  assert.deepEqual(s.globals, { baseURL: "https://x", digestMin: "15", summaryMax: "9", assetsMax: "" });
});

test("push toggle updates meta only once it is loaded", () => {
  assert.equal(notifyPageReducer(initial, { type: "pushToggled", enabled: true }), initial);
  const s = reduce([
    { type: "metaLoaded", meta },
    { type: "pushToggled", enabled: true },
  ]);
  assert.equal(s.meta.enabled, true);
});

test("config fields merge into the form config", () => {
  const s = reduce([
    { type: "formConfigChanged", key: "a", value: 1 },
    { type: "formConfigChanged", key: "b", value: true },
  ]);
  assert.deepEqual(s.editor.form.config, { a: 1, b: true });
});
