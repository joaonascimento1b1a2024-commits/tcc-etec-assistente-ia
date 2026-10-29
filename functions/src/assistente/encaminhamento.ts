import {normalizarTexto} from "../rag/recuperacao";

/**
 * Proximo passo sem contatos ou exigencias inventadas. Nao repete dados livres.
 * @param {string} pergunta Pergunta validada para escolher um rotulo.
 * @return {string} Encaminhamento constante; nao e resposta gerada por IA.
 */
export function orientarSemEvidencia(pergunta: string): string {
  const n = normalizarTexto(pergunta);
  if (/\b(prazo|quanto tempo|data|quando)\b/u.test(n)) {
    return "Não encontrei um prazo ou uma data confirmados nos documentos " +
      "consultados. Confirme com a Secretaria Acadêmica: " +
      "\"Qual é o prazo para o procedimento que preciso solicitar?\" " +
      "Informe qual é o procedimento, sem enviar dados pessoais aqui.";
  }
  if (/\b(telefone|email|e mail|horario|horarios)\b/u.test(n)) {
    return "Não encontrei esse contato ou horário confirmado nos documentos " +
      "consultados. Verifique os canais oficiais divulgados pela escola " +
      "para falar com a Secretaria Acadêmica.";
  }
  return "Não encontrei informação suficiente nos documentos consultados. " +
    "O próximo passo é confirmar a orientação com a Secretaria Acadêmica, " +
    "informando qual procedimento você precisa realizar. " +
    "Não envie dados pessoais aqui.";
}
