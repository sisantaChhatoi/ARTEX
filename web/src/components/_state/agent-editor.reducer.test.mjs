import { agentEditorReducer, initialAgentEditorState } from "./agent-editor.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialAgentEditorState) => actions.reduce(agentEditorReducer, state);

const v1 = { version: 1, template_text: "old", note: "", ts: "" };
const v2 = { version: 2, template_text: "new", note: "", ts: "" };

test("agentLoaded fills form, defaults and visibility, falling back on missing fields", () => {
  const s = reduce([
    { type: "formFieldChanged", patch: { prompt: "unsaved" } },
    {
      type: "agentLoaded",
      detail: {
        prompt: "hello",
        agent: { max_turns: 7, llm_profile_id: 3, web_search: true },
        versions: null,
        variables: null,
        visibility: { mcp: [1], skill: null },
        wrapup_max_turns: 2,
        task_timeout_wrapup_supported: true,
      },
    },
  ]);
  assert.equal(s.form.prompt, "hello");
  assert.equal(s.form.maxTurns, "7");
  assert.equal(s.form.runSecs, "600");
  assert.equal(s.form.llmProfileId, "3");
  assert.equal(s.form.webSearch, true);
  assert.equal(s.form.interactiveShell, false);
  assert.equal(s.form.wrapupTurns, "2");
  assert.equal(s.form.ttTurns, "0");
  assert.deepEqual(s.agent.versions, []);
  assert.deepEqual(s.visibility, { mcp: [1], skill: [] });
  assert.deepEqual(s.defaults, { wrapup: "", wrapupTurns: 5, ttSupported: true, ttWrapup: "", ttTurns: 5 });
  assert.equal(s.agent.loaded, false);
  assert.equal(reduce([{ type: "agentLoadFinished" }], s).agent.loaded, true);
});

test("viewed version can be compared or loaded into the editor", () => {
  const viewing = reduce([
    { type: "versionDialogsChanged", patch: { viewing: v1 } },
    { type: "versionDialogsChanged", patch: { diffing: v2 } },
  ]);
  const compared = reduce([{ type: "viewedVersionCompared" }], viewing);
  assert.deepEqual(compared.versionDialogs, { viewing: null, diffing: v1 });
  const loaded = reduce([{ type: "viewedVersionLoaded" }], viewing);
  assert.equal(loaded.form.prompt, "old");
  assert.deepEqual(loaded.versionDialogs, { viewing: null, diffing: v2 });
});
