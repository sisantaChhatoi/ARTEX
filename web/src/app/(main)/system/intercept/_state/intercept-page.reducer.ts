import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { selectionReducer } from "@/lib/reducers/selection";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { InterceptAction, InterceptRule, Tool } from "@/lib/types";

export type RuleForm = {
  name: string;
  enabled: boolean;
  priority: number;
  match_target: "tool_name" | "tool_input";
  match_type: "string" | "regex" | "argv";
  pattern: string;
  action: InterceptAction;
  message: string;
  timeout_enabled: boolean;
  timeout_seconds: number;
  timeout_action: "deny" | "allow";
};

export const defaultForm = (): RuleForm => ({
  name: "",
  enabled: true,
  priority: 0,
  match_target: "tool_name",
  match_type: "string",
  pattern: "",
  action: "deny",
  message: "",
  timeout_enabled: true,
  timeout_seconds: 60,
  timeout_action: "deny",
});

/** Create/edit rule sheet. */
export type RuleEditor = {
  open: boolean;
  /** Rule being edited; null = creating a new one. */
  editing: InterceptRule | null;
  form: RuleForm;
  /** true = JS cannot parse the pattern but it may be valid Go syntax. */
  regexWarn: boolean;
};

/** Tool scope dialog. */
export type ScopeDialog = {
  open: boolean;
  allTools: Tool[];
  /** Tools checked in the dialog. */
  enabledTools: Set<string>;
};

export type InterceptRequestKey = "save" | "scopeLoad" | "scopeSave";

export type InterceptPageState = {
  /** Rules list; `loaded` false until the first load settles. */
  list: ListState<InterceptRule>;
  editor: RuleEditor;
  scope: ScopeDialog;
  /** Header info bar: tools currently under interception. */
  scopeTools: string[];
  requests: Requests<InterceptRequestKey>;
};

export type InterceptPageAction =
  | ListAction<InterceptRule>
  | RequestAction<InterceptRequestKey>
  | { type: "newRuleOpened" }
  | { type: "editRuleOpened"; rule: InterceptRule }
  | { type: "editorChanged"; patch: Partial<Pick<RuleEditor, "open" | "regexWarn">> }
  | { type: "formFieldChanged"; patch: Partial<RuleForm> }
  | { type: "scopeToolsLoaded"; tools: string[] }
  | { type: "scopeOpenChanged"; open: boolean }
  | { type: "scopeLoaded"; allTools: Tool[]; enabledTools: string[] }
  | { type: "scopeToolChecked"; key: string; checked: boolean }
  | { type: "scopeSaved"; tools: string[] };

export const initialInterceptPageState: InterceptPageState = {
  list: createList(),
  editor: { open: false, editing: null, form: defaultForm(), regexWarn: false },
  scope: { open: false, allTools: [], enabledTools: new Set() },
  scopeTools: [],
  requests: createRequests(["save", "scopeLoad", "scopeSave"]),
};

function formFromRule(rule: InterceptRule): RuleForm {
  return {
    name: rule.name,
    enabled: rule.enabled,
    priority: rule.priority,
    match_target: rule.match_target,
    match_type: rule.match_type,
    pattern: rule.pattern,
    action: rule.action,
    message: rule.message,
    timeout_enabled: rule.timeout_enabled,
    timeout_seconds: rule.timeout_seconds,
    timeout_action: rule.timeout_action,
  };
}

export function interceptPageReducer(state: InterceptPageState, action: InterceptPageAction): InterceptPageState {
  if (isListAction<InterceptRule>(action)) return setSlice(state, "list", listReducer(state.list, action));
  if (isRequestAction<InterceptRequestKey>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "newRuleOpened":
      return { ...state, editor: { ...state.editor, open: true, editing: null, form: defaultForm() } };
    case "editRuleOpened":
      return {
        ...state,
        editor: { ...state.editor, open: true, editing: action.rule, form: formFromRule(action.rule) },
      };
    case "editorChanged":
      return setSlice(state, "editor", mergePatch<RuleEditor>(state.editor, action.patch));
    case "formFieldChanged":
      return { ...state, editor: { ...state.editor, form: { ...state.editor.form, ...action.patch } } };
    case "scopeToolsLoaded":
      return { ...state, scopeTools: action.tools };
    case "scopeOpenChanged":
      if (action.open === state.scope.open) return state;
      return { ...state, scope: { ...state.scope, open: action.open } };
    case "scopeLoaded":
      return {
        ...state,
        scope: { ...state.scope, allTools: action.allTools, enabledTools: new Set(action.enabledTools) },
      };
    case "scopeToolChecked": {
      const enabledTools = selectionReducer(state.scope.enabledTools, {
        type: "selection/changed",
        ids: [action.key],
        selected: action.checked,
      });
      return enabledTools === state.scope.enabledTools ? state : { ...state, scope: { ...state.scope, enabledTools } };
    }
    case "scopeSaved":
      // The saved selection becomes the header info bar and the dialog closes.
      return { ...state, scopeTools: action.tools, scope: { ...state.scope, open: false } };
  }
}
