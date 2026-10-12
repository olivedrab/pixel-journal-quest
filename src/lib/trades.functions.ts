import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { moveExecutionNotes } from "@/lib/trade-details";

export const tradeInputSchema = z.object({
  trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  symbol: z.string().trim().min(1, "Symbol required").max(24),
  direction: z.enum(["long", "short"]),
  entry_price: z.number().finite().nullable(),
  exit_price: z.number().finite().nullable(),
  position_size: z.number().finite().nullable(),
  pnl: z.number().finite(),
  stop_loss: z.number().finite().nullable(),
  target_price: z.number().finite().nullable(),
  fees: z.number().finite().nullable(),
  margin: z.number().finite().nonnegative().nullable().default(null),
  margin_currency: z.string().trim().max(12).nullable().default(null),
  leverage: z.number().finite().positive().nullable().default(null),
  opened_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).nullable().default(null),
  closed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).nullable().default(null),
  close_type: z.string().trim().max(80).nullable().default(null),
  trading_fee: z.number().finite().nullable().default(null),
  funding_fee: z.number().finite().nullable().default(null),
  setup: z.string().trim().max(80).nullable(),
  tags: z.array(z.string().trim().max(24)).max(12),
  notes: z.string().trim().max(2000).nullable(),
}).transform(moveExecutionNotes);

export type TradeInput = z.infer<typeof tradeInputSchema>;

export type Trade = TradeInput & {
  id: string;
  tags: string[];
  created_at: string;
  screenshot_url: string | null;
};

export const setTradeScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        screenshotUrl: z.string().trim().max(500).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trades")
      .update({ screenshot_url: data.screenshotUrl })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTrades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ from: z.string(), to: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("trades")
      .select("*")
      .gte("trade_date", data.from)
      .lte("trade_date", data.to)
      .order("trade_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as unknown as Trade[]).map(moveExecutionNotes);
  });

