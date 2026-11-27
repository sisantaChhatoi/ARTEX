import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";

/** What the sheet's right pane shows: an existing category, the uncategorized tasks, or the create form. */
export type CategoryManagementView = number | "uncategorized" | "new";

export type CategoryEditor = {
  view: CategoryManagementView;
  /** Name input for the create form or the selected category. */
  draftName: string;
};

export type CategoryTaskDrag = {
  /** Task whose category update request is in flight (a per-task ID, so not a `request` slice). */
  movingTaskID: string | null;
  /** Task currently being dragged, shown in the drag overlay. */
  activeTaskID: string | null;
};

/** Saving the edited category and deleting the selected one. */
export type CategoryManagementRequest = "save" | "delete";

export type CategoryManagementSheetState = {
  open: boolean;
  editor: CategoryEditor;
  deleteDialogOpen: boolean;
  requests: Requests<CategoryManagementRequest>;
  drag: CategoryTaskDrag;
};

export type CategoryManagementSheetAction =
  | RequestAction<CategoryManagementRequest>
  | { type: "openChanged"; open: boolean }
  | { type: "viewSelected"; view: CategoryManagementView; draftName: string }
  | { type: "draftNameChanged"; draftName: string }
  | { type: "deleteDialogOpenChanged"; open: boolean }
  | { type: "dragChanged"; patch: Partial<CategoryTaskDrag> };

export const initialCategoryManagementSheetState: CategoryManagementSheetState = {
  open: false,
  editor: { view: "new", draftName: "" },
  deleteDialogOpen: false,
  requests: createRequests(["save", "delete"]),
  drag: { movingTaskID: null, activeTaskID: null },
};

export function categoryManagementSheetReducer(
  state: CategoryManagementSheetState,
  action: CategoryManagementSheetAction,
): CategoryManagementSheetState {
  if (isRequestAction<CategoryManagementRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "openChanged":
      if (action.open === state.open) return state;
      return { ...state, open: action.open };
    case "viewSelected":
      return { ...state, editor: { view: action.view, draftName: action.draftName } };
    case "draftNameChanged":
      return { ...state, editor: { ...state.editor, draftName: action.draftName } };
    case "deleteDialogOpenChanged":
      if (action.open === state.deleteDialogOpen) return state;
      return { ...state, deleteDialogOpen: action.open };
    case "dragChanged":
      return setSlice(state, "drag", mergePatch(state.drag, action.patch));
  }
}
