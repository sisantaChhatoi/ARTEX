import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { InterceptPending } from "@/lib/types";

export type InterceptDecision = "allowed" | "denied" | "timeout";

type InterceptCardRequest = "decide";

/** Live approval record from the backend and the decision shown on the card. */
export type InterceptApproval = {
  pending: InterceptPending | null;
  decided: InterceptDecision | null;
  statusError: string;
  /** Bumped by "Retry details" to reload the approval. */
  retry: number;
};

export type InterceptCardState = {
  /** Persisted detail JSON of the transcript step. */
  detail: Record<string, unknown> | null;
  approval: InterceptApproval;
  expanded: boolean;
  /** Decision errors are toasted; only `pending` is used. */
  requests: Requests<InterceptCardRequest>;
};

export type InterceptCardAction =
  | RequestAction<InterceptCardRequest>
  | { type: "detailLoaded"; detail: Record<string, unknown> }
  | { type: "approvalLoaded"; pending: InterceptPending }
  | { type: "approvalLoadFailed"; error: string }
  | { type: "retryRequested" }
  | { type: "decided"; decision: InterceptDecision }
  | { type: "expandedChanged"; expanded: boolean };

export const initialInterceptCardState: InterceptCardState = {
  detail: null,
  approval: { pending: null, decided: null, statusError: "", retry: 0 },
  expanded: false,
  requests: createRequests(["decide"]),
};

export function interceptCardReducer(state: InterceptCardState, action: InterceptCardAction): InterceptCardState {
  if (isRequestAction<InterceptCardRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "detailLoaded":
      return { ...state, detail: action.detail };
    case "approvalLoaded": {
      const { pending } = action;
      // An already-resolved approval (e.g. after a page refresh) shows its decision instead of the buttons.
      const decided = pending.status !== "pending" ? (pending.status as InterceptDecision) : state.approval.decided;
      return { ...state, approval: { ...state.approval, pending, statusError: "", decided } };
    }
    case "approvalLoadFailed":
      return { ...state, approval: { ...state.approval, statusError: action.error } };
    case "retryRequested":
      return { ...state, approval: { ...state.approval, retry: state.approval.retry + 1 } };
    case "decided":
      if (action.decision === state.approval.decided) return state;
      return { ...state, approval: { ...state.approval, decided: action.decision } };
    case "expandedChanged":
      return setSlice(state, "expanded", action.expanded);
  }
}
