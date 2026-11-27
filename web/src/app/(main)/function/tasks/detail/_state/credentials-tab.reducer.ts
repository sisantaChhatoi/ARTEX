import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { TaskCredential } from "@/lib/types";

/** The "add credential" row. */
export type CredentialForm = {
  domain: string;
  username: string;
  /** Empty means the agent generates and records it. */
  password: string;
  note: string;
};

export type CredentialsTabState = {
  /** Null until the first load succeeds. */
  items: TaskCredential[] | null;
  /** Last load/add/delete error; only the busy flag of `requests.add` is used. */
  error: string;
  form: CredentialForm;
  requests: Requests<"add">;
};

export type CredentialsTabAction =
  | RequestAction<"add">
  | { type: "listLoaded"; items: TaskCredential[] }
  | { type: "failed"; error: string }
  | { type: "formFieldChanged"; patch: Partial<CredentialForm> }
  | { type: "credentialAdded" };

const emptyForm: CredentialForm = { domain: "", username: "", password: "", note: "" };

export const initialCredentialsTabState: CredentialsTabState = {
  items: null,
  error: "",
  form: emptyForm,
  requests: createRequests(["add"]),
};

export function credentialsTabReducer(state: CredentialsTabState, action: CredentialsTabAction): CredentialsTabState {
  if (isRequestAction<"add">(action)) return setSlice(state, "requests", requestReducer(state.requests, action));
  switch (action.type) {
    case "listLoaded":
      return { ...state, items: action.items, error: "" };
    case "failed":
      return { ...state, error: action.error };
    case "formFieldChanged":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "credentialAdded":
      return { ...state, form: emptyForm };
  }
}
