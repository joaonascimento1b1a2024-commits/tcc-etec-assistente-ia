import type {MotivoDiagnosticoRevisao} from "./geracao/revisao";

/** Somente contagens e codigos: nunca identidade, conteudo ou erro bruto. */
export type DiagnosticoAssistente = {
  etapa: "BUSCA_CONCLUIDA"; lidos: number; selecionados: number;
} | {etapa: "BUSCA_FALHOU"} | {
  etapa: "CONTEXTO_PREPARADO" | "PROPOSTA_RECEBIDA" |
    "REVISAO_APROVADA" | "REVISAO_CORRIGIDA" | "REVISAO_REPROVADA";
  motivoRevisao?: MotivoDiagnosticoRevisao;
  contextos: number;
  evidencias: number;
  uso: "DOCUMENTAL" | "SEM_EVIDENCIAS" | "CONTEXTO_BLOQUEADO";
  tipo?: "documental" | "esclarecimento" | "sem_base" |
    "fora_escopo" | "conversa" | "geral";
};
export type RegistrarDiagnostico =
  (diagnostico: Readonly<DiagnosticoAssistente>) => void;

/**
 * Telemetria opcional nunca muda o resultado do atendimento.
 * @param {RegistrarDiagnostico|undefined} registrar Destino local do operador.
 * @param {DiagnosticoAssistente} dado Contagens e codigos locais.
 */
export function emitirDiagnostico(
  registrar: RegistrarDiagnostico | undefined, dado: DiagnosticoAssistente,
): void {
  try {
    registrar?.(Object.freeze(dado));
  } catch {
    // Falha do logger nao impede consulta, geracao ou persistencia.
  }
}
