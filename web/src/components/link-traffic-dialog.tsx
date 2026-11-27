"use client";

import * as React from "react";

import { toast } from "sonner";

import {
  initialLinkTrafficState,
  linkTrafficReducer,
  PAGE_SIZE,
} from "@/components/_state/link-traffic-dialog.reducer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api";
import { t } from "@/i18n";

export function LinkTrafficDialog({
  trafficIds,
  onClose,
  onBound,
}: {
  trafficIds: string[];
  onClose: () => void;
  onBound: () => void;
}) {
  const [state, dispatch] = React.useReducer(linkTrafficReducer, initialLinkTrafficState);
  const { query, selected, saving: busy, error } = state;
  const { page } = state.pagination;
  const { items, total, loading } = state.list;
  React.useEffect(() => {
    let active = true;
    dispatch({ type: "list/loadStarted" });
    const timer = setTimeout(() => {
      api
        .findingsPage({ page, pageSize: PAGE_SIZE, query })
        .then((d) => {
          if (active) dispatch({ type: "list/loaded", items: d.items, total: d.total });
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
  }, [query, page]);
  async function save() {
    if (!selected?.finding_id) return;
    dispatch({ type: "saveStarted" });
    try {
      await api.bindFindingTraffic(
        selected.finding_id,
        trafficIds.map((traffic_id) => ({ traffic_id })),
      );
      toast.success(
        t("Linked {count} traffic records to vulnerability #{id}", { count: trafficIds.length, id: selected.finding_id }),
      );
      onBound();
      onClose();
    } catch (e) {
      dispatch({ type: "saveFailed", error: (e as Error).message });
    } finally {
      dispatch({ type: "saveFinished" });
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Link to vulnerability")}</DialogTitle>
          <DialogDescription>
            {t("Save the {count} selected traffic records as evidence of an existing vulnerability.", {
              count: trafficIds.length,
            })}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="link-finding-query">{t("Find vulnerability")}</FieldLabel>
            <Input
              id="link-finding-query"
              placeholder={t("Name / summary / vulnerability class")}
              value={query}
              onChange={(e) => dispatch({ type: "queryChanged", query: e.target.value })}
            />
          </Field>
        </FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex max-h-[40vh] flex-col gap-2 overflow-auto" aria-busy={loading}>
          {items.map((f) => (
            <Button
              key={f.finding_id ?? f.id}
              variant={selected?.finding_id === f.finding_id ? "secondary" : "outline"}
              className="h-auto justify-start p-3 text-left whitespace-normal"
              aria-pressed={selected?.finding_id === f.finding_id}
              disabled={busy || !f.finding_id || f.inherited}
              onClick={() => dispatch({ type: "findingSelected", finding: f })}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span>
                  #{f.finding_id ?? f.id} · {f.name || f.vulnclass}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{f.summary}</span>
              </span>
            </Button>
          ))}
          {!items.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {loading ? t("Loading…") : t("No matching vulnerabilities; register one first")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => dispatch({ type: "pagination/pageChanged", page: page - 1 })}
          >
            {t("Previous")}
          </Button>
          <span className="text-xs">{t("Page {page} · {total} total", { page, total })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page * PAGE_SIZE >= total}
            onClick={() => dispatch({ type: "pagination/pageChanged", page: page + 1 })}
          >
            {t("Next")}
          </Button>
        </div>
        <p className="text-sm">
          {selected
            ? t("Selected: #{id} {name}", { id: selected.finding_id ?? "", name: selected.name || selected.vulnclass })
            : t("Select a vulnerability")}
        </p>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={busy || !selected} onClick={() => void save()}>
            {busy ? t("Saving…") : t("Link")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
