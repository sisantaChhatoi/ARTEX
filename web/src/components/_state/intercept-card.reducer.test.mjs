import { initialInterceptCardState, interceptCardReducer } from "./intercept-card.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialInterceptCardState) => actions.reduce(interceptCardReducer, state);

test("a resolved approval shows its decision; a pending one keeps the current decision", () => {
  let s = reduce([
    { type: "approvalLoadFailed", error: "x" },
    { type: "approvalLoaded", pending: { id: 1, status: "timeout" } },
  ]);
  assert.deepEqual([s.approval.decided, s.approval.statusError], ["timeout", ""]);
  s = reduce([
    { type: "decided", decision: "allowed" },
    { type: "approvalLoaded", pending: { id: 1, status: "pending" } },
  ]);
  assert.equal(s.approval.decided, "allowed");
});
