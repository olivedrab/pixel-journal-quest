import { useEffect, useRef, useState } from "react";
import { Download, ImageIcon, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TradeInput } from "@/lib/trades.functions";
import { streamImage } from "@/lib/stream-image";
import { Button } from "@/components/ui/button";
import { Overlay } from "./TradeFormDialog";

type GeneratedChart = {
  trade: TradeInput;
  image: string | null;
  final: boolean;
  status: "waiting" | "generating" | "done" | "error";
  error: string | null;
};

function filename(trade: TradeInput, index: number) {
  return `${trade.trade_date}-${trade.symbol}-${trade.direction}-${index + 1}.png`;
}

export function TradeChartGenerator({
  trades,
  onClose,
}: {
  trades: TradeInput[];
  onClose: () => void;
}) {
  const [charts, setCharts] = useState<GeneratedChart[]>(() =>
    trades.map((trade) => ({ trade, image: null, final: false, status: "waiting", error: null })),
  );
  const started = useRef(false);

  async function generateOne(trade: TradeInput, index: number) {
    setCharts((current) =>
      current.map((chart, i) =>
        i === index ? { ...chart, status: "generating", error: null, final: false } : chart,
      ),
    );
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please sign in again to generate charts.");
      await streamImage(
        "/api/generate-trade-chart",
        { trade },
        (image, final) => {
          setCharts((current) =>
            current.map((chart, i) =>
              i === index
                ? { ...chart, image, final, status: final ? "done" : "generating" }
                : chart,
            ),
          );
        },
        { Authorization: `Bearer ${token}` },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate this chart.";
      setCharts((current) =>
        current.map((chart, i) =>
          i === index ? { ...chart, status: "error", error: message } : chart,
        ),
      );
    }
  }

  async function generateAll() {
    for (let index = 0; index < trades.length; index += 1) {
      await generateOne(trades[index], index);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void generateAll();
  }, []);

  function download(chart: GeneratedChart, index: number) {
    if (!chart.image || !chart.final) return;
    const anchor = document.createElement("a");
    anchor.href = chart.image;
    anchor.download = filename(chart.trade, index);
    anchor.click();
    toast.success("Chart downloaded.");
  }

  const completed = charts.filter((chart) => chart.status === "done").length;
  const active = charts.findIndex((chart) => chart.status === "generating");

  return (
    <Overlay onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="pixel-heading text-sm text-primary">Trade charts</h2>
            <p className="mt-2 text-xl text-muted-foreground">
              {completed}/{charts.length} screenshots ready
              {active >= 0 ? ` · generating ${active + 1} of ${charts.length}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="pixel-btn pixel-btn-ghost rounded-none"
            aria-label="Close chart generator"
            title="Close"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>

        <div className="space-y-5">
          {charts.map((chart, index) => (
            <article key={`${chart.trade.symbol}-${chart.trade.trade_date}-${index}`} className="pixel-inset p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-pixel text-[0.65rem]">
                  {chart.trade.symbol} · {chart.trade.direction} · {chart.trade.trade_date}
                </h3>
                <span className="font-pixel text-[0.5rem] text-muted-foreground">
                  {chart.status === "generating" ? "Rendering…" : chart.status}
                </span>
              </div>

              <div className="flex aspect-[3/2] items-center justify-center overflow-hidden bg-background">
                {chart.image ? (
                  <img
                    src={chart.image}
                    alt={`${chart.trade.symbol} generated trade chart`}
                    className={`h-full w-full object-contain transition-[filter] duration-500 ${
                      chart.final ? "blur-0" : "blur-2xl"
                    }`}
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="mx-auto mb-3 size-10" />
                    <p className="font-pixel text-[0.55rem]">
                      {chart.status === "waiting" ? "Queued" : "Generating chart…"}
                    </p>
                  </div>
                )}
              </div>

              {chart.error && <p className="mt-3 text-lg text-loss">{chart.error}</p>}
              <div className="mt-3 flex gap-3">
                <Button
                  type="button"
                  className="pixel-btn pixel-btn-primary rounded-none"
                  disabled={!chart.final}
                  onClick={() => download(chart, index)}
                >
                  <Download /> Download
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="pixel-btn pixel-btn-ghost rounded-none"
                  disabled={chart.status === "generating"}
                  onClick={() => void generateOne(chart.trade, index)}
                >
                  <RefreshCw /> Regenerate
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Overlay>
  );
}