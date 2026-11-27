import { broadcastTabReducer, initialBroadcastTabState } from "./broadcast-tab.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialBroadcastTabState) => actions.reduce(broadcastTabReducer, state);

test("previous/next page stay within 1..pageCount", () => {
  assert.equal(reduce([{ type: "previousPage" }]).pagination.page, 1);
  const s = reduce([
    { type: "nextPage", pageCount: 2 },
    { type: "nextPage", pageCount: 2 },
  ]);
  assert.equal(s.pagination.page, 2);
  assert.equal(reduce([{ type: "previousPage" }], s).pagination.page, 1);
});

test("page is clamped only when past the last page", () => {
  const s = reduce([{ type: "pagination/pageChanged", page: 5 }]);
  assert.equal(reduce([{ type: "pageClamped", pageCount: 6 }], s), s);
  assert.equal(reduce([{ type: "pageClamped", pageCount: 3 }], s).pagination.page, 3);
});

test("back to live resets order, page and the unread count", () => {
  const s = reduce([
    { type: "orderToggled" },
    { type: "pagination/pageChanged", page: 2 },
    { type: "feedLoaded", total: 30, content: null, freshIDs: null, pending: 4 },
    { type: "backToLive" },
  ]);
  assert.equal(s.filters.order, "desc");
  assert.equal(s.pagination.page, 1);
  assert.equal(s.feed.pending, 0);
});
