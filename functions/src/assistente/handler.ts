import type {Request, Response} from "express";
import type {DocumentReference, Firestore} from "firebase-admin/firestore";
import {ErroAutenticacao, verificarAutenticacao} from "./autenticacao.js";
import {
  recuperarConhecimentoRelevante,
} from "../rag/recuperacao.js";
import type {DocumentoPreparado} from "../rag/recuperacao.js";

export const MAX_PERGUNTA_LENGTH = 1000;
export const MAX_MENSAGENS = 100;
const requisicoesEmAndamento =
  new WeakMap<object, Map<string, Promise<string>>>();

interface MensagemIdentificada {
  texto: string;
  remetente: string;
  messageId?: string;
}

/**
 * Vincula o ID a uma unica pergunta imutavel e recupera resposta persistida.
 * @param {unknown[]} mensagens Historico relido.
 * @param {string} messageId ID estavel da pergunta.
 * @param {string} pergunta Texto autenticado pelo historico.
 * @return {string|undefined} Resposta existente.
 */
function respostaExistente(
  mensagens: unknown[], messageId: string, pergunta: string,
): string | undefined {
  const identificadas = mensagens.filter((m): m is MensagemIdentificada =>
    !!m && typeof m === "object" &&
    (m as MensagemIdentificada).messageId === messageId);
  const users = identificadas.filter((m) => m.remetente === "user");
  const bots = identificadas.filter((m) => m.remetente === "bot");
  if (users.length !== 1 || users[0].texto !== pergunta || bots.length > 1) {
    throw new Error("MESSAGE_ID_CONFLICT");
  }
  if (bots.length &&
    (typeof bots[0].texto !== "string" || !bots[0].texto.trim())) {
    throw new Error("MESSAGE_ID_CONFLICT");
  }
  return bots[0]?.texto;
}

export interface DependenciasAssistente {
  auth: {
    verifyIdToken(token: string): Promise<{uid: string}>;
  };
  firestore: Pick<Firestore, "collection" | "runTransaction">;
  serverTimestamp: () => unknown;
  gerarResposta: (pergunta: string,
    chunks: readonly DocumentoPreparado[]) => Promise<string>;
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
 * @param {string} messageId ID da pergunta.
 * @param {string} pergunta Texto da pergunta persistida.
 * @return {Promise<string>} Resposta confirmada ou ja existente.
 */
export async function adicionarRespostaBot(
  conversaRef: DocumentReference,
  resposta: string,
  deps: Pick<DependenciasAssistente,
    "firestore" | "serverTimestamp" | "agora">,
  messageId: string,
  pergunta: string,
): Promise<string> {
  return deps.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(conversaRef);
    if (!snapshot.exists) {
      throw new Error("CONVERSATION_NOT_FOUND");
    }

    const conversa = snapshot.data();
    const mensagens: unknown[] = Array.isArray(conversa?.mensagens) ?
      conversa.mensagens : [];
    const existente = respostaExistente(mensagens, messageId, pergunta);
    if (existente !== undefined) return existente;
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
          messageId,
        },
      ],
      atualizadoEm: deps.serverTimestamp(),
    });
    return resposta;
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

    let decodedToken: {uid: string};
    try {
      decodedToken = await verificarAutenticacao(req, deps.auth);
    } catch (error) {
      if (error instanceof ErroAutenticacao) {
        return res.status(401).json({error: error.message});
      }
      throw error;
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({error: "Corpo da requisição inválido."});
    }

    // usuarioId nao e lido; o caminho depende somente do token validado.
    const {pergunta, conversationId, messageId} =
      req.body as Record<string, unknown>;
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
    if (typeof messageId !== "string" ||
      !/^[A-Za-z0-9_-]{20,80}$/.test(messageId)) {
      return res.status(400).json({
        error: "Identificador da mensagem inválido.",
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
    const existente = respostaExistente(
      mensagensIniciais, messageId, perguntaNormalizada,
    );
    if (existente !== undefined) {
      return res.status(200).json({resposta: existente});
    }
    if (mensagensIniciais.length >= MAX_MENSAGENS) {
      return res.status(409).json({
        error: "A conversa atingiu o limite de mensagens.",
      });
    }

    let emAndamento = requisicoesEmAndamento.get(deps.firestore);
    if (!emAndamento) {
      emAndamento = new Map();
      requisicoesEmAndamento.set(deps.firestore, emAndamento);
    }
    const chave = JSON.stringify([decodedToken.uid, conversationId, messageId]);
    let operacao = emAndamento.get(chave);
    if (!operacao) {
      operacao = (async () => {
        // Revalidar depois de um possivel commit concorrente.
        const atual = await conversaRef.get();
        if (!atual.exists) throw new Error("CONVERSATION_NOT_FOUND");
        const dados = atual.data();
        const atualizadas: unknown[] = Array.isArray(dados?.mensagens) ?
          dados.mensagens : [];
        const concluida = respostaExistente(
          atualizadas, messageId, perguntaNormalizada,
        );
        if (concluida !== undefined) return concluida;
        const chunks = await recuperarConhecimentoRelevante(
          deps.firestore, perguntaNormalizada,
        );
        const gerada = await deps.gerarResposta(perguntaNormalizada, chunks);
        if (typeof gerada !== "string" || !gerada.trim()) {
          throw new Error("INVALID_GENERATOR_RESPONSE");
        }
        return adicionarRespostaBot(
          conversaRef, gerada, deps, messageId, perguntaNormalizada,
        );
      })();
      emAndamento.set(chave, operacao);
      // Coalesce por instancia; a transacao protege tambem entre instancias.
      void operacao.finally(() => emAndamento?.delete(chave)).catch(() => {});
    }
    const resposta = await operacao;
    return res.status(200).json({resposta});
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "";
    if (mensagem === "MESSAGE_ID_CONFLICT") {
      return res.status(409).json({
        error: "Identificador não corresponde à pergunta salva.",
      });
    }
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
