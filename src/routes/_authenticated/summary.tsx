import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTrades } from "@/lib/trades.functions";
import type { Trade } from "@/lib/trades.functions";
import { formatMoney } from "@/lib/trade-utils";

export const Route = createFileRoute("/_authenticated/summary")({
  head: () => ({
    meta: [
      { title: "Summary — PIXEL P&L" },
      {
        name: "description",
        content: "All your trades grouped by symbol, with P&L, win rate, and average duration.",
      },
      { property: "og:title", content: "Summary — PIXEL P&L" },
      { property: "og:description", content: "Per-symbol P&L, win rate, and average trade duration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Summary,
});

type SymbolStats = {
  symbol: string;
  trades: number;
  wins: number;
  pnl: number;
  durations: number[]; // minutes
};

// Timestamps are stored as exchange-local "YYYY-MM-DDTHH:mm:ss" with no
// timezone; parsing them as local time keeps the *difference* correct.
function durationMinutes(trade: Trade): number | null {
  if (!trade.opened_at || !trade.closed_at) return null;
  const opened = new Date(trade.opened_at).getTime();
  const closed = new Date(trade.closed_at).getTime();
  if (Number.isNaN(opened) || Number.isNaN(closed) || closed < opened) return null;
  return (closed - opened) / 60000;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function Summary() {
  const fetchTrades = useServerFn(listTrades);
  const tradesQuery = useQuery({
    queryKey: ["trades", "all"],
    queryFn: () => fetchTrades({ data: { from: "1970-01-01", to: "2100-01-01" } }),
  });

  const trades = tradesQuery.data ?? [];

  const stats = useMemo(() => {
    const map = new Map<string, SymbolStats>();
    for (const trade of trades) {
      const key = trade.symbol.toUpperCase();
      const entry = map.get(key) ?? { symbol: key, trades: 0, wins: 0, pnl: 0, durations: [] };
      entry.trades += 1;
      if (Number(trade.pnl) > 0) entry.wins += 1;
      entry.pnl += Number(trade.pnl ?? 0);
      const duration = durationMinutes(trade);
      if (duration !== null) entry.durations.push(duration);
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const totalPnl = stats.reduce((sum, s) => sum + s.pnl, 0);
  const totalWins = stats.reduce((sum, s) => sum + s.wins, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="pixel-heading text-lg text-primary">PIXEL P&amp;L</h1>
        <div className="flex flex-wrap gap-3">
          <Link to="/journal" className="pixel-btn pixel-btn-ghost">
            Journal
          </Link>
        </div>
      </header>

      <section className="pixel-panel scanlines p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-pixel text-xs text-gold">Summary by symbol</h2>
          <div className="text-xl">
            <span className="font-pixel text-[0.6rem] text-muted-foreground">All-time P&amp;L </span>
            <span className={totalPnl >= 0 ? "text-profit" : "text-loss"}>
              {formatMoney(totalPnl)}
            </span>
            <span className="ml-3 text-muted-foreground">
              {trades.length} trades · {trades.length > 0 ? Math.round((totalWins / trades.length) * 100) : 0}% win rate
            </span>
          </div>
        </div>

        {tradesQuery.isLoading ? (
          <p className="blink font-pixel text-[0.6rem] text-primary">Loading…</p>
        ) : stats.length === 0 ? (
          <p className="text-xl text-muted-foreground">
            No trades yet. Log some trades in your journal and they'll show up here.
          </p>
        ) : (
          <div className="space-y-3">
            {stats.map((s) => {
              const winRate = Math.round((s.wins / s.trades) * 100);
              const avgDuration =
                s.durations.length > 0
                  ? s.durations.reduce((a, b) => a + b, 0) / s.durations.length
                  : null;
              return (
                <article key={s.symbol} className="pixel-inset p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-pixel text-[0.7rem] text-foreground">{s.symbol}</h3>
                    <span
                      className={`font-pixel text-[0.7rem] ${s.pnl >= 0 ? "text-profit" : "text-loss"}`}
                    >
                      {formatMoney(s.pnl)}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xl sm:grid-cols-4">
                    <div>
                      <dt className="font-pixel text-[0.5rem] text-muted-foreground">Trades</dt>
                      <dd>{s.trades}</dd>
                    </div>
                    <div>
                      <dt className="font-pixel text-[0.5rem] text-muted-foreground">Win rate</dt>
                      <dd className={winRate >= 50 ? "text-profit" : "text-loss"}>
                        {winRate}% ({s.wins}/{s.trades})
                      </dd>
                    </div>
                    <div>
                      <dt className="font-pixel text-[0.5rem] text-muted-foreground">Avg duration</dt>
                      <dd>{avgDuration === null ? "—" : formatDuration(avgDuration)}</dd>
                    </div>
                    <div>
                      <dt className="font-pixel text-[0.5rem] text-muted-foreground">Avg P&amp;L</dt>
                      <dd className={s.pnl / s.trades >= 0 ? "text-profit" : "text-loss"}>
                        {formatMoney(s.pnl / s.trades)}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
