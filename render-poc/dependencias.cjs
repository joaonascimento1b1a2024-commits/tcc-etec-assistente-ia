'use strict';

// DEPENDÊNCIAS do servidor: monta os objetos que as rotas usam (autenticação, Firestore, geração de resposta)
// de acordo com o modo escolhido em SYLVINHO_POC_MODE.
// Cada modo recebe só o que precisa: o health não carrega SDK nenhum; os modos de diagnóstico só funcionam
// com os emuladores locais do Firebase; o modo documental (produção) usa a credencial do Render.
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { lerConfiguracao, validarConfiguracao, DEMO_PROJECT } = require('./config.cjs');
const { criarLeituraConhecimento } = require('./conhecimento.cjs');
const { criarRecuperacaoRag } = require('./rag.cjs');
const { criarDependenciasDocumentais } = require('./documental.cjs');
const { gerarRespostaDocumental } = require('../functions/lib/assistente/resposta-documental.js');
// Resposta falsa usada nos modos de teste, para provar que nenhuma IA real foi chamada.
const MOCK_RESPONSE = 'Resposta simulada da POC. Nenhuma IA real foi chamada.';

// Carrega o firebase-admin a partir da pasta functions/, onde ele está instalado.
function carregarModulo(name) {
    return createRequire(resolve(__dirname, '../functions/package.json'))(name);
}

// Escolhe as dependências pelo modo. A configuração é validada de novo aqui, para ninguém montar dependências
// com um objeto adulterado.
function criarDependencias(config, { lerAmbiente = () => process.env, carregar = carregarModulo } = {}) {
    const validated = validarConfiguracao(config);
    if (validated.mode === 'production-locked') throw new Error('PRODUCTION_ACCESS_DISABLED');
    // Produção: Firestore real + motor curado (ver documental.cjs).
    if (validated.mode === 'documental') return criarDependenciasDocumentais(validated, { carregar, lerAmbiente });
    // Health never loads Admin or consults the credential/environment adapter.
    if (validated.mode === 'health') return {
        auth: { async verifyIdToken() { throw new Error('AUTH_UNAVAILABLE'); } },
        firestore: {},
        serverTimestamp: () => { throw new Error('FIRESTORE_UNAVAILABLE'); },
        gerarResposta: async () => MOCK_RESPONSE,
    };
    // Recheck the actual runtime before loading any SDK, not just the supplied config.
    const current = lerConfiguracao(lerAmbiente());
    if (current.mode !== validated.mode || current.demonstracao !== validated.demonstracao)
        throw new Error('LOCAL_EMULATORS_REQUIRED');
    const { initializeApp, getApps } = carregar('firebase-admin/app');
    const { getAuth } = carregar('firebase-admin/auth');
    const name = 'sylvinho-render-poc-emulator';
    const app = getApps().find((item) => item.name === name) || initializeApp({ projectId: DEMO_PROJECT }, name);
    if (app.options.projectId !== DEMO_PROJECT) throw new Error('LOCAL_EMULATORS_REQUIRED');
    // Diagnóstico de login: só o Auth do emulador.
    if (validated.mode === 'auth-diagnostic') return { auth: getAuth(app) };
    // Diagnóstico da busca documental: o Firestore só é aberto na primeira consulta (||=).
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
    // Diagnóstico do Firestore: só conta os documentos ativos da coleção conhecimento.
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
    // Modo emulador (chat completo local): demonstração acadêmica opcional e resposta documental sem IA.
    const { getFirestore, FieldValue } = carregar('firebase-admin/firestore');
    const firestore = getFirestore(app);
    return {
        auth: getAuth(app), firestore,
        ...(validated.demonstracao ? { recuperarConhecimento: require("./demonstracao.cjs").criarLeitorDemonstracao(firestore) } : {}),
        serverTimestamp: () => FieldValue.serverTimestamp(),
        gerarResposta: validated.mode === 'documental-emulator' ?
            async (pergunta, chunks) => gerarRespostaDocumental(pergunta, chunks).resposta : async () => MOCK_RESPONSE,
    };
}

// Fábrica preguiçosa: as dependências só são criadas na primeira requisição que precisa delas e depois
// reaproveitadas. Assim o /health responde sem tocar em credencial nenhuma.
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
