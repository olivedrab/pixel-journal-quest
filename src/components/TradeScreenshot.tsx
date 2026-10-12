import { useEffect, useRef, useState } from "react";
import { ImageIcon, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { setTradeScreenshot } from "@/lib/trades.functions";
import { setBacktestScreenshot } from "@/lib/backtests.functions";
import { Button } from "@/components/ui/button";

const BUCKET = "trade-screenshots";
const MAX_BYTES = 8 * 1024 * 1024;

export function TradeScreenshot({
  trade,
  onChanged,
  target = "live",
}: {
  trade: { id: string; symbol: string; screenshot_url: string | null };
  target?: "live" | "backtest";
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const save = useServerFn(target === "backtest" ? setBacktestScreenshot : setTradeScreenshot);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!trade.screenshot_url) {
      setUrl(null);
      return;
    }
    void supabase.storage
      .from(BUCKET)
      .createSignedUrl(trade.screenshot_url, 60 * 60)
      .then(({ data, error }) => {
        if (!cancelled) setUrl(error ? null : (data?.signedUrl ?? null));
      });
    return () => {
      cancelled = true;
    };
  }, [trade.screenshot_url]);

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("That image is larger than 8 MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error("Choose a PNG, JPG or WebP image."); return; }
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Please sign in again to upload screenshots.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${userId}/${trade.id}/screenshot-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      uploadedPath = path;
      await save({ data: { id: trade.id, screenshotUrl: path } });
      uploadedPath = null;
      if (trade.screenshot_url) await supabase.storage.from(BUCKET).remove([trade.screenshot_url]);
      toast.success("Screenshot saved.");
      onChanged();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      toast.error(error instanceof Error ? error.message : "Could not upload the screenshot.");
    } finally {
      setBusy(false);
    }
  }

  async function removeScreenshot() {
    if (!trade.screenshot_url) return;
    setBusy(true);
    try {
      await save({ data: { id: trade.id, screenshotUrl: null } });
      await supabase.storage.from(BUCKET).remove([trade.screenshot_url]);
      toast.success("Screenshot removed.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the screenshot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {trade.screenshot_url && (
        <div className="pixel-inset mb-3 flex items-center justify-center overflow-hidden bg-background">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt={`${trade.symbol} trade screenshot`}
                className="max-h-72 object-contain"
              />
            </a>
          ) : (
            <p className="blink p-6 font-pixel text-[0.55rem] text-primary">Loading image…</p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="pixel" size="pixel-sm" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Upload />
          {trade.screenshot_url ? "Replace screenshot" : "Upload screenshot"}
        </Button>
          <input
            ref={fileInput}
            aria-label="Trade screenshot"
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        {trade.screenshot_url && (
          <Button
            type="button"
            variant="pixel-danger"
            size="pixel-sm"
            disabled={busy}
            onClick={() => void removeScreenshot()}
          >
            <Trash2 /> Remove
          </Button>
        )}
        {!trade.screenshot_url && !busy && (
          <span className="flex items-center gap-2 text-lg text-muted-foreground">
            <ImageIcon className="size-4" /> No screenshot attached
          </span>
        )}
      </div>
    </div>
  );
}
