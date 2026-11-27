import { initialTaskTemplateControlsState, taskTemplateControlsReducer } from "./task-template-controls.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const tpl = (id, name = `t${id}`) => ({ id, name });
const reduce = (actions, state = initialTaskTemplateControlsState) =>
  actions.reduce(taskTemplateControlsReducer, state);

test("upsert moves the template to the top; remove drops it", () => {
  let s = reduce([{ type: "list/loaded", items: [tpl(1), tpl(2), tpl(3)] }]);
  s = taskTemplateControlsReducer(s, { type: "templateUpserted", template: tpl(3, "new") });
  assert.deepEqual(
    s.templates.items.map((x) => x.name),
    ["new", "t1", "t2"],
  );
  s = taskTemplateControlsReducer(s, { type: "templateRemoved", id: 1 });
  assert.deepEqual(
    s.templates.items.map((x) => x.id),
    [3, 2],
  );
});

test("dismissing the overwrite confirmation restores the combobox text", () => {
  const s = reduce([
    { type: "inputValueChanged", value: "t2" },
    { type: "confirmRequested", template: tpl(2) },
    { type: "confirmDismissed", inputValue: "t1" },
  ]);
  assert.deepEqual(s.picker, { inputValue: "t1", pending: null });
});
