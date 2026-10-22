import {copiarDadosEstritos, textoSuspeito} from "../fundamentacao/contrato";
import {normalizarTexto} from "../../rag/recuperacao";

export interface EvidenciaGeracao {
  readonly id: string;
  readonly texto: string;
  readonly contexto: number;
}
export interface PedidoGeracao {
  readonly pergunta: string;
  readonly contextos: readonly string[];
  readonly evidencias: readonly EvidenciaGeracao[];
}
export interface AfirmacaoGerada {
  texto: string;
  referencias: {id: string; citacao: string}[];
}
export interface PropostaGerada {afirmacoes: AfirmacaoGerada[]}
/** Contrato independente do transporte/provedor, sempre injetavel em testes. */
export interface ProvedorGeracao {
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
 * @return {PropostaGerada|null} Copia valida ou recusa.
 */
export function validarGeracao(
  entrada: unknown, evidencias: readonly EvidenciaGeracao[],
): PropostaGerada | null {
  try {
    const p = copiarDadosEstritos(entrada);
    if (!campos(p, ["afirmacoes"]) || !Array.isArray(p.afirmacoes) ||
      !p.afirmacoes.length || p.afirmacoes.length > 3) return null;
    const numeros = (s: string): string => [...new Set(
      s.match(/\d+(?:[.,:/-]\d+)*(?:\s*%)?/gu) || [],
    )].sort().join("|");
    const marcadores = new RegExp(
      "\\b(nao|nunca|jamais|sem|salvo|exceto|somente|apenas|se|caso|quando|" +
      "desde|proibid[oa]s?|permitid[oa]s?|obrigatori[oa]s?|opcional|" +
      "facultativ[oa]s?|minim[oa]s?|maxim[oa]s?|ate)\\b", "gu");
    for (const a of p.afirmacoes) {
      if (!campos(a, ["texto", "referencias"]) ||
        typeof a.texto !== "string" || !a.texto.trim() ||
        a.texto.length > 420 || /[<>]/u.test(a.texto) ||
        textoSuspeito(a.texto) || !Array.isArray(a.referencias) ||
        !a.referencias.length || a.referencias.length > 3) return null;
      const ids = new Set<string>();
      const citacoes: string[] = [];
      for (const r of a.referencias) {
        if (!campos(r, ["id", "citacao"]) ||
          typeof r.id !== "string" || typeof r.citacao !== "string" ||
          ids.has(r.id)) return null;
        const e = evidencias.find((item) => item.id === r.id);
        if (!e || r.citacao !== e.texto) return null;
        ids.add(r.id);
        citacoes.push(e.texto);
      }
      const fonte = citacoes.join(" ");
      if (numeros(a.texto) !== numeros(fonte)) return null;
      const sinais = (s: string): string => [...new Set(
        normalizarTexto(s).match(marcadores) || [],
      )].sort().join("|");
      if (sinais(a.texto) !== sinais(fonte)) return null;
    }
    return p as unknown as PropostaGerada;
  } catch {
    return null;
  }
}
