import { agentTriggersTabReducer, createAgentTriggersTabState } from "./agent-triggers-tab.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = createAgentTriggersTabState()) => actions.reduce(agentTriggersTabReducer, state);

const _trigger = {
  id: 9,
  enabled: false,
  interval_sec: 0,
  on_finding: true,
  on_goal_met: false,
  on_task_timeout: false,
  on_tool_call: true,
  on_task_create: false,
  interval_message: "",
  finding_message: "found",
  goal_message: "",
  task_timeout_message: "",
  tool_call_message: "called",
  task_create_message: "",
  tool_names: null,
};

test("behaviorSynced replaces local edits and is a no-op when unchanged", () => {
  const s = createAgentTriggersTabState();
  assert.equal(agentTriggersTabReducer(s, { type: "behaviorSynced", policy: {} }), s);
  const edited = reduce([{ type: "behaviorChanged", patch: { maxParallel: "12" } }], s);
  assert.equal(reduce([{ type: "behaviorSynced", policy: {} }], edited).behavior.maxParallel, "5");
});
