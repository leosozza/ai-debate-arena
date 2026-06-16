Vou ajustar a exportação por fala para não depender do modal ficar aberto.

Plano:
1. **Fechar o modal não pausa mais a fila**
   - Ao clicar fora/fechar o painel, ele apenas esconde o modal.
   - A geração dos MP4s continua em segundo plano até terminar ou até o usuário apertar **Parar**.

2. **Separar “fechar” de “parar”**
   - O botão **Parar** será o único que cancela/pausa a fila.
   - Se parar durante uma fala, a fala atual volta para pendente/erro seguro, para poder continuar depois sem perder o que já foi salvo.

3. **Evitar múltiplas filas ao mesmo tempo**
   - Se a fila já estiver rodando e o usuário abrir o painel ou clicar de novo, não inicia outra execução duplicada.

4. **Continuar automaticamente de onde parou**
   - A fila sempre pula itens já concluídos.
   - Itens com vídeo salvo no cache continuam como prontos.
   - Itens pendentes com áudio seguem renderizando sem exigir ficar apertando **Continuar fila**.

5. **Feedback visual**
   - O botão/painel continuará mostrando quando há exportação em andamento, mesmo que o modal tenha sido fechado e reaberto.