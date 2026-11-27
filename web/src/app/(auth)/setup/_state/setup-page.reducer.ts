import { mergePatch, setSlice } from "@/lib/reducers/slice";

export type SetupForm = {
  password: string;
  confirm: string;
  setupToken: string;
};

export type SetupStatus = {
  /** Initialization state still being fetched; nothing is rendered meanwhile. */
  checking: boolean;
  /**
   * The initialization state could not be fetched. Do not default to "not initialized": that would show the setup
   * form to an instance that already has a password, and following it would overwrite the original.
   */
  unavailable: boolean;
  submitting: boolean;
  /** One message for the status check, validation and submit, like the page shows it. */
  error: string;
};

export type SetupPageState = {
  form: SetupForm;
  status: SetupStatus;
};

export type SetupPageAction =
  | { type: "formFieldChanged"; patch: Partial<SetupForm> }
  | { type: "statusCheckFailed"; error: string }
  | { type: "statusChecked" }
  | { type: "validationFailed"; error: string }
  | { type: "submitStarted" }
  | { type: "submitFailed"; error: string }
  | { type: "submitFinished" };

export const initialSetupPageState: SetupPageState = {
  form: { password: "", confirm: "", setupToken: "" },
  status: { checking: true, unavailable: false, submitting: false, error: "" },
};

function withStatus(state: SetupPageState, patch: Partial<SetupStatus>): SetupPageState {
  return setSlice(state, "status", mergePatch(state.status, patch));
}

export function setupPageReducer(state: SetupPageState, action: SetupPageAction): SetupPageState {
  switch (action.type) {
    case "formFieldChanged":
      return setSlice(state, "form", mergePatch(state.form, action.patch));
    case "statusCheckFailed":
      return withStatus(state, { error: action.error, unavailable: true });
    case "statusChecked":
      return withStatus(state, { checking: false });
    case "validationFailed":
    case "submitFailed":
      return withStatus(state, { error: action.error });
    case "submitStarted":
      return withStatus(state, { submitting: true, error: "" });
    case "submitFinished":
      return withStatus(state, { submitting: false });
  }
}
