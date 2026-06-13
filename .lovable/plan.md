
# Plano: Refinar criação de debates + camada de comentaristas

Foco do trabalho fica em `src/routes/_authenticated/new.tsx`, alguns catálogos client-safe e a engine de geração (`src/lib/multi-debate.functions.ts` / `multi-sequence.ts`). O esquema já tem quase tudo (`debates.format`, `debates.commentators jsonb`, `debate_participants`, `personas.gender`), então só falta **1 tabela nova** (`mediators`) e nenhum breaking change.

---

## 1) Formulário dinâmico por formato

Em `new.tsx`:
- Estado `selectedFormat` já existe — vou amarrar **todos** os blocos seguintes a ele.
- Render condicional dos slots de persona usando `DEBATE_FORMATS[selectedFormat]` (`minDebaters`/`maxDebaters`):
  - `duel` / `era_clash` → 2 slots fixos (A × B), sem botão de adicionar.
  - `roundtable` (3–6), `presidential` (4–8), `sages_council` (3–5), `ideas_war` (4–8 com badge de time), `century_problem` (3–5), `tribunal` (réu + jurados): lista de slots com **"+ Adicionar convidado"** e **"× Remover"**, respeitando min/max.
  - `interview` → 2 slots fixos com rótulos "Entrevistador" / "Entrevistado".
- Trocar de formato re-normaliza a lista (corta excedentes, completa até o min).
- O dropdown de persona já é agrupado por categoria (`PersonaSelectItems`). Vou apenas garantir que aparece **em todos os slots** dos novos formatos (hoje só os dois primeiros usam).

## 2) Trava de gênero na voz (Kokoro + ElevenLabs)

- Adicionar campo `gender` no catálogo client-safe:
  - `src/lib/kokoro-voices.ts`: `pf_dora=f`, `pm_alex=m`, `pm_santa=m`.
  - `src/lib/eleven-voices.ts`: rótulos já indicam (F)/(M), só formalizar.
  - `src/lib/piper-voices.ts`: anotar gênero das vozes pt-BR existentes.
- No `VoicePicker` (e no select de voz do mediador), aceitar prop `filterGender?: 'm' | 'f'` e esconder vozes que não batem. Quando a persona tem `gender` definido (catálogo ou campo explícito), o filtro é **obrigatório** e o select já vem com uma voz default do mesmo gênero (`defaultVoiceForGender`, já existe).
- Se a persona é "custom" sem gênero, aparece um seletor compacto **M/F** ao lado do nome — uma vez escolhido, a trava entra em ação.
- **Aviso (sem mudança de comportamento):** Kokoro só tem 1 voz feminina hoje. Se o usuário cria um programa só com mulheres, todas caem na mesma voz. Vou anotar o gap no UI ("amplie variedade com ElevenLabs") — adicionar novas vozes Kokoro está fora deste escopo.

## 3) Mediadores em tabela própria

Hoje `MEDIATORS` é um array estático em `src/lib/mediators.ts`. Migrar para banco para permitir edição/expansão futura:

- **Migração** (`mediators` table): `id, name, gender ('m'|'f'), tagline, style (text), tone, voice_provider, voice_id, avatar_url?, is_default boolean, sort_order, created_at, updated_at`. RLS pública de leitura (`TO anon, authenticated`), escrita só `service_role`. Seed dos 6 perfis atuais (3M/3F) + manter trava: `voice` do mediador deve bater com `gender`.
- `src/lib/mediators.ts` vira só os **tipos**; os dados passam a vir via `getMediators` server fn (cacheada via TanStack Query no `new.tsx`).
- Em `new.tsx`, **logo após** o select de Formato, novo bloco "Escolha o Mediador do Programa" como **carrossel horizontal** de cards (avatar + nome + tagline + chip de tom). Substitui o select de mediador atual. Persiste em `debates.moderator_name` / `moderator_style` / `voice_provider_mod` / `voice_id_mod` (campos já existem).
- Formato `interview` esconde o bloco (não tem mediador).

## 4) Arenas visuais — expandir para 5 cenários por formato

Hoje `ARENA_THEMES` tem **2 por formato**. Subir para **5**:

