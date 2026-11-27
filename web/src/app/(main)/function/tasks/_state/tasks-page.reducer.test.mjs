import { initTasksPageState, tasksPageReducer } from "./tasks-page.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const initial = initTasksPageState(1000);
const reduce = (actions, state = initial) => actions.reduce(tasksPageReducer, state);
const task = (id, extra = {}) => ({ id, status: "done", description: "", goal: "", created_at: "", ...extra });

test("hydration applies only the saved filters it is given and marks hydrated", () => {
  const s = reduce([{ type: "filtersHydrated", status: "running" }]);
  assert.deepEqual(s.filters, { query: "", status: "running", category: "all", hydrated: true });
  const none = reduce([{ type: "filtersHydrated" }]);
  assert.deepEqual(none.filters, { query: "", status: "all", category: "all", hydrated: true });
});

test("loading tasks prunes selections whose task disappeared", () => {
  const s = reduce([
    { type: "tasksLoaded", tasks: [task("1"), task("2"), task("3")] },
    { type: "taskSelectionToggled", id: "1", checked: true },
    { type: "taskSelectionToggled", id: "3", checked: true },
    { type: "tasksLoaded", tasks: [task("1"), task("2")] },
  ]);
  assert.deepEqual([...s.selectedIds], ["1"]);
});

test("category move updates only the moved task, from the latest list", () => {
  const loaded = reduce([
    { type: "tasksLoaded", tasks: [task("1", { category_id: 5, category_name: "Old" }), task("2")] },
  ]);
  const s = tasksPageReducer(loaded, { type: "taskCategoryMoved", taskID: "1", category: { id: 7, name: "New" } });
  assert.equal(s.tasks[1], loaded.tasks[1]);
  assert.equal(s.tasks[0].category_id, 7);
  assert.equal(s.tasks[0].category_name, "New");
  const un = tasksPageReducer(s, { type: "taskCategoryMoved", taskID: "1", category: null });
  assert.equal(un.tasks[0].category_id, undefined);
  assert.equal(un.tasks[0].category_name, undefined);
});
