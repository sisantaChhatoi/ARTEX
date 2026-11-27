import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { NotificationChannel, NotificationMeta } from "@/lib/types";

import type { ChannelForm } from "../_components/channel-fields";

export type NotifyTab = "channels" | "deliveries";

/** Add/edit channel sheet. */
export type ChannelEditor = {
  open: boolean;
  /** Channel being edited; null = adding a new one. */
  editing: NotificationChannel | null;
  form: ChannelForm;
};

/** Global push settings, as typed into their inputs. */
export type GlobalSettings = {
  baseURL: string;
  digestMin: string;
  /** Message render limits; only exposed through /api/settings. */
  summaryMax: string;
  assetsMax: string;
};

export type NotifyRequestKey = "save" | "test" | "globalSave";

export type NotifyPageState = {
  meta: NotificationMeta | null;
  channels: NotificationChannel[];
  tab: NotifyTab;
  editor: ChannelEditor;
  globals: GlobalSettings;
  requests: Requests<NotifyRequestKey>;
};

export type NotifyPageAction =
  | RequestAction<NotifyRequestKey>
  | { type: "metaLoaded"; meta: NotificationMeta }
  | { type: "channelsLoaded"; channels: NotificationChannel[] }
  | { type: "tabChanged"; tab: NotifyTab }
  | { type: "newChannelOpened"; form: ChannelForm }
  | { type: "editChannelOpened"; channel: NotificationChannel }
  | { type: "editorOpenChanged"; open: boolean }
  | { type: "formFieldChanged"; patch: Partial<ChannelForm> }
  | { type: "formConfigChanged"; key: string; value: unknown }
  | { type: "globalsChanged"; patch: Partial<GlobalSettings> }
  | { type: "pushToggled"; enabled: boolean };

/** `emptyForm` lives with the channel field table (which needs i18n), so the page passes the initial form in. */
export function initNotifyPageState(form: ChannelForm): NotifyPageState {
  return {
    meta: null,
    channels: [],
    tab: "channels",
    editor: { open: false, editing: null, form },
    globals: { baseURL: "", digestMin: "", summaryMax: "", assetsMax: "" },
    requests: createRequests(["save", "test", "globalSave"]),
  };
}

function formFromChannel(ch: NotificationChannel): ChannelForm {
  // filter is a Go struct on the backend and always serializes as an object (never null), so no fallback is needed.
  const f = ch.filter;
  return {
    name: ch.name,
    kind: ch.kind,
    mode: ch.mode,
    enabled: ch.enabled,
    ratePerMin: String(ch.rate_per_min),
    // Credentials in the backend-echoed config are masked values; put them into the form as-is and send them back
    // as-is on submit, which tells the backend to keep the stored values.
    config: { ...ch.config },
    minSeverity: f.min_severity ?? "",
    includeText: (f.vulnclass_include ?? []).join("\n"),
    excludeText: (f.vulnclass_exclude ?? []).join("\n"),
    taskIDsText: (f.task_ids ?? []).join(","),
    assetIDsText: (f.asset_ids ?? []).join(","),
    onStatusChange: f.on_status_change ?? false,
  };
}

export function notifyPageReducer(state: NotifyPageState, action: NotifyPageAction): NotifyPageState {
  if (isRequestAction<NotifyRequestKey>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "metaLoaded": {
      // A (re)load refills the URL and digest inputs from the server.
      const { public_base_url: baseURL, digest_interval_min: digestMin } = action.meta;
      return { ...state, meta: action.meta, globals: { ...state.globals, baseURL, digestMin } };
    }
    case "channelsLoaded":
      return { ...state, channels: action.channels };
    case "tabChanged":
      return action.tab === state.tab ? state : { ...state, tab: action.tab };
    case "newChannelOpened":
      return { ...state, editor: { open: true, editing: null, form: action.form } };
    case "editChannelOpened":
      return { ...state, editor: { open: true, editing: action.channel, form: formFromChannel(action.channel) } };
    case "editorOpenChanged":
      if (action.open === state.editor.open) return state;
      return { ...state, editor: { ...state.editor, open: action.open } };
    case "formFieldChanged":
      return { ...state, editor: { ...state.editor, form: { ...state.editor.form, ...action.patch } } };
    case "formConfigChanged": {
      const { form } = state.editor;
      return {
        ...state,
        editor: { ...state.editor, form: { ...form, config: { ...form.config, [action.key]: action.value } } },
      };
    }
    case "globalsChanged":
      return { ...state, globals: { ...state.globals, ...action.patch } };
    case "pushToggled":
      return state.meta ? { ...state, meta: { ...state.meta, enabled: action.enabled } } : state;
  }
}
