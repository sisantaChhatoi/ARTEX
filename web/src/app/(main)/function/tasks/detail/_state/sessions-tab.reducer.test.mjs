import { emptyState, initSessionsTabState, sessionsTabReducer } from "./sessions-tab.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const MAIN_ID = "s-main-0";
const initial = initSessionsTabState(MAIN_ID);
const reduce = (actions, state = initial) => actions.reduce(sessionsTabReducer, state);
const act = (seq, extra = {}) => ({ seq, ts: `t${seq}`, kind: "text", worker: "planner", summary: "", ...extra });
const frame = (key, activity, over = {}) => ({
  type: "activityReceived",
  key,
  activity,
  activeKey: "main:0",
  atBottom: true,
  maxKeep: 4000,
  ...over,
});

test("latest page merges by seq with live frames received meanwhile", () => {
  const s = reduce([
    { type: "sessionLoadStarted", key: "plan" },
    frame("plan", act(5)),
    { type: "sessionLatestLoaded", key: "plan", items: [act(3), act(5), act(4)], hasMore: true },
  ]);
  const st = s.store.plan;
  assert.deepEqual(
    st.items.map((a) => a.seq),
    [3, 4, 5],
  );
  assert.equal(st.loaded, true);
  assert.equal(st.loading, false);
  assert.equal(st.hasMore, true);
  assert.equal(st.earliestSeq, 3);
  assert.equal(st.unread, 0);
});

test("load failure keeps items; a new load clears the error", () => {
  const failed = reduce([
    { type: "sessionLoadStarted", key: "plan" },
    { type: "sessionLoadFailed", key: "plan", error: "boom" },
  ]);
  assert.equal(failed.store.plan.error, "boom");
  assert.equal(failed.store.plan.loading, false);
  const retry = sessionsTabReducer(failed, { type: "sessionLoadStarted", key: "plan" });
  assert.equal(retry.store.plan.error, undefined);
  assert.equal(retry.store.plan.loading, true);
});

test("main boot history does not clear an existing error", () => {
  const s = reduce([
    { type: "sessionLoadFailed", key: "main:0", error: "old" },
    { type: "mainBootHistoryLoaded", key: "main:0", items: [act(1)], hasMore: false },
  ]);
  assert.equal(s.store["main:0"].error, "old");
  assert.equal(s.store["main:0"].loaded, true);
});

test("older page prepends and keeps earliestSeq when nothing came back", () => {
  const loaded = reduce([{ type: "sessionLatestLoaded", key: "plan", items: [act(10)], hasMore: true }]);
  const s = reduce(
    [
      { type: "sessionOlderLoadStarted", key: "plan" },
      { type: "sessionOlderLoaded", key: "plan", items: [act(7), act(8)], hasMore: false },
    ],
    loaded,
  );
  assert.deepEqual(
    s.store.plan.items.map((a) => a.seq),
    [7, 8, 10],
  );
  assert.equal(s.store.plan.earliestSeq, 7);
  assert.equal(s.store.plan.loadingMore, false);
  const failed = reduce(
    [
      { type: "sessionOlderLoadStarted", key: "plan" },
      { type: "sessionOlderLoadFailed", key: "plan" },
    ],
    loaded,
  );
  assert.equal(failed.store.plan.loadingMore, false);
  assert.equal(failed.store.plan.earliestSeq, 10);
});

test("SSE frame for a cold inactive session only keeps an accounting tail", () => {
  let s = initial;
  for (let i = 1; i <= 6; i++) s = sessionsTabReducer(s, frame("intent:9", act(i, { kind: "usage" })));
  s = sessionsTabReducer(s, frame("intent:9", act(7)));
  const st = s.store["intent:9"];
  assert.deepEqual(
    st.items.map((a) => a.seq),
    [3, 4, 5, 6],
  );
  assert.equal(st.unread, 7);
  assert.equal(st.lastTs, "t7");
  assert.equal(st.loaded, false);
});

test("SSE frame for the active session merges without unread", () => {
  const s = reduce([frame("main:0", act(1)), frame("main:0", act(1)), frame("main:0", act(2))]);
  assert.deepEqual(
    s.store["main:0"].items.map((a) => a.seq),
    [1, 2],
  );
  assert.equal(s.store["main:0"].unread, 0);
});

