'use strict';

const { performance } = require('node:perf_hooks');
const { lerConfiguracao } = require('./config.cjs');
const { criarDiagnosticoAutenticado } = require('./autenticacao.cjs');

function criarLeituraConhecimento(obterFirestore, lerAmbiente = () => process.env) {
    return async () => {
        // Revalidate before every query; never fall back to production or ADC.
        if (lerConfiguracao(lerAmbiente()).mode !== 'firestore-diagnostic')
            throw new Error('LOCAL_EMULATORS_REQUIRED');
        const inicio = performance.now();
        const snapshot = await obterFirestore().collection('conhecimento')
            .where('ativo', '==', true).count().get();
        const quantidade = snapshot.data().count;
        if (!Number.isSafeInteger(quantidade) || quantidade < 0) throw new Error('INVALID_AGGREGATE');
        return { quantidade, duracaoConsultaMs: Math.max(0, Math.round(performance.now() - inicio)) };
    };
}

function criarDiagnosticoConhecimento(obterDependencias, lerOrigens) {
    return criarDiagnosticoAutenticado(obterDependencias, lerOrigens, async (factory) => {
        const { quantidade, duracaoConsultaMs } = await factory().consultarConhecimentoAtivo();
        return { status: 'ok', quantidade, duracaoConsultaMs };
    });
}

module.exports = { criarLeituraConhecimento, criarDiagnosticoConhecimento };
