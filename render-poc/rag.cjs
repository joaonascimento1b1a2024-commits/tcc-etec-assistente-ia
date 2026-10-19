'use strict';

const { performance } = require('node:perf_hooks');
const { lerConfiguracao } = require('./config.cjs');
const { criarDiagnosticoAutenticado } = require('./autenticacao.cjs');
const { MAX_PERGUNTA_LENGTH } = require('../functions/lib/assistente/handler.js');
const { recuperarConhecimentoRelevante, formatarDocumentoContexto } = require('../functions/lib/rag/recuperacao.js');

function criarRecuperacaoRag(obterFirestore, lerAmbiente = () => process.env) {
    return async (pergunta) => {
        if (lerConfiguracao(lerAmbiente()).mode !== 'rag-diagnostic')
            throw new Error('LOCAL_EMULATORS_REQUIRED');
        const inicio = performance.now();
        const chunks = await recuperarConhecimentoRelevante(obterFirestore(), pergunta);
        return { chunks, duracaoRecuperacaoMs: Math.max(0, Math.round(performance.now() - inicio)) };
    };
}

function perguntaValida(req) {
    return req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&
        typeof req.body.pergunta === 'string' && req.body.pergunta.trim().length > 0 &&
        req.body.pergunta.trim().length <= MAX_PERGUNTA_LENGTH;
}

function criarDiagnosticoRag(obterDependencias, lerOrigens) {
    return criarDiagnosticoAutenticado(obterDependencias, lerOrigens, async (factory, req) => {
        const { chunks, duracaoRecuperacaoMs } = await factory().recuperarConhecimento(req.body.pergunta.trim());
        const caracteresContexto = chunks.map(formatarDocumentoContexto).join('\n\n').length;
        return { status: 'ok', quantidadeChunks: chunks.length, caracteresContexto, duracaoRecuperacaoMs };
    }, perguntaValida);
}

module.exports = { criarRecuperacaoRag, criarDiagnosticoRag };
