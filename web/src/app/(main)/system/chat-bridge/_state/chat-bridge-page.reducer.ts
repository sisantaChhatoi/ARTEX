import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { ChatBridge } from "@/lib/types";

export interface ChatBridgeForm {
  enabled: boolean;
  /** Empty = keep the stored token. */
  token: string;
  baseURL: string;
  /** One chat ID per line. */
  chats: string;
}

export function formFrom(b: ChatBridge | undefined): ChatBridgeForm {
  return {
    enabled: b?.enabled ?? false,
    token: "",
    baseURL: typeof b?.config.base_url === "string" ? b.config.base_url : "",
    chats: (b?.allowed_chats ?? []).join("\n"),
  };
}

type ChatBridgeRequest = "save" | "test";

export type ChatBridgePageState = {
  bridge: ChatBridge | undefined;
  form: ChatBridgeForm;
  loaded: boolean;
  requests: Requests<ChatBridgeRequest>;
};

export type ChatBridgePageAction =
  | RequestAction<ChatBridgeRequest>
  /** A load or status poll. `resetForm` refills the form; polls leave what the operator is typing. */
  | { type: "bridgeLoaded"; bridge: ChatBridge | undefined; resetForm: boolean }
  /** After a save the form shows what the server stored. */
  | { type: "bridgeSaved"; bridge: ChatBridge }
  | { type: "formChanged"; patch: Partial<ChatBridgeForm> };

export const initialChatBridgePageState: ChatBridgePageState = {
  bridge: undefined,
  form: formFrom(undefined),
  loaded: false,
  requests: createRequests(["save", "test"]),
};

export function chatBridgePageReducer(state: ChatBridgePageState, action: ChatBridgePageAction): ChatBridgePageState {
  if (isRequestAction<ChatBridgeRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "bridgeLoaded":
      return {
        ...state,
        bridge: action.bridge,
        form: action.resetForm ? formFrom(action.bridge) : state.form,
        loaded: true,
      };
    case "bridgeSaved":
      return { ...state, bridge: action.bridge, form: formFrom(action.bridge) };
    case "formChanged":
      return setSlice(state, "form", mergePatch(state.form, action.patch));
  }
}
