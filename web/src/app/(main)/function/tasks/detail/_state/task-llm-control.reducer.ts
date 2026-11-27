import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";

/** Editable copy of the task's LLM profile chain, reset from the task whenever the popover opens. */
export type TaskLLMDraft = {
  profileIDs: string[];
  rotate: boolean;
  activeProfileID: string;
};

export type TaskLLMControlState = {
  open: boolean;
  draft: TaskLLMDraft;
  requests: Requests<"save">;
};

export type TaskLLMControlAction =
  | RequestAction<"save">
  | { type: "openChanged"; open: boolean }
  | { type: "draftReset"; draft: TaskLLMDraft }
  | { type: "profileIDsChanged"; profileIDs: string[] }
  | { type: "rotateChanged"; rotate: boolean }
  | { type: "activeProfileChanged"; activeProfileID: string };

export function initTaskLLMControlState(draft: TaskLLMDraft): TaskLLMControlState {
  return { open: false, draft, requests: createRequests(["save"]) };
}

export function taskLLMControlReducer(state: TaskLLMControlState, action: TaskLLMControlAction): TaskLLMControlState {
  if (isRequestAction<"save">(action)) return setSlice(state, "requests", requestReducer(state.requests, action));
  switch (action.type) {
    case "openChanged":
      return { ...state, open: action.open };
    case "draftReset":
      return { ...state, draft: action.draft };
    case "profileIDsChanged": {
      // Keep the active profile while it is still in the chain; otherwise fall back to the first one.
      const { profileIDs } = action;
      const current = state.draft.activeProfileID;
      const activeProfileID = profileIDs.includes(current) ? current : (profileIDs[0] ?? "");
      return { ...state, draft: { ...state.draft, profileIDs, activeProfileID } };
    }
    case "rotateChanged":
      return { ...state, draft: { ...state.draft, rotate: action.rotate } };
    case "activeProfileChanged":
      return { ...state, draft: { ...state.draft, activeProfileID: action.activeProfileID } };
  }
}
