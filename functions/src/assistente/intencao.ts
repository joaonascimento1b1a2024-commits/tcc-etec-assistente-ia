import {normalizarTexto} from "../rag/recuperacao";
import {normalizarProcedimentos} from "../rag/assuntos";

const PROCEDIMENTOS = [
  {padrao: /\brematriculas?\b/u, nome: "renovação de matrícula"},
  {padrao: /\bmatriculas?\b/u, nome: "matrícula"},
  {padrao: /\bdeclarac(?:ao|oes)\b/u, nome: "declaração escolar"},
  {padrao: /\btransferencia\b/u, nome: "transferência"},
  {padrao: /\btrancamento\b/u, nome: "trancamento de matrícula"},
  {padrao: /\b(?:frequencia|presenca|assiduidade)\b/u,
    nome: "frequência escolar"},
  {padrao: /\bcalendario (?:academico|escolar|letivo)\b/u,
    nome: "calendário acadêmico"},
  {padrao: /\batendimento da secretaria\b/u,
    nome: "atendimento da secretaria"},
] as const;

export type ProcedimentoInstitucional = typeof PROCEDIMENTOS[number]["nome"];

/**
 * Identifica o assunto, nao a elegibilidade nem a regra aplicavel.
 * Multiplos procedimentos nao sao reduzidos arbitrariamente a um deles.
 * O rotulo nao substitui a pergunta nem autoriza enviar dados ao provedor.
 * @param {unknown} pergunta Texto atual ou consulta contextualizada.
 * @return {string|undefined} Rotulo constante de um unico procedimento.
 */
export function identificarProcedimento(
  pergunta: unknown,
): ProcedimentoInstitucional | undefined {
  const n = normalizarProcedimentos(normalizarTexto(pergunta));
  const assuntos = PROCEDIMENTOS.filter((item) => item.padrao.test(n));
  return assuntos.length === 1 ? assuntos[0].nome : undefined;
}
