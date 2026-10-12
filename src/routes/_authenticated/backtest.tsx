import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listBacktests, deleteBacktest } from "@/lib/backtests.functions";
import type { Backtest } from "@/lib/backtests.functions";
import { OUTCOME_LABELS } from "@/lib/backtest-input";
import { toISODate } from "@/lib/trade-utils";
import { BacktestFormDialog } from "@/components/BacktestFormDialog";
import { TradeScreenshot } from "@/components/TradeScreenshot";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus, ScanLine, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/backtest")({
  head: () => ({ meta: [
    { title: "Backtest — PIXEL P&L" },
    { name: "description", content: "Review backtest price levels, target and stop outcomes, trading rules and chart screenshots." },
    { property: "og:title", content: "Backtest — PIXEL P&L" },
    { property: "og:description", content: "Your backtesting journal with setups, outcomes, personal reviews and saved charts." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: BacktestPage,
});
function BacktestPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Backtest | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState("");
  const fetch = useServerFn(listBacktests);
  const remove = useServerFn(deleteBacktest);
  const query = useQuery({ queryKey: ["backtests"], queryFn: () => fetch({ data: { from: "1970-01-01", to: "2100-01-01" } }) });
  const all = query.data ?? [];
  const symbols = useMemo(() => [...new Set(all.map(b => b.symbol.toUpperCase()))].sort(), [all]);
  const entries = all.filter(b => !symbolFilter || b.symbol.toUpperCase() === symbolFilter);
  const wins = entries.filter(b => b.outcome === "won").length;
  const losses = entries.filter(b => b.outcome === "lost").length;
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["backtests"] }); };
  const deletion = useMutation({ mutationFn: (id: string) => remove({ data: { id } }), onSuccess: () => { toast.success("Backtest deleted."); refresh(); }, onError: error => toast.error(error.message) });
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><h1 className="pixel-heading text-lg text-primary">PIXEL P&amp;L</h1><div className="flex flex-wrap gap-3">
      <Button variant="pixel" className="pixel-btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus />Backtest</Button>
      <Button variant="pixel" onClick={() => setScanOpen(true)}><ScanLine />Scan screenshot</Button>
      <Button variant="pixel" asChild><Link to="/journal">Journal</Link></Button><Button variant="pixel" asChild><Link to="/summary">Summary</Link></Button>
    </div></header>
    <section className="space-y-5">
      <h2 className="font-pixel text-xs text-gold">Backtest log</h2>
      <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
        <Stat label="Entries" value={entries.length} /><Stat label="Wins" value={wins} /><Stat label="Losses" value={losses} /><Stat label="Win rate" value={wins + losses ? `${Math.round(wins / (wins + losses) * 100)}%` : "—"} />
      </dl>
      {symbols.length > 1 && <div className="flex flex-wrap gap-2"><Button variant="pixel" size="pixel-sm" aria-pressed={!symbolFilter} className={!symbolFilter ? "pixel-btn-primary" : ""} onClick={() => setSymbolFilter("")}>All</Button>{symbols.map(symbol => <Button key={symbol} variant="pixel" size="pixel-sm" aria-pressed={symbolFilter === symbol} className={symbolFilter === symbol ? "pixel-btn-primary" : ""} onClick={() => setSymbolFilter(symbol)}>{symbol}</Button>)}</div>}
      {query.isLoading ? <p className="blink font-pixel text-[0.6rem] text-primary">Loading…</p> : query.isError ? <p role="alert" className="text-xl text-loss">{query.error.message}</p> : entries.length === 0 ? <p className="text-xl text-muted-foreground">No backtests logged yet.</p> : <div className="space-y-5">{entries.map(entry => <article key={entry.id} className="pixel-inset p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-pixel text-[0.7rem] leading-relaxed">{entry.symbol} <span className={entry.direction === "long" ? "text-profit" : "text-loss"}>{entry.direction}</span> <span className="text-muted-foreground">{entry.trade_date}</span></h3><span className={`font-pixel text-[0.65rem] ${entry.outcome === "won" ? "text-profit" : entry.outcome === "lost" ? "text-loss" : "text-muted-foreground"}`}>{OUTCOME_LABELS[entry.outcome]}</span></div>
        <div className="mt-4 border-l-4 border-gold bg-gold/10 px-3 py-2"><p className="font-pixel text-[0.65rem] text-gold">Setup</p><p className="mt-1 break-words text-2xl font-bold">{entry.setup || "—"}</p></div>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-xl"><Stat label="Entry" value={entry.entry_price ?? "—"} /><Stat label="Target" value={entry.target_price ?? "—"} /><Stat label="Stop loss" value={entry.stop_loss ?? "—"} /></dl>
        {entry.notes && <section className="mt-4 border-t border-border pt-3"><h4 className="font-pixel text-[0.6rem] text-gold">Notes</h4><p className="mt-2 whitespace-pre-wrap break-words text-xl text-muted-foreground">{entry.notes}</p></section>}
        {entry.rules.length > 0 && <section className="mt-4 border-t border-border pt-3"><h4 className="font-pixel text-[0.6rem] text-gold">Trading rules · {entry.rules.filter(r => r.checked).length}/{entry.rules.length}</h4><ul className="mt-2 space-y-1 text-xl">{entry.rules.map((rule, i) => <li key={i} className="flex items-start gap-2">{rule.checked ? <Check className="mt-1 size-4 shrink-0 text-profit" aria-label="Followed" /> : <X className="mt-1 size-4 shrink-0 text-loss" aria-label="Not followed" />}<span className="break-words">{rule.label}</span></li>)}</ul></section>}
        <TradeScreenshot trade={entry} target="backtest" onChanged={refresh} />
        <div className="mt-4 flex gap-3"><Button variant="pixel" size="pixel-sm" onClick={() => { setEditing(entry); setFormOpen(true); }}><Pencil />Edit</Button><Button variant="pixel-danger" size="pixel-sm" disabled={deletion.isPending} onClick={() => { if (window.confirm("Delete this backtest?")) deletion.mutate(entry.id); }}><Trash2 />Delete</Button></div>
      </article>)}</div>}
    </section>
    {(formOpen || scanOpen) && <BacktestFormDialog date={editing?.trade_date ?? toISODate(new Date())} editing={editing} scan={scanOpen} onClose={() => { setFormOpen(false); setScanOpen(false); setEditing(null); }} onSaved={refresh} />}
  </main>;
}
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="min-w-0"><dt className="font-pixel text-[0.5rem] leading-relaxed text-muted-foreground">{label}</dt><dd className="break-words text-xl">{value}</dd></div>; }
