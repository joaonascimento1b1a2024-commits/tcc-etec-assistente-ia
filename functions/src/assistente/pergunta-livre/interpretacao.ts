import {extrairTermosConsultaOriginal, normalizarTexto} from
  "../../rag/recuperacao";

export interface PerguntaInterpretada {
  readonly texto: string;
  readonly termos: readonly string[];
}

/**
 * Interpretacao lexical local: nao inventa intencoes, fatos ou sinonimos.
 * @param {unknown} entrada Texto livre, nunca um ID de catalogo.
 * @return {PerguntaInterpretada} Texto aparado e termos do RAG existente.
 */
export function interpretarPerguntaLivre(
  entrada: unknown,
): PerguntaInterpretada {
  if (typeof entrada !== "string" || entrada.length > 1000 ||
    !entrada.trim()) throw new Error("PERGUNTA_LIVRE_INVALIDA");
  const texto = entrada.trim();
  return Object.freeze({texto,
    termos: Object.freeze(extrairTermosConsultaOriginal(texto))});
}

/**
 * Pergunta incompleta nao autoriza inferir o servico nem ler historico.
 * @param {unknown} entrada Pergunta atual, sem dados de conversa.
 * @return {boolean} Necessita especificar o procedimento.
 */
export function requerEsclarecimento(entrada: unknown): boolean {
  const n = normalizarTexto(entrada);
  const servico = new RegExp("\\b(matricula|rematricula|rematricular|" +
    "renovacao|declaracao|frequencia|transferencia|trancamento)\\b", "u");
  if (servico.test(n)) {
    return false;
  }
  return (/\b(documentos?|papeis)\b/u.test(n) &&
    /\b(apresentar|levar|entregar|secretaria)\b/u.test(n)) ||
    /^(?:e (?:os |a )?)?documentos?$|^e os papeis$/u.test(n) ||
    /^(?:e |e para )?(?:isso|aquilo|como assim)$/u.test(n);
}