test("SSE trims over the cap unless the active session is scrolled up", () => {
  const loaded = reduce([{ type: "sessionLatestLoaded", key: "plan", items: [act(1), act(2)], hasMore: false }]);
  const trimmed = sessionsTabReducer(loaded, frame("plan", act(3), { maxKeep: 2 }));
  assert.deepEqual(
    trimmed.store.plan.items.map((a) => a.seq),
    [2, 3],
  );
  assert.equal(trimmed.store.plan.hasMore, true);
  assert.equal(trimmed.store.plan.earliestSeq, 2);
  assert.equal(trimmed.store.plan.unread, 1);
  const reading = sessionsTabReducer(loaded, frame("plan", act(3), { maxKeep: 2, activeKey: "plan", atBottom: false }));
  assert.equal(reading.store.plan.items.length, 3);
  assert.equal(reading.store.plan.hasMore, false);
});

test("taskChanged resets per-task state but keeps composer and list layout", () => {
  const dirty = reduce([
    { type: "sessionSelected", id: "42" },
    { type: "sessionListToggled" },
    { type: "inputChanged", input: "hi" },
    { type: "firstIntentsLoaded", items: [{ id: "1" }], hasMore: true, displaced: [] },
    { type: "olderIntentsLoaded", items: [{ id: "0" }], hasMore: true, knownIntents: [] },
    { type: "workersChanged", patch: { assets: [{ intent_id: 1 }] } },
    { type: "taskStatusChanged", patch: { sseLive: true } },
    { type: "mainSegmentsResolved", segs: [{ seq: 2, created_at: "x" }], current: 2, key: "main:2", id: "s-main-2" },
    frame("plan", act(1)),
  ]);
  const s = sessionsTabReducer(dirty, { type: "taskChanged", mainId: MAIN_ID });
  assert.equal(s.nav.selectedSessionId, MAIN_ID);
  assert.deepEqual(s.store, {});
  assert.deepEqual(s.main.segs, [{ seq: 0, created_at: "" }]);
  assert.equal(s.main.currentSeg, 0);
  assert.deepEqual(s.workers.intents, []);
  assert.deepEqual(s.workers.olderIntents, []);
  assert.deepEqual(s.workers.assets, []);
  assert.equal(s.workers.hasLoadedOlderPage, false);
  assert.equal(s.taskStatus.sseLive, false);
  assert.equal(s.composer.input, "hi");
  assert.equal(s.nav.listOpen, true);
});

test("creating a main session prepends it, seeds the cache and clears the input", () => {
  const s = reduce([
    { type: "sessionListToggled" },
    { type: "inputChanged", input: "draft" },
    { type: "mainChanged", patch: { confirmNew: true } },
    { type: "request/started", key: "createMain" },
    { type: "mainSessionCreated", segment: { seq: 1, created_at: "c" }, current: 1, key: "main:1", id: "s-main-1" },
    { type: "mainSessionCreateFinished" },
  ]);
  assert.deepEqual(
    s.main.segs.map((m) => m.seq),
    [1, 0],
  );
  assert.equal(s.main.currentSeg, 1);
  assert.deepEqual(s.store["main:1"], { ...emptyState(), loaded: true });
  assert.equal(s.nav.selectedSessionId, "s-main-1");
  assert.equal(s.nav.listOpen, false);
  assert.equal(s.composer.input, "");
  assert.equal(s.requests.createMain.pending, false);
  assert.equal(s.main.confirmNew, false);
});

test("re-created segment is not duplicated", () => {
  const s = reduce([
    { type: "mainSessionCreated", segment: { seq: 0, created_at: "new" }, current: 0, key: "main:0", id: MAIN_ID },
  ]);
  assert.deepEqual(s.main.segs, [{ seq: 0, created_at: "new" }]);
});

test("first intents page moves displaced items into the older list", () => {
  const s = reduce([
    { type: "olderIntentsLoaded", items: [{ id: "1", v: "old" }], hasMore: false, knownIntents: [] },
    {
      type: "firstIntentsLoaded",
      items: [{ id: "5" }],
      hasMore: true,
      displaced: [{ id: "1", v: "new" }, { id: "2" }],
    },
  ]);
  assert.deepEqual(s.workers.olderIntents, [{ id: "1", v: "new" }, { id: "2" }]);
  assert.deepEqual(s.workers.intents, [{ id: "5" }]);
  assert.equal(s.workers.firstHasMore, true);
});

