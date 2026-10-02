// Endpoint preparado localmente; publicacao exige autorizacao separada.

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret, defineString} from "firebase-functions/params";
import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {criarGeradorGemini} from "./assistente/gemini.js";
import {criarEndpointAssistente} from "./assistente/http.js";

// Limita a dez instâncias por função de segunda geração, reduzindo a expansão
// automática de recursos. Cada função pode substituir esse padrão.
// Essa configuração não cria endpoints e não se aplica às funções da API v1.
setGlobalOptions({maxInstances: 10});

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const corsOrigins = defineString("ASSISTENTE_CORS_ORIGINS", {default: ""});
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
