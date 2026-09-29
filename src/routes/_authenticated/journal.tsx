import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listTrades, deleteTrade } from "@/lib/trades.functions";
import type { Trade } from "@/lib/trades.functions";
import {
  MONTH_NAMES,
  formatMoney,
  groupByDay,
  monthGrid,
  monthRange,
  sumPnl,
  toISODate,
} from "@/lib/trade-utils";
import { TradeFormDialog } from "@/components/TradeFormDialog";
import { ScreenshotImport } from "@/components/ScreenshotImport";
import { TradeScreenshot } from "@/components/TradeScreenshot";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Journal — PIXEL P&L" },
      {
        name: "description",
        content: "Your pixel calendar of daily trade counts and profit or loss.",
      },
      { property: "og:title", content: "Journal — PIXEL P&L" },
      { property: "og:description", content: "Daily trade counts and P&L on a pixel calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Journal,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Journal() {
  const today = new Date();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dayListRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [scanFor, setScanFor] = useState<string | null>(null);

  const range = useMemo(() => monthRange(cursor.year, cursor.month), [cursor]);
  const fetchTrades = useServerFn(listTrades);
  const removeTrade = useServerFn(deleteTrade);

  const tradesQuery = useQuery({
    queryKey: ["trades", range.from, range.to],
    queryFn: () => fetchTrades({ data: range }),
  });

  const trades = tradesQuery.data ?? [];
  const byDay = useMemo(() => groupByDay(trades), [trades]);
  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const monthPnl = sumPnl(trades);

  const deletion = useMutation({
    mutationFn: (id: string) => removeTrade({ data: { id } }),
    onSuccess: () => {
      toast.success("Trade deleted.");
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
    onError: () => toast.error("Could not delete that trade."),
  });

  function shiftMonth(step: number) {
    const next = new Date(cursor.year, cursor.month + step, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const dayTrades = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="pixel-heading text-lg text-primary">PIXEL P&amp;L</h1>
        <div className="flex flex-wrap gap-3">
          <button
            className="pixel-btn pixel-btn-primary"
            onClick={() => {
              setEditing(null);
              setFormFor(toISODate(today));
            }}
          >
            + Trade
          </button>
          <button className="pixel-btn pixel-btn-ghost" onClick={() => setScanFor(toISODate(today))}>
            Scan screenshot
          </button>
          <button className="pixel-btn pixel-btn-ghost" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>

      <section className="pixel-panel scanlines p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="pixel-btn pixel-btn-ghost" onClick={() => shiftMonth(-1)}>
              ◀
            </button>
            <h2 className="font-pixel text-xs text-gold">
              {MONTH_NAMES[cursor.month]} {cursor.year}
            </h2>
            <button className="pixel-btn pixel-btn-ghost" onClick={() => shiftMonth(1)}>
              ▶
            </button>
          </div>
          <div className="text-xl">
            <span className="font-pixel text-[0.6rem] text-muted-foreground">Month P&amp;L </span>
            <span className={monthPnl >= 0 ? "text-profit" : "text-loss"}>
              {formatMoney(monthPnl)}
            </span>
            <span className="ml-3 text-muted-foreground">{trades.length} trades</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="pb-2 text-center font-pixel text-[0.5rem] text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {grid.map(({ iso, date, inMonth }) => {
            const dayList = byDay.get(iso) ?? [];
            const pnl = sumPnl(dayList);
            const isToday = iso === toISODate(today);
            return (
              <button
                key={iso}
                onClick={() => setSelectedDay(iso)}
                className={[
                  "pixel-inset min-h-20 p-1 text-left align-top sm:min-h-24 sm:p-2",
                  inMonth ? "" : "opacity-35",
                  isToday ? "border-gold" : "",
                  dayList.length > 0 && pnl >= 0 ? "bg-profit/15" : "",
                  dayList.length > 0 && pnl < 0 ? "bg-loss/15" : "",
                ].join(" ")}
              >
                <span className="font-pixel text-[0.5rem] text-muted-foreground">
                  {date.getDate()}
                </span>
                {dayList.length > 0 && (
                  <span className="mt-1 block text-lg leading-tight">
                    <span className="block text-foreground">
                      {dayList.length}× trade{dayList.length > 1 ? "s" : ""}
                    </span>
                    <span className={pnl >= 0 ? "text-profit" : "text-loss"}>
                      {formatMoney(pnl)}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {tradesQuery.isLoading && (
          <p className="blink mt-4 font-pixel text-[0.6rem] text-primary">Loading…</p>
        )}
      </section>

      {selectedDay && (
        <section className="pixel-panel mt-8 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-pixel text-xs text-gold">{selectedDay}</h2>
            <div className="flex flex-wrap gap-3">
              <button
                className="pixel-btn pixel-btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormFor(selectedDay);
                }}
              >
                + Trade this day
              </button>
              <button className="pixel-btn pixel-btn-ghost" onClick={() => setScanFor(selectedDay)}>
                Scan screenshot
              </button>
              <button className="pixel-btn pixel-btn-ghost" onClick={() => setSelectedDay(null)}>
                Close
              </button>
            </div>
          </div>

          {dayTrades.length === 0 ? (
            <p className="text-xl text-muted-foreground">No trades logged on this day yet.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xl">
                <span className="font-pixel text-[0.6rem] text-muted-foreground">Day total </span>
                <span className={sumPnl(dayTrades) >= 0 ? "text-profit" : "text-loss"}>
                  {formatMoney(sumPnl(dayTrades))}
                </span>
              </p>
              {dayTrades.map((trade) => (
                <article key={trade.id} className="pixel-inset p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-pixel text-[0.7rem]">
                      {trade.symbol}{" "}
                      <span className={trade.direction === "long" ? "text-profit" : "text-loss"}>
                        {trade.direction}
                      </span>
                    </h3>
                    <span
                      className={`font-pixel text-[0.7rem] ${
                        Number(trade.pnl) >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {formatMoney(Number(trade.pnl))}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xl sm:grid-cols-4">
                    <Detail label="Entry" value={trade.entry_price} />
                    <Detail label="Exit" value={trade.exit_price} />
                    <Detail label="Size" value={trade.position_size} />
                    <Detail label="Fees" value={trade.fees} />
                    <Detail label="Stop" value={trade.stop_loss} />
                    <Detail label="Target" value={trade.target_price} />
                    <Detail label="Setup" value={trade.setup} />
                    <Detail
                      label="Tags"
                      value={trade.tags?.length ? trade.tags.join(", ") : null}
                    />
                  </dl>
                  {trade.notes && (
                    <p className="mt-3 text-xl text-muted-foreground">{trade.notes}</p>
                  )}
                  <TradeScreenshot
                    trade={trade}
                    onChanged={() => void queryClient.invalidateQueries({ queryKey: ["trades"] })}
                  />
                  <div className="mt-4 flex gap-3">
                    <button
                      className="pixel-btn pixel-btn-ghost"
                      onClick={() => {
                        setEditing(trade);
                        setFormFor(trade.trade_date);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="pixel-btn pixel-btn-danger"
                      disabled={deletion.isPending}
                      onClick={() => deletion.mutate(trade.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {formFor && (
        <TradeFormDialog
          date={formFor}
          editing={editing}
          onClose={() => {
            setFormFor(null);
            setEditing(null);
          }}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["trades"] })}
        />
      )}

      {scanFor && (
        <ScreenshotImport
          fallbackDate={scanFor}
          onClose={() => setScanFor(null)}
          onImported={() => void queryClient.invalidateQueries({ queryKey: ["trades"] })}
        />
      )}

    </main>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="font-pixel text-[0.5rem] text-muted-foreground">{label}</dt>
      <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
    </div>
  );
}
