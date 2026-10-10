import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createBacktest, updateBacktest } from "@/lib/backtests.functions";
import type { Backtest } from "@/lib/backtests.functions";
import { tradeInputSchema } from "@/lib/trades.functions";
import type { TradeInput } from "@/lib/trades.functions";
import { normalizeTradeTimestamp } from "@/lib/trade-details";
import { Overlay } from "./TradeFormDialog";

type Draft = {
  trade_date: string;
  symbol: string;
  direction: "long" | "short";
  entry_price: string;
  exit_price: string;
  position_size: string;
  pnl: string;
  stop_loss: string;
  target_price: string;
  fees: string;
  margin: string;
  margin_currency: string;
  leverage: string;
  opened_at: string;
  closed_at: string;
  close_type: string;
  trading_fee: string;
  funding_fee: string;
  setup: string;
  tags: string;
  notes: string;
};

function emptyDraft(date: string): Draft {
  return {
    trade_date: date,
    symbol: "",
    direction: "long",
    entry_price: "",
    exit_price: "",
    position_size: "",
    pnl: "",
    stop_loss: "",
    target_price: "",
    fees: "",
    margin: "",
    margin_currency: "",
    leverage: "",
    opened_at: "",
    closed_at: "",
    close_type: "",
    trading_fee: "",
    funding_fee: "",
    setup: "",
    tags: "",
    notes: "",
  };
}

