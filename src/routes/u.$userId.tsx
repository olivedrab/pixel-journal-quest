import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicProfile, formatDate } from "@/lib/profiles";
import { formatMoney } from "@/lib/trade-utils";
import { PixelAvatar } from "@/components/Avatar";

export const Route = createFileRoute("/u/$userId")({
  head: () => ({
    meta: [
      { title: "Trader Profile — PIXEL P&L" },
      { name: "description", content: "A trader's pixel-art profile: stats, P&L and trade history." },
      { property: "og:title", content: "Trader Profile — PIXEL P&L" },
      { property: "og:description", content: "A trader's pixel-art profile: stats, P&L and trade history." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchPublicProfile(userId),
  });

  if (isLoading) return <Shell><p className="font-pixel text-xs text-muted-foreground blink">LOADING...</p></Shell>;
  if (error || !profile) return <Shell><p className="font-pixel text-xs text-loss">Player not found.</p></Shell>;

  const name = profile.display_name || "Anonymous trader";
  const trades = profile.trades;
  const total = trades.reduce((s, t) => s + Number(t.pnl), 0);
  const wins = trades.filter((t) => Number(t.pnl) > 0).length;
  const winRate = trades.length ? Math.round((wins / trades.length) * 100) : 0;

  return (
    <Shell>
      <section className="pixel-panel scanlines p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-5">
          <PixelAvatar path={profile.avatar_url} name={name} size={80} />
          <div className="min-w-0">
            <h1 className="pixel-heading text-base text-primary">{name}</h1>
            <p className="mt-2 text-lg text-muted-foreground">Joined {formatDate(profile.joined_at)}</p>
            {profile.email && <p className="text-lg text-muted-foreground">{profile.email}</p>}
            {profile.last_sign_in_at && (
              <p className="text-lg text-muted-foreground">Last sign-in {formatDate(profile.last_sign_in_at)}</p>
            )}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Trades" value={String(trades.length)} />
          <Stat label="Total P&L" value={formatMoney(total)} tone={total >= 0 ? "text-profit" : "text-loss"} />
          <Stat label="Win rate" value={`${winRate}%`} />
        </div>
      </section>

      {profile.is_self && <EditProfile userId={userId} name={profile.display_name ?? ""} />}

      <section className="pixel-panel mt-6 p-5 sm:p-6">
        <h2 className="pixel-heading mb-4 text-xs text-gold">Trade log</h2>
        {trades.length === 0 ? (
          <p className="text-lg text-muted-foreground">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <thead className="font-pixel text-[0.6rem] text-muted-foreground">
                <tr>
                  <th className="p-2">Date</th><th className="p-2">Symbol</th><th className="p-2">Side</th>
                  <th className="p-2">Entry</th><th className="p-2">Exit</th><th className="p-2">Size</th><th className="p-2 text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-t-2 border-border">
                    <td className="p-2">{t.trade_date}</td>
                    <td className="p-2 text-foreground">{t.symbol}</td>
                    <td className="p-2 uppercase">{t.direction}</td>
                    <td className="p-2">{t.entry_price ?? "—"}</td>
                    <td className="p-2">{t.exit_price ?? "—"}</td>
                    <td className="p-2">{t.position_size ?? "—"}</td>
                    <td className={`p-2 text-right font-bold ${Number(t.pnl) >= 0 ? "text-profit" : "text-loss"}`}>
                      {formatMoney(Number(t.pnl))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="pixel-heading text-lg text-primary">PIXEL P&amp;L</Link>
        <Link to="/journal" className="pixel-btn pixel-btn-ghost">Journal</Link>
      </header>
      {children}
    </main>
  );
}

function Stat({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="pixel-inset p-3 text-center">
      <div className="font-pixel text-[0.55rem] text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function EditProfile({ userId, name }: { userId: string; name: string }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(name);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDisplayName(name), [name]);

  async function save(patch: { display_name?: string | null; avatar_url?: string }) {
    const { error } = await supabase.from("profiles").upsert({ id: userId, ...patch });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  async function onName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ display_name: displayName.trim().slice(0, 40) || null });
      toast.success("Name saved");
    } catch {
      toast.error("Couldn't save your name");
    } finally {
      setBusy(false);
    }
  }

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) {
      toast.error("Pick an image under 4 MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
      if (error) throw error;
      await save({ avatar_url: path });
      toast.success("Avatar updated");
    } catch {
      toast.error("Couldn't upload avatar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pixel-panel mt-6 p-5 sm:p-6">
      <h2 className="pixel-heading mb-4 text-xs text-gold">Edit profile</h2>
      <form onSubmit={onName} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-pixel text-[0.6rem] text-muted-foreground">Display name</span>
          <input className="pixel-field" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <button className="pixel-btn pixel-btn-primary" disabled={busy}>Save</button>
        <label className="pixel-btn pixel-btn-ghost cursor-pointer">
          Upload avatar
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => onAvatar(e.target.files?.[0])} />
        </label>
      </form>
    </section>
  );
}
