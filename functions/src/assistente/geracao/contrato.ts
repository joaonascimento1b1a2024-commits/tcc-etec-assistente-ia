import {
  copiarDadosEstritos, textoSuspeito, motivoTextoBloqueado,
} from "../fundamentacao/contrato";
import type {RespostaConversa} from "./conversa";
import {normalizarTexto} from "../../rag/recuperacao";
import type {ProcedimentoInstitucional} from "../intencao";

export interface EvidenciaGeracao {
  readonly id: string;
  readonly texto: string;
  readonly contexto: number;
}
export interface PedidoGeracao {
  readonly pergunta: string;
  readonly procedimento?: ProcedimentoInstitucional;
  readonly contextos: readonly string[];
  readonly evidencias: readonly EvidenciaGeracao[];
  readonly situacao?: "sem_evidencias" | "contexto_indisponivel" |
    "fontes_parciais";
}
export interface AfirmacaoGerada {
  texto: string;
  referencias: {id: string; citacao: string}[];
}
export interface PropostaGerada {afirmacoes: AfirmacaoGerada[]}
/** Contrato independente do transporte/provedor, sempre injetavel em testes. */
export interface ProvedorGeracao {
  conversar?(pedido: PedidoGeracao, signal: AbortSignal): Promise<unknown>;
  revisarConversa?(pedido: PedidoGeracao, resposta: RespostaConversa,
    signal: AbortSignal): Promise<unknown>;
  verificarConversa?(pedido: PedidoGeracao, resposta: RespostaConversa,
    signal: AbortSignal): Promise<boolean>;
  moderar(texto: string, signal: AbortSignal): Promise<boolean>;
  propor(pedido: PedidoGeracao, signal: AbortSignal): Promise<unknown>;
  verificar(pedido: PedidoGeracao, proposta: PropostaGerada,
    signal: AbortSignal): Promise<boolean>;
}

export const SCHEMA_PROPOSTA = {
  type: "object", additionalProperties: false, required: ["afirmacoes"],
  properties: {afirmacoes: {type: "array", maxItems: 3, items: {
    type: "object", additionalProperties: false,
    required: ["texto", "referencias"], properties: {
      texto: {type: "string", maxLength: 420},
      referencias: {type: "array", minItems: 1, maxItems: 3, items: {
        type: "object", additionalProperties: false,
        required: ["id", "citacao"], properties: {
          id: {type: "string", enum: ["E1", "E2", "E3"]},
          citacao: {type: "string", maxLength: 480},
        },
      }},
    },
  }}},
};
export const SCHEMA_REVISAO = {
  type: "object", additionalProperties: false, required: ["sustentada"],
  properties: {sustentada: {type: "boolean"}},
};

export type MotivoProposta = "PROPOSTA_SCHEMA_INVALIDO" | "PROPOSTA_VAZIA" |
  "PROPOSTA_TEXTO_INVALIDO" | "PROPOSTA_REFERENCIA_INVALIDA" |
  "PROPOSTA_CITACAO_DIVERGENTE" | "PROPOSTA_NUMEROS_DIVERGENTES" |
  "PROPOSTA_CONDICOES_DIVERGENTES";
export type AvaliacaoGeracao = {
  proposta: PropostaGerada; motivo?: never;
} | {proposta: null; motivo: MotivoProposta};

/**
 * Campos exatos de uma copia sem acessores/prototipos arbitrarios.
 * @param {unknown} valor Copia estrita.
 * @param {string[]} nomes Contrato permitido.
 * @return {boolean} Esquema exato.
 */
function campos(valor: unknown, nomes: string[]):
  valor is Record<string, unknown> {
  return !!valor && typeof valor === "object" && !Array.isArray(valor) &&
    Object.keys(valor).length === nomes.length &&
    nomes.every((n) => Object.prototype.hasOwnProperty.call(valor, n));
}

/**
 * Rejeita alteracoes objetivas. Nao prova implicacao semantica de parafrases.
 * @param {unknown} entrada Proposta do provedor.
 * @param {EvidenciaGeracao[]} evidencias IDs/citacoes internos.
 * @param {string} modo Sintese exige revisao semantica posterior obrigatoria.
 * @return {AvaliacaoGeracao} Copia valida ou codigo seguro de recusa.
 */
