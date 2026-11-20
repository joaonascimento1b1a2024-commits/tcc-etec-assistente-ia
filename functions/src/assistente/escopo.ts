import {identificarProcedimento} from "./intencao";

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

/** Respostas fixas sobre o próprio assistente (texto da página Sobre). */
export const IDENTIDADE_ESCOPO =
  "Sou o Sylvinho, o assistente virtual da ETEC Sylvio de Mattos " +
  "Carvalho. Fui criado por um grupo de cinco alunos como Trabalho de " +
  "Conclusão de Curso, para facilitar o acesso às informações da " +
  "Secretaria Acadêmica. Posso ajudar com matrícula, Vestibulinho, cursos, " +
  "frequência, documentos e regras da escola.";
export const CRIADORES_ESCOPO =
  "O Sylvinho foi desenvolvido por um grupo de cinco alunos da ETEC " +
  "Sylvio de Mattos Carvalho, como Trabalho de Conclusão de Curso. Os " +
  "nomes da equipe estão na página Sobre do site.";
export const FONTES_ESCOPO =
  "Sou um assistente com inteligência artificial. Minhas respostas " +
  "vêm de informações oficiais da escola e do Vestibulinho, conferidas com " +
  "as fontes antes de entrar na minha base. A IA ajuda a escrever a " +
  "resposta, mas não inventa dados; quando falta confirmação, indico a " +
  "Secretaria Acadêmica.";

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
  const externo = /(?:ignore|desconsidere|esqueca|substitua).{0,100}(?:instruc|regras|papel|sistema)|(?:aja|responda|atue).{0,40}(?:chatgpt|sem restric)|(?:valor|digitos|numero).{0,15}\bpi\b|\bpi\s*\?|\d\s*[+*/=]\s*\d|(?:quanto e|calcule|resolva).{0,50}\d|(?:crie|escreva|gere|implemente|ensine|explique|faca|produza).{0,70}(?:python|codigo|jogo|programa|algoritmo|poema|piada|receita|equacao|matematica)|(?:quem|qual).{0,40}(?:ganhou|venceu).{0,40}(?:copa|mundial)|(?:conte|explique|ensine).{0,50}(?:historia geral|revolucao francesa|segunda guerra)|(?:traduza|traduce|translate)|(?:capital|presidente) d[oa]|\b(?:faz|faca|resolve|resolva)\b.{0,20}\b(?:meu|minha)\s+(?:trabalho|tarefa|licao|dever|exercicio|redacao|atividade)/u;
  if (externo.test(n)) {
    return {categoria: "fora_escopo", resposta: FORA_ESCOPO};
  }
  // Perguntas sobre o próprio assistente: resposta fixa, sem busca nem modelo.
  // eslint-disable-next-line max-len
  const sobreFontes = /\b(?:(?:voce|vc) (?:e|eh) (?:uma? )?(?:ia|inteligencia artificial|robo|bot|humano|pessoa|chatgpt|gemini)|de onde (?:vem|voce tira|vc tira) (?:as )?(?:suas )?(?:respostas|informacoes)|(?:voce|vc) (?:usa|e feito com) (?:ia|inteligencia artificial)|como (?:voce|vc) funciona)\b/u;
  // eslint-disable-next-line max-len
  const sobreCriadores = /\bquem te (?:criou|fez|desenvolveu|programou)\b|(?:quem|que alunos|qual (?:equipe|grupo))\b.{0,15}\b(?:criou|criaram|fez|fizeram|desenvolveu|desenvolveram|programou|programaram)\b.{0,15}\b(?:sylvinho|voce|vc|site|chat|assistente|projeto|ia|robo|bot)\b/u;
  // eslint-disable-next-line max-len
  const sobreAssistente = /\b(?:quem (?:e|eh) (?:voce|vc|o sylvinho)|o que (?:e o sylvinho|(?:voce|vc) (?:e|faz|sabe fazer|pode fazer))|qual (?:e )?(?:o )?seu nome|como (?:voce|vc) se chama|no que (?:voce|vc) pode (?:me )?ajudar|para que (?:voce|vc) serve)\b/u;
  if (sobreFontes.test(n)) {
    return {categoria: "social", resposta: FONTES_ESCOPO};
  }
  if (sobreCriadores.test(n)) {
    return {categoria: "social", resposta: CRIADORES_ESCOPO};
  }
  if (sobreAssistente.test(n)) {
    return {categoria: "social", resposta: IDENTIDADE_ESCOPO};
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
  const servico = /\b(?:rg|cpf|presenca minima|assiduidade minima|e-mail|email|telefone|matricula|rematricula|inscric(?:ao|oes)|vestibulinho|secretaria|frequencia|faltas|calendario|horarios?|cursos?|documentos?|declarac(?:ao|oes)|diploma|certificado|historico escolar|transferencia|trancamento|estagio|regimento|normas|biblioteca|bolsa|merenda|atendimento|uniforme|transporte escolar|reuniao|conselho de classe|recuperacao|segunda chamada|notas|boletim|aproveitamento|mencao|mencoes|conceitos?|falta|faltei|atestado|doenca|aulas?|atrasad[oa]s?|professor(?:a|es)?|diretor(?:a)?|direcao|coordenador(?:a)?|coordenacao|orientador(?:a)?|orientacao|laboratorios?|refeitorio|quadra|gremio|apm|tcc|provas?|gabarito|feriados?|recesso|ferias|tecnico|m-?tec|ensino medio|modulos?|semestres?|turnos?|turmas?|taxa|pix|boleto|isencao|pontuacao acrescida|treineiro|pcd|fatec|reprovar|reprovei|reprovado|aprovado)\b/u;
  // eslint-disable-next-line max-len
  const institucional = /(?:onde fica|endereco|telefone|contato|email|historia|quem (?:e|foi)|sobre).{0,60}(?:etec|escola|sylvio|sylvinho)|(?:etec|escola).{0,60}(?:endereco|telefone|contato|email|funciona|fundada)/u;
  if (servico.test(n) || institucional.test(n) ||
    identificarProcedimento(entrada)) {
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
