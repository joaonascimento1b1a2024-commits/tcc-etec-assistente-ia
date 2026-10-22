import {recuperarConhecimentoRelevante} from "../../rag/recuperacao";
import type {FonteConhecimento} from "../../rag/recuperacao";
import {interpretarPerguntaLivre} from "./interpretacao";

/**
 * Reutiliza colecao, filtros, fontes e ranking sem reescrita por IA.
 * @param {FonteConhecimento} fonte Fonte somente-leitura, injetavel em testes.
 * @return {Function} Busca compativel com DependenciasAssistente.
 */
export function criarBuscaDocumental(fonte: FonteConhecimento) {
  return async (entrada: unknown) => {
    const {texto} = interpretarPerguntaLivre(entrada);
    try {
      return await recuperarConhecimentoRelevante(fonte, texto);
    } catch {
      // Indisponibilidade nao pode ser apresentada como ausencia de evidencia.
      throw new Error("BUSCA_DOCUMENTAL_INDISPONIVEL");
    }
  };
}
