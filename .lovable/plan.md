## Problema

O persona prompt do Enéas (em `src/lib/persona-seed-data.ts`) instrui literalmente: *"conclui sempre com 'Meu nome é Enéas'"* e *"Fecha com sentença identitária e o nome próprio para selar"*. Como esse prompt é enviado em TODA fala (resposta, réplica, etc.), o bordão acaba aparecendo em cada turno. O real Enéas só usava o bordão no fim do horário eleitoral — não em cada fala de debate.

Já existe um `DEBATER_STAGE_RULES` que tenta proibir reapresentação, mas o persona prompt específico do Enéas o sobrepõe.

## Correções

1. **`src/lib/persona-seed-data.ts`** — reescrever os campos do Enéas:
   - Trocar *"conclui sempre com 'Meu nome é Enéas'"* por: *"Reserva o bordão 'Meu nome é Enéas!' EXCLUSIVAMENTE para as considerações finais / encerramento — nunca usa em resposta, réplica ou turno comum."*
   - Ajustar o campo de tática de fechamento para refletir o mesmo: bordão identitário só no fim do debate.

2. **Atualizar a linha existente em `public.personas`** (migration) — o seed só afeta novos seeds; a persona "Enéas Carneiro" já está no banco com o prompt antigo. Atualizar `persona_prompt` com o texto corrigido para o usuário atual.

3. **`src/lib/debate.functions.ts`** — reforçar `DEBATER_STAGE_RULES` adicionando regra explícita: *"Se a sua persona tem um bordão identitário (ex.: 'Meu nome é X'), use-o APENAS na fase 'considerações finais' ou 'veredito'. Em respostas e réplicas comuns, jamais."*

## Fora do escopo

- Não vou reescrever mensagens já geradas neste debate — só falas futuras seguirão a nova regra.
- Sem mudanças em UI, voz ou clonagem.