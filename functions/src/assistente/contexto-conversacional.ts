import {normalizarTexto} from "../rag/recuperacao";
import {limparReformulacao, normalizarProcedimentos} from "../rag/assuntos";

export const LIMITES_CONTEXTO = Object.freeze({
  mensagens: 6, caracteres: 2000, porMensagem: 700,
});
export const ESCLARECER_CONTEXTO =
  "Sobre qual procedimento você quer saber?";

// Vocabulario fechado: nenhum texto do historico vai para a consulta/provedor.
const ASSUNTOS = [
  {padrao: /^(?:declaracao|declaracao escolar)$/u, nome: "declaração escolar"},
  {padrao: /^matricula(?: inicial)?$/u, nome: "matrícula"},
  {padrao: /^(?:rematricula|renovacao de matricula)$/u,
    nome: "renovação de matrícula"},
  {padrao: /^frequencia(?: minima)?$/u, nome: "frequência mínima"},
  {padrao: /^calendario (?:academico|escolar|letivo)$/u,
    nome: "calendário acadêmico"},
  {padrao: /^(?:horario de )?atendimento da secretaria$/u,
    nome: "atendimento da secretaria"},
];

/**
 * Reconhece complementos fechados; qualificadores extras nao sao apagados.
 * @param {string} texto Pergunta atual ou anterior.
 * @return {string|undefined} Inicio de consulta canonica.
 */
function complemento(texto: string): string | undefined {
  const n = normalizarTexto(texto).replace(/^e /u, "");
  if (/^(?:quanto tempo demora|qual (?:o )?prazo|o prazo)$/u.test(n)) {
    return "Qual o prazo para";
  }
  if (/^(?:quais documentos|quais documentos preciso levar)$/u.test(n)) {
    return "Quais documentos para";
  }
  if (/^(?:onde solicito|onde posso solicitar|onde faco isso)$/u.test(n)) {
    return "Onde solicitar";
  }
  if (/^(?:posso fazer pela internet|pode ser pela internet)$/u.test(n)) {
    return "Como solicitar pela internet";
  }
  const modo = new RegExp("^(?:nao sei como fazer(?: isso)?|" +
    "nao faco ideia de como (?:faz|fazer) isso|" +
    "como (?:faco|faz|fazer)(?: isso)?)$", "u");
  if (modo.test(n)) {
    return "Como solicitar";
  }
  return undefined;
}

/**
 * Extrai somente assunto de perguntas inteiramente reconhecidas.
 * Nomes, identificadores, condicoes e subtipos desconhecidos impedem heranca.
 * @param {string} texto Mensagem anterior, usada apenas localmente.
 * @return {string|undefined} Rotulo constante, nunca trecho do historico.
 */
function assuntoSeguro(texto: string): string | undefined {
  const pedido = new RegExp("^(?:de )?(?:como " +
    "(?:(?:faco para|faco|posso) )?" +
    "(?:(?:solicitar|solicito|pedir|fazer) )?|" +
    "(?:fazer|quero|qual e|qual|quais sao) )", "u");
  const n = limparReformulacao(normalizarProcedimentos(normalizarTexto(texto)))
    .replace(/^(?:por favor |gostaria de saber )/u, "")
    .replace(pedido, "")
    .replace(/^(?:a |o |uma |um |minha |meu )/u, "");
  return ASSUNTOS.find((a) => a.padrao.test(n))?.nome;
}

/**
 * Usa apenas a janela anterior ao messageId ja validado pelo handler.
 * Nao faz I/O, nao consulta outra conversa e nao guarda estado entre chamadas.
 * @param {string} pergunta Texto original da pergunta atual.
 * @param {string} messageId Identificador validado da pergunta salva.
 * @param {unknown[]} mensagens Array do documento da conta autenticada.
 * @return {object} Consulta canonica ou esclarecimento deterministico.
 */
export function resolverContextoConversacional(
  pergunta: string, messageId: string, mensagens: readonly unknown[],
): {pergunta: string; esclarecimento?: never} |
  {pergunta?: never; esclarecimento: string} {
  const prefixo = complemento(pergunta);
  if (!prefixo) return {pergunta};
  const esclarecer = {esclarecimento: ESCLARECER_CONTEXTO};
  if (mensagens.length > 100) return esclarecer;
  const posicao = mensagens.findIndex((m) => !!m && typeof m === "object" &&
    (m as {messageId?: unknown}).messageId === messageId &&
    (m as {remetente?: unknown}).remetente === "user");
  if (posicao < 0) return esclarecer;
  let caracteres = 0;
  for (let i = posicao - 1;
    i >= Math.max(0, posicao - LIMITES_CONTEXTO.mensagens); i--) {
    const m = mensagens[i] as {texto?: unknown; remetente?: unknown} | null;
    if (!m || typeof m.texto !== "string") return esclarecer;
    // Bots nunca fornecem assunto/fatos; seu tamanho ainda conta na janela.
    caracteres += m.texto.length;
    if (caracteres > LIMITES_CONTEXTO.caracteres) return esclarecer;
    if (m.remetente === "bot") continue;
    if (m.remetente !== "user" ||
      m.texto.length > LIMITES_CONTEXTO.porMensagem) return esclarecer;
    if (complemento(m.texto)) continue;
    const assunto = assuntoSeguro(m.texto);
    // Mensagem nao reconhecida interrompe a busca: pode ser mudanca de assunto.
    return assunto ? {pergunta: `${prefixo} ${assunto}?`} : esclarecer;
  }
  return esclarecer;
}
