import {limparReformulacao, normalizarProcedimentos} from "./assuntos";

export interface DocumentoPreparado {
  id: string;
  documentoId: string;
  titulo: string;
  categoria: string;
  tipoConteudo?: string;
  secao: string;
  conteudo: string;
  termosBusca: string;
  paginaInicial: number | null;
  paginaFinal: number | null;
  ativo: boolean;
  indice: number;
}

export interface OpcoesSelecao {
  maxDocumentos?: number;
  maxCaracteres?: number;
}

// Contrato estrutural somente-leitura; nao inicializa o SDK do Firestore.
export interface FonteConhecimento {
  collection(nome: string): {
    where(campo: string, operador: "==", valor: boolean): {
      get(): Promise<{
        forEach(callback: (chunk: unknown) => void): void;
      }>;
    };
  };
}

export const MAX_DOCUMENTOS_CONTEXTO = 5;
export const MAX_CARACTERES_CONTEXTO = 8000;

export const PALAVRAS_COMUNS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos",
  "e", "em", "eu", "essa", "esse", "esta", "este", "na", "nas", "no", "nos",
  "o", "os", "ou", "para", "por", "pra", "que", "qual", "quais", "se", "sua",
  "seu", "sobre", "um", "uma", "voce", "minha", "meu", "quero", "preciso",
]);

/**
 * Normalizacao original do V1.
 * @param {unknown} texto Entrada textual.
 * @return {string} Texto normalizado.
 */
