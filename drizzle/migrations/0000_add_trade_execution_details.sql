ALTER TABLE public.trades
 ADD COLUMN margin numeric,
 ADD COLUMN margin_currency text,
 ADD COLUMN leverage numeric,
 ADD COLUMN opened_at text,
 ADD COLUMN closed_at text,
 ADD COLUMN close_type text,
 ADD COLUMN trading_fee numeric,
 ADD COLUMN funding_fee numeric;
COMMENT ON COLUMN public.trades.opened_at IS 'Exchange-local opening timestamp; timezone is not inferred.';
COMMENT ON COLUMN public.trades.closed_at IS 'Exchange-local closing timestamp; timezone is not inferred.';