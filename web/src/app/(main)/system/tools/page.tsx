"use client";

import * as React from "react";
import { toast } from "sonner";
import { PlayIcon, PlusIcon, RotateCcwIcon, SaveIcon, SearchIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import type { Agent, Tool } from "@/lib/types";

import {
  type CustomToolForm,
  type CustomToolKind,
  customToolDialogReducer,
  type ExecState,
  initialCustomToolDialogState,
} from "./_state/custom-tool-dialog.reducer";
import { createToolEditorState, type ParamRow, toolEditorReducer } from "./_state/tool-editor.reducer";
import { initialToolsPageState, toolsPageReducer } from "./_state/tools-page.reducer";

// Traffic tools are host tools gated by the global traffic capture switch: bindable, but
// only usable when capture is on. Keep in sync with traffic.SeedToolMetas.
const TRAFFIC_TOOL_KEYS = new Set(["traffic_search", "traffic_get"]);

// toRows flattens schema.properties into an ordered row list for editing (see ParamRow).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRows(schema: Record<string, any>): ParamRow[] {
  const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set<string>((schema?.required as string[]) ?? []);
  const rows: ParamRow[] = [];
  for (const [name, p] of Object.entries(props)) {
    const type = String(p?.type ?? "");
    const hasDefault = p != null && "default" in p && (p as Record<string, unknown>).default != null;
    rows.push({
      name, type,
      required: required.has(name),
      description: String(p?.description ?? ""),
      defaultStr: hasDefault ? String((p as Record<string, unknown>).default) : "",
      scalar: ["string", "integer", "number", "boolean"].includes(type),
    });
    // Expand items.properties for array params so sub-fields are editable.
    if (type === "array") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemProps = (p as any)?.items?.properties as Record<string, Record<string, unknown>> | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemRequired = new Set<string>(((p as any)?.items?.required as string[]) ?? []);
      if (itemProps) {
        for (const [subName, subP] of Object.entries(itemProps)) {
          const subType = String((subP as Record<string, unknown>)?.type ?? "");
          const subHasDefault = subP != null && "default" in subP && subP.default != null;
          rows.push({
            name: subName, type: subType,
            required: itemRequired.has(subName),
            description: String(subP?.description ?? ""),
            defaultStr: subHasDefault ? String(subP.default) : "",
            scalar: ["string", "integer", "number", "boolean"].includes(subType),
            parentKey: name,
          });
        }
      }
    }
  }
  return rows;
}

// coerceDefault turns the edited default string back into a typed JSON value, or
// undefined to drop the "default" key entirely.
function coerceDefault(type: string, raw: string): unknown {
  const s = raw.trim();
  if (s === "") return undefined;
  if (type === "integer" || type === "number") {
    const n = Number(s);
    return Number.isNaN(n) ? undefined : n;
  }
  if (type === "boolean") return s === "true";
  return raw;
}

// applyRows writes edited rows back into a deep-copied schema (structure untouched).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyRows(schema: Record<string, any>, rows: ParamRow[]): Record<string, any> {
  const next = structuredClone(schema ?? {});
  const props = (next.properties ?? {}) as Record<string, Record<string, unknown>>;
  for (const r of rows) {
    if (r.parentKey) {
      // Sub-field of an array param's items.properties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent = props[r.parentKey] as any;
      const subP = parent?.items?.properties?.[r.name] as Record<string, unknown> | undefined;
      if (!subP) continue;
      subP.description = r.description;
      if (r.scalar) {
        const dv = coerceDefault(r.type, r.defaultStr);
        if (dv === undefined) delete subP.default;
        else subP.default = dv;
      }
    } else {
      const p = props[r.name];
      if (!p) continue;
      p.description = r.description;
      if (r.scalar) {
        const dv = coerceDefault(r.type, r.defaultStr);
        if (dv === undefined) delete p.default;
        else p.default = dv;
      }
    }
  }
  return next;
}

