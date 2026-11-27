import { initialLogsPageState, LIVE_LINES_MAX, logsPageReducer } from "./logs-page.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialLogsPageState) => actions.reduce(logsPageReducer, state);
const line = (seq, extra = {}) => ({ seq, ts: "", level: "info", tag: "t", text: `line ${seq}`, ...extra });

test("live lines are deduplicated by seq", () => {
  const s = reduce([{ type: "lineReceived", line: line(1) }]);
  assert.equal(logsPageReducer(s, { type: "lineReceived", line: line(1) }), s);
});

test("live tail keeps only the newest lines", () => {
  const actions = Array.from({ length: LIVE_LINES_MAX + 5 }, (_, i) => ({ type: "lineReceived", line: line(i + 1) }));
  const s = reduce(actions);
  assert.equal(s.lines.length, LIVE_LINES_MAX);
  assert.equal(s.lines[0].seq, 6);
});

test("older history is prepended with seq numbers below the minimum and deduped by db_id", () => {
  const s = reduce([
    { type: "lineReceived", line: line(5, { db_id: 10 }) },
    {
      type: "olderLoaded",
      items: [line(1, { db_id: 8 }), line(2, { db_id: 9 }), line(3, { db_id: 10 })],
      hasMore: true,
    },
  ]);
  assert.deepEqual(
    s.lines.map((l) => [l.seq, l.db_id]),
    [
      [-3, 8],
      [-2, 9],
      [-1, 10],
    ],
  );
  assert.equal(s.hasMore, true);
});
