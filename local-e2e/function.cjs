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
const { gerarRespostaDocumental } = require(path.join(root, 'functions/lib/assistente/resposta-documental.js'));
const { criarLeitorDemonstracao, lerModoDemonstracao } = require(path.join(root, 'render-poc/demonstracao.cjs'));
const academica = lerModoDemonstracao(process.env);
const original = process.env.SYLVINHO_RAG_ORIGINAL_LOCAL === '1';
if (original && academica) throw new Error('LOCAL_ORIGINAL_MODE_CONFLICT');
const leitorOriginal = original ? require(path.join(root, 'local-e2e/original-corpus.cjs'))
    .criarLeitorOriginalLocal() : null;
// Fixtures sintéticas deste roteiro usam o contrato lexical legado. Não são
// fontes oficiais e não devem ser passadas ao seletor restrito de documentos.
async function recuperarFixtures(pergunta) {
    const { selecionarDocumentosRelevantes } = require(path.join(root, 'functions/lib/rag/recuperacao.js'));
    const snapshot = await getFirestore(app).collection('conhecimento').where('ativo', '==', true).get();
    return selecionarDocumentosRelevantes(snapshot.docs, pergunta);
}
let app;
function localDependencies() {
    const checks = {
        auth: process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099',
        firestore: process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080',
        project: process.env.GCLOUD_PROJECT === 'demo-sylvinho-render-poc',
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
        app = initializeApp({ projectId: 'demo-sylvinho-render-poc' }, 'sylvinho-local-e2e');
    }
}
const evidence = { tokenValidado: false, geracoes: 0, ativoNoContexto: false, inativoNoContexto: false, resultados: [] };
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
    recuperarConhecimento: original ? leitorOriginal : academica ? criarLeitorDemonstracao(getFirestore(app)) : recuperarFixtures,
    serverTimestamp: () => FieldValue.serverTimestamp(),
    gerarResposta: async (pergunta, chunks) => {
        const contexto = chunks.map((chunk) => chunk.conteudo).join('\n');
        evidence.geracoes++;
        evidence.original = original;
        evidence.ativoNoContexto = original ? chunks.length > 0 : contexto.includes(academica ? 'AZUL-42' : 'MARCADOR_ATIVO_MATRICULA');
        evidence.inativoNoContexto = contexto.includes('MARCADOR_INATIVO_PROIBIDO');
        evidence.academica = academica;
        evidence.idsContexto = chunks.map(chunk => chunk.id);
        evidence.fontes = chunks.map(chunk => chunk.documentoId);
        if (original && evidence.fontes.some(id => !require(path.join(root,
            'functions/lib/rag/recuperacao.js')).FONTES_ORIGINAIS.includes(id))) throw new Error('ORIGINAL_SOURCE_INVALID');
        if (contexto.includes('MARCADOR_FORA_SELECAO')) throw new Error('ACADEMIC_ISOLATION_FAILED');
        if (evidence.inativoNoContexto) throw new Error('INVALID_LOCAL_CONTEXT');
        const resultado = gerarRespostaDocumental(pergunta, chunks);
        evidence.resultados.push({ pergunta, fontes: evidence.fontes, original, status: resultado.status, ativoNoContexto: evidence.ativoNoContexto,
            inativoNoContexto: evidence.inativoNoContexto });
        save();
        return resultado.resposta;
    },
    };
}, () => 'http://127.0.0.1:5000'));
