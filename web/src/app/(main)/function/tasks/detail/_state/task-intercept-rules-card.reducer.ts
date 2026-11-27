import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { AssetInterceptAction, AssetInterceptKind, AssetInterceptRule } from "@/lib/types";

export type InterceptRuleForm = {
  action: AssetInterceptAction;
  kind: AssetInterceptKind;
  pattern: string;
  note: string;
};

/** Inline editor; `id` is the rule being edited, null when closed. */
export type InterceptRuleEditor = InterceptRuleForm & { id: number | null };

export type TaskInterceptRulesCardState = {
  rules: AssetInterceptRule[];
  form: InterceptRuleForm;
  editor: InterceptRuleEditor;
  /** Add and inline save share one busy flag and error line. */
  requests: Requests<"save">;
};

export type TaskInterceptRulesCardAction =
  | RequestAction<"save">
  | { type: "rulesLoaded"; rules: AssetInterceptRule[] }
  | { type: "formChanged"; patch: Partial<InterceptRuleForm> }
  | { type: "editorChanged"; patch: Partial<InterceptRuleForm> }
  | { type: "ruleAdded" }
  | { type: "ruleSaved" }
  | { type: "editStarted"; rule: AssetInterceptRule }
  | { type: "editCancelled" }
  | { type: "ruleRemoved"; id: number }
  | { type: "ruleToggled"; id: number };

export const initialTaskInterceptRulesCardState: TaskInterceptRulesCardState = {
  rules: [],
  form: { action: "block", kind: "fuzzy_domain", pattern: "", note: "" },
  editor: { id: null, action: "block", kind: "fuzzy_domain", pattern: "", note: "" },
  requests: createRequests(["save"]),
};

export function taskInterceptRulesCardReducer(
  state: TaskInterceptRulesCardState,
  action: TaskInterceptRulesCardAction,
): TaskInterceptRulesCardState {
  if (isRequestAction<"save">(action)) return setSlice(state, "requests", requestReducer(state.requests, action));
  switch (action.type) {
    case "rulesLoaded":
      return { ...state, rules: action.rules };
    case "formChanged":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "editorChanged":
      return { ...state, editor: { ...state.editor, ...action.patch } };
    case "ruleAdded":
      // Action and kind stay selected for the next rule.
      return { ...state, form: { ...state.form, pattern: "", note: "" } };
    case "ruleSaved":
    case "editCancelled":
      // Only the id closes the editor; the other editor fields are overwritten by the next editStarted.
      return { ...state, editor: { ...state.editor, id: null } };
    case "editStarted": {
      const { rule } = action;
      return {
        ...state,
        // Opening the editor clears the last save error.
        requests: requestReducer(state.requests, { type: "request/errorCleared", key: "save" }),
        editor: {
          id: rule.id,
          action: rule.action ?? "block",
          kind: rule.kind,
          pattern: rule.pattern,
          note: rule.note,
        },
      };
    }
    case "ruleRemoved":
      return { ...state, rules: state.rules.filter((x) => x.id !== action.id) };
    case "ruleToggled":
      return { ...state, rules: state.rules.map((x) => (x.id === action.id ? { ...x, enabled: !x.enabled } : x)) };
  }
}
