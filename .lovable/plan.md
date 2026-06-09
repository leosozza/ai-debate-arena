Plano para corrigir o modo apresentação inativo:

1. Corrigir o botão da tela do debate
- O botão “Modo apresentação” hoje aponta para `/debates/$id/arena`, que é só uma tela intermediária de introdução.
- Vou alterar para abrir diretamente `/debates/$id/present`, onde ficam o palco, controles e áudio.
- O botão continuará desabilitado apenas quando não houver falas geradas.

2. Deixar a opção de disparar evidente
- Na tela de apresentação, manter um botão principal “Tocar” sempre visível na barra inferior.
- Se a apresentação abrir pausada, o usuário verá imediatamente como iniciar.
- Se houver cartela/vinheta de bloco, ela só entra depois do primeiro toque em “Tocar”, sem bloquear a navegação.

3. Resolver a tela intermediária antiga
- Ajustar a rota `/arena` para não parecer o modo final quando ela for acessada.
- O botão “Iniciar apresentação” nela continuará levando para `/present`, mas o fluxo principal não dependerá mais dela.

4. Validar navegação e áudio
- Conferir que um debate com falas geradas abre o modo apresentação e exibe mediador no topo, IAs lado a lado e controles de TV.
- Confirmar que “Tocar”, pausar, próxima fala e próximo bloco continuam disponíveis.