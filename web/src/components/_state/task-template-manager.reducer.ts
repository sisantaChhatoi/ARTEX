import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { AssetInterceptRuleInput, TaskCategory, TaskTemplate } from "@/lib/types";

export type TemplateDraft = {
  name: string;
  description: string;
  goal: string;
  categoryID: number | null;
  interceptRules: AssetInterceptRuleInput[];
};

// TemplateSeed holds the initial values carried over from the creation form when using "Save as template".
export type TemplateSeed = Pick<TemplateDraft, "description" | "goal" | "categoryID" | "interceptRules">;

type TemplateRequest = "save" | "delete";

/** Template being edited; `selectedID` null = a new template. */
export type TemplateEditor = {
  selectedID: number | null;
  draft: TemplateDraft;
};

export type TaskTemplateManagerState = {
  editor: TemplateEditor;
  categories: TaskCategory[];
  deleteOpen: boolean;
  /** Errors are toasted; only `pending` is used. */
  requests: Requests<TemplateRequest>;
};

export type TaskTemplateManagerAction =
  | RequestAction<TemplateRequest>
  | { type: "managerOpened"; seed: TemplateSeed | null; templates: TaskTemplate[] }
  | { type: "templateSelected"; template: TaskTemplate }
  | { type: "newStarted" }
  | { type: "draftChanged"; patch: Partial<TemplateDraft> }
  | { type: "templateCreated"; template: TaskTemplate }
  | { type: "templateUpdated"; template: TaskTemplate }
  /** `templates` is the list from before the deletion. */
  | { type: "templateDeleted"; id: number; templates: TaskTemplate[] }
  | { type: "categoriesLoaded"; categories: TaskCategory[] }
  | { type: "deleteOpenChanged"; open: boolean };

export const emptyDraft = (): TemplateDraft => ({
  name: "",
  description: "",
  goal: "",
  categoryID: null,
  interceptRules: [],
});

export function templateDraft(template: TaskTemplate): TemplateDraft {
  return {
    name: template.name,
    description: template.description,
    goal: template.goal,
    categoryID: template.category_id ?? null,
    interceptRules: template.intercept_rules ?? [],
  };
}

export const initialTaskTemplateManagerState: TaskTemplateManagerState = {
  editor: { selectedID: null, draft: emptyDraft() },
  categories: [],
  deleteOpen: false,
  requests: createRequests(["save", "delete"]),
};

function edit(state: TaskTemplateManagerState, template: TaskTemplate | null): TaskTemplateManagerState {
  return {
    ...state,
    editor: template
      ? { selectedID: template.id, draft: templateDraft(template) }
      : { selectedID: null, draft: emptyDraft() },
  };
}

export function taskTemplateManagerReducer(
  state: TaskTemplateManagerState,
  action: TaskTemplateManagerAction,
): TaskTemplateManagerState {
  if (isRequestAction<TemplateRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "managerOpened":
      // Opening with a seed ("Save as template") starts a new template from it; otherwise edit the first template.
      if (action.seed) {
        const { description, goal, categoryID, interceptRules } = action.seed;
        return {
          ...state,
          editor: { selectedID: null, draft: { name: "", description, goal, categoryID, interceptRules } },
        };
      }
      return edit(state, action.templates[0] ?? null);
    case "templateSelected":
      return edit(state, action.template);
    case "newStarted":
      return edit(state, null);
    case "draftChanged":
      return { ...state, editor: { ...state.editor, draft: { ...state.editor.draft, ...action.patch } } };
    case "templateCreated":
      return edit(state, action.template);
    case "templateUpdated":
      return { ...state, editor: { ...state.editor, draft: templateDraft(action.template) } };
    case "templateDeleted": {
      const next = action.templates.find((template) => template.id !== action.id) ?? null;
      return { ...edit(state, next), deleteOpen: false };
    }
    case "categoriesLoaded":
      return { ...state, categories: action.categories };
    case "deleteOpenChanged":
      return setSlice(state, "deleteOpen", action.open);
  }
}