export function normalizarTexto(texto: unknown): string {
  if (typeof texto !== "string") {
    return "";
  }

  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenizacao original, sem stemming ou sinonimos.
 * @param {unknown} texto Entrada textual.
 * @return {string[]} Termos unicos elegiveis.
 */
export function extrairTermosUteis(texto: unknown): string[] {
  return [
    ...new Set(
      normalizarTexto(texto)
        .split(" ")
        .filter((termo) => termo.length >= 3 && !PALAVRAS_COMUNS.has(termo)),
    ),
  ];
}

/**
 * Aceita somente valores textuais.
 * @param {unknown} valor Campo de origem.
 * @return {string} Texto aparado ou vazio.
 */
function textoValido(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Preserva suporte original a string ou array de termos.
 * @param {unknown} valor Termos de origem.
 * @return {string} Termos textuais unidos.
 */
function termosBuscaValidos(valor: unknown): string {
  if (Array.isArray(valor)) {
    return valor.map(textoValido).filter(Boolean).join(" ");
  }

  return textoValido(valor);
}

/**
 * Preserva validacao de pagina do V1.
 * @param {unknown} valor Numero de pagina.
 * @return {number|null} Inteiro positivo ou null.
 */
function paginaValida(valor: unknown): number | null {
  return Number.isInteger(valor) && (valor as number) > 0 ?
    valor as number : null;
}

/**
 * Prepara dados brutos ou snapshot com as regras do V1.
 * @param {unknown} doc Documento de origem.
 * @param {number} indice Posicao para desempate.
 * @return {DocumentoPreparado|null} Documento elegivel ou null.
 */
export function prepararDocumento(
  doc: unknown,
  indice = 0,
): DocumentoPreparado | null {
  const entrada = doc as {
    data?: () => unknown;
    id?: unknown;
  } | null | undefined;
  const data = typeof entrada?.data === "function" ? entrada.data() : doc;
  if (!data || typeof data !== "object") {
    return null;
  }

  const campos = data as Record<string, unknown>;
  const documento = {
    id: textoValido(entrada?.id) || textoValido(campos.id),
    documentoId: textoValido(campos.documentoId),
    titulo: textoValido(campos.titulo),
    categoria: textoValido(campos.categoria),
    ...(typeof campos.tipoConteudo === "string" ?
      {tipoConteudo: textoValido(campos.tipoConteudo)} : {}),
    secao: textoValido(campos.secao),
    conteudo: textoValido(campos.conteudo),
    termosBusca: termosBuscaValidos(campos.termosBusca),
    paginaInicial: paginaValida(campos.paginaInicial),
    paginaFinal: paginaValida(campos.paginaFinal),
    ativo: campos.ativo === true,
    indice,
  };

  if (
    !documento.ativo ||
    (!documento.titulo && !documento.categoria &&
      !documento.secao && !documento.conteudo)
  ) {
    return null;
  }

  return documento;
}

/**
 * Score original por campo, com pesos8/5/3/1.
 * @param {Object} documento Campos pontuaveis.
 * @param {string|string[]} termos Pergunta ou termos.
 * @return {number} Pontuacao lexical.
 */
export function pontuarDocumento(
  documento: Partial<DocumentoPreparado>,
  termos: string[] | string,
): number {
  const termosUteis = Array.isArray(termos) ?
    termos : extrairTermosUteis(termos);
  const campos: [string | undefined, number][] = [
    [documento.titulo, 8],
    [documento.categoria, 5],
    [documento.termosBusca, 3],
    [documento.conteudo, 1],
  ];

  return campos.reduce((pontuacao, [valor, peso]) => {
    const palavrasDoCampo = new Set(
      normalizarTexto(valor).split(" ").filter(Boolean),
    );
    const correspondencias = termosUteis
      .filter((termo) => palavrasDoCampo.has(termo)).length;
    return pontuacao + correspondencias * peso;
  }, 0);
}

/**
 * Rotulos de pagina identicos aos do contexto original.
 * @param {Object} documento Campos de pagina.
 * @return {string} Identificacao das paginas.
 */
function formatarPaginas(documento: Partial<DocumentoPreparado>): string {
  if (documento.paginaInicial && documento.paginaFinal) {
    return documento.paginaInicial === documento.paginaFinal ?
      `Página: ${documento.paginaInicial}` :
      `Páginas: ${documento.paginaInicial}-${documento.paginaFinal}`;
  }

  if (documento.paginaInicial) {
    return `Página inicial: ${documento.paginaInicial}`;
  }

  if (documento.paginaFinal) {
    return `Página final: ${documento.paginaFinal}`;
  }

  return "Páginas: não informadas";
}

/**
 * Contexto integral, sem alterar rotulos ou quebras do V1.
 * @param {Object} documento Campos de contexto.
 * @return {string} Contexto formatado.
 */
export function formatarDocumentoContexto(
  documento: Partial<DocumentoPreparado>,
): string {
  return `Chunk ID: ${documento.id || "Não informado"}
Documento ID: ${documento.documentoId || "Não informado"}
Título: ${documento.titulo || "Não informado"}
Categoria: ${documento.categoria || "Não informada"}
Seção: ${documento.secao || "Não informada"}
${formatarPaginas(documento)}
Conteúdo: ${documento.conteudo || "Não informado"}

---`;
}

/**
 * Ranking e orcamento originais, sem truncamento de chunks.
 * @param {unknown} documentos Corpus de origem.
 * @param {unknown} pergunta Pergunta de entrada.
 * @param {OpcoesSelecao} opcoes Limites originais opcionais.
 * @return {DocumentoPreparado[]} Selecao ordenada.
 */
export function selecionarDocumentosRelevantes(
  documentos: unknown, pergunta: unknown, opcoes: OpcoesSelecao = {},
): DocumentoPreparado[] {
  return selecionarPorTermos(documentos, extrairTermosUteis(pergunta), opcoes);
}

/**
 * Compartilha ranking/orcamento; preserva a tokenizacao legada do V1.
 * @param {unknown} documentos Corpus fornecido pelo servidor.
 * @param {string[]} termos Assuntos ja extraidos, inclusive siglas curtas.
 * @param {OpcoesSelecao} opcoes Limites de contexto.
 * @param {boolean} canonico Canonicalizar tambem campos do ranking original.
 * @return {DocumentoPreparado[]} Selecao sem truncar chunks.
 */
function selecionarPorTermos(
  documentos: unknown, termos: string[],
  {
    maxDocumentos = MAX_DOCUMENTOS_CONTEXTO,
    maxCaracteres = MAX_CARACTERES_CONTEXTO,
  }: OpcoesSelecao = {}, canonico = false,
): DocumentoPreparado[] {
  if (!termos.length || !Array.isArray(documentos)) {
    return [];
  }

  const candidatos = documentos
    .map((doc, indice) => prepararDocumento(doc, indice))
    .filter((doc): doc is DocumentoPreparado => Boolean(doc))
    .map((documento) => ({
      documento,
      pontuacao: (canonico ? relevanciaLocal(documento, termos) : 0) +
        pontuarDocumento(canonico ? {
          titulo: extrairTermosOriginais(documento.titulo).join(" "),
          categoria: extrairTermosOriginais(documento.categoria).join(" "),
          termosBusca: extrairTermosOriginais(documento.termosBusca).join(" "),
          conteudo: extrairTermosOriginais(documento.conteudo).join(" "),
        } : documento, termos),
    }))
    .filter(({pontuacao}) => pontuacao > 0)
    .sort((a, b) => {
      if (b.pontuacao !== a.pontuacao) {
        return b.pontuacao - a.pontuacao;
      }

      return a.documento.id.localeCompare(b.documento.id) ||
        a.documento.indice - b.documento.indice;
    });

  const selecionados: DocumentoPreparado[] = [];
  const vistos = new Set<string>();
  let caracteresUsados = 0;

  for (const {documento} of candidatos) {
    if (selecionados.length >= maxDocumentos) {
      break;
    }
    // Apenas copias da mesma proveniencia; nao colapsar fontes ou paginas.
    const identidade = JSON.stringify([
      documento.documentoId, documento.titulo, documento.secao,
      documento.tipoConteudo, documento.paginaInicial, documento.paginaFinal,
      documento.conteudo.replace(/\s+/gu, " ").trim(),
    ]);
    if (canonico && vistos.has(identidade)) continue;

    const contextoDocumento = formatarDocumentoContexto(documento);
    const tamanhoSeparador = selecionados.length ? 2 : 0;
    if (caracteresUsados + tamanhoSeparador +
      contextoDocumento.length > maxCaracteres) {
      continue;
    }

    selecionados.push(documento);
    vistos.add(identidade);
    caracteresUsados += tamanhoSeparador + contextoDocumento.length;
  }

  return selecionados;
}

/** Fontes originais autorizadas; nunca recebidas do cliente. */
export const FONTES_ORIGINAIS = Object.freeze([
  "doc-10d342eed4d6a46a5c6638a29179d80b",
  "doc-3319912252fbc4089c42a062f73d1b58",
  "doc-e7dd9dc45e79430bc34af10b786f6b1d",
]);

// Verbos de pedido e qualificadores nao identificam o assunto documental.
const TERMOS_PEDIDO = new Set([
  "faco", "fazer", "funciona", "funcionam", "posso", "pode", "podem",
  "pedir", "solicitar", "solicito", "conseguir", "consigo", "obter",
  "ser", "sao", "sera", "existe", "existem", "onde", "quando", "quanto",
  "quantos", "quantas", "procedimento", "procedimentos", "informacao",
  "informacoes", "saber", "gostaria", "favor", "levar", "levo", "trazer",
  "trago", "apresentar", "apresento", "entregar", "entrego",
]);
const FLEXOES: Record<string, string> = {
  matriculas: "matricula", rematriculas: "rematricula",
  declaracoes: "declaracao", frequencias: "frequencia",
  minimos: "minima", minimo: "minima", minimas: "minima",
  aprovar: "aprovacao", aprovado: "aprovacao", aprovados: "aprovacao",
  documentos: "documento", telefones: "telefone",
  modelos: "modelo", exemplos: "exemplo",
  horarios: "horario", calendarios: "calendario",
  academicos: "academico", escolares: "escolar",
};

/**
 * Equivalencias restritas, compartilhadas com a citacao; nao reescreve fontes.
 * @param {unknown} texto Consulta ou corpo documental.
 * @return {string} Texto apenas para comparacao lexical.
 */
function normalizarAssuntos(texto: unknown): string {
  return normalizarProcedimentos(normalizarTexto(texto))
    .replace(/\b(?:presenca|assiduidade) minima\b/gu, "frequencia minima")
    .replace(/\bcalendario (?:escolar|letivo)\b/gu, "calendario academico");
}

/**
 * Prefere assunto reunido numa unidade e na secao, apos filtros de evidencia.
 * Nao prova suporte semantico nem remove condicoes de trechos.
 * @param {DocumentoPreparado} doc Documento integral.
 * @param {string[]} termos Assuntos exigidos.
 * @return {number} Bonus lexical limitado.
 */
function relevanciaLocal(doc: DocumentoPreparado, termos: string[]): number {
  const secao = new Set(extrairTermosOriginais(doc.secao));
  const unidade = doc.conteudo.split(/[.!?\n]/u).some((frase) => {
    const palavras = new Set(extrairTermosOriginais(frase));
    return termos.every((t) => palavras.has(t));
  });
  return (unidade ? 12 : 0) +
    termos.filter((t) => secao.has(t)).length * 4;
}

/**
 * Equivalencias morfologicas pequenas, explicitas e testaveis.
 * @param {unknown} texto Campo ou pergunta.
 * @return {string[]} Termos canonicos.
 */
export function extrairTermosOriginais(texto: unknown): string[] {
  // Siglas de duas letras (RG, RA, RM etc.) sao assuntos, nao ruido.
  // Esta regra e compartilhada pela busca e pelas citacoes documentais.
  const termos = normalizarAssuntos(texto).split(" ")
    .filter((termo) => termo.length >= 2 && !PALAVRAS_COMUNS.has(termo))
    .map((termo) => FLEXOES[termo] || termo);
  return [...new Set(termos)];
}

/**
 * Pedido de orientacao, distinto de uma pergunta apenas informativa.
 * @param {unknown} pergunta Texto original, sem reescrita por modelo.
 * @return {boolean} Intencao lexical de solicitar uma declaracao.
 */
export function solicitaDeclaracao(pergunta: unknown): boolean {
  const n = normalizarTexto(pergunta);
  const pedido = new RegExp(
    "\\b(como|faco|fazer|solicitar|solicito|pedir|conseguir|obter|" +
      "preciso|quero|gostaria)\\b", "u");
  return /\bdeclarac(?:ao|oes)\b/u.test(n) && pedido.test(n);
}

/**
 * Mesmo contrato lexical para recuperacao e citacao de fontes originais.
 * Remove intencao de pedido, mantendo o assunto verificavel no documento.
 * @param {unknown} pergunta Pergunta do usuario.
 * @return {string[]} Termos de evidencia canonicos.
 */
export function extrairTermosConsultaOriginal(pergunta: unknown): string[] {
  const cortesia = new RegExp("^(?:ola |oi )?(?:por favor |" +
    "gostaria de saber |poderia me informar |voce pode me informar )", "u");
  let consulta = limparReformulacao(normalizarAssuntos(pergunta))
    .replace(cortesia, "");
  if (solicitaDeclaracao(pergunta) &&
      !/\b(modelos?|exemplos?)\b/u.test(consulta)) {
    // Apenas consulta de orientacao GERAL. Nao comprova emissao de um subtipo.
    // Finalidades reconhecidas nao viram requisitos de procedimento escolar.
    // Outros qualificadores (prazo, internet, assinatura etc.) permanecem.
    consulta = consulta
      .replace(/\bdeclarac(?:ao|oes) de matricula\b/gu, "declaracao")
      .replace(/\bpara (?:entregar|apresentar) (?:no trabalho|na empresa)\b/gu,
        " ");
  }
  const termos = extrairTermosOriginais(consulta)
    .filter((termo) => !TERMOS_PEDIDO.has(termo));
  // "Na ETEC" situa uma norma da rede, mas nao e palavra obrigatoria
  // no corpo de cada artigo. Nao remove nomes de unidades ou condicoes.
  const normaFrequencia = termos.includes("frequencia") &&
    (termos.includes("minima") || termos.includes("aprovacao"));
  const etecGenerica = normaFrequencia &&
    /\bna etec$/u.test(normalizarTexto(pergunta));
  return termos.filter((termo) =>
    !(etecGenerica && termo === "etec") &&
    !(termos.includes("frequencia") && termo === "aprovacao") &&
    !(termos.includes("declaracao") && termo === "escolar") &&
    !["modelo", "exemplo"].includes(termo));
}

/**
 * Modelos sao evidencias de formulario, nao de obrigacoes institucionais.
 * @param {DocumentoPreparado} documento Chunk preparado.
 * @return {boolean} Documento identificado como modelo ou exemplo.
 */
function eModelo(documento: DocumentoPreparado): boolean {
  return /\b(modelo|exemplo)\b/u.test(normalizarTexto(
    documento.tipoConteudo)) ||
    /\bdoc \d/u.test(normalizarTexto(documento.titulo));
}

/**
 * Selecao original: procedencia e cobertura do assunto antes do score V1.
 * Nao altera o seletor lexical legado usado pelos testes isolados de demo.
 * @param {unknown} documentos Chunks reais ou snapshots somente-leitura.
 * @param {unknown} pergunta Pergunta do usuario.
 * @param {OpcoesSelecao} opcoes Limites opcionais, limitados ao teto do V1.
 * @return {DocumentoPreparado[]} Evidencias ou lista vazia por insuficiencia.
 */
export function selecionarDocumentosOriginais(
  documentos: unknown,
  pergunta: unknown,
  opcoes: OpcoesSelecao = {},
): DocumentoPreparado[] {
  if (!Array.isArray(documentos)) return [];
  const termos = extrairTermosOriginais(pergunta)
    .filter((t) => !TERMOS_PEDIDO.has(t));
  const frequencia = termos.includes("frequencia");
  const regraFrequencia = frequencia &&
    (termos.includes("minima") || termos.includes("aprovacao"));
  const modeloPedido = termos.includes("modelo") || termos.includes("exemplo");
  // Aprovacao e o objetivo da consulta de frequencia, nao um sinonimo textual
  // obrigatorio: o artigo que define a frequencia nao usa essa palavra.
  const exigidos = extrairTermosConsultaOriginal(pergunta);
  if (!exigidos.length) return [];
  // Nao escolher um procedimento quando a consulta mistura os dois.
  // Comparacoes entre procedimentos exigem composicao contextual futura.
  if (exigidos.includes("matricula") && exigidos.includes("rematricula")) {
    return [];
  }
  const candidatas = documentos
    .map((doc, indice) => prepararDocumento(doc, indice))
    .filter((doc): doc is DocumentoPreparado => Boolean(doc))
    .filter((doc) => FONTES_ORIGINAIS.includes(doc.documentoId) &&
      Boolean(doc.id && doc.conteudo))
    .filter((doc) => {
      const corpo = new Set(extrairTermosOriginais(doc.conteudo));
      // Titulos, palavras-chave e categorias ajudam o ranking, mas nunca
      // substituem a evidencia do assunto no corpo do chunk.
      if (!exigidos.every((termo) => corpo.has(termo))) return false;
      if (regraFrequencia &&
          normalizarTexto(doc.tipoConteudo) !== "normativo") {
        return false;
      }
      if (modeloPedido && !eModelo(doc)) return false;
      if (eModelo(doc) && !modeloPedido) return false;
      // O assunto principal evita usar mencoes incidentais: por exemplo,
      // trancamento ou intercambio nao explicam a matricula inicial.
      const cabecalho = normalizarTexto(doc.titulo + " " + doc.secao);
      const linhas = doc.conteudo.split(/\r?\n/u)
        .map(normalizarTexto).filter(Boolean);
      if (exigidos.includes("rematricula") &&
          !/renovacao|rematricula/u.test(cabecalho)) return false;
      if (exigidos.includes("matricula") &&
          !exigidos.includes("rematricula") &&
          !/b1 inicial|matricula inicial|das matriculas/u.test(cabecalho)) {
        return false;
      }
      if (exigidos.includes("declaracao") &&
          !(/declarac/u.test(cabecalho) ||
          (eModelo(doc) &&
          linhas.some((linha) => /^declaracao\b/u.test(linha))) ||
          normalizarTexto(doc.tipoConteudo) === "normativo")) return false;
      // Remove apenas cabecalhos identificaveis, sem tamanho minimo magico.
      if (exigidos.includes("declaracao") &&
          solicitaDeclaracao(pergunta) &&
          !modeloPedido &&
          normalizarTexto(doc.tipoConteudo) !== "procedimento") return false;
      const titulo = normalizarTexto(doc.titulo);
      if (!linhas.some((linha) => linha !== "atividades" &&
          !titulo.endsWith(linha))) return false;
      if (exigidos.includes("telefone")) {
        // Um telefone de exemplo ou de outra unidade nao prova o contato local.
        if (!/sylvio de mattos carvalho/u.test(normalizarTexto(doc.conteudo)) ||
          !/(?:\(?\d{2}\)?[ .-]*)?\d{4,5}[ .-]?\d{4}/u.test(doc.conteudo)) {
          return false;
        }
      }
      return true;
    });
  // Ranking original entre candidatos que ja passaram pelos invariantes.
  // Pontua termos canonicos sem modificar o conteudo/metadados retornados.
  const comPercentual = frequencia && exigidos.includes("minima") ?
    candidatas.filter((doc) => /\d+\s*%/u.test(doc.conteudo)) : [];
  const iniciais = exigidos.length === 1 && exigidos[0] === "matricula" ?
    candidatas.filter((doc) => /b1 inicial/u.test(
      normalizarTexto(doc.titulo))) : [];
  const evidencias = comPercentual.length ? comPercentual :
    iniciais.length ? iniciais : candidatas;
  return selecionarPorTermos(evidencias, exigidos, {
    maxDocumentos: Math.min(opcoes.maxDocumentos ?? MAX_DOCUMENTOS_CONTEXTO,
      MAX_DOCUMENTOS_CONTEXTO),
    maxCaracteres: Math.min(opcoes.maxCaracteres ?? MAX_CARACTERES_CONTEXTO,
      MAX_CARACTERES_CONTEXTO),
  }, true);
}

/**
 * Consulta somente conhecimento ativo e aplica selecao original restrita.
 * @param {FonteConhecimento} firestore Fonte somente-leitura.
 * @param {unknown} pergunta Pergunta de entrada.
 * @param {Function} diagnosticar Observador opcional, so recebe contagens.
 * @return {Promise<DocumentoPreparado[]>} Chunks selecionados.
 */
export async function recuperarConhecimentoRelevante(
  firestore: FonteConhecimento,
  pergunta: unknown,
  diagnosticar?: (resumo: {lidos: number; selecionados: number}) => void,
): Promise<DocumentoPreparado[]> {
  const snapshot = await firestore
    .collection("conhecimento")
    .where("ativo", "==", true)
    .get();
  const chunks: unknown[] = [];
  snapshot.forEach((chunk) => chunks.push(chunk));

  const selecionados = selecionarDocumentosOriginais(chunks, pergunta);
  try {
    diagnosticar?.({lidos: chunks.length, selecionados: selecionados.length});
  } catch {
    // Telemetria nao altera a selecao nem provoca uma nova leitura do banco.
  }
  return selecionados;
}
