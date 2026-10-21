'use strict';
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createHash} = require('node:crypto');
const {FONTES_ORIGINAIS, selecionarDocumentosOriginais} = require('../functions/lib/rag/recuperacao.js');
const CORPUS_SHA256 = 'e4d8695fb2ba0f2e7143f3be5ffe075fa53273bd1b5d19da970f76987a8904b3';
function carregarCorpusOriginal(env = process.env) {
    if (env.SYLVINHO_LOCAL_E2E !== '1' || env.GCLOUD_PROJECT !== 'demo-sylvinho-render-poc' ||
        env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
        env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('LOCAL_EMULATORS_REQUIRED');
    const bytes = readFileSync(resolve(__dirname, '../.cache/rag-original-auditoria.json'));
    if (createHash('sha256').update(bytes).digest('hex') !== CORPUS_SHA256) throw new Error('ORIGINAL_CORPUS_HASH_INVALID');
    const docs = JSON.parse(bytes);
    if (!Array.isArray(docs) || docs.length !== 514 || new Set(docs.map(d => d.id)).size !== 514 ||
        docs.some(d => !FONTES_ORIGINAIS.includes(d.documentoId) || d.ativo !== true || !d.conteudo))
        throw new Error('ORIGINAL_CORPUS_INVALID');
    return docs;
}
function criarLeitorOriginalLocal(env = process.env) {
    const docs = carregarCorpusOriginal(env);
    return async pergunta => selecionarDocumentosOriginais(docs, pergunta);
}
module.exports = {carregarCorpusOriginal, criarLeitorOriginalLocal, CORPUS_SHA256};
