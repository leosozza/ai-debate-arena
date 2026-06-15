## Objetivo

Semear 4 comentaristas (2 masc + 2 fem) no estilo jornalista-intelectual (Pedro Bial, William Waack, etc.) na aba **Comentadores** de `/personas`, e corrigir o erro de runtime do Radix Tabs.

## Comentaristas propostos

Personagens fictícios inspirados em arquétipos do jornalismo brasileiro (não usamos nomes reais para evitar problemas de imagem/voz):

| # | Nome | Gênero | Arquétipo / referência | Tom |
|---|------|--------|------------------------|-----|
| 1 | **Ricardo Bial** | M | Âncora-poeta, reflexivo, frases longas, citações literárias | descontraído |
| 2 | **Otávio Waack** | M | Comentarista geopolítico, sério, analítico, vocabulário técnico | formal |
| 3 | **Mariana Godoy** | F | Jornalista-âncora elegante, factual, ritmo de telejornal | formal |
| 4 | **Heloísa Castro** | F | Intelectual-colunista, ácida, irônica, viés sociológico | acadêmico |

Cada um recebe:
- `role = 'commentator'`
- voz ElevenLabs adequada ao gênero (default já existente no catálogo)
- `tagline` curta + `style` (prompt de personalidade ~ 3-5 linhas explicando ângulo, vocabulário e como reage às falas dos debatedores)
- `sort_order` 1–4

## Como entregar

1. **Migration única** — `INSERT` dos 4 registros em `public.mediators` com `role='commentator'`, vozes ElevenLabs por gênero (Adam/Brian para M, Bella/Rachel para F) e `style` redigido em PT-BR. `ON CONFLICT (slug) DO NOTHING` para ser idempotente.
2. **Fix do erro de runtime** — instalar `@radix-ui/react-tabs` (o componente `src/components/ui/tabs.tsx` importa o pacote mas ele não está em `package.json`, por isso o Vite devolveu 504 na aba). Sem isso a aba "Comentadores" nem abre.

## Fora do escopo

- Sem mudanças de UI (o `CastManager` já lista/edita comentadores).
- Sem clonagem de voz: usamos vozes ElevenLabs padrão; o usuário pode trocar pela aba depois.
- Sem fotos/avatares (deixar em branco; pode subir depois via formulário).
