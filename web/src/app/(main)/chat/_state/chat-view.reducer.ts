import { mergeActivities } from "@/lib/activity-merge";
import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { Activity, ChatAttachment } from "@/lib/types";

export type ChatViewRequest = "send" | "stop" | "upload";

/** The loaded window of the conversation and whether a turn is running. */
export type ChatTranscript = {
  messages: Activity[];
  running: boolean;
  /** The latest history page has settled (loaded or failed). */
  historyLoaded: boolean;
  /** Older history remains above the loaded window; drives the "load earlier" hint. */
  hasMore: boolean;
};

export type ChatComposer = {
  input: string;
  /** Already uploaded (under sessions/conv-<id>/uploads/), sent with the next message. */
  attachments: ChatAttachment[];
};

export type ChatViewState = {
  transcript: ChatTranscript;
  composer: ChatComposer;
  requests: Requests<ChatViewRequest>;
};

/** Text and uploads handed off from the draft that created this conversation. */
export type ChatViewInitial = { input?: string; attachments?: ChatAttachment[] } | undefined;

export type ChatViewAction =
  | RequestAction<ChatViewRequest>
  // transcript
  | { type: "conversationReset" }
  | { type: "latestHistoryLoaded"; items: Activity[]; hasMore: boolean; running: boolean }
  | { type: "latestHistoryFailed" }
  | { type: "olderHistoryMerged"; items: Activity[]; hasMore: boolean }
  | { type: "messagesPolled"; items: Activity[]; running: boolean }
  | { type: "transcriptChanged"; patch: Partial<ChatTranscript> }
  // composer
  | { type: "composerChanged"; patch: Partial<ChatComposer> }
  | { type: "attachmentsUploaded"; attachments: ChatAttachment[] }
  | { type: "attachmentRemoved"; path: string }
  | { type: "messageSendStarted" }
  | { type: "messageSendFailed"; input: string; attachments: ChatAttachment[] };

export function initChatViewState(initial: ChatViewInitial): ChatViewState {
  return {
    transcript: { messages: [], running: false, historyLoaded: false, hasMore: false },
    composer: { input: initial?.input ?? "", attachments: initial?.attachments ?? [] },
    requests: createRequests<ChatViewRequest>(["send", "stop", "upload"]),
  };
}

function patchTranscript(state: ChatViewState, patch: Partial<ChatTranscript>): ChatViewState {
  return { ...state, transcript: { ...state.transcript, ...patch } };
}

export function chatViewReducer(state: ChatViewState, action: ChatViewAction): ChatViewState {
  if (isRequestAction<ChatViewRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "conversationReset": {
      const { messages, running, historyLoaded, hasMore } = state.transcript;
      if (!messages.length && !running && !historyLoaded && !hasMore) return state;
      return patchTranscript(state, { messages: [], running: false, historyLoaded: false, hasMore: false });
    }
    case "latestHistoryLoaded":
      // Live messages polled meanwhile win over the history page; a turn seen running stays running.
      return patchTranscript(state, {
        messages: mergeActivities(action.items, state.transcript.messages),
        hasMore: action.hasMore,
        running: state.transcript.running || action.running,
        historyLoaded: true,
      });
    case "latestHistoryFailed":
      if (state.transcript.historyLoaded) return state;
      return patchTranscript(state, { historyLoaded: true });
    case "olderHistoryMerged":
      if (!action.items.length && action.hasMore === state.transcript.hasMore) return state;
      return patchTranscript(state, {
        messages: action.items.length
          ? mergeActivities(action.items, state.transcript.messages)
          : state.transcript.messages,
        hasMore: action.hasMore,
      });
    case "messagesPolled":
      // An idle poll (nothing new, still running) must not re-render.
      if (!action.items.length && action.running === state.transcript.running) return state;
      return patchTranscript(state, {
        messages: action.items.length
          ? mergeActivities(state.transcript.messages, action.items)
          : state.transcript.messages,
        running: action.running,
      });
    case "transcriptChanged":
      return setSlice(state, "transcript", mergePatch(state.transcript, action.patch));

    case "composerChanged":
      return setSlice(state, "composer", mergePatch(state.composer, action.patch));
    case "attachmentsUploaded":
      return {
        ...state,
        composer: { ...state.composer, attachments: [...state.composer.attachments, ...action.attachments] },
      };
    case "attachmentRemoved":
      return {
        ...state,
        composer: {
          ...state.composer,
          attachments: state.composer.attachments.filter((x) => x.path !== action.path),
        },
      };
    case "messageSendStarted":
      // The composer is cleared eagerly; a failed send restores it.
      return {
        ...state,
        composer: { input: "", attachments: [] },
        requests: requestReducer<ChatViewRequest>(state.requests, { type: "request/started", key: "send" }),
      };
    case "messageSendFailed":
      return { ...state, composer: { input: action.input, attachments: action.attachments } };
  }
}
