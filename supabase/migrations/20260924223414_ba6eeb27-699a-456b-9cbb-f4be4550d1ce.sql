CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'long',
  entry_price NUMERIC,
  exit_price NUMERIC,
  position_size NUMERIC,
  pnl NUMERIC NOT NULL DEFAULT 0,
  stop_loss NUMERIC,
  target_price NUMERIC,
  fees NUMERIC DEFAULT 0,
  setup TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own trades" ON public.trades FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX trades_user_date_idx ON public.trades (user_id, trade_date);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();