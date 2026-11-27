"use client";

import * as React from "react";

import { toast } from "sonner";

import {
  createTrafficPickerState,
  PAGE_SIZE,
  trafficPickerReducer,
} from "@/components/_state/traffic-picker-dialog.reducer";
import { CapturedTrafficViewer } from "@/components/traffic-evidence-viewer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { FindingTrafficBinding } from "@/lib/types";
import { intlLocale, t } from "@/i18n";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

export function TrafficPickerDialog({
  findingId,
  contextTask,
  bound,
  onClose,
  onBound,
}: {
  findingId: string;
  contextTask?: string;
  bound: FindingTrafficBinding[];
  onClose: () => void;
  onBound: () => void;
}) {
  const [state, dispatch] = React.useReducer(trafficPickerReducer, undefined, createTrafficPickerState);
  const { filters, selected, preview, saving: busy, error } = state;
  const { host, method, query } = filters;
  const { page } = state.pagination;
  const { items: rows, total, loading } = state.list;
  const alreadyBound = new Set(bound.map((b) => b.snapshot.source_traffic_id));
  React.useEffect(() => {
    let active = true;
    dispatch({ type: "list/loadStarted" });
    const timer = setTimeout(() => {
      api
        .traffic(page, PAGE_SIZE, host, method === "all" ? "" : method, query)
        .then((d) => {
          if (active) dispatch({ type: "list/loaded", items: d.exchanges ?? [], total: d.total ?? 0 });
        })
        .catch((e: Error) => {
          if (active) dispatch({ type: "loadFailed", error: e.message });
        })
        .finally(() => {
          if (active) dispatch({ type: "list/loadFinished" });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, host, method, query]);

  const selectable = rows.filter((e) => !alreadyBound.has(e.id));
  function toggle(id: string, checked: boolean) {
    dispatch({ type: "selectionChanged", ids: [id], checked });
  }
  async function save() {
    dispatch({ type: "saveStarted" });
    try {
      await api.bindFindingTraffic(
        findingId,
        [...selected].map((traffic_id) => ({ traffic_id })),
        contextTask,
      );
      toast.success(t("Bound {count} traffic records", { count: selected.size }));
      onBound();
      onClose();
    } catch (e) {
      dispatch({ type: "saveFailed", error: (e as Error).message });
    } finally {
      dispatch({ type: "saveFinished" });
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy) onClose();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("Bind traffic")}</DialogTitle>
            <DialogDescription>
              {t("Filter and multi-select requests/responses; selections persist across pages. After binding you can set purpose, notes, and order.")}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="flex flex-col gap-3 sm:flex-row">
            <Field>
              <FieldLabel htmlFor="evidence-host">{t("Target host")}</FieldLabel>
              <Input
                id="evidence-host"
                value={host}
                placeholder={t("Domain or IP")}
                onChange={(e) => dispatch({ type: "filtersChanged", patch: { host: e.target.value } })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="evidence-method">{t("Request method")}</FieldLabel>
              <Select value={method} onValueChange={(v) => dispatch({ type: "filtersChanged", patch: { method: v } })}>
                <SelectTrigger id="evidence-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">{t("All methods")}</SelectItem>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="evidence-query">{t("Keyword")}</FieldLabel>
              <Input
                id="evidence-query"
                value={query}
                placeholder={t("URL / body keyword")}
                onChange={(e) => dispatch({ type: "filtersChanged", patch: { query: e.target.value } })}
              />
            </Field>
          </FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="max-h-[45vh] overflow-auto rounded-md border" aria-busy={loading}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      aria-label={t("Select unbound traffic on this page")}
                      disabled={loading || busy || selectable.length === 0}
                      checked={selectable.length > 0 && selectable.every((e) => selected.has(e.id))}
                      onCheckedChange={(checked) =>
                        dispatch({
                          type: "selectionChanged",
                          ids: selectable.map((e) => e.id),
                          checked: checked === true,
                        })
                      }
                    />
                  </TableHead>
                  <TableHead>{t("Method / URL")}</TableHead>
                  <TableHead>{t("Time")}</TableHead>
                  <TableHead>{t("Status code")}</TableHead>
                  <TableHead>{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={t("Select traffic {id}", { id: e.id })}
                        checked={selected.has(e.id) || alreadyBound.has(e.id)}
                        disabled={busy || loading || alreadyBound.has(e.id)}
                        onCheckedChange={(checked) => toggle(e.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {e.method} {e.url}
                      </span>
                      {alreadyBound.has(e.id) ? <Badge variant="secondary">{t("Bound")}</Badge> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(e.ts).toLocaleString(intlLocale)}
                    </TableCell>
                    <TableCell>{e.status}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "previewChanged", id: e.id })}>
                        {t("Preview")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      {loading ? t("Loading…") : t("No matching traffic")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              {t("{selected} selected · {total} total", { selected: selected.size, total })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page === 0}
                onClick={() => dispatch({ type: "pagination/pageChanged", page: page - 1 })}
              >
                {t("Previous")}
              </Button>
              <span className="text-xs">{t("Page {page}", { page: page + 1 })}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || (page + 1) * PAGE_SIZE >= total}
                onClick={() => dispatch({ type: "pagination/pageChanged", page: page + 1 })}
              >
                {t("Next")}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button disabled={busy || selected.size === 0} onClick={() => void save()}>
              {busy ? t("Saving…") : t("Bind {count} traffic records", { count: selected.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CapturedTrafficViewer id={preview} onClose={() => dispatch({ type: "previewChanged", id: null })} />
    </>
  );
}
