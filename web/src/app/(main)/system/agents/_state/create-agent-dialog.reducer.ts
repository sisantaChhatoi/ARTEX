import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";

export type CreateAgentForm = {
  key: string;
  name: string;
  description: string;
};

type CreateAgentRequest = "create";

export type CreateAgentDialogState = {
  open: boolean;
  form: CreateAgentForm;
  requests: Requests<CreateAgentRequest>;
};

export type CreateAgentDialogAction =
  | RequestAction<CreateAgentRequest>
  | { type: "openChanged"; open: boolean }
  | { type: "formFieldChanged"; patch: Partial<CreateAgentForm> }
  /** The agent was created: close the dialog and clear the form for the next one. */
  | { type: "created" };

const EMPTY_FORM: CreateAgentForm = { key: "", name: "", description: "" };

export const initialCreateAgentDialogState: CreateAgentDialogState = {
  open: false,
  form: EMPTY_FORM,
  requests: createRequests(["create"]),
};

export function createAgentDialogReducer(
  state: CreateAgentDialogState,
  action: CreateAgentDialogAction,
): CreateAgentDialogState {
  if (isRequestAction<CreateAgentRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "openChanged":
      return action.open === state.open ? state : { ...state, open: action.open };
    case "formFieldChanged":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "created":
      return { ...state, open: false, form: EMPTY_FORM };
  }
}
