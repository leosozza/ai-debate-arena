## Diagnóstico

O Enéas das falas atuais vira caricatura por dois motivos somados:

1. **No prompt salvo da persona** (tabela `personas`, registro do Enéas Carneiro), o bloco "Estilo de fala" diz literalmente *"Repete a TESE como bordão argumentativo"* e logo abaixo lista bordões ("Brasil acima de tudo!", "É preciso ter uma indústria de base!" etc.). Isso instrui o modelo a martelar exatamente o que você critica.
2. **No prompt global** (`DEBATER_STAGE_RULES` em `src/lib/debate.functions.ts`) só existe regra contra o bordão identitário ("Meu nome é Enéas!"). Não há nada barrando refrões argumentativos repetidos a cada turno ("A TESE é…", "Brasil acima de tudo").

## Mudanças

### 1. Migração — atualizar `personas.persona_prompt` do Enéas

Reescrever as seções **Estilo de fala**, **Bordões e frases típicas** e **Como argumenta em debate** para refletir o Enéas real: erudito, vocabulário técnico (médico, militar, econômico, geopolítico), lógica formal, ritmo de metralhadora com precisão cirúrgica, indignação moral fundamentada em dados — sem muletas. Em particular:

- Remover "Repete a TESE como bordão argumentativo".
- Mover toda a lista de bordões para a seção do encerramento; durante o debate, **proibir** abrir falas com "A tese é…", "Brasil acima de tudo", "Senhores" e qualquer refrão fixo.
- Adicionar instrução positiva: "Cada fala traz dado, conceito ou exemplo histórico novo (nióbio, Meiji, Bismarck, dívida pública, mais-valia, geopolítica do Atlântico Sul etc.). Vocabulário denso, sentenças longas e bem encadeadas, alternadas com sentenças curtas de impacto. Cita números, instituições e processos históricos com precisão."
- Manter a regra de que "Meu nome é Enéas!" só aparece no encerramento.

Implementação: `supabase--migration` com `UPDATE public.personas SET persona_prompt = $$...$$ WHERE id = '85fcc8b0-f61a-4c1b-a43b-f72faea9b0a8';`.

### 2. `src/lib/debate.functions.ts` — endurecer `DEBATER_STAGE_RULES`

Acrescentar parágrafo:

> **REGRA ANTI-REFRÃO:** não abra duas falas seguidas com a mesma fórmula, não repita frases-âncora identitárias da persona ("A tese é…", "Brasil acima de tudo", "Senhores!", etc.) fora do encerramento. Varie aberturas, varie conectores, e em cada turno introduza um dado, exemplo histórico ou conceito novo em vez de reciclar o anterior.

Vale para todas as personas — corrige o problema na raiz e não só pro Enéas.

### Fora de escopo

- Reescrever falas já geradas do debate atual: a IA só vai melhorar nas próximas gerações. Se quiser, regenero o bloco depois.
- Mexer em outras personas — só faço se você pedir.

## Detalhes técnicos

- `id` da persona Enéas: `85fcc8b0-f61a-4c1b-a43b-f72faea9b0a8`.
- O `persona_prompt` é injetado em `buildSystemPrompt` (linha ~1124 de `debate.functions.ts`) via `debate.debater_a_persona`/`debater_b_persona`, copiados do persona no momento da criação do debate. Logo, debates **já criados** (incluindo este) continuam com o texto antigo no campo `debates.debater_a_persona`. Para esse debate específico atualizo também `debates.debater_a_persona`/`debater_b_persona` correspondente se o Enéas estiver lá — confirmo qual lado ele ocupa e atualizo a linha do debate `cea98432-…` na mesma migração.
