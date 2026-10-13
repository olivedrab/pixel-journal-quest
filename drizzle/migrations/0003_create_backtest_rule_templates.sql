CREATE TABLE public.backtest_rule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtest_rule_templates TO authenticated;
GRANT ALL ON public.backtest_rule_templates TO service_role;
ALTER TABLE public.backtest_rule_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own backtest rule templates"
ON public.backtest_rule_templates FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.backtest_rule_templates (user_id, label, sort_order) VALUES
  ('0410e976-e1ac-4d3a-8e24-3fc7a384dad6', 'Area of Interest (Order Block, FVG, Swing High/Low)', 1),
  ('0410e976-e1ac-4d3a-8e24-3fc7a384dad6', 'Liquidity Sweep', 2),
  ('0410e976-e1ac-4d3a-8e24-3fc7a384dad6', 'CISD', 3),
  ('0410e976-e1ac-4d3a-8e24-3fc7a384dad6', 'SMT', 4);