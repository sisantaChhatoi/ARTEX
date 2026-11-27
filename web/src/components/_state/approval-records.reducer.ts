import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import {
  createPagination,
  isPaginationAction,
  type Pagination,
  type PaginationAction,
  paginationReducer,
  toFirstPage,
} from "@/lib/reducers/pagination";
import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { isSelectionAction, type SelectionAction, selectionReducer } from "@/lib/reducers/selection";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { InterceptApprovalFilter, InterceptApprovalRow, InterceptPending } from "@/lib/types";

export const DEFAULT_PAGE_SIZE = 20;

export type ApprovalDecision = "allowed" | "denied";
export type BatchFailure = { id: number; error: string };

/** Batch allow/deny of the selected pending rows. */
export type ApprovalBatch = {
  /** Decision awaiting confirmation; null = confirmation dialog closed. */
  decision: ApprovalDecision | null;
  /** Ids the last batch could not decide, with their errors. */
  errors: BatchFailure[];
};

export type ApprovalRecordsState = {
  filter: InterceptApprovalFilter;
  /** 1-based, like the intercept history API. */
  pagination: Pagination;
  /**
   * Approval history page. `loaded` is false until the first load for the current filter settles (shows the
   * skeleton); `loading` is true while a manual refresh is in flight (spins the Refresh icon).
   */
  list: ListState<InterceptApprovalRow>;
  /** Approval queue, independent of the history page and its filter. */
  pendingRows: InterceptPending[];
  errors: { history: string; pending: string };
  /** `decide.pending` while a single or batch decision is in flight. */
  requests: Requests<"decide">;
  /** Bumped after a manual reload or a decision so expanded rows refetch their detail. */
  revision: number;
  /** Pending rows checked for a batch decision. */
  selection: Set<number>;
  batch: ApprovalBatch;
};

export type SettledResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type ApprovalRecordsAction =
  | PaginationAction
  | ListAction<InterceptApprovalRow>
  | RequestAction<"decide">
  | SelectionAction<number>
  | {
      type: "loadSettled";
      history: SettledResult<{ items: InterceptApprovalRow[]; total: number }>;
      pending: SettledResult<InterceptPending[]>;
      manual: boolean;
    }
  | { type: "historyFailed"; error: string }
  | { type: "filterChanged"; filter: InterceptApprovalFilter }
  | { type: "decided"; id: number; decision: ApprovalDecision; at: string }
  | { type: "batchDecided"; failed: BatchFailure[] }
  | { type: "batchChanged"; patch: Partial<ApprovalBatch> };

export const initialApprovalRecordsState: ApprovalRecordsState = {
  filter: {},
  pagination: createPagination(DEFAULT_PAGE_SIZE, 1),
  list: createList(),
  pendingRows: [],
  errors: { history: "", pending: "" },
  requests: createRequests(["decide"]),
  revision: 0,
  selection: new Set(),
  batch: { decision: null, errors: [] },
};

function setErrors(state: ApprovalRecordsState, patch: Partial<ApprovalRecordsState["errors"]>): ApprovalRecordsState {
  return setSlice(state, "errors", mergePatch(state.errors, patch));
}

export function approvalRecordsReducer(
  state: ApprovalRecordsState,
  action: ApprovalRecordsAction,
): ApprovalRecordsState {
  if (isPaginationAction(action)) return setSlice(state, "pagination", paginationReducer(state.pagination, action));
  if (isListAction<InterceptApprovalRow>(action)) return setSlice(state, "list", listReducer(state.list, action));
  if (isRequestAction<"decide">(action)) return setSlice(state, "requests", requestReducer(state.requests, action));
  if (isSelectionAction<number>(action)) return setSlice(state, "selection", selectionReducer(state.selection, action));
  switch (action.type) {
    case "loadSettled": {
      let next = state;
      if (action.history.ok) {
        const { items, total } = action.history.value;
        next = setSlice(next, "list", listReducer(next.list, { type: "list/loaded", items, total }));
        next = setErrors(next, { history: "" });
      } else {
        next = setErrors(next, { history: action.history.error });
      }
      if (action.pending.ok) next = setErrors({ ...next, pendingRows: action.pending.value }, { pending: "" });
      else next = setErrors(next, { pending: action.pending.error });
      return action.manual ? { ...next, revision: next.revision + 1 } : next;
    }
    case "historyFailed":
      return setErrors(state, { history: action.error });
    case "filterChanged":
      // A new filter starts over: first page, no stale rows, skeleton until its first load settles.
      return {
        ...state,
        filter: action.filter,
        pagination: toFirstPage(state.pagination),
        list: listReducer(state.list, { type: "list/cleared" }),
        errors: state.errors.history ? { ...state.errors, history: "" } : state.errors,
      };
    case "decided":
      // Optimistic: mark the history row decided and drop it from the pending queue; a reload reconciles.
      return {
        ...state,
        list: {
          ...state.list,
          items: state.list.items.map((row) =>
            row.id === action.id
              ? { ...row, status: action.decision, decided_by: "human", decided_at: action.at }
              : row,
          ),
        },
        pendingRows: state.pendingRows.filter((row) => row.id !== action.id),
        revision: state.revision + 1,
      };
    case "batchDecided":
      // Ids that failed stay selected so the user can retry them.
      return {
        ...state,
        batch: { ...state.batch, errors: action.failed },
        selection: selectionReducer(state.selection, { type: "selection/set", ids: action.failed.map((f) => f.id) }),
        revision: state.revision + 1,
      };
    case "batchChanged":
      return setSlice(state, "batch", mergePatch(state.batch, action.patch));
  }
}
