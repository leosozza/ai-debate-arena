# Revisar e regerar os 3 debates existentes

## Debates afetados
1. `o que é o amor` — roundtable (status: ready, sem falas geradas até o fim)
2. `Dinheiro compra felicidade?` — duel dinâmico (completed)
3. `Socialismo x Capitalismo` — duel (completed)

## Passos

### 1. Backfill de configuração (via INSERT/UPDATE)
- Em cada debate, setar:
  - `moderator_id = 'helena'` (Helena Costa — âncora padrão, voz Kokoro `pf_dora`)
  - `moderator_name`, `moderator_style`, `moderator_voice_provider`, `moderator_voice_id` derivados do catálogo `MEDIATORS`
  - `commentators = [{name:"Marina Reis", persona:"Repórter política sagaz, comenta o bloco com ironia fina e leitura de bastidor."}, {name:"Caio Lemos", persona:"Analista esportivo-político: enxerga o debate como jogo, aponta quem mandou bem e quem vacilou."}]`
- Não mexer em `dynamic_flow`, `format`, debaters, blocos, rounds — fica como o usuário configurou.

### 2. Reset de mensagens
- `DELETE FROM debate_messages WHERE debate_id IN (...)` nos 3 IDs.
- `UPDATE debates SET status='ready' WHERE id IN (...)`.

### 3. Regerar todas as falas agora
- Para cada debate, chamar `generateParticipantTurn` (multi: roundtable) ou `generateTurn` (duel) em loop até `done=true` ou `status='completed'`.
- Usar `invoke-server-function` apontando para as fns existentes, autenticando como o dono dos debates.
- Limite de segurança: 200 turnos por debate (corta loop infinito).

### 4. Verificação
- `SELECT count(*) FROM debate_messages GROUP BY debate_id` para confirmar que cada um terminou.
- Conferir que os papéis `c0`/`c1` aparecem no roundtable e que o duel tem comentaristas entre blocos.

## Detalhes técnicos

- **Sem migration**: só UPDATE/DELETE (insert tool) — colunas `moderator_id`, `commentators` etc. já existem.
- **Mediator catálogo**: ler `MEDIATORS` em `src/lib/mediators.ts` para preencher os campos derivados corretamente.
- **Auth**: as server fns exigem `requireSupabaseAuth`. Vou precisar do bearer do usuário dono — se `invoke-server-function` não anexar sessão automaticamente, faço o loop direto via SQL+chatComplete não é viável (lógica está dentro da fn). Plano B: deixar status `ready` e você dispara cada um na UI (botão de gerar), o que evita problema de auth. Confirmo no momento da execução.

## Fora de escopo
- Mudar formato, debatedores, blocos, rounds ou personas dos 3 debates.
- Criar novos comentaristas no catálogo — uso 2 personas inline simples.
