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

export type MotivoTextoBloqueado = "INSTRUCAO_SUSPEITA" | "CREDENCIAL" |
  "DECLARACAO_PESSOAL" | "NOME_PREENCHIDO" | "IDENTIFICADOR_PESSOAL" |
  "CONTATO_OU_IDENTIFICADOR";

/**
 * Procura valores de identificacao, sem tratar prosa apos dois-pontos como ID.
 * Numeracao de passos e quantidade de copias nao sao valores preenchidos.
 * @param {string} texto Texto documental normalizado, sem alterar a fonte.
 * @return {boolean} Sinal de identificador; nao e garantia de anonimato.
 */
function identificadorDocumental(texto: string): boolean {
  const rotulos = new RegExp(
    "\\b(matricula|cpf|rg|ra|rm)\\s*" +
    "(?:(?:numero|n[º°o.]|e|eh)\\s*)?[:#=-]?\\s*" +
    "([a-z]{0,8}\\d[\\w./-]*)\\b", "gu");
  let achado: RegExpExecArray | null;
  while ((achado = rotulos.exec(texto)) !== null) {
    const valor = achado[2];
    const depois = texto.slice(achado.index + achado[0].length);
    const antes = achado[0].slice(0, achado[0].lastIndexOf(valor));
    if (/^\d{1,2}$/u.test(valor)) {
      // CPF: 2 copias / RG: 1 (uma) via, sem ignorar outros IDs no texto.
      if (/^\s*(?:\([a-z ]{1,20}\)\s*)?(?:copias?|vias?)\b/u
        .test(depois)) continue;
      const passo = new RegExp(
        "^[.)]\\s+(?:apresentar|entregar|preencher|solicitar|receber|" +
        "conferir|verificar|efetuar|realizar|providenciar|comparecer|" +
        "requerer|observar|acessar|assinar)\\b", "u");
      if (achado[1] === "matricula" && /[:\n]/u.test(antes) &&
        passo.test(depois)) continue;
    }
    // Cabecalho seguido de codigo de secao (B1 - Inicial...), sem atribuicao.
    if (achado[1] === "matricula" && /^[a-z]\d{1,2}$/u.test(valor) &&
      /\n/u.test(antes) && !/[:#=]/u.test(antes) &&
      /^\s*[-–]\s+[a-z]/u.test(depois)) continue;
    return true;
  }
  return /\bminha matricula\s+(?:e|eh)\b/u.test(texto) ||
    /\bmatricula\s*[#=]\s*\w+/u.test(texto);
}

/**
 * Categoria fechada; nunca retorna o trecho ou valor detectado.
 * @param {string} texto Texto ja validado e limitado.
 * @param {string} uso Documento permite rotulos sem identificacao preenchida.
 * @return {MotivoTextoBloqueado|null} Heuristica, nao prova anonimato.
 */
export function motivoTextoBloqueado(
  texto: string, uso: "livre" | "documento" = "livre",
): MotivoTextoBloqueado | null {
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
    "\\b(?:meu nome|my name|meu endereco|" +
    "my address|" + (uso === "documento" ? "" : "numero da matricula|") +
    "social security|passport)\\b", "u");
  // O nome de um campo em uma instrucao publica nao e um nome preenchido.
  const nomePreenchido = new RegExp(
    "\\b(?:nome(?: completo)?|full name)(?: do aluno| da aluna)?" +
    "\\s*[:=]\\s*[a-z]", "u");
  // Matricula e tambem um assunto escolar; bloquear identificacao, nao tema.
  const matriculaPessoal = new RegExp(
    "\\bmatricula\\s*(?:(?:numero|n[º°o.]|e)\\s*)?[:#=-]?\\s*" +
    "[a-z]{0,8}\\d[\\w/-]*\\b|\\bmatricula\\s*[:#=]\\s*\\w+|" +
    "\\bminha matricula\\s+(?:e|eh)\\b", "u");
  const documentoPessoal = new RegExp(
    "\\b(?:cpf|rg|ra|rm)\\s*(?:(?:numero|n[º°o.]|e|eh)\\s*)?" +
    "[:#=-]?\\s*[a-z]{0,8}\\d[\\w./-]*\\b", "u");
  const identificadores = new RegExp(
    "\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b|" +
    "\\b\\d{2}\\s?\\d{4,5}[- ]?\\d{4}\\b", "u");
  if (instrucao.test(n) || papeis.test(n)) return "INSTRUCAO_SUSPEITA";
  if (exfiltracao.test(n) || /\bBearer\s+\S+|PRIVATE KEY/iu.test(texto)) {
    return "CREDENCIAL";
  }
  if (pessoais.test(n)) return "DECLARACAO_PESSOAL";
  if (nomePreenchido.test(n)) return "NOME_PREENCHIDO";
  if (uso === "documento" ? identificadorDocumental(n) :
    matriculaPessoal.test(n) || documentoPessoal.test(n)) {
    return "IDENTIFICADOR_PESSOAL";
  }
  if (identificadores.test(n) ||
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(texto)) {
    return "CONTATO_OU_IDENTIFICADOR";
  }
  return null;
}

/**
 * Heuristica adicional, nunca anonimiza nem autoriza transmissao externa.
 * @param {string} texto Texto ja validado e limitado.
 * @return {boolean} Sinal para bloquear ate mesmo a simulacao.
 */
export function textoSuspeito(texto: string): boolean {
  return motivoTextoBloqueado(texto) !== null;
}
