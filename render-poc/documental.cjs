'use strict';

const { readFileSync } = require('node:fs');
const { origensPermitidas } = require('../functions/lib/assistente/http.js');
const DOCUMENTAL_SERVICE_ACCOUNT_EMAIL = 'sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com';
const { criarFluxoPerguntaLivre } = require('../functions/lib/assistente/pergunta-livre/fluxo.js');
const { PROJECT_ID, DATABASE_ID, CREDENTIAL_PATH, OFFICIAL_ORIGINS, lerModoDemonstracao } = require('./producao.cjs');

function validarConfiguracaoDocumental(config) {
    if (config.demonstracao !== undefined && typeof config.demonstracao !== 'boolean') throw new Error('DEMO_FLAG_INVALID');
    if (config.demonstracao === true) throw new Error('DOCUMENTAL_ORIGINAL_SOURCES_REQUIRED');
    if (config.projectId !== PROJECT_ID || config.databaseId !== DATABASE_ID) throw new Error('DOCUMENTAL_PROJECT_INVALID');
    if (config.enabled !== true) throw new Error('DOCUMENTAL_EXPLICIT_ENABLE_REQUIRED');
    if (config.credentialPath !== CREDENTIAL_PATH || typeof config.serviceAccountEmail !== 'string' ||
        config.serviceAccountEmail !== DOCUMENTAL_SERVICE_ACCOUNT_EMAIL)
        throw new Error('DOCUMENTAL_CREDENTIAL_CONFIGURATION_INVALID');
    if (typeof config.origins !== 'string' || config.origins.split(',').some(item => !item.trim()))
        throw new Error('DOCUMENTAL_CORS_INVALID');
    const origins = origensPermitidas(config.origins);
    if (!origins.length || new Set(origins).size !== origins.length || origins.some(origin => !OFFICIAL_ORIGINS.includes(origin)))
        throw new Error('DOCUMENTAL_CORS_INVALID');
    return Object.freeze({ ...config, projectId: PROJECT_ID, databaseId: DATABASE_ID, credentialPath: CREDENTIAL_PATH });
}

function lerConfiguracaoDocumental(env) {
    if (env.RENDER !== 'true' || env.NODE_ENV !== 'production') throw new Error('DOCUMENTAL_HOST_INVALID');
    if (Object.keys(env).some(key => /EMULATOR/i.test(key))) throw new Error('DOCUMENTAL_EMULATORS_FORBIDDEN');
    for (const key of ['GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID', 'SYLVINHO_FIREBASE_PROJECT_ID'])
        if (env[key] !== undefined && env[key] !== PROJECT_ID) throw new Error('DOCUMENTAL_PROJECT_INVALID');
    const forbidden = ['FIREBASE_CONFIG', 'FIREBASE_TOKEN', 'FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_JSON',
        'GOOGLE_CREDENTIALS', 'GOOGLE_APPLICATION_CREDENTIALS_JSON', 'GOOGLE_ACCESS_TOKEN', 'GOOGLE_REFRESH_TOKEN',
        'FIREBASE_PRIVATE_KEY', 'FIRESTORE_HOST', 'FIREBASE_AUTH_HOST', 'GOOGLE_API_ENDPOINT', 'GOOGLE_CLOUD_UNIVERSE_DOMAIN',
        'NODE_OPTIONS', 'NODE_EXTRA_CA_CERTS', 'GRPC_DEFAULT_SSL_ROOTS_FILE_PATH', 'SSL_CERT_FILE', 'SSL_CERT_DIR'];
    if (forbidden.some(key => env[key] !== undefined) ||
        env.NODE_TLS_REJECT_UNAUTHORIZED !== undefined && env.NODE_TLS_REJECT_UNAUTHORIZED !== '1')
        throw new Error('DOCUMENTAL_UNSAFE_ENVIRONMENT');
    return validarConfiguracaoDocumental({
        mode: 'documental', ...(lerModoDemonstracao(env) ? { demonstracao: true } : {}), host: '0.0.0.0', port: env.PORT === undefined ? 10000 : Number(env.PORT),
        origins: env.ASSISTENTE_CORS_ORIGINS || '', projectId: env.GCLOUD_PROJECT,
        databaseId: env.FIRESTORE_DATABASE_ID, enabled: env.SYLVINHO_DOCUMENTAL_ENABLED === 'true',
        credentialPath: env.GOOGLE_APPLICATION_CREDENTIALS, serviceAccountEmail: env.SYLVINHO_SERVICE_ACCOUNT_EMAIL,
    });
}

