// Endpoint preparado localmente; publicacao exige autorizacao separada.

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {defineString} from "firebase-functions/params";
import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {gerarRespostaDocumental} from "./assistente/resposta-documental.js";
import {criarEndpointAssistente} from "./assistente/http.js";
import {criarEndpointVisitante} from "./assistente/visitante.js";
import {criarBuscaDocumental} from "./assistente/pergunta-livre/busca.js";
import {
  enfileirarEmailsAviso, enviarEmailAviso,
} from "./avisos/notificacoes.js";

// Limita a dez instâncias por função de segunda geração, reduzindo a expansão
// automática de recursos. Cada função pode substituir esse padrão.
// Essa configuração não cria endpoints e não se aplica às funções da API v1.
setGlobalOptions({maxInstances: 10});

const corsOrigins = defineString("ASSISTENTE_CORS_ORIGINS", {default: ""});
const avisosSiteUrl = defineString("AVISOS_SITE_URL", {
  default: "https://tcc-ia-d8891.web.app",
});
if (!getApps().some((app) => app.name === "[DEFAULT]")) {
  initializeApp();
}

export const perguntarAssistente = onRequest({
  region: "southamerica-east1",
  cors: false, // CORS restrito e preflight tratados no adapter.
}, criarEndpointAssistente(() => ({
  auth: getAuth(),
  firestore: getFirestore(),
  serverTimestamp: () => FieldValue.serverTimestamp(),
  gerarResposta: async (pergunta, chunks) =>
    gerarRespostaDocumental(pergunta, chunks).resposta,
}), () => corsOrigins.value()));

export const perguntarVisitante = onRequest({
  region: "southamerica-east1",
  cors: false,
  maxInstances: 2,
}, criarEndpointVisitante(() => ({
  recuperarConhecimento: criarBuscaDocumental(getFirestore()),
  gerarResposta: async (pergunta, chunks) =>
    gerarRespostaDocumental(pergunta, chunks).resposta,
}), () => corsOrigins.value()));

// A criação do aviso não aguarda o provedor de e-mail.
export const enfileirarNotificacoesAviso = onDocumentCreated({
  document: "avisos/{avisoId}",
  region: "southamerica-east1",
  retry: true,
  timeoutSeconds: 540,
}, async (event) => {
  if (!event.data) return;
  await enfileirarEmailsAviso(
    event.params.avisoId, event.data.data(),
    event.data.createTime.toDate().toISOString(), {
      firestore: getFirestore(),
      serverTimestamp: () => FieldValue.serverTimestamp(),
    },
  );
});

export const enviarNotificacaoAviso = onDocumentCreated({
  document: "avisosEmails/{entregaId}",
  region: "southamerica-east1",
  retry: true,
  timeoutSeconds: 60,
}, async (event) => {
  if (!event.data) return;
  await enviarEmailAviso(event.params.entregaId, {
    firestore: getFirestore(),
    auth: getAuth(),
    serverTimestamp: () => FieldValue.serverTimestamp(),
    siteUrl: avisosSiteUrl.value(),
  });
});
