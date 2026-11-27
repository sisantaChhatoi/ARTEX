import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { Agent, MCPServer, MCPTool } from "@/lib/types";

export type Transport = "stdio" | "http" | "sse";
export type FormState = {
  name: string;
  transport: Transport;
  command: string;
  args: string;
  url: string;
  env: string;
  insecure: boolean;
  timeoutSeconds: string;
};
export const emptyForm: FormState = {
  name: "",
  transport: "stdio",
  command: "",
  args: "",
  url: "",
  env: "",
  insecure: false,
  timeoutSeconds: "",
};

export type MCPEditorTab = "config" | "tools";

/** Add/edit server sheet. */
export type ServerEditor = {
  open: boolean;
  /** Server being edited; null = add mode. */
  editing: MCPServer | null;
  tab: MCPEditorTab;
  form: FormState;
};

export type MCPPageState = {
  servers: MCPServer[];
  agents: Agent[];
  /** Agent ids each server is visible to, keyed by server id. */
  visibility: Record<number, string[]>;
  editor: ServerEditor;
  /** Tools of the server being edited. */
  tools: ListState<MCPTool>;
  requests: Requests<"save" | "refresh">;
};

export type MCPPageAction =
  | RequestAction<"save" | "refresh">
  /** `list/*` actions apply to the edited server's tools. */
  | ListAction<MCPTool>
  | { type: "serversLoaded"; servers: MCPServer[] }
  | { type: "agentsLoaded"; agents: Agent[] }
  | { type: "visibilityLoaded"; serverId: number; agentIds: string[] }
  | { type: "newServerOpened" }
  | { type: "editServerOpened"; server: MCPServer; form: FormState }
  | { type: "editorChanged"; patch: Partial<Pick<ServerEditor, "open" | "tab">> }
  | { type: "formFieldChanged"; patch: Partial<FormState> };

export const initialMCPPageState: MCPPageState = {
  servers: [],
  agents: [],
  visibility: {},
  editor: { open: false, editing: null, tab: "config", form: emptyForm },
  tools: createList(),
  requests: createRequests(["save", "refresh"]),
};

export function mcpPageReducer(state: MCPPageState, action: MCPPageAction): MCPPageState {
  if (isListAction<MCPTool>(action)) return setSlice(state, "tools", listReducer(state.tools, action));
  if (isRequestAction<"save" | "refresh">(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "serversLoaded":
      return { ...state, servers: action.servers };
    case "agentsLoaded":
      return { ...state, agents: action.agents };
    case "visibilityLoaded":
      return { ...state, visibility: { ...state.visibility, [action.serverId]: action.agentIds } };
    case "newServerOpened":
      return {
        ...state,
        editor: { open: true, editing: null, tab: "config", form: emptyForm },
        tools: listReducer(state.tools, { type: "list/loaded", items: [] }),
      };
    case "editServerOpened":
      // The previous tool list stays until the new server's tools load.
      return { ...state, editor: { open: true, editing: action.server, tab: "config", form: action.form } };
    case "editorChanged":
      return setSlice(state, "editor", mergePatch<ServerEditor>(state.editor, action.patch));
    case "formFieldChanged":
      return { ...state, editor: { ...state.editor, form: { ...state.editor.form, ...action.patch } } };
  }
}
