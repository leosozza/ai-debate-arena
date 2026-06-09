Vou corrigir o modo apresentação para funcionar como uma transmissão de TV já a partir das 31 falas geradas.

## Plano

1. **Destravar o início do modo apresentação**
   - Ajustar a lógica da vinheta para ela não bloquear o botão Tocar.
   - Ao clicar em Tocar, mostrar a cartela do bloco e depois iniciar automaticamente a primeira fala com áudio.

2. **Sincronizar áudio e avanço das falas**
   - Trocar o controle atual por um token de reprodução, evitando que áudios antigos ou eventos duplicados avancem a apresentação na hora errada.
   - Garantir que cada fala só avance quando o áudio ativo realmente terminar.
   - Melhorar fallback: se ElevenLabs/MiniMax falhar, usar voz do navegador e continuar o debate.

3. **Navegação estilo TV por blocos**
   - Adicionar botões de bloco anterior e próximo bloco no controle inferior.
   - Fazer esses botões pularem para a primeira fala do bloco correto, pausando áudio atual com segurança.
   - Manter avançar/voltar fala funcionando.

4. **Vinheta e cartela entre blocos**
   - Mostrar a cartela animada antes de cada novo bloco.
   - Depois da cartela, tocar a fala de vinheta do mediador daquele bloco e seguir para os debatedores.
   - Adicionar barra de progresso visual na cartela.

5. **Manter palco de TV**
   - Preservar o mediador no topo e as IAs lado a lado na arena.
   - Ajustar responsividade para mobile sem quebrar o fluxo.

## Detalhes técnicos

- Editar `src/routes/_authenticated/debates.$id.present.tsx`.
- Editar `src/components/BlockIntroCard.tsx`.
- Não será necessário regerar o debate nem alterar o banco: o debate atual já tem 31 falas, 4 blocos e configuração de voz do navegador.