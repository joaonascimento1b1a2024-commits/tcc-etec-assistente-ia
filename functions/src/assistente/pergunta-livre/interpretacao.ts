import {extrairTermosConsultaOriginal} from "../../rag/recuperacao";

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
