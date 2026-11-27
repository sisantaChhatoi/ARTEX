import { assetsTabReducer, initialAssetsTabState } from "./assets-tab.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialAssetsTabState) => actions.reduce(assetsTabReducer, state);

test("tab change returns to the first page and clears the search and its error", () => {
  const s = reduce([
    { type: "queryChanged", query: "host=x" },
    { type: "pagination/pageChanged", page: 3 },
    { type: "searchFailed", error: "bad dsl" },
    { type: "tabChanged", tab: "ip" },
  ]);
  assert.equal(s.filters.query, "");
  assert.equal(s.pagination.page, 0);
  assert.equal(s.listMeta.dslError, "");
});

test("load cycle fills rows and counts; a failed search empties the rows", () => {
  const loaded = reduce([
    { type: "list/loadStarted" },
    { type: "assetsLoaded", rows: [{ id: 1 }], total: 7, counts: { ip: 7 } },
    { type: "list/loadFinished" },
  ]);
  assert.deepEqual(loaded.list, { items: [{ id: 1 }], total: 7, loading: false, loaded: true });
  assert.deepEqual(loaded.listMeta.counts, { ip: 7 });
  const failed = reduce([{ type: "searchFailed", error: "boom" }], loaded);
  assert.deepEqual(failed.list.items, []);
  assert.equal(failed.list.total, 0);
  assert.equal(failed.listMeta.dslError, "boom");
  assert.deepEqual(failed.listMeta.counts, { ip: 7 });
});
