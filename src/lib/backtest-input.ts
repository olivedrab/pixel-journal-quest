import { z } from "zod";

export const outcomeSchema = z.enum(["pending", "won", "lost"]);
export const ruleSchema = z.object({ label: z.string().trim().min(1).max(160), checked: z.boolean() });
export function cleanBacktestNotes(notes: string | null | undefined) {
  return notes?.replace(/Chart position tool, not an execution history\.[\s\S]*?net monetary PnL is not shown\./gi, "").trim() || null;
}
export const backtestInputSchema = z.object({
  trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  symbol: z.string().trim().min(1, "Symbol required").max(24),
  direction: z.enum(["long", "short"]),
  entry_price: z.number().finite().nullable(),
  target_price: z.number().finite().nullable(),
  stop_loss: z.number().finite().nullable(),
  setup: z.string().trim().max(80).nullable(),
  outcome: outcomeSchema.default("pending"),
  notes: z.string().trim().max(2000).nullable().transform(cleanBacktestNotes),
  rules: z.array(ruleSchema).max(30).default([]),
  screenshot_url: z.string().trim().max(500).nullable().default(null),
});
export type BacktestInput = z.infer<typeof backtestInputSchema>;
export type BacktestRule = z.infer<typeof ruleSchema>;
export const OUTCOME_LABELS = { pending: "Unconfirmed", won: "Won · target hit", lost: "Lost · stop hit" };