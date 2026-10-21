import type {DocumentoPreparado} from "../rag/recuperacao";
import {
  extrairTermosUteis, normalizarTexto, FONTES_ORIGINAIS,
  extrairTermosOriginais, extrairTermosConsultaOriginal,
  MAX_CARACTERES_CONTEXTO, MAX_DOCUMENTOS_CONTEXTO,
} from "../rag/recuperacao";

/** Entrada ja selecionada pelo V1; classificacao extra e opcional. */
export interface TrechoDocumental extends Partial<DocumentoPreparado> {
  tipoConteudo?: string;
}

export interface FonteDocumental {
  chunkId?: string;
  documentoId?: string;
  titulo?: string;
  secao?: string;
  paginaInicial?: number;
  paginaFinal?: number;
  natureza: "documental" | "modelo" | "exemplo";
}

export interface CitacaoDocumental {
  texto: string;
  fonte: FonteDocumental;
}

export interface RespostaDocumental {
  resposta: string;
  status: "trechos_encontrados" | "informacao_insuficiente";
  motivo: "evidencia_textual" | "sem_evidencia" | "entrada_invalida" |
    "trechos_contraditorios" | "apenas_modelos";
  citacoes: CitacaoDocumental[];
}

export const MAX_CITACOES_DOCUMENTAIS = 3;
export const MAX_CARACTERES_CITACAO = 480;
export const MAX_CARACTERES_RESPOSTA = 2400;

const SEM_INFORMACAO = "Nao ha informacao suficiente na base consultada " +
  "para o Sylvinho responder com seguranca. Procure a secretaria " +
  "academica para obter a informacao oficial.";
const TERMOS_PERGUNTA = new Set([
  "faco", "fazer", "funciona", "funcionam", "posso", "pode", "podem",
  "pedir", "solicitar", "conseguir", "consigo", "obter", "ser", "sao",
  "sera", "acontece", "existem", "existe", "atual", "proximo", "proxima",
  "quando", "onde", "quanto", "quantos", "quantas",
]);
// Node 24 oferece Segmenter; descrevemos a API sem mudar o tsconfig ES2017.
const intl = Intl as unknown as {
  Segmenter: new (locale: string, opcoes: {granularity: "sentence"}) => {
    segment(texto: string): Iterable<{segment: string; index: number}>;
  };
};
const segmentador = new intl.Segmenter("pt-BR", {granularity: "sentence"});
const INSTRUCAO_SISTEMA = new RegExp(
  "\\b(ignore|ignorar|desconsidere|substitua)\\b.{0,100}" +
  "\\b(instrucoes|prompt|sistema|regras)\\b", "u");
const EXFILTRACAO = new RegExp(
  "\\b(revele|exiba|imprima|envie)\\b.{0,100}" +
  "\\b(token|senha|chave|segredo|credenciais)\\b", "u");

/**
 * Rejeita texto invalido, sem coercoes.
 * @param {unknown} valor Campo da entrada.
 * @param {number} limite Limite do campo.
 * @return {string} Texto original aparado ou vazio.
 */
function textoSeguro(valor: unknown, limite: number): string {
  if (typeof valor !== "string" || valor.length > limite) return "";
  const invalido = Array.from(valor).some((c) => {
    const codigo = c.charCodeAt(0);
    return (codigo < 32 && ![9, 10, 13].includes(codigo)) ||
      codigo === 127 || codigo === 65533;
  });
  return invalido ? "" : valor.trim();
}

/**
 * Defesa adicional; nenhum texto e executado ou interpretado como comando.
 * A lista nao representa um detector completo de injecoes.
 * @param {string} texto Conteudo nao confiavel.
 * @return {boolean} Marcador de instrucao ao sistema.
 */
