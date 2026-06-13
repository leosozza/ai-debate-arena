## Encurtar tela de AVISO

A tela de aviso atualmente narra via TTS o parágrafo inteiro do disclaimer (~50 palavras), o que leva 10-20s gerando + tocando. Vamos narrar só uma frase curta.

### Mudança

Em `src/routes/_authenticated/presentation.$id.tsx` (linha ~716), trocar o texto passado para `speak()`:

- **Antes:** `AI_DISCLAIMER_TEXT` (parágrafo completo)
- **Depois:** `"Aviso: este programa é uma simulação por inteligência artificial."` (uma frase, ~3s de áudio)

O texto visual na tela (`<AIDisclaimer variant="card" />`) continua mostrando o disclaimer completo — só a narração fica curta. Fallback de 30s mantido como segurança.

### Fora de escopo

- Texto exibido na tela (continua completo, por compliance visual)
- Disclaimers de outras telas (footer, inline, export)
