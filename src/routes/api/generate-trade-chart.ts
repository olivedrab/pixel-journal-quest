import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateImage, imageSettings } from "@/lib/image-gateway.server";

const nullableNumber = z.number().finite().nullable();
const requestSchema = z.object({
  trade: z.object({
    trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    symbol: z.string().trim().min(1).max(24),
    direction: z.enum(["long", "short"]),
    entry_price: nullableNumber,
    exit_price: nullableNumber,
    position_size: nullableNumber,
    pnl: z.number().finite(),
    stop_loss: nullableNumber,
    target_price: nullableNumber,
    fees: nullableNumber,
    setup: z.string().trim().max(80).nullable(),
    tags: z.array(z.string().trim().max(24)).max(12),
    notes: z.string().trim().max(2000).nullable(),
  }),
  stream: z.boolean().default(true),
});

function display(value: number | null) {
  return value === null ? "not provided" : String(value);
}

function buildPrompt(trade: z.infer<typeof requestSchema>["trade"]) {
  const outcome = trade.pnl >= 0 ? "profitable" : "losing";
  const move =
    trade.entry_price !== null && trade.exit_price !== null
      ? trade.exit_price >= trade.entry_price
        ? "rising from the entry price toward the exit price"
        : "falling from the entry price toward the exit price"
      : "moving naturally between the marked entry and exit";
  return [
    "Create a realistic landscape screenshot of a professional dark cryptocurrency trading chart platform.",
    `The market is ${trade.symbol}. Show a believable intraday candlestick price path on ${trade.trade_date}, ${move}.`,
    `This is a ${trade.direction.toUpperCase()} trade. Precisely mark ENTRY ${display(trade.entry_price)} and EXIT ${display(trade.exit_price)} with horizontal lines and compact labels.`,
    `When provided, also mark STOP ${display(trade.stop_loss)} and TARGET ${display(trade.target_price)}. Position size: ${display(trade.position_size)}.`,
    `Show a small trade summary panel reading exactly: "P&L ${trade.pnl >= 0 ? "+" : ""}${trade.pnl}" and "FEES ${display(trade.fees)}". The outcome is ${outcome}.`,
    "Use red and green candlesticks, subtle gridlines, price scale on the right, time scale below, volume bars, crosshair, and restrained professional exchange controls.",
    "No logos, no brand names, no people, no decorative illustration, no fake account balance, and no additional invented trade values.",
    "Make all requested numbers legible and show each requested label exactly once.",
  ].join(" ");
}

async function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!token || !url || !key) return false;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await client.auth.getClaims(token);
  return !error && Boolean(data?.claims?.sub);
}

export const Route = createFileRoute("/api/generate-trade-chart")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAuthorized(request))) {
          return new Response("Please sign in again to generate charts.", { status: 401 });
        }
        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid trade details.", { status: 400 });
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI image generation is not configured.", { status: 500 });

        const upstream = await generateImage(
          { ...imageSettings, apiKey },
          buildPrompt(parsed.data.trade),
          parsed.data.stream,
        );
        const safeError = upstream.ok
          ? upstream.body
          : await upstream.text().then((message) => message || "Image generation failed.");
        return new Response(safeError, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "text/plain",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});