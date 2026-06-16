// Compartilha o <audio> em reprodução com o Teleprompter para sincronizar
// o scroll com o tempo REAL da fala (em vez de uma estimativa por caracteres).
let activeAudio: HTMLAudioElement | null = null;

export function setActiveAudio(el: HTMLAudioElement | null) {
  activeAudio = el;
}

export function getActiveAudio(): HTMLAudioElement | null {
  return activeAudio;
}
