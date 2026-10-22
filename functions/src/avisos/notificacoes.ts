import {createHash} from "node:crypto";
import type {Auth} from "firebase-admin/auth";
import type {
  DocumentData, Firestore, QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import {montarEmailAviso} from "./email.js";
import type {ConteudoAviso} from "./email.js";

export const COLECAO_EMAILS = "avisosEmails";
export const COLECAO_MAIL = "mail";

interface DependenciasFila {
  firestore: Pick<Firestore, "collection" | "runTransaction">;
  serverTimestamp: () => unknown;
}

interface DependenciasEnvio extends DependenciasFila {
  auth: Pick<Auth, "getUser">;
  siteUrl: string;
}

interface TrabalhoEmail {
  avisoId: string;
  uid: string;
  conteudo: ConteudoAviso;
  avisoCriadoEm: string;
  estado: "pendente" | "enfileirado" | "ignorado";
}

const codigo = (erro: unknown): unknown =>
  (erro as {code?: unknown} | null)?.code;

/**
 * Cria uma entrega por conta, sem consultar cargo ou e-mail do perfil.
 * @param {string} avisoId ID do novo aviso.
 * @param {DocumentData} aviso Snapshot original do evento.
 * @param {string} criadoEm CreateTime do documento, distinto em recriações.
 * @param {DependenciasFila} deps Banco e relógio do servidor.
 * @return {Promise<void>} Fila persistida; falhas permitem repetir o evento.
 */
export async function enfileirarEmailsAviso(
  avisoId: string, aviso: DocumentData, criadoEm: string,
  deps: DependenciasFila,
): Promise<void> {
  if (aviso.publicado !== true || typeof aviso.titulo !== "string" ||
      !aviso.titulo.trim() || typeof aviso.descricao !== "string" ||
      !aviso.descricao.trim()) return;

  const consulta = deps.firestore.collection("users")
    .orderBy("__name__").limit(100);
  let ultimo: QueryDocumentSnapshot | undefined;
  let continuar = true;
  while (continuar) {
    const proxima = ultimo ? consulta.startAfter(ultimo) : consulta;
    const pagina = await proxima.get();
    if (pagina.empty) return;
    // Espera todas as gravações antes de propagar falhas parciais.
    const criarEntrega = async (user: QueryDocumentSnapshot) => {
      const id = createHash("sha256")
        .update(JSON.stringify([avisoId, criadoEm, user.id])).digest("hex");
      try {
        await deps.firestore.collection(COLECAO_EMAILS).doc(id).create({
          avisoId,
          uid: user.id,
          avisoCriadoEm: criadoEm,
          conteudo: {
            titulo: aviso.titulo, descricao: aviso.descricao,
            categoria: typeof aviso.categoria === "string" ?
              aviso.categoria : "geral",
          },
          estado: "pendente",
          criadoEm: deps.serverTimestamp(),
        });
      } catch (erro) {
        // Uma repetição nunca recria uma entrega ou apaga seu resultado.
        if (codigo(erro) !== 6) throw erro;
      }
    };
    const resultados = await Promise.allSettled(pagina.docs.map(criarEntrega));
    if (resultados.some((resultado) => resultado.status === "rejected")) {
      throw new Error("AVISOS_FILA_INCOMPLETA");
    }
    ultimo = pagina.docs[pagina.docs.length - 1];
    continuar = pagina.size === 100;
  }
}

/**
 * Revalida a conta e grava uma mensagem para a extensão Trigger Email.
 * @param {string} id Identificador determinístico da entrega.
 * @param {DependenciasEnvio} deps Banco, Auth e configuração.
 * @return {Promise<void>} Resultado persistido ou falha para retry do trigger.
 */
export async function enviarEmailAviso(
  id: string, deps: DependenciasEnvio,
): Promise<void> {
  const referencia = deps.firestore.collection(COLECAO_EMAILS).doc(id);
  const inicial = (await referencia.get()).data() as TrabalhoEmail | undefined;
  if (!inicial || inicial.estado !== "pendente") return;

  const encerrar = async (motivo: string) => {
    await deps.firestore.runTransaction(async (transaction) => {
      const atual = await transaction.get(referencia);
      if (atual.data()?.estado === "pendente") {
        transaction.update(referencia, {
          estado: "ignorado", motivo, atualizadoEm: deps.serverTimestamp(),
        });
      }
    });
  };
  const [perfil, aviso] = await Promise.all([
    deps.firestore.collection("users").doc(inicial.uid).get(),
    deps.firestore.collection("avisos").doc(inicial.avisoId).get(),
  ]);
  if (!perfil.exists) {
    await encerrar("perfil_removido");
    return;
  }
  if (aviso.data()?.publicado !== true ||
      aviso.createTime?.toDate().toISOString() !== inicial.avisoCriadoEm) {
    await encerrar("aviso_indisponivel");
    return;
  }
  let conta;
  try {
    conta = await deps.auth.getUser(inicial.uid);
  } catch (erro) {
    if (codigo(erro) !== "auth/user-not-found") throw erro;
    await encerrar("conta_removida");
    return;
  }
  if (conta.disabled || !conta.email) {
    await encerrar("conta_indisponivel");
    return;
  }

  const mail = deps.firestore.collection(COLECAO_MAIL).doc(id);
  await deps.firestore.runTransaction(async (transaction) => {
    const atual = (await transaction.get(referencia)).data() as
      TrabalhoEmail | undefined;
    if (!atual || atual.estado !== "pendente") return;
    // Mensagem e confirmação atômicas; repetições não alteram delivery.
    const existente = await transaction.get(mail);
    if (!existente.exists) {
      transaction.create(mail, {
        ...montarEmailAviso(
          atual.conteudo, conta.email as string, deps.siteUrl,
        ),
        avisoId: atual.avisoId,
        uid: atual.uid,
        criadoEm: deps.serverTimestamp(),
      });
    }
    transaction.update(referencia, {
      estado: "enfileirado", mailId: id,
      atualizadoEm: deps.serverTimestamp(),
    });
  });
}
