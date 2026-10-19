import {createHash} from "node:crypto";
import type {Auth} from "firebase-admin/auth";
import type {
  DocumentData, Firestore, QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import {montarEmailAviso} from "./email.js";
import type {ConteudoAviso, MensagemEmail} from "./email.js";

export const COLECAO_EMAILS = "avisosEmails";
// Resend preserva a idempotência por 24h. Para antes, com margem de segurança.
export const JANELA_ENVIO_MS = 23 * 60 * 60 * 1000;

interface DependenciasFila {
  firestore: Pick<Firestore, "collection" | "runTransaction">;
  serverTimestamp: () => unknown;
}

interface DependenciasEnvio extends DependenciasFila {
  auth: Pick<Auth, "getUser">;
  remetente: string;
  siteUrl: string;
  enviar: (mensagem: MensagemEmail, id: string) => Promise<string>;
  agora?: () => number;
}

interface TrabalhoEmail {
  avisoId: string;
  uid: string;
  conteudo: ConteudoAviso;
  avisoCriadoEm: string;
  estado: "pendente" | "enviado" | "ignorado" | "falha";
  mensagem?: MensagemEmail;
  primeiraTentativaEm?: number;
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
    .where("preferencias.avisosEmail", "==", true).orderBy("__name__")
    .limit(100);
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
 * Revalida a adesão e usa um payload persistido em todas as tentativas.
 * @param {string} id Identificador determinístico da entrega.
 * @param {DependenciasEnvio} deps Banco, Auth, provedor e configuração.
 * @return {Promise<void>} Resultado persistido ou falha para retry do trigger.
 */
export async function enviarEmailAviso(
  id: string, deps: DependenciasEnvio,
): Promise<void> {
  const referencia = deps.firestore.collection(COLECAO_EMAILS).doc(id);
  const inicial = (await referencia.get()).data() as TrabalhoEmail | undefined;
  if (!inicial || inicial.estado !== "pendente") return;

  const encerrar = async (estado: "ignorado" | "falha", motivo: string) => {
    await deps.firestore.runTransaction(async (transaction) => {
      const atual = await transaction.get(referencia);
      if (atual.data()?.estado === "pendente") {
        transaction.update(referencia, {
          estado, motivo, atualizadoEm: deps.serverTimestamp(),
        });
      }
    });
  };
  const [perfil, aviso] = await Promise.all([
    deps.firestore.collection("users").doc(inicial.uid).get(),
    deps.firestore.collection("avisos").doc(inicial.avisoId).get(),
  ]);
  if (perfil.data()?.preferencias?.avisosEmail !== true) {
    await encerrar("ignorado", "notificacoes_desativadas");
    return;
  }
  if (aviso.data()?.publicado !== true ||
      aviso.createTime?.toDate().toISOString() !== inicial.avisoCriadoEm) {
    await encerrar("ignorado", "aviso_indisponivel");
    return;
  }
  let conta;
  try {
    conta = await deps.auth.getUser(inicial.uid);
  } catch (erro) {
    if (codigo(erro) !== "auth/user-not-found") throw erro;
    await encerrar("ignorado", "conta_removida");
    return;
  }
  if (conta.disabled || !conta.email) {
    await encerrar("ignorado", "conta_indisponivel");
    return;
  }

  const agora = deps.agora || Date.now;
  const trabalho = await deps.firestore.runTransaction(async (transaction) => {
    const atual = (await transaction.get(referencia)).data() as
      TrabalhoEmail | undefined;
    if (!atual || atual.estado !== "pendente") return undefined;
    if (atual.mensagem) return atual;
    const preparado = {
      ...atual,
      mensagem: montarEmailAviso(
        atual.conteudo, conta.email as string, deps.remetente, deps.siteUrl,
      ),
      primeiraTentativaEm: agora(),
    };
    transaction.update(referencia, {
      mensagem: preparado.mensagem,
      primeiraTentativaEm: preparado.primeiraTentativaEm,
    });
    return preparado;
  });
  if (!trabalho?.mensagem) return;
  // Não envia para o endereço antigo após uma troca de e-mail no Auth.
  if (trabalho.mensagem.to[0] !== conta.email) {
    await encerrar("ignorado", "email_alterado");
    return;
  }
  if (typeof trabalho.primeiraTentativaEm !== "number" ||
      agora() - trabalho.primeiraTentativaEm >= JANELA_ENVIO_MS) {
    await encerrar("falha", "janela_de_retentativas_expirada");
    return;
  }

  const resendId = await deps.enviar(trabalho.mensagem, id);
  await referencia.update({
    estado: "enviado", resendId, enviadoEm: deps.serverTimestamp(),
  });
}
