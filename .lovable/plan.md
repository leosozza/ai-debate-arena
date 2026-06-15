## Objetivo

Trazer para `/debates/$id/edit` os mesmos seletores que existem em `/new`:

1. **Personas salvas** — dropdown agrupado por categoria em cada card (Debatedor A / B), que preenche nome, persona, voz e imagem do debatedor escolhido.
2. **Mediador** — grade de cards de mediadores salvos (de `listMediators`), que define `moderatorName`, `moderatorStyle`, `moderatorTone` e a voz do mediador.
3. **Comentaristas pós-bloco** — switch + dois cards (nome, estilo, voz), idêntico ao do `/new`.
4. **Direcionamento do debate** (opcional, textarea) — campo `direction` que já existe no banco mas não está na tela.

## Mudanças

### `src/lib/debate.functions.ts` — `UpdateDebateSchema` + handler `updateDebate`
Adicionar (todos opcionais) ao schema e ao patch:
- `direction` (string nullable)
- `moderatorName` (string nullable) → `moderator_name`
- `moderatorStyle` (string nullable) → `moderator_style`
- `commentators` (array de `{ name, persona, voiceProvider, voiceId }`, max 2, nullable) → coluna `commentators` (jsonb); salvar `null` quando o array vier vazio.

Nada é obrigatório — campos não enviados continuam preservados, igual aos já existentes.

### `src/routes/_authenticated/debates.$id.edit.tsx`
- Carregar `personas` (`listPersonas`) e `mediators` (`listMediators`) via `useQuery`.
- Reutilizar o helper `PersonaSelectItems` (extrair para `src/components/PersonaSelectItems.tsx` — já existe arquivo com esse nome, vou conferir e reusar; caso contrário, criar). Copiar `applyPersona(side, personaId)` e `pickMediator(m)` do `new.tsx`.
- Estender o `form` com `direction`, `moderatorName`, `moderatorStyle`, `debaterAImageUrl`, `debaterBImageUrl`, `commentators` e popular no `useEffect` a partir de `data.debate` (incluindo `data.debate.commentators` se vier como array).
- Adicionar na UI:
  - Textarea **"Direcionamento do debate"** logo abaixo do Tema.
  - Em cada card de Debatedor: `<Select>` "Carregar persona salva" no topo (igual ao `new.tsx`).
  - Card **"Mediador do programa"** com a grade de botões, antes do "Modelo do mediador".
  - Card **"Comentaristas (pós-bloco)"** ao final, com switch e dois `VoicePicker` (mesmo JSX do `new.tsx`).
- `handleSave` passa os novos campos ao `update({ data: { ... } })`. Para comentaristas: enviar o array (vazio vira `null` no handler).

### Fora de escopo
- Editor de convidados extras (mesa redonda etc.) e formato/cenário — exigem mais mudanças no schema e no banco (`debate_participants`). Não foram pedidos; faço em uma rodada seguinte se quiser.

## Detalhes técnicos
- `VoicePicker` já recebe `filterGender`; aplico o mesmo padrão do `new.tsx` (gênero do mediador selecionado, gênero inferido dos nomes A/B).
- O schema atual exige `voiceProviderMod/A/B` e `voiceIdMod/A/B` sem `.optional()`; mantenho como está — o form sempre envia.
- `data.debate.commentators` em `getDebate` já retorna o JSON do banco; faço cast defensivo (`Array.isArray`).
