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
  documentos: unknown,
  pergunta: unknown,
  {
    maxDocumentos = MAX_DOCUMENTOS_CONTEXTO,
    maxCaracteres = MAX_CARACTERES_CONTEXTO,
  }: OpcoesSelecao = {},
): DocumentoPreparado[] {
  const termos = extrairTermosUteis(pergunta);
  if (!termos.length || !Array.isArray(documentos)) {
    return [];
  }

  const candidatos = documentos
    .map((doc, indice) => prepararDocumento(doc, indice))
    .filter((doc): doc is DocumentoPreparado => Boolean(doc))
    .map((documento) => ({
      documento,
      pontuacao: pontuarDocumento(documento, termos),
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
  let caracteresUsados = 0;

  for (const {documento} of candidatos) {
    if (selecionados.length >= maxDocumentos) {
      break;
    }

    const contextoDocumento = formatarDocumentoContexto(documento);
    const tamanhoSeparador = selecionados.length ? 2 : 0;
    if (caracteresUsados + tamanhoSeparador +
      contextoDocumento.length > maxCaracteres) {
      continue;
    }

    selecionados.push(documento);
    caracteresUsados += tamanhoSeparador + contextoDocumento.length;
  }

  return selecionados;
}

/**
 * Consulta somente conhecimento ativo e aplica selecao V1.
 * @param {FonteConhecimento} firestore Fonte somente-leitura.
 * @param {unknown} pergunta Pergunta de entrada.
 * @return {Promise<DocumentoPreparado[]>} Chunks selecionados.
 */
export async function recuperarConhecimentoRelevante(
  firestore: FonteConhecimento,
  pergunta: unknown,
): Promise<DocumentoPreparado[]> {
  const snapshot = await firestore
    .collection("conhecimento")
    .where("ativo", "==", true)
    .get();
  const chunks: unknown[] = [];
  snapshot.forEach((chunk) => chunks.push(chunk));

  return selecionarDocumentosRelevantes(chunks, pergunta);
}