test("older intents dedup against the known first page and previous older pages", () => {
  const s = reduce([
    { type: "workersChanged", patch: { loadingOlder: true } },
    { type: "olderIntentsLoaded", items: [{ id: "3" }, { id: "2" }], hasMore: true, knownIntents: [{ id: "3" }] },
    { type: "olderIntentsLoaded", items: [{ id: "2" }, { id: "1" }], hasMore: false, knownIntents: [] },
    { type: "workersChanged", patch: { loadingOlder: false } },
  ]);
  assert.deepEqual(
    s.workers.olderIntents.map((n) => n.id),
    ["2", "1"],
  );
  assert.equal(s.workers.olderHasMore, false);
  assert.equal(s.workers.hasLoadedOlderPage, true);
  assert.equal(s.workers.loadingOlder, false);
});

test("intent state patch updates both lists; no state removes the row", () => {
  const base = reduce([
    { type: "firstIntentsLoaded", items: [{ id: "1", state: "open" }], hasMore: false, displaced: [] },
    { type: "olderIntentsLoaded", items: [{ id: "2", state: "open" }], hasMore: false, knownIntents: [] },
  ]);
  const paused = reduce(
    [
      { type: "intentStatePatched", intentId: "1", state: "paused" },
      { type: "intentStatePatched", intentId: "2", state: "paused" },
    ],
    base,
  );
  assert.equal(paused.workers.intents[0].state, "paused");
  assert.equal(paused.workers.olderIntents[0].state, "paused");
  const removed = sessionsTabReducer(base, { type: "intentStatePatched", intentId: "2" });
  assert.deepEqual(removed.workers.olderIntents, []);
  assert.equal(removed.workers.intents.length, 1);
});

test("main message send clears eagerly and restores on failure", () => {
  const att = { path: "uploads/a", name: "a", size: 1 };
  const started = reduce([
    { type: "inputChanged", input: "hello" },
    { type: "attachmentsUploaded", attachments: [att] },
    { type: "messageSendStarted" },
  ]);
  assert.equal(started.composer.input, "");
  assert.deepEqual(started.composer.attachments, []);
  assert.equal(started.requests.send.pending, true);
  const failed = reduce(
    [
      { type: "messageSendFailed", input: "hello", attachments: [att] },
      { type: "request/finished", key: "send" },
    ],
    started,
  );
  assert.equal(failed.composer.input, "hello");
  assert.deepEqual(failed.composer.attachments, [att]);
  assert.equal(failed.requests.send.pending, false);
});

test("worker message: editing resets the request id, side question keeps it", () => {
  const sending = reduce([
    { type: "workerMessageChanged", message: "go" },
    { type: "workerMessageSendStarted", requestId: "r1" },
    { type: "request/finished", key: "workerSend" },
  ]);
  assert.equal(sending.workerChat.requestId, "r1");
  assert.equal(sending.requests.workerSend.pending, false);
  assert.equal(sessionsTabReducer(sending, { type: "workerSideQuestionSent" }).workerChat.requestId, "r1");
  assert.equal(sessionsTabReducer(sending, { type: "workerMessageChanged", message: "go!" }).workerChat.requestId, "");
  const sent = sessionsTabReducer(sending, { type: "workerMessageSent" });
  assert.deepEqual(sent.workerChat, { message: "", requestId: "" });
});

test("selecting a session collapses the list and drops the worker draft", () => {
  const s = reduce([
    { type: "sessionListToggled" },
    { type: "workerMessageChanged", message: "draft" },
    { type: "workerMessageSendStarted", requestId: "r1" },
    { type: "sessionSelected", id: "7" },
  ]);
  assert.equal(s.nav.selectedSessionId, "7");
  assert.equal(s.nav.listOpen, false);
  assert.equal(s.workerChat.message, "");
  assert.equal(s.workerChat.requestId, "");
  const focus = sessionsTabReducer(
    { ...s, nav: { ...s.nav, listOpen: true } },
    { type: "navChanged", patch: { selectedSessionId: "8" } },
  );
  assert.equal(focus.nav.selectedSessionId, "8");
  assert.equal(focus.nav.listOpen, true);
});

test("unchanged chat-running and SSE flags return the same state", () => {
  assert.equal(sessionsTabReducer(initial, { type: "mainChanged", patch: { chatRunning: null } }), initial);
  assert.equal(sessionsTabReducer(initial, { type: "taskStatusChanged", patch: { sseLive: false } }), initial);
  assert.equal(
    sessionsTabReducer(initial, { type: "mainChanged", patch: { chatRunning: false } }).main.chatRunning,
    false,
  );
});
