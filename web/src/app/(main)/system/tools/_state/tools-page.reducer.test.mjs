import { initialToolsPageState, toolsPageReducer } from "./tools-page.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialToolsPageState) => actions.reduce(toolsPageReducer, state);

test("opening a system tool selects it; a custom tool opens its full editor", () => {
  const sys = { key: "bash", system: true };
  const custom = { key: "mine", system: false };
  const s = reduce([{ type: "toolOpened", tool: sys }]);
  assert.deepEqual(s.editing, { selectedKey: "bash", customEdit: null });
  const c = reduce([{ type: "toolOpened", tool: custom }]);
  assert.deepEqual(c.editing, { selectedKey: null, customEdit: custom });
  assert.equal(reduce([{ type: "customToolCreateStarted" }]).editing.customEdit, "new");
});