export function avaliarGeracao(
  entrada: unknown, evidencias: readonly EvidenciaGeracao[],
  modo: "literal" | "sintese_revisada" = "literal",
): AvaliacaoGeracao {
  const falhar = (motivo: MotivoProposta): AvaliacaoGeracao =>
    ({proposta: null, motivo});
  try {
    const p = copiarDadosEstritos(entrada);
    if (!campos(p, ["afirmacoes"]) || !Array.isArray(p.afirmacoes) ||
      p.afirmacoes.length > 3) return falhar("PROPOSTA_SCHEMA_INVALIDO");
    if (!p.afirmacoes.length) return falhar("PROPOSTA_VAZIA");
    const numeros = (s: string): string[] => [...new Set(
      s.match(/\d+(?:[.,:/-]\d+)*(?:\s*%)?/gu) || [],
    )].sort();
    const marcadores = new RegExp(
      "\\b(nao|nunca|jamais|sem|salvo|exceto|somente|apenas|se|caso|quando|" +
      "desde|proibid[oa]s?|permitid[oa]s?|obrigatori[oa]s?|opcional|" +
      "facultativ[oa]s?|minim[oa]s?|maxim[oa]s?|ate)\\b", "gu");
    for (const a of p.afirmacoes) {
      if (!campos(a, ["texto", "referencias"]) ||
        typeof a.texto !== "string" || !a.texto.trim() ||
        a.texto.length > 420 || /[<>]/u.test(a.texto) ||
        (modo === "sintese_revisada" ?
          motivoTextoBloqueado(a.texto, "documento") :
          textoSuspeito(a.texto)) || !Array.isArray(a.referencias) ||
        !a.referencias.length || a.referencias.length > 3) {
        return falhar("PROPOSTA_TEXTO_INVALIDO");
      }
      const ids = new Set<string>();
      const citacoes: string[] = [];
      for (const r of a.referencias) {
        if (!campos(r, ["id", "citacao"]) ||
          typeof r.id !== "string" || typeof r.citacao !== "string" ||
          ids.has(r.id)) return falhar("PROPOSTA_REFERENCIA_INVALIDA");
        const e = evidencias.find((item) => item.id === r.id);
        if (!e) return falhar("PROPOSTA_REFERENCIA_INVALIDA");
        if (r.citacao !== e.texto) return falhar("PROPOSTA_CITACAO_DIVERGENTE");
        ids.add(r.id);
        citacoes.push(e.texto);
      }
      const fonte = citacoes.join(" ");
      const numerosTexto = numeros(a.texto);
      const numerosFonte = numeros(fonte);
      // Resumo pode omitir numeros alheios, nunca introduzir outro valor.
      // A relevancia de uma omissao e conferida pelo revisor semantico.
      const numerosValidos = modo === "sintese_revisada" ?
        numerosTexto.every((n) => numerosFonte.includes(n)) :
        numerosTexto.join("|") === numerosFonte.join("|");
      if (!numerosValidos) return falhar("PROPOSTA_NUMEROS_DIVERGENTES");
      const sinais = (s: string): string => [...new Set(
        normalizarTexto(s).match(marcadores) || [],
      )].sort().join("|");
      // Somente/apenas e outras parafrases nao sao comparacoes lexicais.
      // No fluxo revisado, sentido/condicoes sao decisao do revisor.
      if (modo !== "sintese_revisada" && sinais(a.texto) !== sinais(fonte)) {
        return falhar("PROPOSTA_CONDICOES_DIVERGENTES");
      }
    }
    return {proposta: p as unknown as PropostaGerada};
  } catch {
    return falhar("PROPOSTA_SCHEMA_INVALIDO");
  }
}

/**
 * Mantem o contrato de validacao utilizado pelos fluxos existentes.
 * @param {unknown} entrada JSON gerado.
 * @param {EvidenciaGeracao[]} evidencias Evidencias previamente selecionadas.
 * @return {PropostaGerada|null} Proposta validada ou recusa.
 */
export function validarGeracao(
  entrada: unknown, evidencias: readonly EvidenciaGeracao[],
): PropostaGerada | null {
  return avaliarGeracao(entrada, evidencias).proposta;
}