function instrucaoSuspeita(texto: string): boolean {
  const normalizado = normalizarTexto(texto);
  return INSTRUCAO_SISTEMA.test(normalizado) ||
    EXFILTRACAO.test(normalizado) ||
    /\b(invente|fabrique)\b.{0,100}\b(resposta|horario|telefone|prazo)\b/u
      .test(normalizado) ||
    /(?:\b(?:system|assistant|developer)\s*:|<\|[^>]+\|>|\[INST\])/iu
      .test(texto);
}

/**
 * Classifica apenas marcadores explicitos, nunca a existencia de uma regra.
 * @param {TrechoDocumental} trecho Metadados recebidos.
 * @param {string} frase Frase candidata.
 * @return {string} Natureza da citacao.
 */
function natureza(
  trecho: TrechoDocumental, frase: string,
): FonteDocumental["natureza"] {
  const campos = [trecho.tipoConteudo, trecho.titulo,
    trecho.categoria, trecho.secao].map(normalizarTexto).join(" ");
  if (/\b(modelo|modelos|doc\s*\d+)\b/u.test(campos)) return "modelo";
  if (/\b(exemplo|exemplos)\b/u.test(campos) ||
    /\b(por exemplo|exemplo|modelo de)\b/u.test(normalizarTexto(frase))) {
    return "exemplo";
  }
  return "documental";
}

/**
 * Copia somente metadados fornecidos; paginas sao do chunk, nao da frase.
 * @param {TrechoDocumental} trecho Chunk de origem.
 * @param {string} frase Conteudo citado.
 * @return {FonteDocumental} Referencia sem preencher dados ausentes.
 */
function fonteDoTrecho(
  trecho: TrechoDocumental, frase: string,
): FonteDocumental {
  const fonte: FonteDocumental = {natureza: natureza(trecho, frase)};
  for (const [entrada, saida] of [
    ["id", "chunkId"], ["documentoId", "documentoId"],
    ["titulo", "titulo"], ["secao", "secao"],
  ] as const) {
    const limite = entrada === "secao" ? 1200 : 180;
    const valor = textoSeguro(trecho[entrada], limite);
    if (/[\r\n]/u.test(valor)) continue;
    if (valor && !instrucaoSuspeita(valor)) fonte[saida] = valor;
  }
  const inicial = trecho.paginaInicial;
  const final = trecho.paginaFinal;
  const pagina = (n: unknown): n is number =>
    Number.isSafeInteger(n) && (n as number) > 0;
  if (pagina(inicial) && pagina(final) && final < inicial) return fonte;
  if (pagina(inicial)) fonte.paginaInicial = inicial;
  if (pagina(final)) fonte.paginaFinal = final;
  return fonte;
}

/**
 * Dados locais ou temporais exigem evidencia literal do valor/condicao.
 * @param {string} pergunta Pergunta normalizada.
 * @param {string} frase Frase original.
 * @return {boolean} Presenca da forma de evidencia exigida.
 */
function evidenciaEspecifica(pergunta: string, frase: string): boolean {
  if (/\b(telefone|telefonico)\b/u.test(pergunta) &&
    !/(?:\(\d{2}\)\s*|\b\d{2}[\s-])?\d{4,5}[\s-]\d{4}\b/u
      .test(frase)) return false;
  if (/\b(horario|horarios)\b/u.test(pergunta) &&
    !/\b\d{1,2}(?::\d{2}|h(?:\d{2})?)\b/iu.test(frase)) return false;
  const data = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/u.test(frase) ||
    /\b\d{1,2}\s+de\s+[a-z]+/u.test(normalizarTexto(frase));
  if (/\bferiado\b/u.test(pergunta) && !data) return false;
  if (/\bprazo\b/u.test(pergunta) && !data &&
    !/\b\d+\s+(dias?|horas?|meses?|anos?|semanas?)\b/u
      .test(normalizarTexto(frase)) &&
    !/\bate\s+(?:o|a)\s+(?:encerramento|termino|fim)\b/u
      .test(normalizarTexto(frase))) return false;
  return true;
}