function criarDependenciasDocumentais(config, { carregar, lerArquivo = readFileSync, lerAmbiente = () => process.env } = {}) {
    const current = lerConfiguracaoDocumental(lerAmbiente());
    const expected = validarConfiguracaoDocumental(config);
    for (const key of ['projectId', 'databaseId', 'credentialPath', 'serviceAccountEmail', 'origins', 'port', 'demonstracao'])
        if (current[key] !== expected[key]) throw new Error('DOCUMENTAL_RUNTIME_CHANGED');
    let credential;
    try { credential = JSON.parse(lerArquivo(current.credentialPath, 'utf8')); }
    catch { throw new Error('DOCUMENTAL_CREDENTIAL_UNAVAILABLE'); }
    if (!credential || typeof credential !== 'object' || Array.isArray(credential) ||
        credential.type !== 'service_account' || credential.project_id !== PROJECT_ID ||
        credential.client_email !== current.serviceAccountEmail || typeof credential.private_key !== 'string' ||
        !credential.private_key.startsWith('-----BEGIN PRIVATE KEY-----') ||
        credential.token_uri !== 'https://oauth2.googleapis.com/token' ||
        credential.universe_domain !== undefined && credential.universe_domain !== 'googleapis.com')
        throw new Error('DOCUMENTAL_CREDENTIAL_INVALID');
    const { initializeApp, getApps, cert } = carregar('firebase-admin/app');
    // Nunca usa ADC, sessão da CLI, app [DEFAULT] ou credencial inline de ambiente.
    const name = 'sylvinho-render-documental';
    const existing = getApps().find(app => app.name === name);
    if (existing) throw new Error('DOCUMENTAL_APP_ALREADY_INITIALIZED');
    try {
        const { criarDemonstracaoGemini } = require('../functions/lib/assistente/geracao/demonstracao.js');
        const app = initializeApp({ projectId: PROJECT_ID, credential: cert(credential) }, name);
        const { getAuth } = carregar('firebase-admin/auth');
        const { getFirestore, FieldValue } = carregar('firebase-admin/firestore');
        const firestore = getFirestore(app, DATABASE_ID);
        const fluxo = criarFluxoPerguntaLivre({ fonte: firestore, geracao: { lerAmbiente,
            registrarDiagnostico: dado => console.info('SYLVINHO_DIAGNOSTICO', JSON.stringify(dado)),
            registrarEvento: (codigo, motivo) => console.info('SYLVINHO_IA', codigo, ...(motivo ? [motivo] : [])) } });
        if (lerAmbiente().SYLVINHO_IA_PROVIDER === 'openrouter') {
            const { VERSAO_FLUXO_CONVERSA } = require('../functions/lib/assistente/geracao/conversa.js');
            console.info('SYLVINHO_IA_FLUXO', VERSAO_FLUXO_CONVERSA);
        }
        return { auth: getAuth(app), firestore,
            demonstracao: criarDemonstracaoGemini({ lerAmbiente,
                registrarEvento: codigo => console.info('SYLVINHO_IA_DEMO', codigo) }),
            recuperarConhecimento: fluxo.recuperarConhecimento,
            serverTimestamp: () => FieldValue.serverTimestamp(),
            gerarResposta: fluxo.gerarResposta };
    } catch { throw new Error('DOCUMENTAL_INITIALIZATION_FAILED'); }
}

module.exports = { lerConfiguracaoDocumental, validarConfiguracaoDocumental, criarDependenciasDocumentais };
