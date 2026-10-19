'use strict';

const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { lerConfiguracao, validarConfiguracao, DEMO_PROJECT } = require('./config.cjs');
const { criarLeituraConhecimento } = require('./conhecimento.cjs');
const { criarRecuperacaoRag } = require('./rag.cjs');
const { criarDependenciasDocumentais } = require('./documental.cjs');
const { gerarRespostaDocumental } = require('../functions/lib/assistente/resposta-documental.js');
const MOCK_RESPONSE = 'Resposta simulada da POC. Nenhuma IA real foi chamada.';

function carregarModulo(name) {
    return createRequire(resolve(__dirname, '../functions/package.json'))(name);
}

function criarDependencias(config, { lerAmbiente = () => process.env, carregar = carregarModulo } = {}) {
    const validated = validarConfiguracao(config);
    if (validated.mode === 'production-locked') throw new Error('PRODUCTION_ACCESS_DISABLED');
    if (validated.mode === 'documental') return criarDependenciasDocumentais(validated, { carregar, lerAmbiente });
    // Health never loads Admin or consults the credential/environment adapter.
    if (validated.mode === 'health') return {
        auth: { async verifyIdToken() { throw new Error('AUTH_UNAVAILABLE'); } },
        firestore: {},
        serverTimestamp: () => { throw new Error('FIRESTORE_UNAVAILABLE'); },
        gerarResposta: async () => MOCK_RESPONSE,
    };
    // Recheck the actual runtime before loading any SDK, not just the supplied config.
    if (lerConfiguracao(lerAmbiente()).mode !== validated.mode) throw new Error('LOCAL_EMULATORS_REQUIRED');
    const { initializeApp, getApps } = carregar('firebase-admin/app');
    const { getAuth } = carregar('firebase-admin/auth');
    const name = 'sylvinho-render-poc-emulator';
    const app = getApps().find((item) => item.name === name) || initializeApp({ projectId: DEMO_PROJECT }, name);
    if (app.options.projectId !== DEMO_PROJECT) throw new Error('LOCAL_EMULATORS_REQUIRED');
    if (validated.mode === 'auth-diagnostic') return { auth: getAuth(app) };
    if (validated.mode === 'rag-diagnostic') {
        let firestore;
        return {
            auth: getAuth(app),
            recuperarConhecimento: criarRecuperacaoRag(() => {
                firestore ||= carregar('firebase-admin/firestore').getFirestore(app, '(default)');
                return firestore;
            }, lerAmbiente),
        };
    }
    if (validated.mode === 'firestore-diagnostic') {
        let firestore;
        return {
            auth: getAuth(app),
            consultarConhecimentoAtivo: criarLeituraConhecimento(() => {
                firestore ||= carregar('firebase-admin/firestore').getFirestore(app, '(default)');
                return firestore;
            }, lerAmbiente),
        };
    }
    const { getFirestore, FieldValue } = carregar('firebase-admin/firestore');
    return {
        auth: getAuth(app), firestore: getFirestore(app),
        serverTimestamp: () => FieldValue.serverTimestamp(),
        gerarResposta: validated.mode === 'documental-emulator' ?
            async (pergunta, chunks) => gerarRespostaDocumental(pergunta, chunks).resposta : async () => MOCK_RESPONSE,
    };
}

function criarFabricaDependencias(config, { obterDependencias, ...adapters } = {}) {
    const validated = validarConfiguracao(config);
    let deps;
    return () => {
        if (validated.mode === 'production-locked') throw new Error('PRODUCTION_ACCESS_DISABLED');
        deps ||= obterDependencias ? obterDependencias() : criarDependencias(validated, adapters);
        return deps;
    };
}

module.exports = { criarDependencias, criarFabricaDependencias, MOCK_RESPONSE };
