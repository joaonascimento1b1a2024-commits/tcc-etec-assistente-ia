import {recuperarConhecimentoRelevante} from "../../rag/recuperacao";
import type {FonteConhecimento} from "../../rag/recuperacao";
import {emitirDiagnostico} from "../diagnostico";
import type {RegistrarDiagnostico} from "../diagnostico";
import {interpretarPerguntaLivre} from "./interpretacao";

/**
 * Reutiliza colecao, filtros, fontes e ranking sem reescrita por IA.
 * @param {FonteConhecimento} fonte Fonte somente-leitura, injetavel em testes.
 * @param {RegistrarDiagnostico} registrar Observador local sem conteudo.
 * @return {Function} Busca compativel com DependenciasAssistente.
 */
export function criarBuscaDocumental(
  fonte: FonteConhecimento, registrar?: RegistrarDiagnostico,
) {
  return async (entrada: unknown) => {
    const {texto} = interpretarPerguntaLivre(entrada);
    try {
      return await recuperarConhecimentoRelevante(fonte, texto, (resumo) =>
        emitirDiagnostico(registrar, {etapa: "BUSCA_CONCLUIDA", ...resumo}));
    } catch {
      emitirDiagnostico(registrar, {etapa: "BUSCA_FALHOU"});
      // Indisponibilidade nao pode ser apresentada como ausencia de evidencia.
      throw new Error("BUSCA_DOCUMENTAL_INDISPONIVEL");
    }
  };
}
