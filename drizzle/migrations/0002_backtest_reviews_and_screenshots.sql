ALTER TABLE public.backtests ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'pending', ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS screenshot_url text;
ALTER TABLE public.backtests ADD CONSTRAINT backtests_outcome_values CHECK (outcome IN ('pending', 'won', 'lost'));
COMMENT ON COLUMN public.backtests.outcome IS 'Confirmed target hit (won), stop hit (lost), or unconfirmed (pending); not derived from monetary P&L.';
COMMENT ON COLUMN public.backtests.rules IS 'Per-entry customizable trading-rule checklist of label and checked values.';