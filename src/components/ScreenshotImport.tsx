import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { parseScreenshot, createTrades } from "@/lib/trades.functions";
import type { ParsedTrade, TradeInput } from "@/lib/trades.functions";
import { Overlay } from "./TradeFormDialog";
import { formatMoney } from "@/lib/trade-utils";

const MAX_BYTES = 8 * 1024 * 1024;

function normalize(parsed: ParsedTrade, fallbackDate: string): TradeInput {
  const direction = (parsed.direction ?? "").toLowerCase();
  return {
    trade_date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.trade_date ?? "")
      ? (parsed.trade_date as string)
      : fallbackDate,
    symbol: (parsed.symbol ?? "UNKNOWN").trim().toUpperCase().slice(0, 24) || "UNKNOWN",
    direction: direction.includes("short") || direction.includes("sell") ? "short" : "long",
    entry_price: parsed.entry_price ?? null,
    exit_price: parsed.exit_price ?? null,
    position_size: parsed.position_size ?? null,
    pnl: parsed.pnl ?? 0,
    stop_loss: parsed.stop_loss ?? null,
    target_price: parsed.target_price ?? null,
    fees: parsed.fees ?? null,
    setup: parsed.setup?.slice(0, 80) ?? null,
    tags: ["screenshot"],
    notes: parsed.notes?.slice(0, 2000) ?? null,
  };
}

export function ScreenshotImport({
  fallbackDate,
  onClose,
  onImported,
}: {
  fallbackDate: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<TradeInput[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const parse = useServerFn(parseScreenshot);
  const insert = useServerFn(createTrades);

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("That image is larger than 8 MB.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read the file."));
      reader.readAsDataURL(file);
    });
    setPreview(dataUrl);
    setBusy(true);
    try {
      const result = await parse({ data: { image: dataUrl, fallbackDate } });
      const normalized = result.trades.map((t) => normalize(t, fallbackDate));
      if (normalized.length === 0) {
        toast.error("No trades were readable in that screenshot.");
      } else {
        toast.success(`Found ${normalized.length} trade${normalized.length > 1 ? "s" : ""}.`);
      }
      setRows(normalized);
      setSelected(new Set(normalized.map((_, i) => i)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the screenshot.");
    } finally {
      setBusy(false);
    }
  }

  async function importSelected() {
    if (!rows) return;
    const chosen = rows.filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      toast.error("Pick at least one trade to import.");
      return;
    }
    setBusy(true);
    try {
      const result = await insert({ data: { trades: chosen } });
      toast.success(
        `Imported ${result.inserted} trade${result.inserted > 1 ? "s" : ""}.` +
          (result.skipped > 0
            ? ` Skipped ${result.skipped} duplicate${result.skipped > 1 ? "s" : ""}.`
            : ""),
      );
      onImported();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import the trades.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="space-y-5">
        <h2 className="pixel-heading text-sm text-primary">Scan a screenshot</h2>
        <p className="text-xl text-muted-foreground">
          Upload a screenshot of your trade history and the fields are filled in for you. Review
          before importing.
        </p>

        <label className="pixel-inset block cursor-pointer p-5 text-center">
          <span className="font-pixel text-[0.6rem] text-gold">Choose image</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          {preview && (
            <img src={preview} alt="Screenshot preview" className="mx-auto mt-4 max-h-48" />
          )}
        </label>

        {busy && <p className="blink font-pixel text-[0.6rem] text-primary">Reading image…</p>}

        {rows && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <label key={index} className="pixel-inset flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  className="mt-1 size-5 accent-primary"
                  checked={selected.has(index)}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(index);
                      else next.delete(index);
                      return next;
                    });
                  }}
                />
                <span className="text-xl">
                  <strong className="font-pixel text-[0.6rem]">{row.symbol}</strong>{" "}
                  {row.direction} · {row.trade_date} · entry {row.entry_price ?? "—"} · exit{" "}
                  {row.exit_price ?? "—"} ·{" "}
                  <span className={row.pnl >= 0 ? "text-profit" : "text-loss"}>
                    {formatMoney(row.pnl)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !rows || rows.length === 0}
            onClick={importSelected}
            className="pixel-btn pixel-btn-primary"
          >
            Import selected
          </button>
          <button type="button" onClick={onClose} className="pixel-btn pixel-btn-ghost">
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}
