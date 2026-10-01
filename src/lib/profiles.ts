import { supabase } from "@/integrations/supabase/client";

export type PublicTrade = {
  id: string;
  trade_date: string;
  symbol: string;
  direction: string;
  entry_price: number | null;
  exit_price: number | null;
  position_size: number | null;
  pnl: number;
  fees: number | null;
  setup: string | null;
};

export type PublicProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: string;
  email: string | null;
  last_sign_in_at: string | null;
  is_self: boolean;
  trades: PublicTrade[];
};

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { _user_id: userId });
  if (error) throw error;
  return (data as unknown as PublicProfile | null) ?? null;
}

export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return Boolean(data);
}

export async function avatarSrc(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
