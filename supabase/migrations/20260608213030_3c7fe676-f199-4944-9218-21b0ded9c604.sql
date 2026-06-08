ALTER TABLE public.debates ADD COLUMN IF NOT EXISTS blocks_count integer NOT NULL DEFAULT 4;
ALTER TABLE public.debates ADD COLUMN IF NOT EXISTS block_subtopics jsonb;
ALTER TABLE public.debate_messages ADD COLUMN IF NOT EXISTS block_index integer NOT NULL DEFAULT 0;