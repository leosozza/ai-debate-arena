## Problema

Toda fala exportada (por-fala) está tocando o jingle de abertura ("Legends") como música de fundo. Causa: em `src/components/ExportVideoButton.tsx` (linha 662), o builder do per-speech passa `musicUrl: musicAsset.url` — ou seja, o MP3 da vinheta de abertura — como **bed musical** de cada fala. O encoder (`video-export-webcodecs.ts`) então mixa esse áudio embaixo de toda fala, com fade in/out.

A exportação do vídeo único completo (linha 427) também usa o mesmo MP3 como bed durante todas as falas, então tem o mesmo problema lá quando o usuário gera o vídeo inteiro.

## Correção

1. **Per-speech export** (`src/components/ExportVideoButton.tsx` linha 662): remover `musicUrl`/`musicVolume` do builder per-speech — falas individuais não devem ter música de fundo. Resultado: cada MP4 por fala fica só com a voz (sem jingle, sem bed).

2. **Vídeo único completo** (linha 427): também remover `musicUrl: musicAsset.url` / `musicVolume` do payload do export completo, para o jingle de abertura tocar **apenas** nos 10s de intro (disclaimer + vinheta) e não como cama durante todas as falas. O `video-export.ts` já usa o `musicAsset.url` internamente apenas no bloco `includeIntro`, então isso não afeta a abertura.

Se no futuro quisermos uma cama musical diferente durante as falas, podemos adicionar um asset novo (ex: "bed_neutral.mp3") e plugar nesses dois pontos. Por ora, ficar sem cama resolve a queixa imediata.

## Arquivo a alterar

- `src/components/ExportVideoButton.tsx` — duas pequenas edições (linhas 427-428 e 662-663) removendo `musicUrl`/`musicVolume`.

Nenhuma mudança em `video-export.ts` ou `video-export-webcodecs.ts`.
