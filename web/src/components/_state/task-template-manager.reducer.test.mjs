import { initialTaskTemplateManagerState, taskTemplateManagerReducer } from "./task-template-manager.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const tpl = (id) => ({ id, name: `t${id}`, description: "d", goal: "g", category_id: 2, intercept_rules: [] });
const reduce = (actions, state = initialTaskTemplateManagerState) => actions.reduce(taskTemplateManagerReducer, state);

test("opening without a seed edits the first template, or a blank one", () => {
  let s = reduce([{ type: "managerOpened", seed: null, templates: [tpl(7), tpl(8)] }]);
  assert.deepEqual([s.editor.selectedID, s.editor.draft.name, s.editor.draft.categoryID], [7, "t7", 2]);
  s = reduce([{ type: "managerOpened", seed: null, templates: [] }]);
  assert.deepEqual([s.editor.selectedID, s.editor.draft.name], [null, ""]);
});

test("deleting moves to another template from the old list and closes the confirmation", () => {
  let s = reduce([
    { type: "templateSelected", template: tpl(1) },
    { type: "deleteOpenChanged", open: true },
    { type: "templateDeleted", id: 1, templates: [tpl(1), tpl(2)] },
  ]);
  assert.deepEqual([s.editor.selectedID, s.deleteOpen], [2, false]);
  s = reduce([{ type: "templateDeleted", id: 1, templates: [tpl(1)] }]);
  assert.equal(s.editor.selectedID, null);
});

test("an update refreshes the draft but keeps the selection", () => {
  const s = reduce([
    { type: "templateSelected", template: tpl(3) },
    { type: "templateUpdated", template: { ...tpl(3), name: "renamed" } },
  ]);
  assert.deepEqual([s.editor.selectedID, s.editor.draft.name], [3, "renamed"]);
});