// A trade is a duplicate when date, symbol, direction, entry, exit, size and
// P&L all match an existing trade for the same user.
function tradeKey(t: TradeInput) {
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
    .from("trades")
    .select("trade_date, symbol, direction, entry_price, exit_price, position_size, pnl")
    .in("trade_date", dates);
  if (error) throw new Error(error.message);
  const keys = new Set<string>();
  for (const row of rows ?? []) {
    keys.add(
      tradeKey({
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

export const createTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tradeInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const existing = await findExistingKeys(context.supabase, [data.trade_date]);
    if (existing.has(tradeKey(data))) {
      throw new Error(
        `This ${data.symbol} ${data.direction} trade on ${data.trade_date} is already in your journal.`,
      );
    }
    const { error } = await context.supabase
      .from("trades")
      .insert({ ...data, tags: data.tags ?? [], user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ trades: z.array(tradeInputSchema).min(1).max(50) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const dates = [...new Set(data.trades.map((t) => t.trade_date))];
    const existing = await findExistingKeys(context.supabase, dates);
    const seen = new Set<string>();
    const fresh = data.trades.filter((t) => {
      const key = tradeKey(t);
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const skipped = data.trades.length - fresh.length;
    if (fresh.length === 0) {
      throw new Error(
        skipped === 1
          ? "That trade is already in your journal."
          : `All ${skipped} trades are already in your journal.`,
      );
    }
    const { error } = await context.supabase.from("trades").insert(
      fresh.map((t) => ({ ...t, tags: t.tags ?? [], user_id: context.userId })),
    );
    if (error) throw new Error(error.message);
    return { inserted: fresh.length, skipped };
  });

export const updateTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), values: tradeInputSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trades")
      .update({ ...data.values, tags: data.values.tags ?? [] })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("trades").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const parsedTradeSchema = z.object({
  trade_date: z.string().nullable().optional(),
  symbol: z.string().nullable().optional(),
  direction: z.string().nullable().optional(),
  entry_price: z.number().nullable().optional(),
  exit_price: z.number().nullable().optional(),
  position_size: z.number().nullable().optional(),
  pnl: z.number().nullable().optional(),
  stop_loss: z.number().nullable().optional(),
  target_price: z.number().nullable().optional(),
  fees: z.number().nullable().optional(),
  margin: z.number().nullable().optional(),
  margin_currency: z.string().nullable().optional(),
  leverage: z.number().nullable().optional(),
  opened_at: z.string().nullable().optional(),
  closed_at: z.string().nullable().optional(),
  close_type: z.string().nullable().optional(),
  trading_fee: z.number().nullable().optional(),
  funding_fee: z.number().nullable().optional(),
  setup: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  outcome: z.enum(["pending", "won", "lost"]).optional(),
});

export type ParsedTrade = z.infer<typeof parsedTradeSchema>;

export const parseScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        image: z.string().startsWith("data:image/").max(12_000_000),
        fallbackDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        target: z.enum(["live", "backtest"]).default("live"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const instructions = data.target === "backtest" ?
      "Extract the single selected long/short position from this backtesting chart. Return JSON {trades:[{trade_date,symbol,direction,entry_price,target_price,stop_loss,setup,outcome}]}. " +
      "Read absolute ENTRY, TARGET and STOP prices from the right axis or position boundaries; Target/Stop label distances are not absolute prices. Never treat Closed PnL as monetary profit. " +
      "Outcome is won only if subsequent candles visibly reach target before stop, lost if stop is reached first, pending if neither hit or order ambiguous. The position box alone does not prove a hit. " +
      "Closed PnL matching target/stop distance can corroborate a clearly visible hit. Never invent a symbol or setup, use null if not shown. No explanatory summary or notes. " +
      `Use date YYYY-MM-DD from chart, or ${data.fallbackDate} if unavailable.` :
      "You read screenshots from trading platforms and extract closed trades. " +
      'Reply with JSON only, shaped {"trades":[{...}]}. Each trade may include ' +
      "trade_date (YYYY-MM-DD), symbol, direction ('long' or 'short'), entry_price, " +
      "exit_price, position_size, pnl (net profit or loss as a number, negative for a loss), " +
      "stop_loss, target_price, fees, margin, margin_currency, leverage, opened_at, closed_at, " +
      "close_type, trading_fee, funding_fee, setup, notes. " +
      "Extract margin as a number and its currency separately (e.g. 105.78 and USDT). " +
      "Extract leverage as a number (2x means 2). Preserve opened_at and closed_at as " +
      "YYYY-MM-DDTHH:mm:ss in the exchange's displayed time, without inventing a timezone. " +
      "Use the closing date for trade_date when available. Keep trading_fee and funding_fee " +
      "separate; fees is the displayed total fees, or their sum when both are visible. " +
      "Put these execution details in dedicated fields, not notes. " +
      "Use null when a value is not visible. " +
      `If no date is visible, use ${data.fallbackDate}. Never invent trades that are not in the image.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Extract every trade you can read from this screenshot. Reply with JSON only.",
              },
              { type: "input_image", image_url: data.image },
            ],
          },
        ],
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: data.target === "backtest" ? {
          type: "json_schema", name: "backtest_chart", strict: true,
          schema: { type: "object", additionalProperties: false, required: ["trades"], properties: {
            trades: { type: "array", items: { type: "object", additionalProperties: false,
              required: ["trade_date", "symbol", "direction", "entry_price", "target_price", "stop_loss", "setup", "outcome"],
              properties: {
                trade_date: { type: ["string", "null"] }, symbol: { type: ["string", "null"] },
                direction: { type: "string", enum: ["long", "short"] },
                entry_price: { type: ["number", "null"] }, target_price: { type: ["number", "null"] },
                stop_loss: { type: ["number", "null"] }, setup: { type: ["string", "null"] },
                outcome: { type: "string", enum: ["pending", "won", "lost"] },
              } } },
          } },
        } : { type: "json_object" } },
        store: false,
        stream: true,
      }),
    });

    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { message?: string; error?: { message?: string } };
      throw new Error(failure.message ?? failure.error?.message ?? `Screenshot analysis failed (${response.status}).`);
    }
    if (!response.body) throw new Error("Screenshot analysis returned no response.");

    // Consume the SSE stream and collect the model's text output.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let raw = "";
    let terminalError: string | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as { type?: string; delta?: string; text?: string; error?: { message?: string }; message?: string };
          if (event.type === "response.refusal.delta" || event.type === "response.refusal.done" || event.type === "error" || event.type === "response.failed") terminalError = event.error?.message ?? event.message ?? event.delta ?? "Screenshot analysis was declined or failed.";
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            raw += event.delta;
          } else if (event.type === "response.output_text.done" && typeof event.text === "string") {
            raw = event.text;
          }
        } catch {
          // ignore keep-alive / non-JSON frames
        }
      }
    }

    if (terminalError) throw new Error(terminalError);
    if (!raw.trim()) throw new Error("Screenshot analysis returned no readable results.");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsedJson = match ? JSON.parse(match[0]) : {};
    }

    const result = z
      .object({ trades: z.array(parsedTradeSchema).default([]) })
      .safeParse(parsedJson);

    return { trades: result.success ? result.data.trades.slice(0, 50) : [] };
  });
