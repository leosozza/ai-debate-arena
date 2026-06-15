# Diagnóstico: a clonagem FUNCIONOU

Olhando os logs de rede, a clonagem ElevenLabs **rodou com sucesso 2 vezes** nesta sessão:

- Voice ID `V5y8XCbu95r3C8oxGqFp` (16:18:32)
- Voice ID `60VPbn6ieL2Wi9gENAIk` (16:19:38)

Ambas foram salvas na persona Enéas Carneiro (`provider=eleven`, `source=upload-eleven`). O banco está atualizado. O áudio enviado foi aceito pelo ElevenLabs e o voice_id retornado é válido.

## Por que parece que "não clonou"

O `VoicePicker` só mostra um item especial **"🎙 Voz clonada"** quando o provider é **Replicate**. Para ElevenLabs/MiniMax, quando o voiceId clonado não está no catálogo de vozes pré-definidas, ele cai num branch (`isCustomCatalog`) que exibe só `🎙 Personalizada (V5y8XCbu95r…)` — mas só no select; o dropdown ainda parecia mostrar "Rachel (F)" porque o estado do form pode não ter sido visivelmente atualizado, e não há nenhum aviso textual confirmando "voz X clonada e atribuída".

## Plano

### 1. `src/components/VoicePicker.tsx` — mostrar clone Eleven/MiniMax com nome amigável

Quando `provider === "eleven"` ou `"minimax"` e o `voiceId` atual não está no catálogo, exibir um item destacado tipo:

```
🎭 Voz clonada · {nome do preset, se existir} ({voiceId curto})
```

Buscar o nome cruzando com `presets` (já carregados no componente) via `voice_url === voiceId` — hoje só fazemos esse match para Replicate; estender para Eleven/MiniMax também.

### 2. `src/components/VoiceClonePanel.tsx` — toast mais claro

Trocar `toast.success("Voz clonada via ElevenLabs ✓")` por algo explícito:

```
✓ Voz "Enéas Carneiro" clonada (ElevenLabs · V5y8XCbu…) e atribuída à persona
```

Inclui o nome do clone + provider + 8 chars do voiceId, deixando óbvio o que aconteceu.

### 3. `src/routes/_authenticated/personas.tsx` — banner pós-clone

No `onCloned` da persona, após `setForm`, mostrar um pequeno aviso fixo abaixo do `VoicePicker`:

```
🎭 Esta persona agora usa uma voz clonada (ElevenLabs · Enéas Carneiro).
Use o botão ▶ ao lado do seletor para ouvir uma amostra.
```

Some quando o usuário muda o provider/voice manualmente.

## O que NÃO muda

- Lógica de cascata (`cloneVoiceCascade`) — já funciona.
- API ElevenLabs / chaves / endpoints.
- Banco / RLS / migrations.

## Detalhes técnicos

- `voice_presets` já são criados pelo `savePreset` em `voice-clone.functions.ts` (`name: "Enéas Carneiro (ElevenLabs)"`, `voice_url: voice_id`). O VoicePicker já consulta `listVoicePresets`, então tem o nome disponível — só precisa estender o match para Eleven/MiniMax (não só Replicate como hoje).
- Nenhuma chamada de API extra.
