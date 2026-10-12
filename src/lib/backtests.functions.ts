import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { backtestInputSchema, cleanBacktestNotes, outcomeSchema, ruleSchema } from "./backtest-input";
import type { BacktestInput } from "./backtest-input";

export type Backtest = BacktestInput & { id: string; created_at: string };
const key = (t: Pick<BacktestInput, "trade_date" | "symbol" | "direction" | "entry_price" | "target_price" | "stop_loss">) =>
  [t.trade_date, t.symbol.toUpperCase(), t.direction, t.entry_price, t.target_price, t.stop_loss].join("|");
function validatePath(path: string | null, userId: string) {
  if (path && (!path.startsWith(`${userId}/`) || path.includes(".."))) throw new Error("Invalid screenshot path.");
}
export const listBacktests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ from: z.string(), to: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("backtests").select("*")
      .gte("trade_date", data.from).lte("trade_date", data.to)
      .order("trade_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row): Backtest => ({
      ...row, direction: row.direction === "short" ? "short" : "long",
      outcome: outcomeSchema.catch("pending").parse(row.outcome),
      rules: z.array(ruleSchema).catch([]).parse(row.rules), notes: cleanBacktestNotes(row.notes),
    }));
  });
export const createBacktest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => backtestInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    validatePath(data.screenshot_url, context.userId);
    const { data: rows, error: readError } = await context.supabase.from("backtests")
      .select("trade_date,symbol,direction,entry_price,target_price,stop_loss").eq("trade_date", data.trade_date);
    if (readError) throw new Error(readError.message);
    if ((rows ?? []).some(row => key({ ...row, direction: row.direction === "short" ? "short" : "long" }) === key(data)))
      throw new Error("That backtest is already logged.");
    const { error } = await context.supabase.from("backtests").insert({ ...data, symbol: data.symbol.toUpperCase(), user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const updateBacktest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), values: backtestInputSchema }).parse(data))
  .handler(async ({ data, context }) => {
    validatePath(data.values.screenshot_url, context.userId);
    const { error } = await context.supabase.from("backtests").update({ ...data.values, symbol: data.values.symbol.toUpperCase() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const setBacktestScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), screenshotUrl: z.string().max(500).nullable() }).parse(data))
  .handler(async ({ data, context }) => {
    validatePath(data.screenshotUrl, context.userId);
    const { error } = await context.supabase.from("backtests").update({ screenshot_url: data.screenshotUrl }).eq("id", data.id);
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
