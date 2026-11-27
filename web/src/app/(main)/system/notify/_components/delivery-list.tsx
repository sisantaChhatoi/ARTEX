"use client";

import * as React from "react";

import { RefreshCwIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { intlLocale, t } from "@/i18n";
import { api } from "@/lib/api";
import { statusMeta, toneClasses } from "@/lib/status";
import type { NotificationChannel } from "@/lib/types";

import { deliveryListReducer, initialDeliveryListState } from "../_state/delivery-list.reducer";

// DeliveryList is the delivery records table: filterable by channel and state, with manual retry for failed items.
export function DeliveryList({ channels }: { channels: NotificationChannel[] }) {
  const [listState, dispatch] = React.useReducer(deliveryListReducer, initialDeliveryListState);
  const { channelID, state } = listState.filters;
  const { page, size: pageSize } = listState.pagination;
  const { items: rows, total, loading } = listState.list;

  const load = React.useCallback(() => {
    dispatch({ type: "list/loadStarted" });
    api
      .notifyDeliveries({ channelId: channelID, state, page, pageSize })
      .then((r) => dispatch({ type: "list/loaded", items: r.deliveries, total: r.total }))
      .catch((e) => toast.error(t("Failed to load delivery records: {error}", { error: (e as Error).message })))
      .finally(() => dispatch({ type: "list/loadFinished" }));
  }, [channelID, state, page, pageSize]);
  React.useEffect(() => {
    load();
  }, [load]);

  async function retry(id: number) {
    try {
      await api.notifyRetryDelivery(id);
      toast.success(t("Re-queued"));
      load();
    } catch (e) {
      toast.error(t("Retry failed: {error}", { error: (e as Error).message }));
    }
  }

  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={channelID ? String(channelID) : "all"}
          onValueChange={(v) => {
            dispatch({ type: "filtersChanged", patch: { channelID: v === "all" ? undefined : Number(v) } });
          }}
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder={t("All channels")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All channels")}</SelectItem>
            {channels.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={state ?? "all"}
          onValueChange={(v) => {
            dispatch({ type: "filtersChanged", patch: { state: v === "all" ? undefined : v } });
          }}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder={t("All statuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All statuses")}</SelectItem>
            {["pending", "sending", "sent", "failed", "skipped"].map((s) => (
              <SelectItem key={s} value={s}>
                {statusMeta("delivery", s).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCwIcon className={loading ? "animate-spin" : ""} /> {t("Refresh")}
        </Button>
        <span className="text-muted-foreground ml-auto text-xs">{t("{count} in total", { count: total })}</span>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">{t("Time")}</TableHead>
              <TableHead>{t("Vulnerability")}</TableHead>
              <TableHead className="w-40">{t("Channel")}</TableHead>
              <TableHead className="w-24">{t("Status")}</TableHead>
              <TableHead className="w-16">{t("Attempts")}</TableHead>
              <TableHead>{t("Error")}</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  {loading ? t("Loading…") : t("No delivery records")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatTime(d.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={toneClasses[statusMeta("severity", d.severity).tone]}>
                        {statusMeta("severity", d.severity).label}
                      </Badge>
                      <span className="truncate text-sm">{d.title || t("(untitled)")}</span>
                      {d.event_kind === "finding_status_changed" && (
                        <Badge variant="outline" className="shrink-0">
                          {t("Status change")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{d.channel_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={toneClasses[statusMeta("delivery", d.state).tone]}>
                      {statusMeta("delivery", d.state).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{d.attempts}</TableCell>
                  <TableCell className="text-muted-foreground max-w-md text-xs break-all">{d.last_error}</TableCell>
                  <TableCell>
                    {/* Only failed/skipped items get a retry button: re-sending a delivered one would duplicate the push. */}
                    {(d.state === "failed" || d.state === "skipped") && (
                      <Button size="sm" variant="outline" onClick={() => retry(d.id)}>
                        <RotateCcwIcon /> {t("Retry")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {maxPage > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => dispatch({ type: "pageStepped", delta: -1 })}
          >
            {t("Previous")}
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} / {maxPage}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= maxPage}
            onClick={() => dispatch({ type: "pageStepped", delta: 1 })}
          >
            {t("Next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(intlLocale, { hour12: false });
}
