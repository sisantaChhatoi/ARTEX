import type { Agent, Tool } from "@/lib/types";

/** Data loaded from the server once (tools reload after edits). */
export type ToolsPageData = {
  tools: Tool[];
  agents: Agent[];
  /** Global traffic capture switch; gates the traffic tools. */
  captureOn: boolean;
};

/** Which editor is open: the binding drawer for a system tool, or the custom tool sheet. */
export type ToolsPageEditing = {
  /** System tool shown in the binding drawer. */
  selectedKey: string | null;
  /** Custom tool being edited, "new" while creating one, null when closed. */
  customEdit: Tool | "new" | null;
};

export type ToolsPageState = {
  data: ToolsPageData;
  /** Search box value; matched against key, description and bound agents. */
  query: string;
  editing: ToolsPageEditing;
};

export type ToolsPageAction =
  | { type: "toolsLoaded"; tools: Tool[] }
  | { type: "agentsLoaded"; agents: Agent[] }
  | { type: "captureLoaded"; captureOn: boolean }
  | { type: "queryChanged"; query: string }
  /** A grid card was clicked: system tools open the binding drawer, custom tools their full editor. */
  | { type: "toolOpened"; tool: Tool }
  | { type: "customToolCreateStarted" }
  | { type: "toolEditorClosed" }
  | { type: "customEditorClosed" };

export const initialToolsPageState: ToolsPageState = {
  data: { tools: [], agents: [], captureOn: false },
  query: "",
  editing: { selectedKey: null, customEdit: null },
};

function setEditing(state: ToolsPageState, patch: Partial<ToolsPageEditing>): ToolsPageState {
  const editing = { ...state.editing, ...patch };
  if (editing.selectedKey === state.editing.selectedKey && editing.customEdit === state.editing.customEdit) {
    return state;
  }
  return { ...state, editing };
}

export function toolsPageReducer(state: ToolsPageState, action: ToolsPageAction): ToolsPageState {
  switch (action.type) {
    case "toolsLoaded":
      return { ...state, data: { ...state.data, tools: action.tools } };
    case "agentsLoaded":
      return { ...state, data: { ...state.data, agents: action.agents } };
    case "captureLoaded":
      if (action.captureOn === state.data.captureOn) return state;
      return { ...state, data: { ...state.data, captureOn: action.captureOn } };
    case "queryChanged":
      return action.query === state.query ? state : { ...state, query: action.query };
    case "toolOpened":
      return action.tool.system
        ? setEditing(state, { selectedKey: action.tool.key })
        : setEditing(state, { customEdit: action.tool });
    case "customToolCreateStarted":
      return setEditing(state, { customEdit: "new" });
    case "toolEditorClosed":
      return setEditing(state, { selectedKey: null });
    case "customEditorClosed":
      return setEditing(state, { customEdit: null });
  }
}
