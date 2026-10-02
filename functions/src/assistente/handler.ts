import type {Request, Response} from "express";
import type {DocumentReference, Firestore} from "firebase-admin/firestore";
import {
  formatarDocumentoContexto,
  recuperarConhecimentoRelevante,
} from "../rag/recuperacao.js";

export const MAX_PERGUNTA_LENGTH = 1000;
export const MAX_MENSAGENS = 100;

export interface DependenciasAssistente {
  auth: {
    verifyIdToken(token: string): Promise<{uid: string}>;
  };
  firestore: Pick<Firestore, "collection" | "runTransaction">;
  serverTimestamp: () => unknown;
  gerarResposta: (promptSistema: string, pergunta: string) => Promise<string>;
  agora?: () => number;
}

type RequisicaoAssistente = Pick<Request, "method" | "get" | "body">;
type RespostaAssistente = Pick<Response, "set" | "status">;

/**
 * Prepara o mesmo prompt utilizado pelo handler JavaScript.
 * @param {string} contextoSecretaria Contexto V1 integral.
 * @return {string} Prompt de sistema, sem chamada externa.
 */
export function montarPromptSistema(contextoSecretaria: string): string {
  const instrucao = "Responda ao usuário de forma clara e educada, " +
    "utilizando APENAS as informações oficiais da secretaria abaixo:";
  const insuficiencia = "Se a resposta não puder ser encontrada no contexto " +
    "acima, responda educadamente que ainda não possui essa informação e " +
    "oriente o usuário a procurar a Secretaria Acadêmica presencialmente " +
    "ou via e-mail. Nunca invente dados.";
  return `
Você é o Sylvinho, Assistente Virtual oficial da Etec Sylvio de Mattos Carvalho.
${instrucao}

--- INÍCIO DO CONTEXTO OFICIAL ---
${contextoSecretaria}
--- FIM DO CONTEXTO OFICIAL ---

${insuficiencia}
`;
}

/**
 * Acrescenta somente bot ao estado relido na transacao.
 * @param {DocumentReference} conversaRef Referencia autenticada.
 * @param {string} resposta Texto produzido pelo gerador injetado.
 * @param {DependenciasAssistente} deps Dependencias locais/injetadas.
 * @return {Promise<void>} Resolvida somente apos persistencia.
 */
export async function adicionarRespostaBot(
  conversaRef: DocumentReference,
  resposta: string,
  deps: Pick<DependenciasAssistente,
    "firestore" | "serverTimestamp" | "agora">,
): Promise<void> {
  await deps.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(conversaRef);
    if (!snapshot.exists) {
      throw new Error("CONVERSATION_NOT_FOUND");
    }

    const conversa = snapshot.data();
    const mensagens: unknown[] = Array.isArray(conversa?.mensagens) ?
      conversa.mensagens : [];
    if (mensagens.length >= MAX_MENSAGENS) {
      throw new Error("CONVERSATION_LIMIT_REACHED");
    }

    transaction.update(conversaRef, {
      mensagens: [
        ...mensagens,
        {
          texto: resposta,
          remetente: "bot",
          enviadoEm: (deps.agora || Date.now)(),
        },
      ],
      atualizadoEm: deps.serverTimestamp(),
    });
  });
}

/**
 * Handler isolado: nao inicializa Firebase, Gemini ou endpoint HTTP.
 * @param {RequisicaoAssistente} req Requisicao futura ou mock.
 * @param {RespostaAssistente} res Resposta futura ou mock.
 * @param {DependenciasAssistente} deps Dependencias obrigatorias.
 * @return {Promise<unknown>} Resultado HTTP produzido.
 */
export async function perguntarAssistenteHandler(
  req: RequisicaoAssistente,
  res: RespostaAssistente,
  deps: DependenciasAssistente,
): Promise<unknown> {
  try {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      return res.status(405).json({
        error: "Método não permitido. Use POST.",
      });
    }

    const authorizationHeader = req.get("Authorization");
    if (!authorizationHeader) {
      return res.status(401).json({error: "Autenticação obrigatória."});
    }

    const authParts = authorizationHeader.trim().split(/\s+/);
    const [scheme, idToken] = authParts;
    if (authParts.length !== 2 || scheme !== "Bearer" || !idToken) {
      return res.status(401).json({
        error: "Formato de autenticação inválido.",
      });
    }

    let decodedToken: {uid: string};
    try {
      decodedToken = await deps.auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        error: "Token de autenticação inválido.",
      });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({error: "Corpo da requisição inválido."});
    }

    // usuarioId nao e lido; o caminho depende somente do token validado.
    const {pergunta, conversationId} = req.body as Record<string, unknown>;
    if (typeof pergunta !== "string") {
      return res.status(400).json({error: "A pergunta deve ser um texto."});
    }

    const perguntaNormalizada = pergunta.trim();
    if (!perguntaNormalizada) {
      return res.status(400).json({error: "A pergunta não pode estar vazia."});
    }
    if (perguntaNormalizada.length > MAX_PERGUNTA_LENGTH) {
      return res.status(400).json({
        error: "A pergunta deve ter no máximo " +
          `${MAX_PERGUNTA_LENGTH} caracteres.`,
      });
    }

    if (
      typeof conversationId !== "string" ||
      !/^[A-Za-z0-9]{20}$/.test(conversationId)
    ) {
      return res.status(400).json({
        error: "Identificador da conversa inválido.",
      });
    }

    const conversaRef = deps.firestore
      .collection("users")
      .doc(decodedToken.uid)
      .collection("conversas")
      .doc(conversationId);
    const conversaInicial = await conversaRef.get();
    if (!conversaInicial.exists) {
      return res.status(404).json({error: "Conversa não encontrada."});
    }

    const conversa = conversaInicial.data();
    const mensagensIniciais: unknown[] = Array.isArray(conversa?.mensagens) ?
      conversa.mensagens : [];
    if (mensagensIniciais.length >= MAX_MENSAGENS) {
      return res.status(409).json({
        error: "A conversa atingiu o limite de mensagens.",
      });
    }

    const chunks = await recuperarConhecimentoRelevante(
      deps.firestore,
      perguntaNormalizada,
    );
    const contexto = chunks.map(formatarDocumentoContexto).join("\n\n");
    const resposta = await deps.gerarResposta(
      montarPromptSistema(contexto),
      perguntaNormalizada,
    );
    if (typeof resposta !== "string" || !resposta.trim()) {
      throw new Error("INVALID_GENERATOR_RESPONSE");
    }

    await adicionarRespostaBot(conversaRef, resposta, deps);
    return res.status(200).json({resposta});
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "";
    if (mensagem === "CONVERSATION_NOT_FOUND") {
      return res.status(404).json({error: "Conversa não encontrada."});
    }
    if (mensagem === "CONVERSATION_LIMIT_REACHED") {
      return res.status(409).json({
        error: "A conversa atingiu o limite de mensagens.",
      });
    }
    return res.status(500).json({
      error: "Erro interno no servidor do assistente.",
    });
  }
}