- Adicionar 3 novos temas por formato em `src/lib/arena-themes.ts` (paletas + arquétipo). Sem nova engine — o `<ArenaScene>` já desenha pelas paletas + `scene`.
- No `new.tsx`, depois do mediador, mostrar **grade visual** "Cenário da Arena" (mini-preview com `<ArenaBackground theme={t}/>`), filtrada por `themesForFormat(selectedFormat)`. Persiste em `debates.arena_theme` (já existe).
- Não vou gerar imagens novas — os cenários continuam vetoriais (CSS/SVG via `ArenaScene`).

## 5) Camada de Comentaristas (intervalos entre blocos)

Coluna `debates.commentators jsonb` **já existe** e está sem uso. Vou ligar a ponta a ponta:

### UI (`new.tsx`)
- Toggle "Incluir painel de comentaristas?" (default: off).
- Se on: 2 slots de comentarista (persona + voz com mesma trava de gênero + nome de exibição). Persistido como:
  ```json
  { "enabled": true, "panel": [{ "persona_id", "name", "voice_provider", "voice_id", "style" }, ...] }
  ```

### Engine
Em `src/lib/multi-sequence.ts` (sequenciador que gera a linha do tempo de áudio/cards):
- Após cada bloco (entre Bloco 1→2, 2→3, 3→4), se `commentators.enabled`, inserir um segmento `commentary_break`:
  1. Construir prompt para Comentarista A com: histórico do bloco recém-fechado + estilo do comentarista + diretriz "análise curta, 2–3 frases, foque em desempenho/retórica, não tome lado".
  2. Chamar `chatComplete` (Lovable AI) — fala curta (~15s TTS).
  3. Comentarista B replica com follow-up (recebe a fala de A no contexto).
  4. Render: novo card `CommentaryBreak` com 2 avatares lado a lado + legenda "Intervalo de análise", animação de transição.
- TTS reaproveita `tts.functions.ts` com as vozes escolhidas.
- Falha de IA no break **não derruba o debate** — log + pula o intervalo (try/catch isolado).

### Apresentação (`presentation.$id.tsx`)
- Renderizar os segmentos `commentary_break` na linha do tempo entre os blocos. Botão "pular intervalo" para o usuário.
- Export (`ExportPackDialog` / `video-export`) inclui os trechos no MP4 final automaticamente (já consome a sequência).

---

## Detalhes técnicos

**Arquivos novos:**
- migration `mediators` + seed.
- `src/lib/mediators.functions.ts` (getMediators server fn).
- `src/components/MediatorCarousel.tsx`.
- `src/components/CommentaryBreak.tsx`.

**Arquivos alterados:**
- `src/routes/_authenticated/new.tsx` (form dinâmico, mediador carrossel, cenário grid, toggle comentaristas).
- `src/lib/arena-themes.ts` (+3 temas por formato).
- `src/lib/kokoro-voices.ts`, `eleven-voices.ts`, `piper-voices.ts` (campo `gender`).
- `src/components/VoicePicker.tsx` (prop `filterGender`).
- `src/lib/multi-sequence.ts` + `multi-debate.functions.ts` (segmento `commentary_break`).
- `src/routes/_authenticated/presentation.$id.tsx` (render do intervalo).
- `src/lib/mediators.ts` (vira só tipos; mantém helpers).

**Fora de escopo agora:**
- Gerar novas vozes Kokoro femininas (gap real, mas precisa de áudio source).
- Arenas como imagens geradas (continuam vetoriais).
- Verdict colaborativo dos comentaristas (eles só comentam, não votam).
- Editar mediadores pela UI (CRUD admin) — só seed por enquanto.

---

## Perguntas antes de implementar

1. **Ordem de execução:** prefere que eu faça tudo de uma vez (1 PR grande) ou em fases? Sugiro fases: **(A)** form dinâmico + trava de voz + carrossel de mediador (DB), **(B)** 5 cenários por formato, **(C)** comentaristas end-to-end.
2. **Comentaristas — quem são?** Posso (a) reaproveitar personas do catálogo (usuário escolhe 2 quaisquer), (b) criar um catálogo dedicado tipo os mediadores (ex.: "Analista Político", "Crítico Acadêmico", "Comentarista Esportivo"), ou (c) ambos (escolhe da lista pronta **ou** custom)? A opção (c) é a mais flexível.
3. **Tribunal/Interview no carrossel de mediador:** "Interview" não tem mediador; "Tribunal" tradicionalmente tem juiz. Confirma que mantemos mediador **só nos formatos com `fixedRoles` ausentes** e tribunal usa o "juiz" no lugar (vindo de `fixedRoles.judge`)?
