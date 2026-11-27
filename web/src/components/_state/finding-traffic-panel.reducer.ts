import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { FindingTraffic, FindingTrafficBinding, TrafficEvidenceRole } from "@/lib/types";

type FindingTrafficRequest = "mutate";

/** The finding's bound traffic; `data` is null while (re)loading. */
export type FindingTrafficEvidence = {
  data: FindingTraffic | null;
  error: string;
  /** Bumped to force a reload (retry, failed change, new binding). */
  reloadTick: number;
};

/** Role/note dialog for one binding; `binding` null = closed. */
export type FindingTrafficEditor = {
  binding: FindingTrafficBinding | null;
  role: TrafficEvidenceRole;
  note: string;
};

export type FindingTrafficPanelState = {
  evidence: FindingTrafficEvidence;
  editor: FindingTrafficEditor;
  /** Traffic picker dialog open. */
  adding: boolean;
  /** Binding shown in the evidence viewer. */
  preview: string | null;
  /** Errors of changes are toasted; only `pending` is used. */
  requests: Requests<FindingTrafficRequest>;
};

export type FindingTrafficPanelAction =
  | RequestAction<FindingTrafficRequest>
  | { type: "loadStarted" }
  | { type: "loaded"; data: FindingTraffic }
  | { type: "loadFailed"; error: string }
  | { type: "reloadRequested" }
  | { type: "mutated"; data: FindingTraffic }
  | { type: "addingChanged"; open: boolean }
  | { type: "previewChanged"; id: string | null }
  | { type: "editStarted"; binding: FindingTrafficBinding }
  | { type: "editorChanged"; patch: Partial<FindingTrafficEditor> };

export const initialFindingTrafficPanelState: FindingTrafficPanelState = {
  evidence: { data: null, error: "", reloadTick: 0 },
  editor: { binding: null, role: "supporting", note: "" },
  adding: false,
  preview: null,
  requests: createRequests(["mutate"]),
};

function withEvidence(
  state: FindingTrafficPanelState,
  patch: Partial<FindingTrafficEvidence>,
): FindingTrafficPanelState {
  return setSlice(state, "evidence", mergePatch(state.evidence, patch));
}

export function findingTrafficPanelReducer(
  state: FindingTrafficPanelState,
  action: FindingTrafficPanelAction,
): FindingTrafficPanelState {
  if (isRequestAction<FindingTrafficRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "loadStarted":
      return withEvidence(state, { data: null, error: "" });
    case "loaded":
      return withEvidence(state, { data: action.data });
    case "loadFailed":
      return withEvidence(state, { error: action.error });
    case "reloadRequested":
      return withEvidence(state, { reloadTick: state.evidence.reloadTick + 1 });
    case "mutated":
      // A successful change returns the new list and closes the editor.
      return { ...withEvidence(state, { data: action.data }), editor: { ...state.editor, binding: null } };
    case "addingChanged":
      return setSlice(state, "adding", action.open);
    case "previewChanged":
      return setSlice(state, "preview", action.id);
    case "editStarted":
      return { ...state, editor: { binding: action.binding, role: action.binding.role, note: action.binding.note } };
    case "editorChanged":
      return setSlice(state, "editor", mergePatch(state.editor, action.patch));
  }
}
