import {copiarDadosEstritos} from "../fundamentacao/contrato";
import {
  CRITERIOS_REVISAO_CONVERSA, SCHEMA_CONVERSA, validarConversa,
} from "./conversa";
import type {RespostaConversa} from "./conversa";
import type {EvidenciaGeracao} from "./contrato";

const MOTIVOS = ["SEM_PROBLEMA", "CLAREZA", "SEM_SUPORTE", "CONTRADICAO",
  "CONDICAO_RELEVANTE", "ESCOPO_INCORRETO", "PERGUNTA_AMBIGUA",
  "SEGURANCA"] as const;
export type MotivoRevisao = typeof MOTIVOS[number];
export type MotivoDiagnosticoRevisao = MotivoRevisao |
  "FORMATO_INVALIDO" | "CORRECAO_INVALIDA";
export type FalhaRevisao = "REVISAO_REPROVADA" |
  "REVISAO_FORMATO_INVALIDO" | "REVISAO_CORRECAO_INVALIDA";

// Array vazio em aprovar/recusar; uma resposta em corrigir. Sem campos livres
// de justificativa: logs recebem apenas os motivos fechados, nunca conteudo.
export const SCHEMA_REVISAO_EDITORA = {
  type: "object", additionalProperties: false,
  required: ["decisao", "motivo", "respostas"],
  properties: {
    decisao: {type: "string", enum: ["aprovar", "corrigir", "recusar"]},
    motivo: {type: "string", enum: MOTIVOS},
    respostas: {type: "array", maxItems: 1, items: SCHEMA_CONVERSA},
  },
};
export const INSTRUCAO_REVISAO_EDITORA = CRITERIOS_REVISAO_CONVERSA +
  " Retorne JSON com decisao, motivo e respostas. Se a proposta atende " +
  "aos criterios, aprovar, SEM_PROBLEMA e respostas vazio. Quando " +
  "puder resolver o problema, corrigir com o motivo concreto e uma unica " +
  "resposta final completa em respostas. Voce mesmo revisa a correcao " +
  "contra os documentos antes de devolve-la. Nao basta sugerir ajustes. " +
  "Corrija somente o necessario e aproveite as partes sustentadas. " +
  "Se nao houver fonte suficiente, substitua a afirmacao sem suporte " +
  "por uma resposta sem_base ou esclarecimento pertinente; nao invente. " +
  "Apenas recuse com respostas vazio quando nao puder oferecer uma " +
  "correcao segura. Nao use SEM_PROBLEMA para corrigir ou recusar. " +
  "Para uma correcao documental, mensagem vazia e uma a tres afirmacoes " +
  "com referencias E1/E2/E3 existentes. Copie integralmente a citacao " +
  "da evidencia referenciada, inclusive espacos e quebras de linha. " +
  "Preserve na afirmacao os numeros, negacoes e condicoes dessa citacao. " +
  "Nos outros tipos, afirmacoes vazio e mensagem util de ate mil " +
  "caracteres. Nao inclua raciocinio interno ou justificativa livre.";

type ResultadoRevisao = {
  resposta: RespostaConversa;
  decisao: "aprovar" | "corrigir";
  motivo: MotivoRevisao;
} | {
  resposta: null;
  codigo: FalhaRevisao;
  motivo: MotivoDiagnosticoRevisao;
};

/**
 * Valida decisao e resposta corrigida com as mesmas regras da proposta.
 * @param {unknown} entrada JSON recebido da revisao independente.
 * @param {RespostaConversa} original Proposta ja validada localmente.
 * @param {EvidenciaGeracao[]} evidencias Fontes realmente enviadas.
 * @return {ResultadoRevisao} Resposta aprovada/corrigida ou recusa segura.
 */
export function avaliarRevisao(
  entrada: unknown, original: RespostaConversa,
  evidencias: readonly EvidenciaGeracao[],
): ResultadoRevisao {
  const falhar = (codigo: FalhaRevisao,
    motivo: MotivoDiagnosticoRevisao): ResultadoRevisao =>
    ({resposta: null, codigo, motivo});
  const invalida = (): ResultadoRevisao =>
    falhar("REVISAO_FORMATO_INVALIDO", "FORMATO_INVALIDO");
  try {
    const r = copiarDadosEstritos(entrada) as {
      decisao: string; motivo: MotivoRevisao; respostas: unknown[];
    } | null;
    if (!r || typeof r !== "object" || Array.isArray(r) ||
      Object.keys(r).sort().join() !== "decisao,motivo,respostas" ||
      !["aprovar", "corrigir", "recusar"].includes(r.decisao) ||
      !MOTIVOS.includes(r.motivo) || !Array.isArray(r.respostas) ||
      r.respostas.length !== (r.decisao === "corrigir" ? 1 : 0) ||
      (r.decisao === "aprovar") !== (r.motivo === "SEM_PROBLEMA")) {
      return invalida();
    }
    if (r.decisao === "recusar") {
      return falhar("REVISAO_REPROVADA", r.motivo);
    }
    const validacao = validarConversa(r.decisao === "corrigir" ?
      r.respostas[0] : original, evidencias);
    if (!validacao.resposta) {
      return falhar("REVISAO_CORRECAO_INVALIDA", "CORRECAO_INVALIDA");
    }
    return {resposta: validacao.resposta,
      decisao: r.decisao as "aprovar" | "corrigir", motivo: r.motivo};
  } catch {
    return invalida();
  }
}
