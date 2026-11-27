import { initialSystemSettingsPageState, systemSettingsPageReducer } from "./system-settings-page.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialSystemSettingsPageState) => actions.reduce(systemSettingsPageReducer, state);

const settings = {
  traffic_capture: true,
  agent_traffic_binding: false,
  web_search_enabled: true,
  web_search_backend: "tavily",
  brave_key_set: false,
  tavily_key_set: true,
  keenable_key_set: false,
  web_search_proxy: "http://proxy:8080",
  global_proxy: "",
  workers: 5,
  constraints_inject_planner: false,
};

test("settingsLoaded keeps typed keys and returns the same state when nothing changed", () => {
  const typed = reduce([
    { type: "settingsLoaded", settings },
    { type: "apiKeyInputChanged", provider: "brave", input: "secret" },
  ]);
  const again = systemSettingsPageReducer(typed, { type: "settingsLoaded", settings });
  assert.equal(again, typed);
  assert.equal(again.apiKeys.brave.input, "secret");
});

test("apiKeySaved applies settings and clears only that provider's input", () => {
  const s = reduce([
    { type: "apiKeyInputChanged", provider: "brave", input: "b" },
    { type: "apiKeyInputChanged", provider: "keenable", input: "k" },
    { type: "apiKeySaved", provider: "brave", settings: { ...settings, brave_key_set: true } },
  ]);
  assert.deepEqual(s.apiKeys.brave, { set: true, input: "" });
  assert.equal(s.apiKeys.keenable.input, "k");
  assert.equal(s.switches.trafficCapture, true);
});
