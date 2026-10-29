/**
 * Equivalencias lexicais de procedimentos; recebe texto ja normalizado.
 * Mantem qualificadores, negacoes e condicoes fora das expressoes conhecidas.
 * @param {string} texto Texto apenas para comparacao, nunca uma fonte reescrita.
 * @return {string} Assuntos com grafia canonica.
 */
export function normalizarProcedimentos(texto: string): string {
  return texto.replace(/\bre matricula(s)?\b/gu, "rematricula$1")
    .replace(/\b(?:renovacao|renovar|renovo|renova|renovando) (?:da |de |a |minha )*matricula\b/gu,
      "rematricula")
    .replace(/\bcontinuar estudando no proximo (?:ano|semestre)\b/gu,
      "rematricula");
}

/**
 * Remove somente expressoes de desconhecimento do modo de fazer.
 * "Nao renovar" e demais negacoes substantivas permanecem na consulta.
 * @param {string} texto Consulta normalizada.
 * @return {string} Consulta sem ruido de reformulacao.
 */
export function limparReformulacao(texto: string): string {
  return texto
    .replace(/\b(?:eu )?nao (?:sei|faco ideia de) como (?:se )?(?:faz|fazer)(?: isso)?$/u,
      "")
    .replace(/\b(?:eu )?nao (?:sei|faco ideia de) como\b/gu, "como")
    .trim();
}
