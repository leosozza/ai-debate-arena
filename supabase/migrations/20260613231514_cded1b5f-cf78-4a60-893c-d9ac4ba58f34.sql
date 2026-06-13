
CREATE TABLE public.mediators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('m','f')),
  tagline text NOT NULL,
  style text NOT NULL,
  tone text NOT NULL DEFAULT 'formal',
  voice_provider text NOT NULL,
  voice_id text NOT NULL,
  avatar_url text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mediators TO anon, authenticated;
GRANT ALL ON public.mediators TO service_role;

ALTER TABLE public.mediators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mediators are readable by anyone" ON public.mediators
  FOR SELECT USING (true);

CREATE TRIGGER mediators_updated_at BEFORE UPDATE ON public.mediators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.mediators (slug, name, gender, tagline, style, tone, voice_provider, voice_id, is_default, sort_order) VALUES
('otavio','Otávio Bastos','m','Âncora clássico · voz grave e sóbria','Âncora de telejornal experiente: voz grave, postura sóbria e imparcial, conduz com autoridade e elegância, sem perder a neutralidade.','formal','kokoro','pm_santa',true,10),
('teo','Téo Vibe','m','Apresentador animado · energia de auditório','Apresentador carismático e enérgico de programa de auditório: provoca, brinca, cria tensão e empolga a plateia, sem perder o controle do debate.','descontraído','kokoro','pm_alex',false,20),
('aurelio','Professor Aurélio','m','Mediador acadêmico · ponderado','Mediador acadêmico e reflexivo: faz perguntas precisas, contextualiza historicamente, valoriza o rigor e a profundidade dos argumentos.','acadêmico','piper','pt_BR-faber-medium',false,30),
('helena','Helena Costa','f','Âncora elegante · telejornal','Âncora de telejornal elegante e firme: conduz com classe e imparcialidade, transições limpas, mantém o ritmo e o respeito entre os debatedores.','formal','kokoro','pf_dora',false,40),
('lila','Lila Show','f','Apresentadora carismática · descontraída','Apresentadora vibrante e carismática: leve, espirituosa, provoca contrapontos com bom humor e mantém o programa dinâmico e divertido.','descontraído','kokoro','pf_dora',false,50),
('sofia','Dra. Sofia','f','Mediadora acadêmica · reflexiva','Mediadora acadêmica e analítica: serena, faz sínteses inteligentes, busca o cerne das ideias e estimula a profundidade sobre o confronto.','acadêmico','kokoro','pf_dora',false,60);
