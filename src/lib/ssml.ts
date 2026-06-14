// Wrap leve em SSML para providers que suportam (ElevenLabs/Polly-like) e
// versão "soft" para providers que não suportam (MiniMax/Kokoro/Piper):
// injeta reticências adicionais para forçar pausas no áudio.
import { paceToSsmlRate, type PhaseStyle } from "./phase-style";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** SSML completo: <speak><prosody rate=...>...</prosody></speak> com <break>. */
export function toSSML(text: string, style: PhaseStyle): string {
  const rate = paceToSsmlRate(style.pace);
  const pauseTag = `<break time="${style.pauseMs}ms"/>`;
  const body = escapeXml(text)
    // pausa após travessão de fala / em-dash
    .replace(/\s+—\s+/g, ` ${pauseTag} `)
    // pausa após pontos finais (não em abreviações comuns)
    .replace(/([.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕ])/g, `$1 ${pauseTag} `);
  return `<speak><prosody rate="${rate}">${body}</prosody></speak>`;
}

/** Versão plain — adiciona "..." após pontos para forçar pausa no TTS sem SSML. */
export function toPausedPlain(text: string, style: PhaseStyle): string {
  if (style.pauseMs < 350) return text;
  return text
    .replace(/\s+—\s+/g, " ... ")
    .replace(/([.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕ])/g, "$1 ... ");
}
