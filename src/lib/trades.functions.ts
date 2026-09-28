import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

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
  setup: z.string().trim().max(80).nullable(),
  tags: z.array(z.string().trim().max(24)).max(12),
  notes: z.string().trim().max(2000).nullable(),
});

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
    return (rows ?? []) as unknown as Trade[];
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
  setup: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type ParsedTrade = z.infer<typeof parsedTradeSchema>;

export const parseScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        image: z.string().startsWith("data:image/").max(12_000_000),
        fallbackDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const instructions =
      "You read screenshots from trading platforms and extract closed trades. " +
      'Reply with JSON only, shaped {"trades":[{...}]}. Each trade may include ' +
      "trade_date (YYYY-MM-DD), symbol, direction ('long' or 'short'), entry_price, " +
      "exit_price, position_size, pnl (net profit or loss as a number, negative for a loss), " +
      "stop_loss, target_price, fees, setup, notes. Use null when a value is not visible. " +
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
        reasoning: { effort: "low" },
        text: { format: { type: "json_object" } },
        store: false,
        stream: true,
      }),
    });

    if (response.status === 429) throw new Error("AI rate limit reached — try again shortly.");
    if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
    if (!response.ok || !response.body) {
      throw new Error("Could not read the screenshot. Try a clearer image.");
    }

    // Consume the SSE stream and collect the model's text output.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let raw = "";
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
          const event = JSON.parse(payload) as { type?: string; delta?: string; text?: string };
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
