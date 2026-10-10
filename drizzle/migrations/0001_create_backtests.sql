CREATE TABLE public.backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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
  margin NUMERIC,
  margin_currency TEXT,
  leverage NUMERIC,
  opened_at TEXT,
  closed_at TEXT,
  close_type TEXT,
  trading_fee NUMERIC,
  funding_fee NUMERIC,
  setup TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtests TO authenticated;
GRANT ALL ON public.backtests TO service_role;

ALTER TABLE public.backtests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own backtests"
ON public.backtests
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_backtests_updated_at
BEFORE UPDATE ON public.backtests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();