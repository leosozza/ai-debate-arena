## Objetivo

Substituir a geração atual de persona (1 chamada Gemini "do nada") por um **orquestrador multi-agente** que pesquisa a pessoa na web via Firecrawl, monta um dossiê com fontes citadas e converte em `persona_prompt` operacional.

## Arquitetura

```text
generatePersonaWithAI (server fn)
   │
   ├── 1. Agente Pesquisador  (Gemini 2.5 Flash)
   │       gera 4–6 queries de busca a partir do nome+contexto
   │
   ├── 2. Firecrawl /search   (em paralelo, scrapeOptions: markdown)
   │       coleta título + URL + markdown das top fontes (limit 5 por query, dedup por URL, máx ~12 fontes)
   │
   ├── 3. Agente Analista     (Gemini 2.5 Pro)
   │       recebe o material bruto + lista de URLs
   │       devolve dossiê estruturado em markdown com [n] citações
   │
   └── 4. Agente Encarnador   (Gemini 2.5 Pro)
           converte dossiê em JSON { description, persona_prompt }
           persona_prompt em 2ª pessoa, 2500–6000 chars, com as seções já usadas hoje
```

Retorno final ao cliente:
```ts
{ description, persona_prompt, sources: { title, url }[] }
```

## Arquivos a criar/editar

**Novo** `src/lib/firecrawl.server.ts`
- `firecrawlSearch(query, { limit }): Promise<{ title; url; markdown }[]>`
- usa `process.env.FIRECRAWL_API_KEY`, chama `https://api.firecrawl.dev/v2/search` com `scrapeOptions: { formats: ['markdown'], onlyMainContent: true }`
- trunca markdown por fonte (~6k chars) para caber no contexto
- erros tipados (402 = sem créditos, 401 = key inválida)

**Editar** `src/lib/persona.functions.ts` — reescrever `generatePersonaWithAI`:
1. Etapa "queries": pede ao Flash 4–6 queries JSON (`[{q, lang}]`), em pt e en
2. Etapa "search": `Promise.all` chamando firecrawl, dedup por URL, corta para 12 fontes
3. Se 0 fontes → fallback para o fluxo atual (sem web) e marca `sources: []`
4. Etapa "analista": monta prompt com `[1] título — url\n<markdown truncado>` e pede dossiê em markdown com `[n]` ao final de cada afirmação
5. Etapa "encarnador": converte dossiê → JSON `{ description, persona_prompt }` (mesmas seções de hoje + "**Fontes consultadas**" listando `[n] título — url`)
6. Schema de retorno expandido com `sources`

**Editar** `src/routes/_authenticated/personas.tsx`
- Mostrar barra de progresso em etapas: `🔎 Gerando queries… → 📚 Buscando na web ({n} fontes) → 🧠 Analisando… → ✍️ Encarnando…` (status textual simples, sem streaming SSE — basta exibir spinner com texto variável durante o `useMutation`)
- Após sucesso, listar `sources` (chips clicáveis com `<a target="_blank">`) abaixo do textarea
- Salvar persona já anexa as fontes no final do `persona_prompt` (que o encarnador já incluiu)

## Detalhes técnicos

- **Modelos**: queries = `google/gemini-3-flash-preview` (rápido); analista e encarnador = `google/gemini-2.5-pro` (qualidade).
- **Concorrência**: `Promise.allSettled` no search; ignora queries que falharem.
- **Timeout/segurança**: cada chamada Firecrawl com `AbortController` 25s; total da serverFn ~90s.
- **Tamanho de contexto**: cada fonte truncada a ~6000 chars; dossiê final cabe folgado no Gemini Pro.
- **Sem novas tabelas** — `personas` já guarda tudo; `sources` retornadas no response e renderizadas, depois embutidas no `persona_prompt` para virem junto quando o debatedor for instanciado.
- **Sem mudança de schema do DB**.

## Fora do escopo

- Agente Crítico (validação fidelidade vs dossiê) — fica como melhoria futura.
- Streaming de progresso real (SSE) — usaremos estado local com etapas estimadas.
- Armazenar fontes em tabela separada.