/**
 * Detecta divergencias literais de numeros, negacao e modalidades opostas.
 * Nao resolve vigencia nem contradicoes semanticas arbitrarias.
 * @param {CitacaoDocumental[]} citacoes Evidencias documentais, sem modelos.
 * @return {boolean} Conflito que impede apresentar uma resposta.
 */
function contradicao(citacoes: CitacaoDocumental[]): boolean {
  const modalidades = new RegExp(
    "\\b(permitid[ao]s?|proibid[ao]s?|obrigatori[ao]s?|" +
    "opcional|facultativ[ao]s?)\\b", "gu");
  const dados = citacoes.map(({texto}) => {
    const n = normalizarTexto(texto);
    const negado = /\b(nao|nunca|jamais)\b/u.test(n);
    let modalidade = "";
    if (/\bpermitid[ao]s?\b/u.test(n)) {
      modalidade = negado ? "proibido" : "permitido";
    } else if (/\bproibid[ao]s?\b/u.test(n)) {
      modalidade = negado ? "permitido" : "proibido";
    } else if (/\bobrigatori[ao]s?\b/u.test(n)) {
      modalidade = negado ? "opcional" : "obrigatorio";
    } else if (/\b(opcional|facultativ[ao]s?)\b/u.test(n)) {
      modalidade = "opcional";
    }
    const base = extrairTermosUteis(n.replace(modalidades, " ")
      .replace(/\b(nao|nunca|jamais|\d+)\b/gu, " "))
      .filter((t) => !TERMOS_PERGUNTA.has(t)).sort().join(" ");
    return {base, negado, modalidade,
      numeros: (texto.match(/\d+(?:[.,:/-]\d+)*/gu) || []).join("|")};
  });
  return dados.some((a, i) => dados.slice(i + 1).some((b) =>
    a.base !== "" && a.base === b.base &&
    (a.numeros !== b.numeros ||
    (a.modalidade && b.modalidade ? a.modalidade !== b.modalidade :
      a.negado !== b.negado))));
}

/**
 * Referencia humana sem inventar titulo, link ou pagina precisa da frase.
 * @param {FonteDocumental} fonte Metadados validados.
 * @return {string} Rotulo publico.
 */
function rotuloFonte(fonte: FonteDocumental): string {
  const partes = [fonte.titulo || "titulo nao informado"];
  if (fonte.documentoId) partes.push(`documento: ${fonte.documentoId}`);
  if (fonte.chunkId) partes.push(`trecho: ${fonte.chunkId}`);
  if (fonte.secao) partes.push(`secao: ${fonte.secao}`);
  const {paginaInicial: inicial, paginaFinal: final} = fonte;
  if (inicial && final) {
    partes.push(inicial === final ? `pagina ${inicial}` :
      `paginas ${inicial}-${final} (intervalo do chunk)`);
  } else if (inicial) partes.push(`pagina inicial ${inicial}`);
  else if (final) partes.push(`pagina final ${final}`);
  return partes.join("; ");
}

/**
 * Segmenta sem tratar a quebra visual de linha do PDF como fim da frase.
 * Os indices sao preservados: cada citacao e uma substring literal do chunk.
 * Sentencas longas podem ser separadas apenas em limites estruturais de lista.
 * @param {string} conteudo Texto original.
 * @param {TrechoDocumental} trecho Metadados do chunk.
 * @return {Array} Unidades literais com prioridade de passo numerado.
 */
