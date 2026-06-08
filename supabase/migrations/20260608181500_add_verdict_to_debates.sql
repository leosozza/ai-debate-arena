-- Placar / veredito estruturado do juiz-IA (winner, summary, criteria, scores, mvp_quote)
ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS verdict jsonb;
