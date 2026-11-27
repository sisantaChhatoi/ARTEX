import type { TemplateSeed } from "@/components/_state/task-template-manager.reducer";
import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import { setSlice } from "@/lib/reducers/slice";
import type { TaskTemplate } from "@/lib/types";

/** Combobox text and the template waiting for "overwrite?" confirmation. */
export type TemplatePicker = {
  inputValue: string;
  pending: TaskTemplate | null;
};

export type TemplateManagerDialog = {
  open: boolean;
  seed: TemplateSeed | null;
};

export type TaskTemplateControlsState = {
  templates: ListState<TaskTemplate>;
  picker: TemplatePicker;
  manager: TemplateManagerDialog;
};

export type TaskTemplateControlsAction =
  | ListAction<TaskTemplate>
  | { type: "inputValueChanged"; value: string }
  | { type: "confirmRequested"; template: TaskTemplate }
  | { type: "confirmClosed" }
  /** Confirmation dismissed: the combobox text returns to the selected template. */
  | { type: "confirmDismissed"; inputValue: string }
  | { type: "managerOpened"; seed: TemplateSeed | null }
  | { type: "managerOpenChanged"; open: boolean }
  /** Created or updated: moves the template to the top of the list. */
  | { type: "templateUpserted"; template: TaskTemplate }
  | { type: "templateRemoved"; id: number };

export const initialTaskTemplateControlsState: TaskTemplateControlsState = {
  // Templates load on mount.
  templates: { ...createList<TaskTemplate>(), loading: true },
  picker: { inputValue: "", pending: null },
  manager: { open: false, seed: null },
};

function withItems(state: TaskTemplateControlsState, items: TaskTemplate[]): TaskTemplateControlsState {
  return { ...state, templates: { ...state.templates, items, total: items.length } };
}

export function taskTemplateControlsReducer(
  state: TaskTemplateControlsState,
  action: TaskTemplateControlsAction,
): TaskTemplateControlsState {
  if (isListAction<TaskTemplate>(action)) return setSlice(state, "templates", listReducer(state.templates, action));
  switch (action.type) {
    case "inputValueChanged":
      if (action.value === state.picker.inputValue) return state;
      return { ...state, picker: { ...state.picker, inputValue: action.value } };
    case "confirmRequested":
      return { ...state, picker: { ...state.picker, pending: action.template } };
    case "confirmClosed":
      if (state.picker.pending === null) return state;
      return { ...state, picker: { ...state.picker, pending: null } };
    case "confirmDismissed":
      return { ...state, picker: { pending: null, inputValue: action.inputValue } };
    case "managerOpened":
      return { ...state, manager: { open: true, seed: action.seed } };
    case "managerOpenChanged":
      if (action.open === state.manager.open) return state;
      return { ...state, manager: { ...state.manager, open: action.open } };
    case "templateUpserted":
      return withItems(state, [
        action.template,
        ...state.templates.items.filter((item) => item.id !== action.template.id),
      ]);
    case "templateRemoved":
      return withItems(
        state,
        state.templates.items.filter((template) => template.id !== action.id),
      );
  }
}
