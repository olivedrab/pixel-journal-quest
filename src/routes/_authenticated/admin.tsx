import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchIsAdmin, formatDate } from "@/lib/profiles";
import { formatMoney } from "@/lib/trade-utils";
import { PixelAvatar } from "@/components/Avatar";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — PIXEL P&L" },
      { name: "description", content: "See every trader who has joined PIXEL P&L." },
      { property: "og:title", content: "Admin Panel — PIXEL P&L" },
      { property: "og:description", content: "See every trader who has joined PIXEL P&L." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: isAdmin, isLoading: checking } = useQuery({ queryKey: ["is-admin"], queryFn: fetchIsAdmin });
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data ?? [];
    },
  });

  const now = Date.now();
  const week = users?.filter((u) => now - new Date(u.joined_at).getTime() < 7 * 864e5).length ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="pixel-heading text-lg text-primary">ADMIN</h1>
        <Link to="/journal" className="pixel-btn pixel-btn-ghost">Journal</Link>
      </header>
      {checking ? (
        <p className="font-pixel text-xs text-muted-foreground blink">LOADING...</p>
      ) : !isAdmin ? (
        <p className="font-pixel text-xs text-loss">Admins only.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="pixel-panel p-4 text-center">
              <div className="font-pixel text-[0.6rem] text-muted-foreground">Total users</div>
              <div className="mt-2 text-4xl font-bold text-gold">{users?.length ?? "…"}</div>
            </div>
            <div className="pixel-panel p-4 text-center">
              <div className="font-pixel text-[0.6rem] text-muted-foreground">Joined this week</div>
              <div className="mt-2 text-4xl font-bold text-profit">{users ? week : "…"}</div>
            </div>
          </div>
          <section className="pixel-panel p-4 sm:p-6">
            <h2 className="pixel-heading mb-4 text-xs text-gold">Players</h2>
            {isLoading ? (
              <p className="text-lg text-muted-foreground">Loading…</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {users?.map((u) => {
                  const name = u.display_name || u.email || "Trader";
                  return (
                    <li key={u.id}>
                      <Link
                        to="/u/$userId"
                        params={{ userId: u.id }}
                        className="pixel-inset flex flex-wrap items-center gap-4 p-3 hover:border-gold"
                      >
                        <PixelAvatar path={u.avatar_url} name={name} size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xl text-foreground">{name}</div>
                          <div className="truncate text-base text-muted-foreground">
                            {u.email} · joined {formatDate(u.joined_at)} · last seen {formatDate(u.last_sign_in_at)}
                          </div>
                        </div>
                        <div className="text-right text-lg">
                          <div>{u.trade_count} trades</div>
                          <div className={Number(u.total_pnl) >= 0 ? "text-profit" : "text-loss"}>
                            {formatMoney(Number(u.total_pnl))}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
