import { CONVERSATION_LIST_PAGE, chatPageReducer, initChatPageState } from "./chat-page.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const conv = (id, agent_key = "auto", pinned = false) => ({ id, agent_key, pinned });
const reduce = (actions, state = initChatPageState()) => actions.reduce(chatPageReducer, state);
const loaded = (items) => [{ type: "list/loaded", items }, { type: "list/loadFinished" }];

test("a started conversation is inserted above the first unpinned row and selected", () => {
  const s = reduce([
    ...loaded([conv(1, "auto", true), conv(2), conv(3)]),
    { type: "conversationStarted", conversation: conv(9), pending: { input: "hi" } },
  ]);
  assert.deepEqual(
    s.list.items.map((c) => c.id),
    [1, 9, 2, 3],
  );
  assert.equal(s.nav.selectedId, 9);
  assert.deepEqual(s.pendingByConv[9], { input: "hi" });
});

test("a started conversation clears a filter that would hide it", () => {
  const s = reduce([
    { type: "agentFilterChanged", agentFilter: "web" },
    { type: "conversationStarted", conversation: conv(4, "auto") },
  ]);
  assert.equal(s.sidebar.agentFilter, null);
});

test("changing the agent filter resets paging, selection, dialog and rename", () => {
  const s = reduce([
    ...loaded([conv(1), conv(2)]),
    { type: "moreConversationsShown" },
    { type: "selection/set", ids: [1, 2] },
    { type: "bulkDeleteOpenChanged", open: true },
    { type: "renameChanged", patch: { id: 1, text: "old" } },
    { type: "agentFilterChanged", agentFilter: "auto" },
  ]);
  assert.equal(s.sidebar.visibleCount, CONVERSATION_LIST_PAGE);
  assert.equal(s.selection.size, 0);
  assert.equal(s.bulkDeleteOpen, false);
  assert.equal(s.rename.id, null);
  assert.equal(s.rename.text, "old");
});

test("selecting another conversation drops the approval source request", () => {
  const restored = reduce([{ type: "selectionRestored", id: 3, sourceRequested: true }]);
  assert.equal(restored.nav.selectedId, 3);
  assert.equal(restored.nav.sourceRequested, true);
  assert.equal(chatPageReducer(restored, { type: "conversationSelected", id: 3 }), restored);
  const other = chatPageReducer(restored, { type: "conversationSelected", id: null });
  assert.deepEqual(other.nav, { selectedId: null, sourceRequested: false });
});

test("deleting the open conversation deselects it and unchecks it", () => {
  const s = reduce([
    { type: "conversationSelected", id: 2 },
    { type: "selection/set", ids: [1, 2] },
    { type: "conversationDeleted", id: 2 },
  ]);
  assert.equal(s.nav.selectedId, null);
  assert.deepEqual([...s.selection], [1]);
  const other = chatPageReducer(s, { type: "conversationDeleted", id: 7 });
  assert.equal(other.selection, s.selection);
  assert.equal(other.nav, s.nav);
});

test("bulk delete keeps selection mode only when some deletes failed", () => {
  const base = reduce([
    { type: "selectionModeEntered" },
    { type: "selection/set", ids: [1, 2, 3] },
    { type: "bulkDeleteOpenChanged", open: true },
  ]);
  const partial = chatPageReducer(base, { type: "bulkDeleteSettled", deleted: [1, 2], allSucceeded: false });
  assert.deepEqual([...partial.selection], [3]);
  assert.equal(partial.selectionMode, true);
  assert.equal(partial.bulkDeleteOpen, false);
  const full = chatPageReducer(base, { type: "bulkDeleteSettled", deleted: [1, 2, 3], allSucceeded: true });
  assert.equal(full.selectionMode, false);
  assert.equal(full.selection.size, 0);
});
