import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createTrade, updateTrade, tradeInputSchema } from "@/lib/trades.functions";
import type { Trade, TradeInput } from "@/lib/trades.functions";

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

export function draftFromTrade(trade: Trade): Draft {
  return {
    trade_date: trade.trade_date,
    symbol: trade.symbol,
    direction: trade.direction,
    entry_price: trade.entry_price?.toString() ?? "",
    exit_price: trade.exit_price?.toString() ?? "",
    position_size: trade.position_size?.toString() ?? "",
    pnl: trade.pnl?.toString() ?? "",
    stop_loss: trade.stop_loss?.toString() ?? "",
    target_price: trade.target_price?.toString() ?? "",
    fees: trade.fees?.toString() ?? "",
    setup: trade.setup ?? "",
    tags: (trade.tags ?? []).join(", "),
    notes: trade.notes ?? "",
  };
}

export function TradeFormDialog({
  date,
  editing,
  prefill,
  onClose,
  onSaved,
}: {
  date: string;
  editing?: Trade | null;
  prefill?: Partial<Draft> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    editing ? draftFromTrade(editing) : { ...emptyDraft(date), ...(prefill ?? {}) },
  );
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createTrade);
  const update = useServerFn(updateTrade);

  useEffect(() => {
    setDraft(editing ? draftFromTrade(editing) : { ...emptyDraft(date), ...(prefill ?? {}) });
  }, [editing, date, prefill]);

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
        toast.success("Trade updated.");
      } else {
        await create({ data: parsed.data });
        toast.success("Trade logged.");
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the trade.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <h2 className="pixel-heading text-sm text-primary">
          {editing ? "Edit trade" : "New trade"}
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
          <Field label="Setup">
            <input
              className="pixel-field"
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
            {busy ? "Saving…" : "Save trade"}
          </button>
          <button type="button" onClick={onClose} className="pixel-btn pixel-btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </Overlay>
  );
}

export function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background/85 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pixel-panel mx-auto max-w-2xl p-6">{children}</div>
    </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-pixel text-[0.55rem] text-muted-foreground">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
