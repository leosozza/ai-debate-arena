## O que muda

Hoje a apresentação começa direto na "vinheta do bloco 1" — um card preto com o título do bloco, e o mediador anuncia o sub-tema. Não há apresentação dos convidados, e o encerramento mostra só uma tela simples de vencedor.

Vamos transformar a abertura e o encerramento num formato de programa de TV (Roda Viva / debate de televisão):

### 1. Abertura — "Apresentação dos convidados"

Antes da vinheta do bloco 1, entra uma nova etapa: um card em tela cheia com os dois debatedores lado a lado:
- Cada lado mostra a foto grande do persona, o nome em destaque, e a descrição/biografia curta (campo `description` da persona, já existente).
- Um cabeçalho no topo: "Hoje no programa" + o tema do debate.
- Animação de entrada (slide das duas colunas, faixa diagonal igual a vinheta atual).

Enquanto o card está na tela, o mediador (TTS) narra a apresentação dos dois convidados e anuncia quem abre e qual é a primeira pergunta. O card só avança quando o áudio termina (ou ao toque, igual hoje).

### 2. Vinheta do bloco 1 — passa a abrir o debate de fato

A vinheta do bloco 1 deixa de ser uma simples chamada do sub-tema. Ela passa a:
- Saudar a audiência ("Boa noite, começa agora mais um debate…").
- Apresentar os dois debatedores, citando nome + 1 frase de quem é cada um (a partir do `debater_a_persona`/`debater_b_persona`).
- Anunciar explicitamente quem abre ("Começamos com [Debatedor A]") e ler a primeira pergunta do bloco 1 (sub-tema/foco).

As vinhetas dos blocos 2..N-1 continuam como hoje (chamada curta do sub-tema).

### 3. Encerramento — card final estilo "fim de programa"

Depois do veredito, em vez da tela atual de vencedor, entra um card final:
- Dois debatedores lado a lado novamente (foto + nome).
- Faixa central com o placar (vencedor destacado) e uma linha do veredito.
- Botão para voltar ao estúdio.

## Detalhes técnicos

**Arquivos novos**
- `src/components/DebaterIntroCard.tsx` — card duplo lado a lado (props: `topic`, `debaterA {name, image, description}`, `debaterB {...}`, `onDone`, opcional `audioUrl` para sincronizar com TTS). Reaproveita a estética da `BlockIntroCard` (faixa diagonal, faixa de progresso, "toque para pular").
- `src/components/ClosingCard.tsx` — card final com placar e os dois personas. Recebe `winner`, `verdictSummary`, ambos os debaters.

**Arquivos editados**
- `src/routes/_authenticated/presentation.$id.tsx`:
  - Antes do índice 0 (primeira vinheta), inserir uma "etapa virtual" de apresentação que renderiza `DebaterIntroCard` e dispara o TTS da vinheta do bloco 1 (já existente como mensagem do mediador). Quando termina, avança para a tela do estúdio.
  - Buscar `description` + `image_url` de cada persona (lookup por nome igual ao já feito para avatares no `video-export.ts`).
  - Depois da fase `veredito`, renderizar `ClosingCard` em vez (ou em cima) da tela atual de fim.
- `src/lib/debate.functions.ts` — ajustar APENAS o prompt da vinheta quando `block_index === 0`:

```
Você abre um debate de TV ao vivo no formato Roda Viva.
Tema: ${debate.topic}
Convidado A: ${debate.debater_a_name} — ${debate.debater_a_persona.slice(0,400)}
Convidado B: ${debate.debater_b_name} — ${debate.debater_b_persona.slice(0,400)}
Bloco 1 — "${block.title}". Foco: ${block.focus}.

Sua tarefa, em até 130 palavras:
1. Saúde a audiência e abra o programa.
2. Apresente os dois convidados em uma frase cada (nome + quem é, em tom jornalístico).
3. Anuncie que começamos com ${debate.debater_a_name} e faça a primeira pergunta do bloco 1, derivada do foco acima.
Texto corrido, sem markdown, sem listas.
```

Vinhetas dos blocos 2+ mantêm o prompt atual.

- `src/lib/video-export.ts` — incluir um frame inicial de apresentação (mesmo layout do `DebaterIntroCard`) tocando junto com o áudio da primeira vinheta, e um frame de encerramento estilo `ClosingCard` no final, para o MP4 exportado ficar igual ao que o usuário vê no estúdio.

**Sem mudanças** em: estrutura de blocos, contagem de turnos, modelo de IA, fluxo de aprovação/edição, integração de voz, autenticação.

## Como o usuário vai ver

1. Clica "Iniciar apresentação".
2. Card de abertura: tema no topo, "A: foto+nome+bio" | "B: foto+nome+bio". Mediador narra a apresentação e a primeira pergunta.
3. Estúdio entra, Debatedor A abre, debate segue normal.
4. Ao final do veredito, card de encerramento com placar e os dois convidados.
5. Vídeo MP4 exportado inclui as duas telas extras.
