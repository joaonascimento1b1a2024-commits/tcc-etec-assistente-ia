'use strict';

// Liga o motor curado (render-poc/motor-curado/*.mjs) ao servidor Render.
// SYLVINHO_MOTOR escolhe: fluxo (padrão, comportamento anterior), curado ou
// hibrido (curado primeiro; sem evidência, o fluxo documental responde).
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { ErroRespostaTemporaria } = require('../functions/lib/assistente/handler.js');

const MOTORES = Object.freeze(['fluxo', 'curado', 'hibrido']);
const RAIZ = resolve(__dirname, '..');
const TIMEOUT_MS = 20000; // Termina antes do cliente (30 s) e do requestTimeout do servidor.
// Só falta de evidência devolve a vez ao fluxo documental. Falhas de geração,
// limite de uso e tempo excedido continuam erros recuperáveis com nova tentativa.
const SEM_EVIDENCIA = new Set(['sem_evidencia']);
const SEM_EVIDENCIA_CODIGOS = new Set(['BUSCA_INDISPONIVEL']);
const AVISO_VISITANTE = ' Reenvie a pergunta completa com esse detalhe, porque este chat não guarda as mensagens anteriores.';

function resolverMotor(env = process.env) {
    const solicitado = env.SYLVINHO_MOTOR === undefined || env.SYLVINHO_MOTOR === '' ? 'fluxo' : env.SYLVINHO_MOTOR;
    if (!MOTORES.includes(solicitado)) throw new Error('SYLVINHO_MOTOR_INVALIDO');
    const temChave = typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim().length > 0;
    if (solicitado !== 'fluxo' && !temChave) return Object.freeze({ solicitado, efetivo: 'fluxo', motivo: 'GEMINI_API_KEY_AUSENTE' });
    return Object.freeze({ solicitado, efetivo: solicitado, motivo: null });
}

function lerBase(raiz = RAIZ) {
    const ler = nome => JSON.parse(readFileSync(resolve(raiz, 'knowledge-local', nome), 'utf8'));
    let vetores = null;
    try { vetores = ler('embeddings-curados.json'); } catch { vetores = null; }
    return { registros: ler('faq-curada.json'), contatos: ler('contatos-publicos.json'), vetores };
}

function motivoTemporario(resultado) {
    if (resultado.tipo === 'ocupado') return 'OCUPADO';
    if (resultado.codigo === 'HTTP_429') return 'LIMITE_USO';
    if (resultado.codigo === 'TIMEOUT') return 'TEMPO_EXCEDIDO';
    if (['NAO_SUSTENTADA', 'LINGUAGEM', 'FORMATO', 'NUMERO_OU_DADO_NAO_SUSTENTADO'].includes(resultado.codigo))
        return 'RESPOSTA_NAO_VALIDADA';
    return 'INDISPONIVEL';
}

/**
 * @param {object} opcoes
 * @param {'curado'|'hibrido'} opcoes.modo Motor efetivo (resolverMotor).
 * @param {Function} opcoes.lerAmbiente Leitura do ambiente; a chave nunca é guardada.
 * @param {Function} [opcoes.registrar] Diagnóstico sem pergunta, resposta ou dados pessoais.
 * @param {Function} [opcoes.transporte] Substituto de fetch para testes.
 */
function criarMotorCurado({ modo, lerAmbiente = () => process.env, registrar = () => {}, transporte, base = lerBase(), timeoutMs = TIMEOUT_MS } = {}) {
    if (!['curado', 'hibrido'].includes(modo)) throw new Error('SYLVINHO_MOTOR_INVALIDO');
    const log = (codigo, dados) => { try { registrar(codigo, dados); } catch { /* diagnóstico não interfere */ } };
    const lerChave = () => lerAmbiente().GEMINI_API_KEY;
    let carregando;
    const obterMotor = () => carregando ||= Promise.all([
        import(pathToFileURL(resolve(__dirname, 'motor-curado/gemini-curado.mjs')).href),
        import(pathToFileURL(resolve(__dirname, 'motor-curado/embeddings-curados.mjs')).href),
    ]).then(([gemini, embeddings]) => {
        const extra = transporte ? { transporte } : {};
        const api = embeddings.criarEmbeddings({ lerChave, ...extra });
        const motor = gemini.criarGeminiCurado({ ...base, lerChave, timeoutMs, ...extra,
            embeddingConsulta: api.consulta, registrar: log });
        log('MOTOR_CARREGADO', { modo, registros: base.registros.length, vetores: Boolean(base.vetores) });
        return motor;
    }).catch(erro => { carregando = undefined; throw erro; });

    async function responder(pergunta, historico, chaves, publico) {
        let motor;
        try { motor = await obterMotor(); }
        catch {
            log('MOTOR_FALHA_CARGA', { modo });
            if (modo === 'hibrido') return null;
            throw new ErroRespostaTemporaria('INDISPONIVEL', 5);
        }
        const resultado = await motor.responder({ pergunta, historico, ...chaves });
        log('MOTOR_RESPOSTA', { publico, tipo: resultado.tipo, modo: resultado.modo || null,
            codigo: resultado.codigo || null, ms: resultado.ms ?? null });
        const semEvidencia = SEM_EVIDENCIA.has(resultado.tipo) ||
            resultado.retentavel && SEM_EVIDENCIA_CODIGOS.has(resultado.codigo);
        if (modo === 'hibrido' && semEvidencia) {
            log('MOTOR_FLUXO_RESERVA', { publico });
            return null;
        }
        if (resultado.retentavel) throw new ErroRespostaTemporaria(motivoTemporario(resultado), resultado.tentarEmSegundos);
        if (typeof resultado.texto !== 'string' || !resultado.texto.trim()) throw new Error('INVALID_GENERATOR_RESPONSE');
        return resultado;
    }

    return Object.freeze({
        modo,
        // Conta autenticada: cache e fila segregados pelo uid, histórico já filtrado pelo handler.
        responderConversa: async (pergunta, historico, contexto) => {
            const resultado = await responder(pergunta, historico, { cacheNamespace: contexto.uid, chaveFila: contexto.uid }, 'conta');
            return resultado === null ? null : resultado.texto;
        },
        // Visitante: sem histórico; cache público próprio, vez na fila por requisição.
        responderVisitante: async pergunta => {
            const resultado = await responder(pergunta, [], { cacheNamespace: 'visitante', chaveFila: 'visitante:' + randomUUID() }, 'visitante');
            if (resultado === null) return null;
            // Perguntas de esclarecimento dependem de histórico, que o chat visitante não envia.
            return resultado.tipo === 'esclarecimento' ? resultado.texto.trim() + AVISO_VISITANTE : resultado.texto;
        },
    });
}

module.exports = { criarMotorCurado, resolverMotor, lerBase, MOTORES, TIMEOUT_MS };
