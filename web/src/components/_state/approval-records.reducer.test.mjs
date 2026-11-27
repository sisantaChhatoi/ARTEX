import { approvalRecordsReducer, initialApprovalRecordsState } from "./approval-records.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialApprovalRecordsState) => actions.reduce(approvalRecordsReducer, state);

const row = (id, extra = {}) => ({
  id,
  agent_name: "a",
  tool_name: "Bash",
  tool_input: {},
  status: "pending",
  reason: "",
  created_at: "",
  conv_title: "",
  conv_agent_key: "",
  rule_name: "",
  ...extra,
});

test("loadSettled keeps old rows when the history request failed", () => {
  const s = reduce([
    {
      type: "loadSettled",
      history: { ok: true, value: { items: [row(1)], total: 1 } },
      pending: { ok: true, value: [] },
      manual: false,
    },
    {
      type: "loadSettled",
      history: { ok: false, error: "down" },
      pending: { ok: false, error: "queue down" },
      manual: false,
    },
  ]);
  assert.equal(s.list.items.length, 1);
  assert.deepEqual(s.errors, { history: "down", pending: "queue down" });
  assert.equal(s.revision, 0);
});

test("filterChanged returns to page 1, drops rows and shows the skeleton again", () => {
  const s = reduce([
    {
      type: "loadSettled",
      history: { ok: false, error: "down" },
      pending: { ok: true, value: [] },
      manual: false,
    },
    { type: "list/loaded", items: [row(1)], total: 30 },
    { type: "list/loadFinished" },
    { type: "pagination/pageChanged", page: 2 },
    { type: "filterChanged", filter: { status: "denied" } },
  ]);
  assert.deepEqual(s.filter, { status: "denied" });
  assert.equal(s.pagination.page, 1);
  assert.equal(s.list.items.length, 0);
  assert.equal(s.list.total, 0);
  assert.equal(s.list.loaded, false);
  assert.equal(s.errors.history, "");
});

test("decided marks the history row and drops it from the queue", () => {
  const s = reduce([
    { type: "list/loaded", items: [row(1), row(2)], total: 2 },
    {
      type: "loadSettled",
      history: { ok: true, value: { items: [row(1), row(2)], total: 2 } },
      pending: { ok: true, value: [row(1), row(3)] },
      manual: false,
    },
    { type: "decided", id: 1, decision: "allowed", at: "2026-01-01T00:00:00Z" },
  ]);
  assert.equal(s.list.items[0].status, "allowed");
  assert.equal(s.list.items[0].decided_by, "human");
  assert.equal(s.list.items[0].decided_at, "2026-01-01T00:00:00Z");
  assert.equal(s.list.items[1].status, "pending");
  assert.deepEqual(
    s.pendingRows.map((r) => r.id),
    [3],
  );
  assert.equal(s.revision, 1);
});

test("batchDecided keeps only failed ids selected and lists their errors", () => {
  const s = reduce([
    { type: "selection/toggled", id: 1 },
    { type: "selection/toggled", id: 2 },
    { type: "batchChanged", patch: { decision: "denied" } },
    { type: "batchDecided", failed: [{ id: 2, error: "nope" }] },
  ]);
  assert.deepEqual([...s.selection], [2]);
  assert.deepEqual(s.batch.errors, [{ id: 2, error: "nope" }]);
  assert.equal(s.batch.decision, "denied");
  assert.equal(s.revision, 1);
});
