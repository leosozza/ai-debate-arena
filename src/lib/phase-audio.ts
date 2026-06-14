// Mapeia o nome da FASE para o "bed" (pad musical) que deve correr embaixo.
// Funciona para todas as engines porque os nomes de fase são padronizados.
import type { BedType } from "./sfx";

export function phaseToBed(phase: string): BedType {
  const p = (phase ?? "").toLowerCase();
  if (!p) return "bed_reflective";
  // Aberturas/vinhetas/apresentação → introdução
  if (/vinheta|abertura|apresenta|intro/.test(p)) return "bed_intro";
  // Confronto: réplica, acusação, interrogatório, pergunta/resposta presidencial
  if (/réplica|replica|acusa|interrog|pergunta|resposta|reviravolta/.test(p)) return "bed_tension";
  // Encerramento solene: veredito, sentença, considerações finais, fechamento
  if (/veredito|sente|considera|fechamento/.test(p)) return "bed_verdict";
  // Reflexão coletiva: contribuição, síntese, ângulo, ação, defesa
  return "bed_reflective";
}
