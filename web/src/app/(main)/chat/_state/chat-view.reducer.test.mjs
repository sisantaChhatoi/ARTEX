import { chatViewReducer, initChatViewState } from "./chat-view.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const act = (seq, kind = "text") => ({ seq, kind, ts: "" });
const reduce = (actions, state = initChatViewState(undefined)) => actions.reduce(chatViewReducer, state);
const seqs = (state) => state.transcript.messages.map((a) => a.seq);

test("latest history merges with live messages that arrived first and keeps running", () => {
  const s = reduce([
    { type: "messagesPolled", items: [act(5), act(6)], running: true },
    { type: "latestHistoryLoaded", items: [act(3), act(5)], hasMore: true, running: false },
  ]);
  assert.deepEqual(seqs(s), [3, 5, 6]);
  assert.equal(s.transcript.running, true);
  assert.equal(s.transcript.hasMore, true);
  assert.equal(s.transcript.historyLoaded, true);
});

test("an idle poll returns the same state", () => {
  const s = reduce([{ type: "transcriptChanged", patch: { running: true } }]);
  assert.equal(chatViewReducer(s, { type: "messagesPolled", items: [], running: true }), s);
  assert.equal(chatViewReducer(s, { type: "messagesPolled", items: [], running: false }).transcript.running, false);
});

test("older pages prepend without duplicates", () => {
  const s = reduce([
    { type: "latestHistoryLoaded", items: [act(10), act(11)], hasMore: true, running: false },
    { type: "olderHistoryMerged", items: [act(8), act(10)], hasMore: false },
  ]);
  assert.deepEqual(seqs(s), [8, 10, 11]);
  assert.equal(s.transcript.hasMore, false);
  assert.equal(chatViewReducer(s, { type: "olderHistoryMerged", items: [], hasMore: false }), s);
});

test("send clears the composer, a failure restores it", () => {
  const att = { path: "p", name: "p", size: 1 };
  const typed = reduce([
    { type: "composerChanged", patch: { input: "hello" } },
    { type: "attachmentsUploaded", attachments: [att] },
  ]);
  const sending = chatViewReducer(typed, { type: "messageSendStarted" });
  assert.deepEqual(sending.composer, { input: "", attachments: [] });
  assert.equal(sending.requests.send.pending, true);
  const failed = reduce(
    [
      { type: "messageSendFailed", input: "hello", attachments: [att] },
      { type: "request/finished", key: "send" },
    ],
    sending,
  );
  assert.deepEqual(failed.composer, { input: "hello", attachments: [att] });
  assert.equal(failed.requests.send.pending, false);
});
