import { mergePatch, setSlice } from "@/lib/reducers/slice";

export type LoginForm = {
  password: string;
  /** Terms of Use accepted. */
  agreed: boolean;
};

/** Terms of Use dialog; "Agree" unlocks once the terms are scrolled to the end. */
export type LoginTerms = {
  open: boolean;
  readToEnd: boolean;
};

export type LoginStatus = {
  /** Login state still being checked. */
  checking: boolean;
  submitting: boolean;
  /** One message for the status check, validation and submit, like the page shows it. */
  error: string;
};

export type LoginPageState = {
  form: LoginForm;
  terms: LoginTerms;
  status: LoginStatus;
};

export type LoginPageAction =
  | { type: "formChanged"; patch: Partial<LoginForm> }
  | { type: "termsChanged"; patch: Partial<LoginTerms> }
  /** "I have read and agree" in the terms dialog. */
  | { type: "termsAgreed" }
  | { type: "statusCheckFailed"; error: string }
  | { type: "statusChecked" }
  | { type: "validationFailed"; error: string }
  | { type: "submitStarted" }
  | { type: "submitFailed"; error: string }
  | { type: "submitFinished" };

export const initialLoginPageState: LoginPageState = {
  form: { password: "", agreed: false },
  terms: { open: false, readToEnd: false },
  status: { checking: true, submitting: false, error: "" },
};

function withStatus(state: LoginPageState, patch: Partial<LoginStatus>): LoginPageState {
  return setSlice(state, "status", mergePatch(state.status, patch));
}

export function loginPageReducer(state: LoginPageState, action: LoginPageAction): LoginPageState {
  switch (action.type) {
    case "formChanged":
      return setSlice(state, "form", mergePatch(state.form, action.patch));
    case "termsChanged":
      return setSlice(state, "terms", mergePatch(state.terms, action.patch));
    case "termsAgreed":
      return { ...state, form: { ...state.form, agreed: true }, status: { ...state.status, error: "" } };
    case "statusCheckFailed":
    case "validationFailed":
    case "submitFailed":
      return withStatus(state, { error: action.error });
    case "statusChecked":
      return withStatus(state, { checking: false });
    case "submitStarted":
      return withStatus(state, { submitting: true, error: "" });
    case "submitFinished":
      return withStatus(state, { submitting: false });
  }
}
