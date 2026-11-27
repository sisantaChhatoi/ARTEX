import { initialTaskArchivesPanelState as initial, taskArchivesPanelReducer } from "./task-archives-panel.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initial) => actions.reduce(taskArchivesPanelReducer, state);
const archive = (id) => ({ id, task_id: String(id), state: "ready" });

test("the spinner shows until the first load settles", () => {
  assert.equal(initial.list.loaded, false);
  assert.deepEqual(initial.pagination, { page: 1, size: 20, firstPage: 1 });
  const s = reduce([{ type: "list/loaded", items: [archive(1)], total: 7 }, { type: "list/loadFinished" }]);
  assert.equal(s.list.loaded, true);
  assert.equal(s.list.total, 7);
});

test("loading a page prunes selections that are no longer on it", () => {
  const s = reduce([
    { type: "list/loaded", items: [archive(1), archive(2)], total: 2 },
    { type: "archiveSelectionToggled", id: 1, checked: true },
    { type: "archiveSelectionToggled", id: 2, checked: true },
    { type: "list/loaded", items: [archive(2), archive(3)], total: 2 },
  ]);
  assert.deepEqual([...s.selected], [2]);
  const same = taskArchivesPanelReducer(s, { type: "list/loaded", items: [archive(2)], total: 1 });
  assert.equal(same.selected, s.selected);
});
