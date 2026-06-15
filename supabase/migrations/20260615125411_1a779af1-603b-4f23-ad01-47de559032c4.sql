UPDATE public.debates SET voice_provider_mod='kokoro' WHERE voice_provider_mod='browser';
UPDATE public.debates SET voice_provider_a='kokoro' WHERE voice_provider_a='browser';
UPDATE public.debates SET voice_provider_b='kokoro' WHERE voice_provider_b='browser';
UPDATE public.personas SET voice_provider='kokoro' WHERE voice_provider='browser';
UPDATE public.mediators SET voice_provider='kokoro' WHERE voice_provider='browser';
UPDATE public.debate_participants SET voice_provider='kokoro' WHERE voice_provider='browser';