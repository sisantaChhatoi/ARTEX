import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";

export type DraftChatRequest = "send" | "upload";

/** What the first message of the new conversation will be sent with. */
export type DraftChatForm = {
  agentKey: string;
  /** null = the default LLM profile. */
  llmProfileId: number | null;
  input: string;
};

export type DraftChatState = {
  form: DraftChatForm;
  /**
   * `send` creates the conversation and sends the first message; `upload` creates it
   * and uploads the picked files. Both stay pending on success, because the parent
   * switches to the new conversation; only a failure finishes them.
   */
  requests: Requests<DraftChatRequest>;
};

export type DraftChatAction =
  | RequestAction<DraftChatRequest>
  | { type: "agentChanged"; agentKey: string }
  | { type: "llmProfileChanged"; llmProfileId: number | null }
  | { type: "inputChanged"; input: string };

export const initialDraftChatState: DraftChatState = {
  form: { agentKey: "", llmProfileId: null, input: "" },
  requests: createRequests<DraftChatRequest>(["send", "upload"]),
};

function patchForm(state: DraftChatState, patch: Partial<DraftChatForm>): DraftChatState {
  const form = { ...state.form, ...patch };
  return (Object.keys(patch) as (keyof DraftChatForm)[]).every((k) => form[k] === state.form[k])
    ? state
    : { ...state, form };
}

export function draftChatReducer(state: DraftChatState, action: DraftChatAction): DraftChatState {
  if (isRequestAction<DraftChatRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "agentChanged":
      return patchForm(state, { agentKey: action.agentKey });
    case "llmProfileChanged":
      return patchForm(state, { llmProfileId: action.llmProfileId });
    case "inputChanged":
      return patchForm(state, { input: action.input });
  }
}
