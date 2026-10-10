import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { tradeInputSchema } from "@/lib/trades.functions";
import type { TradeInput } from "@/lib/trades.functions";
import { moveExecutionNotes } from "@/lib/trade-details";

// Backtest entries share the exact same shape as live trades; only the
// destination table differs, so simulated results never mix with real P&L.
export type Backtest = TradeInput & {
  id: string;
  tags: string[];
  created_at: string;
};

function backtestKey(t: TradeInput) {
  return [
    t.trade_date,
    t.symbol.toUpperCase(),
    t.direction,
    t.entry_price,
    t.exit_price,
    t.position_size,
    t.pnl,
  ].join("|");
}

async function findExistingKeys(
  supabase: SupabaseClient<Database>,
  dates: string[],
): Promise<Set<string>> {
  const { data: rows, error } = await supabase
    .from("backtests")
    .select("trade_date, symbol, direction, entry_price, exit_price, position_size, pnl")
    .in("trade_date", dates);
  if (error) throw new Error(error.message);
  const keys = new Set<string>();
  for (const row of rows ?? []) {
    keys.add(
      backtestKey({
        ...(row as unknown as TradeInput),
        entry_price: row.entry_price === null ? null : Number(row.entry_price),
        exit_price: row.exit_price === null ? null : Number(row.exit_price),
        position_size: row.position_size === null ? null : Number(row.position_size),
        pnl: Number(row.pnl),
      }),
    );
  }
  return keys;
}

export const listBacktests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ from: z.string(), to: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("backtests")
      .select("*")
      .gte("trade_date", data.from)
      .lte("trade_date", data.to)
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as unknown as Backtest[]).map(moveExecutionNotes);
  });

export const createBacktest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tradeInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const existing = await findExistingKeys(context.supabase, [data.trade_date]);
    if (existing.has(backtestKey(data))) {
      throw new Error(
        `This ${data.symbol} ${data.direction} backtest on ${data.trade_date} is already logged.`,
      );
    }
    const { error } = await context.supabase
      .from("backtests")
      .insert({ ...data, tags: data.tags ?? [], user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createBacktests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ trades: z.array(tradeInputSchema).min(1).max(50) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const dates = [...new Set(data.trades.map((t) => t.trade_date))];
    const existing = await findExistingKeys(context.supabase, dates);
    const seen = new Set<string>();
    const fresh = data.trades.filter((t) => {
      const key = backtestKey(t);
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const skipped = data.trades.length - fresh.length;
    if (fresh.length === 0) {
      throw new Error(
        skipped === 1
          ? "That backtest is already logged."
          : `All ${skipped} backtests are already logged.`,
      );
    }
    const { error } = await context.supabase.from("backtests").insert(
      fresh.map((t) => ({ ...t, tags: t.tags ?? [], user_id: context.userId })),
    );
    if (error) throw new Error(error.message);
    return { inserted: fresh.length, skipped };
  });

export const updateBacktest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), values: tradeInputSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("backtests")
      .update({ ...data.values, tags: data.values.tags ?? [] })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBacktest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("backtests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
