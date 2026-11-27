import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { LLMProfile, Task } from "@/lib/types";

export type TaskDetailTask = {
  /** Null until the first successful load. */
  task: Task | null;
  /** Engine pause state; updated by polling and optimistically by the pause/resume button. */
  paused: boolean;
  /** True once the first load settled (success or failure). */
  loaded: boolean;
};

export type TaskDetailState = {
  detail: TaskDetailTask;
  /** Active tab value. */
  tab: string;
  interceptPendingCount: number;
  profiles: LLMProfile[];
  requests: Requests<"archive">;
};

export type TaskDetailAction =
  | RequestAction<"archive">
  | { type: "detailChanged"; patch: Partial<TaskDetailTask> }
  | { type: "tabChanged"; tab: string }
  | { type: "interceptPendingCounted"; count: number }
  | { type: "profilesLoaded"; profiles: LLMProfile[] };

export const initialTaskDetailState: TaskDetailState = {
  detail: { task: null, paused: false, loaded: false },
  tab: "sessions",
  interceptPendingCount: 0,
  profiles: [],
  requests: createRequests(["archive"]),
};

export function taskDetailReducer(state: TaskDetailState, action: TaskDetailAction): TaskDetailState {
  if (isRequestAction<"archive">(action)) return setSlice(state, "requests", requestReducer(state.requests, action));
  switch (action.type) {
    case "detailChanged":
      return setSlice(state, "detail", mergePatch(state.detail, action.patch));
    case "tabChanged":
      return { ...state, tab: action.tab };
    case "interceptPendingCounted":
      return { ...state, interceptPendingCount: action.count };
    case "profilesLoaded":
      return { ...state, profiles: action.profiles };
  }
}
