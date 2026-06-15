## Por que o salvamento parece não persistir

Confirmei no banco: o debate `cea98432` continua com `voice_id_mod=pm_santa`, `voice_id_b=""` e `updated_at` de horas atrás. Nenhum `UPDATE` chegou ao Postgres.

O motivo é um bug no `VoicePicker` que acontece exatamente quando você troca o **provedor** de voz (ex.: de Kokoro para ElevenLabs):

```
VoicePicker.tsx onValueChange:
  const first = filterVoicesByGender(np, filterGender)[0]?.id
              ?? VOICE_CATALOG[np][0]?.id     // ← crash aqui
              ?? null;
```

A runtime do navegador registrou:
```
TypeError: Cannot read properties of undefined (reading '0')
  at onValueChange (VoicePicker.tsx:126…)
```

Quando o array da esquerda está vazio, ele cai pro `VOICE_CATALOG[np][0]`, e em alguns providers `[0]` é `undefined` → a exceção estoura **antes** de chamar `onChange(np, first)`. Resultado: o `<Select>` da UI mostra o novo provedor, mas o `form.voiceProvider*` no estado nunca é atualizado. Aí você clica em **Salvar**, e o `updateDebate` recebe os valores antigos — exatamente o que está no banco hoje.

Segundo problema, menor mas perceptível: a página `/debates/$id` (e o próprio editor, ao voltar) lê de `useQuery(["debate", id])` e **nada invalida esse cache após o save**. Mesmo um save que deu certo só "aparece" depois de F5.

## O que vou mudar

### 1. `src/components/VoicePicker.tsx` — corrigir o crash do provider
Trocar a linha do fallback por uma versão totalmente defensiva:

```ts
const cat = filterVoicesByGender(np, filterGender);
const fallbackCat = VOICE_CATALOG[np];
const first = cat[0]?.id ?? (fallbackCat && fallbackCat[0]?.id) ?? null;
onChange(np, first);
```

Sem `[0]` em coisa potencialmente `undefined`. Mantém o comportamento atual (`null` quando o catálogo daquele provider está vazio).

### 2. `src/routes/_authenticated/debates.$id.edit.tsx` — invalidar cache após salvar
- Adicionar `import { useQueryClient } from "@tanstack/react-query";`
- `const qc = useQueryClient();`
- No `handleSave`, depois do `await update(...)`:
  - `await qc.invalidateQueries({ queryKey: ["debate", id] });`
  - `await qc.invalidateQueries({ queryKey: ["debates"] });`
- Aí navega para `/debates/$id`. Assim a tela de detalhe e o `ExportVideoButton` (que usa o mesmo `["debate", id]`) já leem as vozes novas — sem precisar de F5.

## Fora de escopo
- Não vou mudar o esquema de validação nem `updateDebate`: o server fn está correto e grava todos os campos de voz que vierem definidos.
- Não vou mexer no catálogo Kokoro de novo (já foi feito na rodada anterior).
- Não vou inserir migration: só código de UI.

## Resultado esperado
- Trocar o provedor de voz no editor para ElevenLabs (ou qualquer outro) deixa de quebrar; a voz selecionada vai pro `form`.
- Clicar em "Salvar alterações" grava `voice_provider_*` / `voice_id_*` no banco (dá pra confirmar com um SELECT no `debates`).
- Voltar pra `/debates/$id` e clicar em "Exportar MP4" já usa as vozes recém-salvas, sem refresh.
