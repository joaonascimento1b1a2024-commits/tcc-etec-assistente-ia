import type {FonteConhecimento} from "../../rag/recuperacao";
import {criarGeradorConfiguravel} from "../geracao/gateway";
import type {OpcoesGerador} from "../geracao/gateway";
import {criarBuscaDocumental} from "./busca";
import {interpretarPerguntaLivre} from "./interpretacao";

export interface OpcoesPerguntaLivre {
  readonly fonte: FonteConhecimento;
  readonly geracao?: OpcoesGerador;
}

/**
 * Compoe componentes existentes sem inicializar Firebase ou provedor externo.
 * ProvedorGeracao e o contrato reutilizado; simulados sao injetados nos testes.
 * @param {OpcoesPerguntaLivre} opcoes Dependencias do servidor.
 * @return {object} Dependencias do handler e fluxo para teste local.
 */
export function criarFluxoPerguntaLivre(opcoes: OpcoesPerguntaLivre) {
  const recuperarConhecimento = criarBuscaDocumental(opcoes.fonte);
  // Nao herda ativacao de process.env nesta preparacao offline.
  // Uma composicao autorizada precisa fornecer lerAmbiente explicitamente.
  const gerarResposta = criarGeradorConfiguravel({
    ...opcoes.geracao,
    lerAmbiente: opcoes.geracao?.lerAmbiente ?? (() => ({})),
  });
  return Object.freeze({
    recuperarConhecimento,
    gerarResposta,
    async responder(entrada: unknown, contexto?: {readonly uid: string}) {
      const {texto} = interpretarPerguntaLivre(entrada);
      const chunks = await recuperarConhecimento(texto);
      return gerarResposta(texto, chunks, contexto);
    },
  });
}