function num(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function draftFromBacktest(entry: Backtest): Draft {
  return {
    trade_date: entry.trade_date,
    symbol: entry.symbol,
    direction: entry.direction,
    entry_price: entry.entry_price?.toString() ?? "",
    exit_price: entry.exit_price?.toString() ?? "",
    position_size: entry.position_size?.toString() ?? "",
    pnl: entry.pnl?.toString() ?? "",
    stop_loss: entry.stop_loss?.toString() ?? "",
    target_price: entry.target_price?.toString() ?? "",
    fees: entry.fees?.toString() ?? "",
    margin: entry.margin?.toString() ?? "",
    margin_currency: entry.margin_currency ?? "",
    leverage: entry.leverage?.toString() ?? "",
    opened_at: entry.opened_at ?? "",
    closed_at: entry.closed_at ?? "",
    close_type: entry.close_type ?? "",
    trading_fee: entry.trading_fee?.toString() ?? "",
    funding_fee: entry.funding_fee?.toString() ?? "",
    setup: entry.setup ?? "",
    tags: (entry.tags ?? []).join(", "),
    notes: entry.notes ?? "",
  };
}

export function BacktestFormDialog({
  date,
  editing,
  onClose,
  onSaved,
}: {
  date: string;
  editing?: Backtest | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    editing ? draftFromBacktest(editing) : emptyDraft(date),
  );
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createBacktest);
  const update = useServerFn(updateBacktest);

  useEffect(() => {
    setDraft(editing ? draftFromBacktest(editing) : emptyDraft(date));
  }, [editing, date]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values: TradeInput = {
      trade_date: draft.trade_date,
      symbol: draft.symbol.trim().toUpperCase(),
      direction: draft.direction,
      entry_price: num(draft.entry_price),
      exit_price: num(draft.exit_price),
      position_size: num(draft.position_size),
      pnl: num(draft.pnl) ?? 0,
      stop_loss: num(draft.stop_loss),
      target_price: num(draft.target_price),
      fees: num(draft.fees),
      margin: num(draft.margin),
      margin_currency: draft.margin_currency.trim().toUpperCase() || null,
      leverage: num(draft.leverage),
      opened_at: normalizeTradeTimestamp(draft.opened_at),
      closed_at: normalizeTradeTimestamp(draft.closed_at),
      close_type: draft.close_type.trim() || null,
      trading_fee: num(draft.trading_fee),
      funding_fee: num(draft.funding_fee),
      setup: draft.setup.trim() || null,
      tags: draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12),
      notes: draft.notes.trim() || null,
    };
    const parsed = tradeInputSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the values you entered.");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await update({ data: { id: editing.id, values: parsed.data } });
        toast.success("Backtest updated.");
      } else {
        await create({ data: parsed.data });
        toast.success("Backtest logged.");
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the backtest.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <h2 className="pixel-heading text-sm text-primary">
          {editing ? "Edit backtest" : "New backtest"}
        </h2>

        <Section title="Trade">
          <Field label="Date">
            <input
              type="date"
              className="pixel-field"
              value={draft.trade_date}
              onChange={(e) => set("trade_date", e.target.value)}
            />
          </Field>
          <Field label="Symbol">
            <input
              className="pixel-field"
              value={draft.symbol}
              maxLength={24}
              placeholder="BTCUSD"
              onChange={(e) => set("symbol", e.target.value)}
            />
          </Field>
          <Field label="Direction">
            <select
              className="pixel-field"
              value={draft.direction}
              onChange={(e) => set("direction", e.target.value as "long" | "short")}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Size">
            <input
              className="pixel-field"
              inputMode="decimal"
              value={draft.position_size}
              onChange={(e) => set("position_size", e.target.value)}
            />
          </Field>
          <Field label="Entry">
            <input
              className="pixel-field"
              inputMode="decimal"
              value={draft.entry_price}
              onChange={(e) => set("entry_price", e.target.value)}
            />
          </Field>
          <Field label="Exit">
            <input
              className="pixel-field"
              inputMode="decimal"
              value={draft.exit_price}
              onChange={(e) => set("exit_price", e.target.value)}
            />
          </Field>
          <Field label="Profit / loss">
            <input
              className="pixel-field"
              inputMode="decimal"
              placeholder="-120.50"
              value={draft.pnl}
              onChange={(e) => set("pnl", e.target.value)}
            />
          </Field>
          <Field label="Fees">
            <input
              className="pixel-field"
              inputMode="decimal"
              value={draft.fees}
              onChange={(e) => set("fees", e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Execution">
          <Field label="Margin">
            <input className="pixel-field" inputMode="decimal" value={draft.margin} onChange={(e) => set("margin", e.target.value)} />
          </Field>
          <Field label="Margin currency">
            <input className="pixel-field" maxLength={12} placeholder="USDT" value={draft.margin_currency} onChange={(e) => set("margin_currency", e.target.value)} />
          </Field>
          <Field label="Leverage (×)">
            <input className="pixel-field" inputMode="decimal" placeholder="2" value={draft.leverage} onChange={(e) => set("leverage", e.target.value)} />
          </Field>
          <Field label="Close type">
            <input className="pixel-field" maxLength={80} placeholder="Triggered TP/SL" value={draft.close_type} onChange={(e) => set("close_type", e.target.value)} />
          </Field>
          <Field label="Opened">
            <input className="pixel-field" type="datetime-local" step="1" value={draft.opened_at} onChange={(e) => set("opened_at", e.target.value)} />
          </Field>
          <Field label="Closed">
            <input className="pixel-field" type="datetime-local" step="1" value={draft.closed_at} onChange={(e) => set("closed_at", e.target.value)} />
          </Field>
          <Field label="Trading fee">
            <input className="pixel-field" inputMode="decimal" value={draft.trading_fee} onChange={(e) => set("trading_fee", e.target.value)} />
          </Field>
          <Field label="Funding fee">
            <input className="pixel-field" inputMode="decimal" value={draft.funding_fee} onChange={(e) => set("funding_fee", e.target.value)} />
          </Field>
        </Section>

        <Section title="Risk">
          <Field label="Stop loss">
            <input
              className="pixel-field"
              inputMode="decimal"
              value={draft.stop_loss}
              onChange={(e) => set("stop_loss", e.target.value)}
            />
          </Field>
          <Field label="Target">
            <input
              className="pixel-field"
              inputMode="decimal"
              value={draft.target_price}
              onChange={(e) => set("target_price", e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Journal">
          <Field label="Setup" emphasized>
            <input
              className="pixel-field border-gold bg-gold/5 text-2xl"
              maxLength={80}
              value={draft.setup}
              placeholder="Breakout retest"
              onChange={(e) => set("setup", e.target.value)}
            />
          </Field>
          <Field label="Tags (comma separated)">
            <input
              className="pixel-field"
              value={draft.tags}
              placeholder="london, news"
              onChange={(e) => set("tags", e.target.value)}
            />
          </Field>
        </Section>
        <Field label="Notes">
          <textarea
            className="pixel-field min-h-24"
            maxLength={2000}
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="pixel-btn pixel-btn-primary">
            {busy ? "Saving…" : "Save backtest"}
          </button>
          <button type="button" onClick={onClose} className="pixel-btn pixel-btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="pixel-inset p-4">
      <legend className="font-pixel text-[0.6rem] text-gold">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, children, emphasized = false }: { label: string; children: React.ReactNode; emphasized?: boolean }) {
  return (
    <label className="block">
      <span className={emphasized ? "font-pixel text-[0.7rem] text-gold" : "font-pixel text-[0.55rem] text-muted-foreground"}>{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