function unidadesOriginais(
  conteudo: string, trecho: TrechoDocumental,
): {texto: string; passo: boolean}[] {
  const saida: {texto: string; passo: boolean}[] = [];
  // Em formularios, o titulo literal pode comprovar a existencia do modelo,
  // sem apresentar seus campos preenchiveis como uma norma institucional.
  if (natureza(trecho, "") !== "documental") {
    for (const linha of conteudo.split(/\r?\n/u)) {
      const texto = linha.trim();
      if (texto === texto.toUpperCase() && texto !== texto.toLowerCase()) {
        saida.push({texto, passo: false});
      }
    }
  }
  const continuo = conteudo.replace(/[\r\n]/gu, " ");
  for (const {segment, index} of segmentador.segment(continuo)) {
    const original = conteudo.slice(index, index + segment.length);
    const limites = [0];
    if (original.length > MAX_CARACTERES_CITACAO) {
      const marcadores = /\n[ \t]*(?=[•✓]|\d+[.)]\s|[a-z]\)\s)/gu;
      for (const marcador of original.matchAll(marcadores)) {
        limites.push((marcador.index ?? 0) + 1);
      }
    }
    limites.push(original.length);
    for (let i = 0; i < limites.length - 1; i++) {
      const inicio = limites[i];
      let fim = limites[i + 1];
      // Preserva a introducao e o primeiro item quando a lista cabe no teto.
      if (original.slice(limites[i], fim).trim().endsWith(":") &&
          i + 2 < limites.length &&
          limites[i + 2] - limites[i] <= MAX_CARACTERES_CITACAO) {
        fim = limites[++i + 1];
      }
      let texto = original.slice(inicio, fim).trim();
      while (texto) {
        const primeira = /^([^\r\n]*)(?:\r?\n|$)/u.exec(texto);
        if (!primeira || !(normalizarTexto(trecho.titulo)
          .endsWith(normalizarTexto(primeira[1])) ||
          /^(atividades|material necessario)$/u
            .test(normalizarTexto(primeira[1])))) break;
        texto = texto.slice(primeira[0].length);
      }
      texto = texto.trim();
      const anterior = conteudo.slice(0, index + inicio);
      const passo = /^\d+[.)]\s/u.test(texto) ||
        /(?:^|\n)\s*\d+\.\s*$/u.test(anterior);
      if (texto) saida.push({texto, passo});
    }
  }
  return saida;
}

/**
 * Gerador puro: cita evidencias literais, sem SDKs ou I/O.
 * Correspondencia literal e uma barreira conservadora, nao prova semantica.
 * @param {string} pergunta Pergunta do usuario.
 * @param {TrechoDocumental[]} selecionados Resultado ja selecionado pelo V1.
 * @return {RespostaDocumental} Citacoes ou recusa, com motivo local.
 */
