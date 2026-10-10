import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listBacktests, deleteBacktest } from "@/lib/backtests.functions";
import type { Backtest } from "@/lib/backtests.functions";
import { formatMoney, sumPnl, toISODate } from "@/lib/trade-utils";
import { BacktestFormDialog } from "@/components/BacktestFormDialog";
import { ScreenshotImport } from "@/components/ScreenshotImport";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/backtest")({
  head: () => ({
    meta: [
      { title: "Backtest — PIXEL P&L" },
      {
        name: "description",
        content: "Your backtesting journal: simulated trades kept separate from live P&L.",
      },
      { property: "og:title", content: "Backtest — PIXEL P&L" },
      { property: "og:description", content: "Log and review backtested trades." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BacktestPage,
});

function BacktestPage() {
  const today = new Date();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Backtest | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState("");

  const fetchBacktests = useServerFn(listBacktests);
  const removeBacktest = useServerFn(deleteBacktest);

  const backtestsQuery = useQuery({
    queryKey: ["backtests"],
    queryFn: () => fetchBacktests({ data: { from: "1970-01-01", to: "2100-01-01" } }),
  });

  const all = backtestsQuery.data ?? [];
  const symbols = useMemo(
    () => [...new Set(all.map((b) => b.symbol.toUpperCase()))].sort(),
    [all],
  );
  const entries = symbolFilter
    ? all.filter((b) => b.symbol.toUpperCase() === symbolFilter)
    : all;

  const totalPnl = sumPnl(entries);
  const wins = entries.filter((b) => Number(b.pnl) > 0);
  const losses = entries.filter((b) => Number(b.pnl) < 0);
  const winRate = entries.length > 0 ? Math.round((wins.length / entries.length) * 100) : 0;
  const avgWin = wins.length > 0 ? sumPnl(wins) / wins.length : null;
  const avgLoss = losses.length > 0 ? sumPnl(losses) / losses.length : null;

  const deletion = useMutation({
    mutationFn: (id: string) => removeBacktest({ data: { id } }),
    onSuccess: () => {
      toast.success("Backtest deleted.");
      void queryClient.invalidateQueries({ queryKey: ["backtests"] });
    },
    onError: () => toast.error("Could not delete that backtest."),
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="pixel-heading text-lg text-primary">PIXEL P&amp;L</h1>
        <div className="flex flex-wrap gap-3">
          <button
            className="pixel-btn pixel-btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + Backtest
          </button>
          <button className="pixel-btn pixel-btn-ghost" onClick={() => setScanOpen(true)}>
            Scan screenshot
          </button>
          <Link to="/journal" className="pixel-btn pixel-btn-ghost">
            Journal
          </Link>
          <Link to="/summary" className="pixel-btn pixel-btn-ghost">
            Summary
          </Link>
        </div>
      </header>

      <section className="pixel-panel scanlines p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-pixel text-xs text-gold">Backtest log</h2>
          <div className="text-xl">
            <span className="font-pixel text-[0.6rem] text-muted-foreground">Total P&amp;L </span>
            <span className={totalPnl >= 0 ? "text-profit" : "text-loss"}>
              {formatMoney(totalPnl)}
            </span>
            <span className="ml-3 text-muted-foreground">
              {entries.length} entr{entries.length === 1 ? "y" : "ies"} · {winRate}% win rate
            </span>
          </div>
        </div>

        {symbols.length > 1 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button
              className={`pixel-btn pixel-btn-compact ${symbolFilter === "" ? "pixel-btn-primary" : "pixel-btn-ghost"}`}
              onClick={() => setSymbolFilter("")}
            >
              All
            </button>
            {symbols.map((symbol) => (
              <button
                key={symbol}
                className={`pixel-btn pixel-btn-compact ${symbolFilter === symbol ? "pixel-btn-primary" : "pixel-btn-ghost"}`}
                onClick={() => setSymbolFilter(symbol)}
              >
                {symbol}
              </button>
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xl sm:grid-cols-4">
            <Stat label="Wins" value={`${wins.length}`} tone="profit" />
            <Stat label="Losses" value={`${losses.length}`} tone="loss" />
            <Stat label="Avg win" value={avgWin === null ? "—" : formatMoney(avgWin)} tone="profit" />
            <Stat label="Avg loss" value={avgLoss === null ? "—" : formatMoney(avgLoss)} tone="loss" />
          </dl>
        )}

        {backtestsQuery.isLoading ? (
          <p className="blink font-pixel text-[0.6rem] text-primary">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-xl text-muted-foreground">
            No backtests logged yet. Add one by hand or scan a screenshot of your replayed trades.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article key={entry.id} className="pixel-inset p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-pixel text-[0.7rem]">
                    {entry.symbol}{" "}
                    <span className={entry.direction === "long" ? "text-profit" : "text-loss"}>
                      {entry.direction}
                    </span>{" "}
                    <span className="text-muted-foreground">{entry.trade_date}</span>
                  </h3>
                  <span
                    className={`font-pixel text-[0.7rem] ${
                      Number(entry.pnl) >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {formatMoney(Number(entry.pnl))}
                  </span>
                </div>
                {entry.setup && (
                  <div className="mt-4 border-l-4 border-gold bg-gold/10 px-3 py-2">
                    <p className="font-pixel text-[0.65rem] text-gold">Setup</p>
                    <p className="mt-1 break-words text-2xl font-bold text-foreground">{entry.setup}</p>
                  </div>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xl sm:grid-cols-4">
                  <Detail label="Entry" value={entry.entry_price} />
                  <Detail label="Exit" value={entry.exit_price} />
                  <Detail label="Size" value={entry.position_size} />
                  <Detail label="Fees" value={entry.fees} />
                  <Detail label="Stop" value={entry.stop_loss} />
                  <Detail label="Target" value={entry.target_price} />
                  <Detail
                    label="Tags"
                    value={entry.tags?.length ? entry.tags.join(", ") : null}
                  />
                </dl>
                {[entry.margin, entry.leverage, entry.opened_at, entry.closed_at, entry.close_type, entry.trading_fee, entry.funding_fee].some((v) => v !== null && v !== undefined) && (
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xl sm:grid-cols-4">
                    <Detail label="Margin" value={entry.margin == null ? null : `${entry.margin} ${entry.margin_currency ?? ""}`} />
                    <Detail label="Leverage" value={entry.leverage == null ? null : `${entry.leverage}×`} />
                    <Detail label="Trading fee" value={entry.trading_fee} />
                    <Detail label="Funding fee" value={entry.funding_fee} />
                    <Detail label="Opened" value={entry.opened_at?.replace("T", " ")} />
                    <Detail label="Closed" value={entry.closed_at?.replace("T", " ")} />
                    <Detail label="Close type" value={entry.close_type} />
                  </dl>
                )}
                {entry.notes && (
                  <p className="mt-3 text-xl text-muted-foreground">{entry.notes}</p>
                )}
                <div className="mt-4 flex gap-3">
                  <Button
                    variant="pixel" size="pixel-sm"
                    onClick={() => {
                      setEditing(entry);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil /> Edit
                  </Button>
                  <Button
                    variant="pixel-danger" size="pixel-sm"
                    disabled={deletion.isPending}
                    onClick={() => deletion.mutate(entry.id)}
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {formOpen && (
        <BacktestFormDialog
          date={editing?.trade_date ?? toISODate(today)}
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["backtests"] })}
        />
      )}

      {scanOpen && (
        <ScreenshotImport
          fallbackDate={toISODate(today)}
          target="backtest"
          onClose={() => setScanOpen(false)}
          onImported={() => void queryClient.invalidateQueries({ queryKey: ["backtests"] })}
        />
      )}
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "profit" | "loss" }) {
  return (
    <div className="min-w-0">
      <dt className="font-pixel text-[0.5rem] text-muted-foreground">{label}</dt>
      <dd className={tone === "profit" ? "text-profit" : "text-loss"}>{value}</dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="font-pixel text-[0.5rem] text-muted-foreground">{label}</dt>
      <dd className="break-words">{value === null || value === undefined || value === "" ? "—" : value}</dd>
    </div>
  );
}