// ToolEditor is the full edit form for one tool, rendered inside the drawer.
function ToolEditor({
  tool,
  agents,
  captureOn,
  onSaved,
  onClose,
}: {
  tool: Tool;
  agents: Agent[];
  captureOn: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  // traffic tools can't be bound/enabled until the global traffic capture switch is on.
  const trafficGated = TRAFFIC_TOOL_KEYS.has(tool.key) && !captureOn;
  const [state, dispatch] = React.useReducer(toolEditorReducer, tool, (initial) =>
    createToolEditorState(initial, toRows(initial.schema)),
  );
  const { description, bound, enabled, rows } = state.form;
  const saving = state.requests.save.pending;

  const setRow = (i: number, patch: Partial<ParamRow>) => dispatch({ type: "rowChanged", index: i, patch });
  const toggleAgent = (k: string) => dispatch({ type: "agentToggled", agent: k });

  async function save() {
    dispatch({ type: "request/started", key: "save" });
    try {
      await api.saveTool(tool.key, {
        description,
        schema: applyRows(tool.schema, rows),
        agents: bound,
        enabled,
      });
      toast.success(t('Tool "{key}" saved', { key: tool.key }));
      onSaved();
      onClose();
    } catch (e) {
      toast.error(t("Save failed: {error}", { error: (e as Error).message }));
    } finally {
      dispatch({ type: "request/finished", key: "save" });
    }
  }
  async function reset() {
    try {
      await api.resetTool(tool.key);
      toast.success(t('Restored "{key}" to the code default', { key: tool.key }));
      onSaved();
      onClose();
    } catch (e) {
      toast.error(t("Restore failed: {error}", { error: (e as Error).message }));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
        {trafficGated && (
          <div className="border-amber-500/40 bg-amber-500/10 text-muted-foreground rounded-md border px-3 py-2 text-xs">
            {(() => {
              const [before, after] = t("This tool depends on {capture}.").split("{capture}");
              return (
                <>
                  {before}
                  <b>{t("traffic capture")}</b>
                  {after}
                </>
              );
            })()}{" "}
            {t('Enable traffic capture under "System settings" first before binding it to agents and enabling it.')}
          </div>
        )}
        {/* binding + switch */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground text-xs">{t("Bind agents (controls which agents get this tool)")}</Label>
            <div className="flex flex-wrap gap-3">
              {agents.map((ag) => (
                <label key={ag.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bound.includes(ag.key)}
                    disabled={trafficGated}
                    onCheckedChange={() => toggleAgent(ag.key)}
                  />
                  {ag.name}
                  <span className="text-muted-foreground font-mono text-xs">{ag.key}</span>
                </label>
              ))}
              {agents.length === 0 && <span className="text-muted-foreground text-xs">{t("(no agents)")}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              onCheckedChange={(v) => dispatch({ type: "formFieldChanged", patch: { enabled: v } })}
              id={`en-${tool.key}`}
            />
            <Label htmlFor={`en-${tool.key}`} className="text-sm">
              {t("Enable")}
            </Label>
          </div>
        </div>

        {/* description */}
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs">{t("Tool description (sent to the model)")}</Label>
          <Textarea
            className="font-mono text-xs"
            rows={6}
            value={description}
            onChange={(e) => dispatch({ type: "formFieldChanged", patch: { description: e.target.value } })}
          />
        </div>

        {/* params */}
        <div className="grid gap-2">
          <Label className="text-muted-foreground text-xs">
            {t("Parameters (name / type / required are read-only; description and default are editable)")}
          </Label>
          {rows.length === 0 && <span className="text-muted-foreground text-xs">{t("(no parameters)")}</span>}
          {rows.map((r, i) => (
            <div
              key={(r.parentKey ?? "") + "." + r.name}
              className={r.parentKey
                ? "border-l-2 border-muted ml-3 pl-3 grid gap-2 py-2"
                : "grid gap-2 rounded-md border p-3"
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {r.parentKey && <span className="text-muted-foreground font-mono text-[10px]">↳</span>}
                <span className="font-mono text-sm">{r.name}</span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {r.type || "?"}
                </Badge>
                {r.required && (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {t("Required")}
                  </Badge>
                )}
                {r.parentKey && (
                  <span className="text-muted-foreground text-[10px]">{t("items sub-field")}</span>
                )}
              </div>
              <div className="grid gap-2">
                <div className="grid gap-1">
                  <Label className="text-muted-foreground text-[11px]">{t("Description")}</Label>
                  <Input
                    className="text-xs"
                    value={r.description}
                    onChange={(e) => setRow(i, { description: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-muted-foreground text-[11px]">{t("Default")}</Label>
                  <Input
                    className="text-xs"
                    placeholder={r.scalar ? t("(empty = no default)") : t("scalars only")}
                    disabled={!r.scalar}
                    value={r.defaultStr}
                    onChange={(e) => setRow(i, { defaultStr: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="mt-4" />
      <div className="flex flex-wrap gap-2 p-4">
        <Button size="sm" onClick={save} disabled={saving}>
          <SaveIcon /> {t("Save")}
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          <RotateCcwIcon /> {t("Restore defaults")}
        </Button>
      </div>
    </div>
  );
}

// ToolGridCard is one clickable tile in the catalog grid.
function ToolGridCard({ tool, onClick }: { tool: Tool; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:border-primary/50 hover:bg-muted/40 focus-visible:ring-ring flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{tool.key}</span>
        {tool.system ? (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {t("System")}
          </Badge>
        ) : (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {t("Custom · {kind}", { kind: tool.kind ?? "" })}
          </Badge>
        )}
        {tool.deferred && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {t("deferred")}
          </Badge>
        )}
        {!tool.enabled && (
          <Badge variant="outline" className="text-destructive px-1.5 py-0 text-[10px]">
            {t("Disabled")}
          </Badge>
        )}
        <Badge
          variant="secondary"
          className="ml-auto px-1.5 py-0 text-[10px] tabular-nums"
          title={t("{count} calls in total", { count: tool.calls ?? 0 })}
        >
          {t("{count} calls", { count: tool.calls ?? 0 })}
        </Badge>
      </div>
      <p className="text-muted-foreground line-clamp-1 h-4 text-xs">
        {tool.description || t("(no description)")}
      </p>
      <div className="mt-auto flex flex-wrap gap-1 pt-1">
        {tool.agents.length === 0 && (
          <span className="text-muted-foreground text-[10px]">{t("(no agents bound)")}</span>
        )}
        {tool.agents.map((a) => (
          <Badge key={a} variant="outline" className="px-1.5 py-0 text-[10px]">
            {a}
          </Badge>
        ))}
      </div>
    </button>
  );
}

export default function ToolsPage() {
  const [state, dispatch] = React.useReducer(toolsPageReducer, initialToolsPageState);
  const { tools, agents, captureOn } = state.data;
  const { query } = state;
  const { selectedKey, customEdit } = state.editing;

  const reload = React.useCallback(() => {
    api
      .tools()
      .then((tools) => dispatch({ type: "toolsLoaded", tools }))
      .catch(() => dispatch({ type: "toolsLoaded", tools: [] }));
  }, []);
  React.useEffect(() => {
    reload();
    api
      .agents()
      .then((agents) => dispatch({ type: "agentsLoaded", agents }))
      .catch(() => {});
    api
      .settings()
      .then((s) => dispatch({ type: "captureLoaded", captureOn: !!s.traffic_capture }))
      .catch(() => {});
  }, [reload]);

  const selected = tools.find((t) => t.key === selectedKey) ?? null;
  const matchTool = React.useCallback((t: Tool) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.key.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.agents.some((a) => a.toLowerCase().includes(q))
    );
  }, [query]);
  const systemTools = tools.filter((t) => t.system && matchTool(t));
  const customTools = tools.filter((t) => !t.system && matchTool(t));
  const allSystemCount = tools.filter((t) => t.system).length;
  const allCustomCount = tools.filter((t) => !t.system).length;
  // clicking a built-in tool opens the binding drawer; a custom tool opens its full editor.
  const openTool = (t: Tool) => dispatch({ type: "toolOpened", tool: t });

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("Tools")}</h1>
          <p className="text-muted-foreground text-sm">{t("Descriptions/bindings for system tools, plus custom tools (command/script/http)")}</p>
        </div>
        <div className="relative w-64">
          <SearchIcon className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("Search tool name, description, agent…")}
            value={query}
            onChange={(e) => dispatch({ type: "queryChanged", query: e.target.value })}
          />
        </div>
      </div>

      <Tabs defaultValue="system">
        <TabsList>
          <TabsTrigger value="system">{t("System tools")}</TabsTrigger>
          <TabsTrigger value="custom">{t("Custom tools")}</TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>{t("System tools")}</CardTitle>
              <CardDescription>
                {query.trim()
                  ? t(
                      "{count} / {total} matching; click a card to edit the description, parameter defaults and agent bindings",
                      { count: systemTools.length, total: allSystemCount },
                    )
                  : t("{total} total; click a card to edit the description, parameter defaults and agent bindings", {
                      total: allSystemCount,
                    })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {systemTools.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  {query.trim() ? t("No matching system tools") : t("(no system tools yet, waiting for the backend seed)")}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {systemTools.map((t) => (
                    <ToolGridCard key={t.key} tool={t} onClick={() => openTool(t)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{t("Custom tools")}</CardTitle>
                  <CardDescription>
                    {query.trim()
                      ? t("shell/command/script/http, {count} / {total} matching; click a card to edit", {
                          count: customTools.length,
                          total: allCustomCount,
                        })
                      : t(
                          "shell (bash declaration) / command (command template) / script (Python) / http (API), {total} total; click a card to edit",
                          { total: allCustomCount },
                        )}
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => dispatch({ type: "customToolCreateStarted" })}>
                  <PlusIcon /> {t("Create custom tool")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {customTools.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  {query.trim() ? t("No matching custom tools") : t("(no custom tools yet; click 'Create custom tool' in the top right)")}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {customTools.map((t) => (
                    <ToolGridCard key={t.key} tool={t} onClick={() => openTool(t)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(o) => !o && dispatch({ type: "toolEditorClosed" })}>
        <SheetContent
          side="right"
          className="gap-0 p-0 data-[side=right]:w-[30vw] data-[side=right]:sm:max-w-[30vw]"
        >
          {selected && (
            <>
              <SheetHeader className="px-4">
                <SheetTitle className="font-mono">{selected.key}</SheetTitle>
                <SheetDescription>{t("Edit the description, parameter defaults and agent bindings")}</SheetDescription>
              </SheetHeader>
              <ToolEditor
                key={selected.key}
                tool={selected}
                agents={agents}
                captureOn={captureOn}
                onSaved={reload}
                onClose={() => dispatch({ type: "toolEditorClosed" })}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <CustomToolDialog
        edit={customEdit}
        agents={agents}
        onClose={() => dispatch({ type: "customEditorClosed" })}
        onSaved={() => {
          dispatch({ type: "customEditorClosed" });
          reload();
        }}
      />
    </div>
  );
}

// ---- custom tool editor ----

function CustomToolDialog({
  edit,
  agents,
  onClose,
  onSaved,
}: {
  edit: Tool | "new" | null;
  agents: Agent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = edit === "new";
  const tool = edit && edit !== "new" ? edit : null;
  const [state, dispatch] = React.useReducer(customToolDialogReducer, initialCustomToolDialogState);
  const { key, description, kind, ex, schemaText, bound, deferred, enabled } = state.form;
  const { paramsText, result: testResult } = state.test;
  const saving = state.requests.save.pending;
  const testing = state.requests.test.pending;
  const setField = (patch: Partial<Omit<CustomToolForm, "ex">>) => dispatch({ type: "formFieldChanged", patch });
  const setExField = (patch: Partial<ExecState>) => dispatch({ type: "execFieldChanged", patch });

  // (re)load form state when opening.
  React.useEffect(() => {
    if (!edit) return;
    dispatch({ type: "editLoaded", edit });
  }, [edit]);

  const toggleAgent = (k: string) => dispatch({ type: "agentToggled", agent: k });

  function buildExec(): Record<string, unknown> {
    if (kind === "shell") return {};
    const t = ex.timeout_ms ? Number(ex.timeout_ms) : undefined;
    if (kind === "command") return { command: ex.command, timeout_ms: t };
    if (kind === "script") return { code: ex.code, timeout_ms: t };
    let headers: Record<string, string> = {};
    if (ex.headers.trim()) {
      try { headers = JSON.parse(ex.headers); } catch { /* validated on save */ }
    }
    return { method: ex.method, url: ex.url, headers, body: ex.body, timeout_ms: t, proxy: ex.proxy, use_recording_proxy: ex.use_recording_proxy };
  }

  async function save() {
    if (isNew && !/^[a-z][a-z0-9_]*$/.test(key.trim())) {
      toast.error(t("key must start with a lowercase letter and contain only lowercase letters/digits/underscores"));
      return;
    }
    let schema: Record<string, unknown> = {};
    if (schemaText.trim()) {
      try { schema = JSON.parse(schemaText); } catch { toast.error(t("Invalid parameter JSON Schema")); return; }
    }
    if (kind === "http" && ex.headers.trim()) {
      try { JSON.parse(ex.headers); } catch { toast.error(t("Invalid headers JSON")); return; }
    }
    if (kind === "http") {
      const props = (schema as { properties?: Record<string, unknown> }).properties;
      if (!props || Object.keys(props).length === 0) {
        toast.error(t("http tools must provide a parameter JSON Schema (with properties; cannot be empty)"));
        return;
      }
    }
    dispatch({ type: "request/started", key: "save" });
    const payload = { description, schema: kind === "shell" ? {} : schema, agents: bound, enabled, kind, exec: buildExec(), deferred: kind === "shell" ? false : deferred };
    try {
      if (isNew) await api.createCustomTool({ key: key.trim(), ...payload });
      else await api.updateCustomTool(tool!.key, payload);
      toast.success(isNew ? t("Custom tool created") : t("Saved"));
      onSaved();
    } catch (e) {
      toast.error(t("Save failed: {error}", { error: (e as Error).message }));
    } finally {
      dispatch({ type: "request/finished", key: "save" });
    }
  }
  async function del() {
    if (!tool) return;
    try {
      await api.deleteCustomTool(tool.key);
      toast.success(t("Deleted"));
      onSaved();
    } catch (e) {
      toast.error(t("Delete failed: {error}", { error: (e as Error).message }));
    }
  }
  // runTest dry-runs the CURRENT form (unsaved) with the sample params, so a
  // template/script/request can be debugged before saving.
  async function runTest() {
    let params: Record<string, unknown> = {};
    if (paramsText.trim()) {
      try { params = JSON.parse(paramsText); } catch { toast.error(t("Invalid test parameter JSON")); return; }
    }
    if (kind === "http" && ex.headers.trim()) {
      try { JSON.parse(ex.headers); } catch { toast.error(t("Invalid headers JSON")); return; }
    }
    dispatch({ type: "testStarted" });
    try {
      // key: a saved tool's stored secrets replace the masked placeholders.
      const r = await api.testCustomTool({ key: tool?.key, kind, exec: buildExec(), params });
      dispatch({ type: "testChanged", patch: { result: r } });
    } catch (e) {
      dispatch({ type: "testChanged", patch: { result: { output: (e as Error).message, is_error: true } } });
    } finally {
      dispatch({ type: "request/finished", key: "test" });
    }
  }

  return (
    <Sheet open={!!edit} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 data-[side=right]:w-[45vw] data-[side=right]:sm:max-w-[45vw] data-[side=right]:min-w-[480px]"
      >
        <SheetHeader className="px-4">
          <SheetTitle>{isNew ? t("Create custom tool") : t("Edit {key}", { key: tool?.key ?? "" })}</SheetTitle>
          <SheetDescription>
            {t(
              "shell = a bash environment declaration (name + description only, telling the model bash is available); command/script/http need an execution spec.",
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("Key")}</Label>
            <Input className="font-mono" placeholder={t("e.g. nmap_scan")} value={key} disabled={!isNew}
              onChange={(e) => setField({ key: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("Description (sent to the model)")}</Label>
            <Textarea rows={2} value={description} onChange={(e) => setField({ description: e.target.value })} />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">{t("Type")}</Label>
            <Select value={kind} onValueChange={(v) => setField({ kind: v as CustomToolKind })}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shell">{t("shell (bash environment declaration)")}</SelectItem>
                <SelectItem value="command">{t("command (shell command template)")}</SelectItem>
                <SelectItem value="script">{t("script (Python script)")}</SelectItem>
                <SelectItem value="http">{t("http (API request)")}</SelectItem>
              </SelectContent>
            </Select>
            {kind === "shell" && (
              <p className="text-muted-foreground text-xs">{t("Suited to well-known tools like nmap, sqlmap, ffuf — the model already knows their usage; you only need to declare \"can be invoked in bash\". The name + description are appended to the Bash tool's description.")}</p>
            )}
          </div>

          {kind === "command" && (
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("Command template (placeholder {param}, e.g. nmap -p {ports} {target})")}</Label>
              <Textarea className="font-mono text-xs" rows={2} value={ex.command}
                onChange={(e) => setExField({ command: e.target.value })}
              />
            </div>
          )}
          {kind === "script" && (
            <div className="grid gap-1.5">
              <Label className="text-xs">
                {t('Python body (params arrive via stdin JSON / os.environ["TOOL_X"])')}
              </Label>
              <Textarea className="font-mono text-xs" rows={10} value={ex.code}
                placeholder={"import json,sys\nargs=json.load(sys.stdin)\nprint(...)"}
                onChange={(e) => setExField({ code: e.target.value })}
              />
            </div>
          )}
          {kind === "http" && (
            <div className="grid gap-2">
              <div className="flex gap-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t("Method")}</Label>
                  <Input className="w-24" value={ex.method} onChange={(e) => setExField({ method: e.target.value })} />
                </div>
                <div className="grid flex-1 gap-1.5">
                  <Label className="text-xs">{t("URL (may contain {param})")}</Label>
                  <Input
                    className="font-mono text-xs"
                    value={ex.url}
                    onChange={(e) => setExField({ url: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">{t("Headers (JSON, may contain {param})")}</Label>
                <Textarea className="font-mono text-xs" rows={2} value={ex.headers}
                  placeholder={'{"Authorization": "Bearer {token}"}'}
                  onChange={(e) => setExField({ headers: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">{t("Body (may contain {param})")}</Label>
                <Textarea
                  className="font-mono text-xs"
                  rows={2}
                  value={ex.body}
                  onChange={(e) => setExField({ body: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t("Proxy URL (empty = direct)")}</Label>
                  <Input
                    className="font-mono text-xs w-56"
                    value={ex.proxy}
                    onChange={(e) => setExField({ proxy: e.target.value })}
                  />
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={ex.use_recording_proxy}
                    onCheckedChange={(v) => setExField({ use_recording_proxy: !!v })}
                  />
                  {t("Use recording proxy")}
                </label>
              </div>
            </div>
          )}

          {kind !== "shell" && (
            <div className="flex items-center gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">{t("Timeout (ms, empty = default)")}</Label>
                <Input
                  type="number"
                  className="w-32"
                  value={ex.timeout_ms}
                  onChange={(e) => setExField({ timeout_ms: e.target.value })}
                />
              </div>
            </div>
          )}

          {kind !== "shell" && (
            <div className="grid gap-1.5">
              <Label className="text-xs">
                {kind === "http"
                  ? t("Parameter JSON Schema (required for http tools, must include properties)")
                  : t("Parameter JSON Schema (empty = a thin {args} shell is generated automatically)")}
              </Label>
              <Textarea className="font-mono text-xs" rows={4} value={schemaText}
                placeholder={'{"type":"object","properties":{"target":{"type":"string"}},"required":["target"]}'}
                onChange={(e) => setField({ schemaText: e.target.value })}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label className="text-muted-foreground text-xs">{t("Bind agents")}</Label>
            <div className="flex flex-wrap gap-3">
              {agents.map((a) => (
                <label key={a.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={bound.includes(a.key)} onCheckedChange={() => toggleAgent(a.key)} />
                  {a.name}<span className="text-muted-foreground font-mono text-xs">{a.key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled} onCheckedChange={(v) => setField({ enabled: v })} /> {t("Enable")}
            </label>
            {kind !== "shell" && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={deferred} onCheckedChange={(v) => setField({ deferred: v })} />{" "}
                {t("deferred (enable only for many rarely-used tools)")}
              </label>
            )}
          </div>

          {kind !== "shell" && (
            <div className="grid gap-1.5 rounded-md border p-3">
              <Label className="text-xs font-medium">{t("Test run (uses the current form, nothing is saved)")}</Label>
              <Textarea className="font-mono text-xs" rows={2} value={paramsText}
                placeholder={t('Sample params JSON, e.g. {"target":"example.com"}')}
                onChange={(e) => dispatch({ type: "testChanged", patch: { paramsText: e.target.value } })}
              />
              <div>
                <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
                  <PlayIcon /> {testing ? t("Running…") : t("Test run")}
                </Button>
              </div>
              {testResult && (
                <pre
                  className={
                    "max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 font-mono text-xs " +
                    (testResult.is_error ? "text-destructive" : "")
                  }
                >
                  {testResult.output || t("(no output)")}
                </pre>
              )}
            </div>
          )}
        </div>

        <Separator />
        <div className="flex items-center gap-2 p-4">
          <Button size="sm" onClick={save} disabled={saving}>
            <SaveIcon /> {isNew ? t("Create") : t("Save")}
          </Button>
          {!isNew && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={del}>
              <Trash2Icon /> {t("Delete")}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
