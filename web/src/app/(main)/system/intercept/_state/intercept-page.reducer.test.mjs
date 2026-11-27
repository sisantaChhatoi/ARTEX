import { initialInterceptPageState, interceptPageReducer } from "./intercept-page.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialInterceptPageState) => actions.reduce(interceptPageReducer, state);

const _rule = {
  id: 7,
  name: "no rm",
  enabled: true,
  priority: 5,
  match_target: "tool_input",
  match_type: "regex",
  pattern: "rm -rf",
  action: "ask",
  message: "careful",
  timeout_enabled: false,
  timeout_seconds: 30,
  timeout_action: "allow",
  created_at: "x",
};

test("saving the scope updates the info bar and closes the dialog", () => {
  const s = reduce([
    { type: "scopeOpenChanged", open: true },
    { type: "scopeSaved", tools: ["Bash"] },
  ]);
  assert.deepEqual(s.scopeTools, ["Bash"]);
  assert.equal(s.scope.open, false);
});
