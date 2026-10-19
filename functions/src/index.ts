// Endpoint preparado localmente; publicacao exige autorizacao separada.

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {defineSecret, defineString} from "firebase-functions/params";
import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {criarGeradorGemini} from "./assistente/gemini.js";
import {criarEndpointAssistente} from "./assistente/http.js";
import {criarEnvioResend} from "./avisos/email.js";
import {
  enfileirarEmailsAviso, enviarEmailAviso,
} from "./avisos/notificacoes.js";

// Limita a dez instâncias por função de segunda geração, reduzindo a expansão
// automática de recursos. Cada função pode substituir esse padrão.
// Essa configuração não cria endpoints e não se aplica às funções da API v1.
setGlobalOptions({maxInstances: 10});

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const corsOrigins = defineString("ASSISTENTE_CORS_ORIGINS", {default: ""});
const resendApiKey = defineSecret("RESEND_API_KEY");
const avisosRemetente = defineString("AVISOS_EMAIL_FROM", {default: ""});
const avisosSiteUrl = defineString("AVISOS_SITE_URL", {
  default: "https://tcc-ia-d8891.web.app",
});
if (!getApps().some((app) => app.name === "[DEFAULT]")) {
  initializeApp();
}

export const perguntarAssistente = onRequest({
  region: "southamerica-east1",
  secrets: [geminiApiKey],
  cors: false, // CORS restrito e preflight tratados no adapter.
}, criarEndpointAssistente(() => ({
  auth: getAuth(),
  firestore: getFirestore(),
  serverTimestamp: () => FieldValue.serverTimestamp(),
  gerarResposta: criarGeradorGemini(() => geminiApiKey.value()),
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
  secrets: [resendApiKey],
  retry: true,
  timeoutSeconds: 60,
  // Serializa as chamadas; o cliente também espaça os pedidos ao Resend.
  maxInstances: 1,
  concurrency: 1,
}, async (event) => {
  if (!event.data) return;
  await enviarEmailAviso(event.params.entregaId, {
    firestore: getFirestore(),
    auth: getAuth(),
    serverTimestamp: () => FieldValue.serverTimestamp(),
    remetente: avisosRemetente.value(),
    siteUrl: avisosSiteUrl.value(),
    enviar: criarEnvioResend(() => resendApiKey.value()),
  });
});
