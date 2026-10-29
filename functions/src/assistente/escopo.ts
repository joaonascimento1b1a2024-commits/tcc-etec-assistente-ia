/** Politica local conservadora: intencoes desconhecidas pedem esclarecimento.
 * Nao usa modelo, dados pessoais ou historico externo.
 * O handler resolve complementos com o contexto autenticado.
 */
export const FORA_ESCOPO = "Posso ajudar você com informações sobre a ETEC " +
  "Sylvio de Mattos Carvalho, como matrícula, cursos, documentos, horários " +
  "e serviços da Secretaria Acadêmica. Sobre qual desses assuntos você " +
  "gostaria de saber?";
export const ESCLARECER_ESCOPO = "Sobre qual procedimento você quer saber?";
export const SOCIAL_ESCOPO =
  "Olá! Sou o Sylvinho, assistente virtual da ETEC " +
  "Sylvio de Mattos Carvalho. Como posso ajudar você com informações " +
  "da escola?";

export interface DecisaoEscopo {
  categoria: "institucional" | "social" | "fora_escopo" | "ambigua";
  resposta?: string;
}

/** Classifica objetivo e objeto da solicitacao; citar ETEC nao concede acesso.
 * @param {unknown} entrada Pergunta atual ou consulta contextualizada.
 * @return {DecisaoEscopo} Decisao sem texto livre na resposta local.
 */
export function classificarEscopo(entrada: unknown): DecisaoEscopo {
  const n = typeof entrada === "string" ? entrada.normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "").toLowerCase()
    .replace(/\s+/gu, " ").trim() : "";
  // Objetivos externos prevalecem sobre mencoes institucionais incidentais.
  // eslint-disable-next-line max-len
  const externo = /(?:ignore|desconsidere|esqueca|substitua).{0,100}(?:instruc|regras|papel|sistema)|(?:aja|responda|atue).{0,40}(?:chatgpt|sem restric)|(?:valor|digitos|numero).{0,15}\bpi\b|\bpi\s*\?|\d\s*[+*/=]\s*\d|(?:quanto e|calcule|resolva).{0,50}\d|(?:crie|escreva|gere|implemente|ensine|explique|faca|produza).{0,70}(?:python|codigo|jogo|programa|algoritmo|poema|piada|receita|equacao|matematica)|(?:quem|qual).{0,40}(?:ganhou|venceu).{0,40}(?:copa|mundial)|(?:conte|explique|ensine).{0,50}(?:historia geral|revolucao francesa|segunda guerra)|(?:traduza|traduce|translate)|(?:capital|presidente) d[oa]/u;
  if (externo.test(n)) {
    return {categoria: "fora_escopo", resposta: FORA_ESCOPO};
  }
  // Mensagem inteira social: "oi, valor de pi" nunca vira saudacao.
  // eslint-disable-next-line max-len
  if (/^(?:(?:oi|ola|bom dia|boa tarde|boa noite|obrigad[oa]|muito obrigad[oa]|valeu|tchau|ate mais|tudo bem)[!?. ,]*)+$/u.test(n)) {
    const resposta = /obrigad|valeu/u.test(n) ?
      "Por nada! Estou à disposição para ajudar com informações da ETEC." :
      /tchau|ate mais/u.test(n) ?
        "Até mais! Conte com o Sylvinho para informações da ETEC." :
        SOCIAL_ESCOPO;
    return {categoria: "social", resposta};
  }
  // Dominio positivo de servicos, nao permissao por nome da escola isolado.
  // eslint-disable-next-line max-len
  const servico = /\b(?:rg|cpf|presenca minima|assiduidade minima|e-mail|email|telefone|matricula|rematricula|inscric(?:ao|oes)|vestibulinho|secretaria|frequencia|faltas|calendario|horarios?|cursos?|documentos?|declarac(?:ao|oes)|diploma|certificado|historico escolar|transferencia|trancamento|estagio|regimento|normas|biblioteca|bolsa|merenda|atendimento|uniforme|transporte escolar|reuniao|conselho de classe|recuperacao|segunda chamada|notas|boletim|aproveitamento)\b/u;
  // eslint-disable-next-line max-len
  const institucional = /(?:onde fica|endereco|telefone|contato|email|historia|quem (?:e|foi)|sobre).{0,60}(?:etec|escola|sylvio|sylvinho)|(?:etec|escola).{0,60}(?:endereco|telefone|contato|email|funciona|fundada)/u;
  if (servico.test(n) || institucional.test(n)) {
    return {categoria: "institucional"};
  }
  // Objetivo completo externo, sem objeto institucional reconhecido.
  const perguntaExterna =
    /^(?:qual|quem|quanto|conte|crie|explique|ensine|escreva|como)\b/u;
  if (perguntaExterna.test(n) &&
      n.split(" ").length > 3 &&
      !/prazo|demora|documento|semestre|onde|faco|levar|rg|cpf/u.test(n)) {
    return {categoria: "fora_escopo", resposta: FORA_ESCOPO};
  }
  // Ausencia de intencao reconhecida nunca autoriza geracao geral.
  return {categoria: "ambigua", resposta: ESCLARECER_ESCOPO};
}
