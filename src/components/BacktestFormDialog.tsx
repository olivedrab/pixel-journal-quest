import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Upload, Save } from "lucide-react";
import { createBacktest, updateBacktest } from "@/lib/backtests.functions";
import type { Backtest } from "@/lib/backtests.functions";
import { backtestInputSchema, OUTCOME_LABELS } from "@/lib/backtest-input";
import type { BacktestInput } from "@/lib/backtest-input";
import { parseScreenshot } from "@/lib/trades.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Overlay } from "./TradeFormDialog";

export function BacktestFormDialog({ date, editing, scan = false, onClose, onSaved }: {
  date: string; editing?: Backtest | null; scan?: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<BacktestInput>(() => editing ?? {
    trade_date: date, symbol: "", direction: "long", entry_price: null, target_price: null,
    stop_loss: null, setup: null, outcome: "pending", notes: null, rules: [], screenshot_url: null,
  });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rule, setRule] = useState("");
  const create = useServerFn(createBacktest);
  const update = useServerFn(updateBacktest);
  const parse = useServerFn(parseScreenshot);
  function set<K extends keyof BacktestInput>(key: K, value: BacktestInput[K]) {
    setDraft(prev => ({ ...prev, [key]: value }));
  }
  async function chooseImage(file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error("That image is larger than 8 MB."); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error("Choose a PNG, JPG or WebP image."); return; }
    setReading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the image."));
        reader.readAsDataURL(file);
      });
      setImage(file); setPreview(dataUrl);
      const result = await parse({ data: { image: dataUrl, fallbackDate: draft.trade_date, target: "backtest" } });
      const row = result.trades[0];
      if (!row) throw new Error("No readable position found in this chart.");
      setDraft(prev => ({ ...prev,
        trade_date: row.trade_date ?? prev.trade_date,
        symbol: row.symbol?.trim().toUpperCase() ?? prev.symbol,
        direction: row.direction === "short" ? "short" : "long",
        entry_price: row.entry_price ?? null, target_price: row.target_price ?? null,
        stop_loss: row.stop_loss ?? null, setup: row.setup ?? prev.setup, outcome: row.outcome ?? "pending",
      }));
      toast.success("Chart read. Review the price levels and result.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not read the screenshot."); }
    finally { setReading(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = backtestInputSchema.safeParse(draft);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check your entries."); return; }
    setBusy(true);
    let uploaded: string | null = null;
    try {
      const values = parsed.data;
      if (image) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error("Please sign in again to save the screenshot.");
        const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : "png";
        const path = `${data.user.id}/backtests/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("trade-screenshots").upload(path, image, { contentType: image.type });
        if (uploadError) throw new Error(uploadError.message);
        uploaded = path; values.screenshot_url = path;
      }
      if (editing) await update({ data: { id: editing.id, values } });
      else await create({ data: values });
      uploaded = null;
      if (image && editing?.screenshot_url) await supabase.storage.from("trade-screenshots").remove([editing.screenshot_url]);
      toast.success(editing ? "Backtest updated." : "Backtest saved."); onSaved(); onClose();
    } catch (error) {
      if (uploaded) await supabase.storage.from("trade-screenshots").remove([uploaded]);
      toast.error(error instanceof Error ? error.message : "Could not save the backtest.");
    } finally { setBusy(false); }
  }
  function addRule() {
    if (!rule.trim() || draft.rules.length >= 30) return;
    set("rules", [...draft.rules, { label: rule.trim(), checked: false }]); setRule("");
  }
  return <Overlay onClose={busy || reading ? () => {} : onClose}>
    <form onSubmit={submit} className="space-y-5">
      <h2 className="pixel-heading text-sm text-primary">{editing ? "Edit backtest" : scan ? "Scan backtest" : "New backtest"}</h2>
      <fieldset disabled={busy || reading} className="space-y-5">
        <label className="block cursor-pointer border border-border p-4">
          <span className="flex items-center gap-2 font-pixel text-[0.6rem] text-gold"><Upload className="size-4" /> {preview ? "Replace chart" : "Choose chart screenshot"}</span>
          <input aria-label="Backtest screenshot" type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 block w-full text-lg" onChange={e => { const file = e.target.files?.[0]; if (file) void chooseImage(file); e.target.value = ""; }} />
          {preview && <img src={preview} alt="Backtest chart preview" className="mx-auto mt-3 max-h-64 object-contain" />}
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date"><input type="date" className="pixel-field" value={draft.trade_date} onChange={e => set("trade_date", e.target.value)} required /></Field>
          <Field label="Symbol"><input className="pixel-field" maxLength={24} value={draft.symbol} onChange={e => set("symbol", e.target.value)} required /></Field>
          <Field label="Direction"><select className="pixel-field" value={draft.direction} onChange={e => set("direction", e.target.value === "short" ? "short" : "long")}><option value="long">Long</option><option value="short">Short</option></select></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">{([ ["entry_price", "Entry"], ["target_price", "Target"], ["stop_loss", "Stop loss"] ] as const).map(([key, label]) =>
          <Field key={key} label={label}><input type="number" step="any" className="pixel-field" value={draft[key] ?? ""} onChange={e => set(key, e.target.value === "" ? null : Number(e.target.value))} /></Field>)}</div>
        <Field label="Setup" emphasized><input className="pixel-field border-gold bg-gold/5 text-2xl" maxLength={80} value={draft.setup ?? ""} onChange={e => set("setup", e.target.value || null)} /></Field>
        <Field label="Result"><select className="pixel-field" value={draft.outcome} onChange={e => set("outcome", e.target.value === "won" ? "won" : e.target.value === "lost" ? "lost" : "pending")}>{Object.entries(OUTCOME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Notes"><textarea className="pixel-field min-h-28" maxLength={2000} placeholder="Why did this trade win or lose?" value={draft.notes ?? ""} onChange={e => set("notes", e.target.value || null)} /></Field>
        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="font-pixel text-[0.65rem] text-gold">Trading rules</h3>
          {draft.rules.map((item, i) => <div key={i} className="flex items-center gap-3">
            <label className="flex min-w-0 flex-1 items-center gap-3 text-xl"><input type="checkbox" className="size-5 shrink-0 accent-primary" checked={item.checked} onChange={e => set("rules", draft.rules.map((r, n) => n === i ? { ...r, checked: e.target.checked } : r))} /><span className="break-words">{item.label}</span></label>
            <Button type="button" variant="pixel-danger" size="pixel-sm" aria-label={`Remove rule ${i + 1}`} title="Remove rule" onClick={() => set("rules", draft.rules.filter((_, n) => n !== i))}><Trash2 /></Button>
          </div>)}
          <div className="flex gap-2"><input aria-label="New trading rule" className="pixel-field min-w-0 flex-1" maxLength={160} value={rule} onChange={e => setRule(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRule(); } }} placeholder="Add your trading rule" /><Button type="button" variant="pixel" size="pixel-sm" aria-label="Add rule" title="Add rule" disabled={!rule.trim() || draft.rules.length >= 30} onClick={addRule}><Plus /></Button></div>
        </section>
      </fieldset>
      {reading && <p role="status" className="blink font-pixel text-[0.6rem] text-primary">Reading chart…</p>}
      <div className="flex gap-3"><Button type="submit" variant="pixel" className="pixel-btn-primary" disabled={busy || reading}><Save />{busy ? "Saving…" : "Save backtest"}</Button><Button type="button" variant="pixel" disabled={busy || reading} onClick={onClose}>Cancel</Button></div>
    </form>
  </Overlay>;
}
function Field({ label, children, emphasized = false }: { label: string; children: React.ReactNode; emphasized?: boolean }) {
  return <label className="block"><span className={`font-pixel ${emphasized ? "text-[0.7rem] text-gold" : "text-[0.55rem] text-muted-foreground"}`}>{label}</span><div className="mt-2">{children}</div></label>;
}
