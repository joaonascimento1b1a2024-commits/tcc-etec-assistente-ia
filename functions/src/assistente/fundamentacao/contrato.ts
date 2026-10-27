import type {FonteDocumental} from "../resposta-documental";
import {isProxy} from "node:util/types";

export const LIMITES_FASE_A = Object.freeze({
  afirmacoes: 3, referenciasPorAfirmacao: 1, caracteresCitacao: 480,
  caracteresProposta: 6000, caracteresResposta: 2400,
  caracteresPergunta: 1000, timeoutMs: 10000, maxOutputTokens: 2048,
});

/** Evidencia interna confiavel; identidade literal nao prova contexto global.
 */
export interface Evidencia {
  readonly id: string;
  readonly texto: string;
  readonly fonte: Readonly<FonteDocumental>;
}
export interface ReferenciaProposta { id: string; citacao: string }
export interface AfirmacaoProposta {
  texto: string;
  referencias: ReferenciaProposta[];
}
export interface PropostaFundamentada {
  versao: 1;
  afirmacoes: AfirmacaoProposta[];
}
export type Validacao =
  {valida: true; proposta: PropostaFundamentada} |
  {valida: false; motivo: string};

/**
 * Copia JSON sem executar getters, toJSON, iteradores ou traps de proxies.
 * Falha fechada; nao serializa a entrada. Limites independem de sua estrutura.
 * @param {unknown} entrada Dado nao confiavel.
 * @param {number} limite Orcamento de caracteres antes da serializacao.
 * @return {unknown} Copia simples, limitada e desvinculada da entrada.
 */
export function copiarDadosEstritos(entrada: unknown, limite = 6000): unknown {
  let nos = 0;
  let caracteres = 0;
  const visitar = (valor: unknown, nivel: number): unknown => {
    if (++nos > 512 || nivel > 12) throw new Error("ESTRUTURA_INVALIDA");
    if (typeof valor === "string") {
      caracteres += valor.length;
      if (caracteres > limite) throw new Error("LIMITE_EXCEDIDO");
      return valor;
    }
    if (valor === null || typeof valor === "boolean") return valor;
    if (typeof valor === "number" && Number.isFinite(valor) &&
      !Object.is(valor, -0)) return valor;
    if (!valor || typeof valor !== "object" || isProxy(valor)) {
      throw new Error("TIPO_INVALIDO");
    }
    const array = Array.isArray(valor);
    if (Object.getPrototypeOf(valor) !== null &&
      Object.getPrototypeOf(valor) !==
      (array ? Array.prototype : Object.prototype)) {
      throw new Error("PROTOTIPO_INVALIDO");
    }
    const descritores = Object.getOwnPropertyDescriptors(valor);
    const chaves = Reflect.ownKeys(descritores);
    if (chaves.length > 128) throw new Error("LIMITE_EXCEDIDO");
    const tamanho = array ? descritores.length.value : 0;
    if (array && (!Number.isSafeInteger(tamanho) || tamanho > 16 ||
      chaves.length !== tamanho + 1)) throw new Error("ARRAY_INVALIDO");
    const copia: Record<string, unknown> = Object.create(null);
    for (const chave of chaves) {
      if (array && chave === "length") continue;
      if (typeof chave !== "string" || chave === "toJSON" ||
        chave === "__proto__" || chave === "constructor" ||
        chave === "prototype" || (array &&
        !/^(?:0|[1-9]\d*)$/u.test(chave))) throw new Error("CAMPO_INVALIDO");
      const d = descritores[chave];
      if (!("value" in d) || !d.enumerable) throw new Error("ACESSOR_INVALIDO");
      caracteres += chave.length;
      if (caracteres > limite) throw new Error("LIMITE_EXCEDIDO");
      copia[chave] = visitar(d.value, nivel + 1);
    }
    if (!array) return copia;
    return Array.from({length: tamanho}, (_, i) => {
      if (!Object.prototype.hasOwnProperty.call(copia, String(i))) {
        throw new Error("ARRAY_INVALIDO");
      }
      return copia[String(i)];
    });
  };
  return visitar(entrada, 0);
}

/**
 * Heuristica adicional, nunca anonimiza nem autoriza transmissao externa.
 * @param {string} texto Texto ja validado e limitado.
 * @return {boolean} Sinal para bloquear ate mesmo a simulacao.
 */
export function textoSuspeito(texto: string): boolean {
  const n = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const instrucao = new RegExp(
    "(?:ignore|ignorar|desconsidere|substitua|disregard|override).{0,100}" +
    "(?:instruc|prompt|sistema|regra|instruction|direction|policy|system)",
    "su");
  const exfiltracao = new RegExp(
    "(?:revele|exiba|imprima|envie|reveal|print|send|expose).{0,100}" +
    "(?:token|senha|chave|segredo|credencia|password|secret|key)", "su");
  const papeis = new RegExp(
    "(?:system|assistant|developer)\\s*:|" +
    "<\\/?(?:system|instruction)|\\[inst\\]", "iu");
  const pessoais = new RegExp(
    "\\b(?:meu nome|my name|nome completo|full name|meu endereco|" +
    "my address|numero da matricula|" +
    "social security|passport)\\b", "u");
  // Matricula e tambem um assunto escolar; bloquear identificacao, nao tema.
  const matriculaPessoal = new RegExp(
    "\\bmatricula\\s*(?:(?:numero|n[º°o.]|e)\\s*)?[:#=-]?\\s*" +
    "[a-z]{0,8}\\d[\\w/-]*\\b|\\bmatricula\\s*[:#=]\\s*\\w+|" +
    "\\bminha matricula\\s+(?:e|eh)\\b", "u");
  const documentoPessoal = new RegExp(
    "\\b(?:cpf|rg|ra|rm)\\s*(?:(?:numero|n[º°o.]|e|eh)\\s*)?" +
    "[:#=-]?\\s*[a-z]{0,8}\\d[\\w./-]*\\b|" +
    "\\b(?:cpf|rg|ra|rm)\\s*[:#=]\\s*\\w+", "u");
  const identificadores = new RegExp(
    "\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b|" +
    "\\b\\d{2}\\s?\\d{4,5}[- ]?\\d{4}\\b", "u");
  return instrucao.test(n) || exfiltracao.test(n) || papeis.test(n) ||
    pessoais.test(n) || matriculaPessoal.test(n) ||
    documentoPessoal.test(n) ||
    identificadores.test(n) ||
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}|\bBearer\s+\S+|PRIVATE KEY/iu.test(texto);
}
