CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Admin = has admin role, or is the owner account
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND lower(u.email) = 'olivedrab@rocketmail.com' AND u.email_confirmed_at IS NOT NULL)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text CHECK (char_length(display_name) <= 40),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are public" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin: list all users with stats
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id uuid, email text, display_name text, avatar_url text, joined_at timestamptz, last_sign_in_at timestamptz, trade_count bigint, total_pnl numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.display_name, p.avatar_url, u.created_at, u.last_sign_in_at,
         count(t.id), coalesce(sum(t.pnl), 0)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.trades t ON t.user_id = u.id
  GROUP BY u.id, p.display_name, p.avatar_url
  ORDER BY u.created_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Public profile: safe fields + stats + trades (no notes/screenshots). Email/last sign-in only for self or admin.
CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u auth.users%ROWTYPE;
  priv boolean;
  result jsonb;
BEGIN
  SELECT * INTO u FROM auth.users WHERE auth.users.id = _user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  priv := auth.uid() = _user_id OR public.is_admin();
  SELECT jsonb_build_object(
    'id', u.id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'joined_at', u.created_at,
    'email', CASE WHEN priv THEN u.email END,
    'last_sign_in_at', CASE WHEN priv THEN u.last_sign_in_at END,
    'is_self', coalesce(auth.uid() = _user_id, false),
    'trades', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'trade_date', t.trade_date, 'symbol', t.symbol, 'direction', t.direction,
        'entry_price', t.entry_price, 'exit_price', t.exit_price, 'position_size', t.position_size,
        'pnl', t.pnl, 'fees', t.fees, 'setup', t.setup
      ) ORDER BY t.trade_date DESC, t.created_at DESC)
      FROM public.trades t WHERE t.user_id = _user_id), '[]'::jsonb)
  ) INTO result
  FROM (SELECT 1) x LEFT JOIN public.profiles p ON p.id = _user_id;
  RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;

-- Avatar storage policies (bucket "avatars", public read)
CREATE POLICY "Avatars are public" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);