export function gerarRespostaDocumental(
  pergunta: string, selecionados: readonly TrechoDocumental[],
): RespostaDocumental {
  const recusar = (
    motivo: RespostaDocumental["motivo"], extra = "",
  ): RespostaDocumental => ({
    resposta: extra ? `${extra} ${SEM_INFORMACAO}` : SEM_INFORMACAO,
    status: "informacao_insuficiente", motivo, citacoes: [],
  });
  const textoPergunta = textoSeguro(pergunta, 1000);
  if (!textoPergunta || instrucaoSuspeita(textoPergunta) ||
    !Array.isArray(selecionados) ||
    selecionados.length > MAX_DOCUMENTOS_CONTEXTO) {
    return recusar("entrada_invalida");
  }
  // Chunks originais compartilham exatamente os termos e a procedencia do RAG.
  // O caminho legado continua isolado para nao mudar os contratos dos runners.
  const originais = selecionados.some((trecho) => trecho &&
    FONTES_ORIGINAIS.includes(trecho.documentoId || ""));
  const chunks = originais ?
    selecionados.filter((trecho) => trecho &&
      FONTES_ORIGINAIS.includes(trecho.documentoId || "")) : selecionados;
  const termos = originais ? extrairTermosConsultaOriginal(textoPergunta) :
    extrairTermosUteis(textoPergunta)
      .filter((t) => !TERMOS_PERGUNTA.has(t));
  const modeloSolicitado = originais && extrairTermosOriginais(textoPergunta)
    .some((termo) => ["modelo", "exemplo"].includes(termo));
  if (!termos.length) return recusar("sem_evidencia");
  const perguntaNormalizada = normalizarTexto(textoPergunta);
  // O contrato V1 nao comprova atualidade; nao consultar relogio ou inferi-la.
  if (/\b(atual|atuais|hoje|amanha|proximo|proxima)\b/u
    .test(perguntaNormalizada)) return recusar("sem_evidencia");
  const candidatos: CitacaoDocumental[] = [];
  const passos = new Set<CitacaoDocumental>();
  let caracteres = 0;
  for (const trecho of chunks) {
    if (!trecho || typeof trecho !== "object" ||
      Array.isArray(trecho) ||
      (trecho.ativo !== undefined && trecho.ativo !== true)) continue;
    const conteudo = textoSeguro(trecho.conteudo, MAX_CARACTERES_CONTEXTO);
    caracteres += conteudo.length;
    if (caracteres > MAX_CARACTERES_CONTEXTO) {
      return recusar("entrada_invalida");
    }
    if (!conteudo || instrucaoSuspeita(conteudo)) continue;
    const unidades = originais ? unidadesOriginais(conteudo, trecho) :
      [...segmentador.segment(conteudo)]
        .map(({segment}) => ({texto: segment.trim(), passo: false}));
    for (const {texto: frase, passo} of unidades) {
      const palavras = new Set(originais ? extrairTermosOriginais(frase) :
        normalizarTexto(frase).split(" "));
      if (frase.length < 25 || frase.length > MAX_CARACTERES_CITACAO ||
        !termos.every((t) => palavras.has(t)) ||
        !evidenciaEspecifica(perguntaNormalizada, frase)) continue;
      const citacao = {texto: frase, fonte: fonteDoTrecho(trecho, frase)};
      candidatos.push(citacao);
      if (passo && normalizarTexto(trecho.tipoConteudo) === "procedimento") {
        passos.add(citacao);
      }
    }
  }
  const documentais = candidatos.filter((c) =>
    c.fonte.natureza === "documental");
  if (contradicao(documentais)) {
    return recusar("trechos_contraditorios",
      "Os trechos relacionados apresentam informacoes divergentes.");
  }
  const apenasModelos = !documentais.length && candidatos.length > 0;
  const elegiveis = apenasModelos ? candidatos : documentais;
  if (originais && /\b(como|faco|fazer|solicitar|renovar|procedimentos?)\b/u
    .test(perguntaNormalizada)) {
    elegiveis.sort((a, b) => Number(passos.has(b)) - Number(passos.has(a)));
  }
  let resposta = apenasModelos && modeloSolicitado ?
    "Modelos/exemplos documentais encontrados (nao comprovam regras, " +
      "prazos ou procedimentos):" : apenasModelos ?
      `${SEM_INFORMACAO}\nModelos/exemplos relacionados nao comprovam ` +
      "uma regra ou procedimento:" :
      "Trechos documentais relacionados a pergunta (citacoes, " +
      "nao uma interpretacao ou garantia de regra vigente):";
  const citacoes: CitacaoDocumental[] = [];
  const vistos = new Set<string>();
  for (const citacao of elegiveis) {
    const chave = normalizarTexto(citacao.texto);
    if (vistos.has(chave)) continue;
    const tipo = citacao.fonte.natureza === "documental" ?
      "Trecho documental" : "Modelo/exemplo, nao normativo";
    const bloco = `\n\n${citacoes.length + 1}. ${tipo}: ` +
      `"${citacao.texto}"\nFonte: ${rotuloFonte(citacao.fonte)}.`;
    if (resposta.length + bloco.length > MAX_CARACTERES_RESPOSTA) continue;
    citacoes.push(citacao);
    vistos.add(chave);
    resposta += bloco;
    if (citacoes.length === MAX_CITACOES_DOCUMENTAIS) break;
  }
  if (!citacoes.length) return recusar("sem_evidencia");
  return {resposta, citacoes,
    status: apenasModelos && !modeloSolicitado ?
      "informacao_insuficiente" : "trechos_encontrados",
    motivo: apenasModelos && !modeloSolicitado ?
      "apenas_modelos" : "evidencia_textual"};
}
