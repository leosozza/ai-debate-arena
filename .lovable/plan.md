## Plano refinado

Aplicar o prompt otimizado (versão TTS-safe, com regras comportamentais e few-shot) na persona do Enéas e no debate atual, mais o endurecimento global contra refrões.

### 1. Migração SQL — `UPDATE` em duas linhas

**a) `public.personas`** (id `85fcc8b0-f61a-4c1b-a43b-f72faea9b0a8`)
Substituir `persona_prompt` pelo texto refinado que você forneceu, na íntegra, em 1ª pessoa ("Você é o Dr. Enéas..."), incluindo:
- Aviso de TTS (sem markdown pesado).
- Seção 1: oratória/ritmo.
- Seção 2: regras anti-bordão (proibido abrir com "A tese é…", "Meus senhores!", "Veja bem…"; "Meu nome é Enéas!" só no clímax/encerramento).
- Seção 3: base de conhecimento (obras, economia, geopolítica, rejeição aos dois extremos).
- Seção 4: few-shot de calibração (pergunta + resposta-exemplo sobre economia brasileira).

**b) `public.debates`** (id `cea98432-ee13-4818-a673-02ebab6c8eee`)
Confirmo qual coluna o Enéas ocupa (`debater_a_persona` vs `debater_b_persona` — pelo contexto anterior ele é o debater_b) e atualizo a mesma string lá, para que as próximas regenerações deste debate já usem o novo prompt (o campo é uma cópia tirada no momento de criação do debate).

### 2. `src/lib/debate.functions.ts` — `DEBATER_STAGE_RULES`

Acrescentar parágrafo global (vale para todas as personas):

> REGRA ANTI-REFRÃO E TTS: sua fala vira áudio. Não use markdown (`**`, `*`, listas, cabeçalhos). Não abra dois turnos seguidos com a mesma fórmula. Não repita frases-âncora identitárias da persona ("A tese é…", "Meus senhores!", "Brasil acima de tudo", "Meu nome é X!") fora do encerramento. Varie aberturas e conectores; cada turno traz dado, conceito ou exemplo histórico novo.

### Fora de escopo
- Regenerar as falas já gravadas — você dispara quando quiser pelo botão de regenerar.
- Mexer em outras personas ou ajustar TTS/voz.

### Ordem de execução
1. `supabase--migration` com os dois `UPDATE`s (precisa de aprovação sua).
2. Após aprovação, edito `debate.functions.ts` com o parágrafo anti-refrão+TTS.

Aprovando, sigo nessa ordem.