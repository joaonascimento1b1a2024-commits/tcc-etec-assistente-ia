'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
if (process.env.SYLVINHO_LOCAL_E2E !== '1' ||
    __dirname !== path.join(root, '.cache/local-e2e/functions')) {
    throw new Error('LOCAL_EMULATORS_REQUIRED');
}
const localRequire = createRequire(path.join(root, 'functions/package.json'));
const { onRequest } = localRequire('firebase-functions/v2/https');
const { initializeApp } = localRequire('firebase-admin/app');
const { getAuth } = localRequire('firebase-admin/auth');
const { getFirestore, FieldValue } = localRequire('firebase-admin/firestore');
const { criarEndpointAssistente } = require(path.join(root, 'functions/lib/assistente/http.js'));
let app;
function localDependencies() {
    const checks = {
        auth: process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099',
        firestore: process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080',
        project: process.env.GCLOUD_PROJECT === 'tcc-ia-d8891',
    };
    evidence.emulatorChecks = checks;
    evidence.configured = {
        auth: process.env.FIREBASE_AUTH_EMULATOR_HOST,
        firestore: process.env.FIRESTORE_EMULATOR_HOST,
        project: process.env.GCLOUD_PROJECT,
    };
    save();
    if (Object.values(checks).some((valid) => !valid))
        throw new Error('LOCAL_EMULATORS_REQUIRED:' + Object.keys(checks).filter((key) => !checks[key]).join(','));
    if (!app) {
        // O SDK Firestore nao aceita credential artesanal. Emuladores usam
        // somente o projeto explicito; o runner isola HOME e bloqueia ADC/rede.
        app = initializeApp({ projectId: 'tcc-ia-d8891' }, 'sylvinho-local-e2e');
    }
}
const evidence = { tokenValidado: false, geracoes: 0, ativoNoContexto: false, inativoNoContexto: false };
function save() {
    fs.writeFileSync(path.join(root, '.cache/local-e2e/function-evidence.json'), JSON.stringify(evidence, null, 2));
}
exports.perguntarAssistente = onRequest({ region: 'southamerica-east1', cors: false }, criarEndpointAssistente(() => {
    localDependencies();
    return {
    auth: { verifyIdToken: async (token) => {
        const decoded = await getAuth(app).verifyIdToken(token);
        evidence.tokenValidado = true;
        evidence.uid = decoded.uid;
        save();
        return decoded;
    } },
    firestore: getFirestore(app),
    serverTimestamp: () => FieldValue.serverTimestamp(),
    gerarResposta: async (prompt) => {
        evidence.geracoes++;
        evidence.ativoNoContexto = prompt.includes('MARCADOR_ATIVO_MATRICULA');
        evidence.inativoNoContexto = prompt.includes('MARCADOR_INATIVO_PROIBIDO');
        save();
        if (!evidence.ativoNoContexto || evidence.inativoNoContexto) throw new Error('INVALID_LOCAL_CONTEXT');
        return 'Resposta local de teste baseada no contexto recuperado.';
    },
    };
}, () => 'http://127.0.0.1:5000'));
