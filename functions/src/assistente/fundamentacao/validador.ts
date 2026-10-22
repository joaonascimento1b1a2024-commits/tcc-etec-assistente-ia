import {LIMITES_FASE_A, textoSuspeito, copiarDadosEstritos} from "./contrato";
import type {Evidencia, PropostaFundamentada, Validacao} from "./contrato";

/**
 * Confere campos exatos em copias estritas, sem coercoes.
 * @param {unknown} value Copia simples.
 * @param {string[]} keys Campos permitidos.
 * @return {boolean} Contrato exato.
 */
function campos(
  value: unknown, keys: string[],
): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

/**
 * JSON textual nao pode repetir chaves, mesmo usando escapes equivalentes.
 * @param {string} raw JSON ja limitado e sintaticamente valido.
 * @return {boolean} Chaves unicas em cada objeto.
 */
function chavesUnicas(raw: string): boolean {
  const pilha: {objeto: boolean; chave: boolean; usadas: Set<string>}[] = [];
  const padrao = /"(?:\\.|[^"\\])*"|[{}[\],:]|[^\s{}[\],:]+/gu;
  const tokens = raw.match(padrao) || [];
  for (const token of tokens) {
    const atual = pilha[pilha.length - 1];
    if (token === "{" || token === "[") {
      pilha.push({objeto: token === "{", chave: true, usadas: new Set()});
    } else if (token === "}" || token === "]") pilha.pop();
    else if (atual?.objeto && token === ",") atual.chave = true;
    else if (atual?.objeto && atual.chave && token.startsWith("\"")) {
      const chave = JSON.parse(token) as string;
      if (atual.usadas.has(chave)) return false;
      atual.usadas.add(chave);
      atual.chave = false;
    }
  }
  return true;
}

/**
 * Prova somente identidade literal. O gateway verifica fechamento local antes.
 * @param {unknown} entrada Objeto estrito ou JSON limitado.
 * @param {Array} evidencias Contexto interno, nunca fornecido pelo modelo.
 * @return {Validacao} Falha controlada sem conteudo de erros.
 */
export function validarProposta(
  entrada: unknown, evidencias: readonly Evidencia[],
): Validacao {
  const negar = (motivo: string): Validacao => ({valida: false, motivo});
  try {
    let original = entrada;
    if (typeof entrada === "string") {
      if (entrada.length > LIMITES_FASE_A.caracteresProposta) {
        return negar("proposta_excessiva");
      }
      original = JSON.parse(entrada);
      if (!chavesUnicas(entrada)) return negar("formato_invalido");
    }
    // Nao serializa a entrada: copia recusa acessores e transformacoes.
    const value = copiarDadosEstritos(original);
    if (JSON.stringify(value).length > LIMITES_FASE_A.caracteresProposta) {
      return negar("proposta_excessiva");
    }
    if (!campos(value, ["versao", "afirmacoes"]) || value.versao !== 1 ||
      !Array.isArray(value.afirmacoes) || !value.afirmacoes.length ||
      value.afirmacoes.length > LIMITES_FASE_A.afirmacoes) {
      return negar("formato_invalido");
    }
    const es = copiarDadosEstritos(evidencias, 12000) as Evidencia[];
    if (!Array.isArray(es) || !es.length ||
      es.length > LIMITES_FASE_A.afirmacoes || es.some((e, i) =>
      !e || e.id !== `E${i + 1}` || typeof e.texto !== "string" ||
      !e.texto || e.texto.length > LIMITES_FASE_A.caracteresCitacao ||
      textoSuspeito(e.texto))) return negar("evidencias_invalidas");
    const mapa = new Map(es.map((e) => [e.id, e]));
    const usadas = new Set<string>();
    for (const claim of value.afirmacoes) {
      if (!campos(claim, ["texto", "referencias"]) ||
        typeof claim.texto !== "string" || !claim.texto ||
        !Array.isArray(claim.referencias) || claim.referencias.length !==
        LIMITES_FASE_A.referenciasPorAfirmacao) {
        return negar("formato_invalido");
      }
      const ref = claim.referencias[0];
      if (!campos(ref, ["id", "citacao"]) || typeof ref.id !== "string" ||
        typeof ref.citacao !== "string") return negar("formato_invalido");
      const evidencia = mapa.get(ref.id);
      if (!evidencia || usadas.has(ref.id)) return negar("referencia_invalida");
      if (ref.citacao !== evidencia.texto) return negar("citacao_incorreta");
      if (claim.texto !== evidencia.texto) {
        return negar("afirmacao_sem_suporte");
      }
      usadas.add(ref.id);
    }
    if (usadas.size !== es.length) return negar("contexto_incompleto");
    return {valida: true, proposta: value as unknown as PropostaFundamentada};
  } catch {
    return negar("formato_invalido");
  }
}
