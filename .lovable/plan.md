Vou corrigir a exportação por fala para ela não perder progresso e não ficar vulnerável a falas com erro.

Plano:
1. **Abrir o painel antes de preparar tudo**
   - Mostrar a lista de falas imediatamente.
   - Carregar vídeos MP4 já salvos no cache local sem precisar reprocessar.
   - Evitar que uma falha na preparação de áudio feche ou impeça o painel.

2. **Pré-validar cada fala individualmente**
   - Marcar falas sem áudio como `Áudio ausente` sem parar a fila.
   - Continuar exportando as próximas falas automaticamente.
   - Melhorar a mensagem de erro por fala para ficar claro o que falhou.

3. **Salvar cada vídeo antes de avançar**
   - Depois de gerar uma fala, salvar no cache local de forma aguardada, antes de ir para a próxima.
   - Se o modal fechar, atualizar ou travar depois, as falas já prontas reaparecem como concluídas.

4. **Não limpar a fila ao fechar o modal**
   - Fechar o painel apenas pausa/cancela a execução atual.
   - Manter a lista e os vídeos prontos em memória/cache para reabrir e continuar.

5. **Reduzir risco de travamento entre falas**
   - Revogar URLs antigas quando uma fala é re-renderizada.
   - Dar mais tempo ao navegador para liberar memória entre renders.
   - Garantir limpeza dos encoders/audio/canvas mesmo quando der erro.

6. **Melhorar retomada**
   - O botão “Continuar fila” vai pular tudo que já está pronto e tentar somente pendentes/erros com áudio.
   - Downloads individuais, ZIP e vídeo único continuam usando apenas as falas prontas.