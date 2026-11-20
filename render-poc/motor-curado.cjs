'use strict';

// ADAPTADOR do motor curado para o servidor Render (render-poc/server.cjs).
//
// SYLVINHO_MOTOR escolhe o modo de responder:
// - fluxo   : só o fluxo documental antigo (RAG sobre os documentos no Firestore);
// - curado  : só a base curada (render-poc/motor-curado/*.mjs);
// - hibrido : base curada primeiro e, sem fato aprovado, o fluxo documental (modo em produção).
//
// Decisão do modo híbrido para cada resultado do motor curado (função responder abaixo):
//   resposta válida (curado_direto, gemini_curado, esclarecimento...) -> mostra ao usuário;
//   falha COM reserva (fato aprovado inequívoco)                      -> mostra o texto aprovado;
//   sem evidência na base                                           -> null: o fluxo documental responde;
//   todos os modelos Gemini sem cota/sobrecarregados, sem reserva    -> null: o fluxo documental tenta;
//   tempo esgotado ou resposta reprovada, sem reserva              -> erro recuperável ("tente de novo").
// Uma resposta gerada que foi reprovada na validação NUNCA é mostrada.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { ErroRespostaTemporaria } = require('../functions/lib/assistente/handler.js');
const { classificarEscopo } = require('../functions/lib/assistente/escopo.js');

const MOTORES = Object.freeze(['fluxo', 'curado', 'hibrido']);
const RAIZ = resolve(__dirname, '..');
const TIMEOUT_MS = 20000; // Termina antes do cliente (30 s) e do requestTimeout do servidor.
// Falta de evidência devolve a vez ao fluxo documental. No híbrido, o fluxo também
// atende quando todos os modelos Gemini da lista recusam por limite (429) ou falha do
// provedor (5xx/rede): essas recusas são rápidas, então cabe o tempo do fluxo.
// Tempo excedido e resposta reprovada na validação continuam erros recuperáveis.
const SEM_EVIDENCIA = new Set(['sem_evidencia']);
const SEM_EVIDENCIA_CODIGOS = new Set(['BUSCA_INDISPONIVEL']);
const PROVEDOR_ESGOTADO = codigo => /^HTTP_(429|5\d\d)$/.test(codigo || '') || codigo === 'PROVEDOR_INDISPONIVEL';
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
    if (resultado.codigo === 'TIMEOUT' || resultado.codigo === 'PROVEDOR_TIMEOUT') return 'TEMPO_EXCEDIDO';
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
// Fontes da resposta: o texto da base curada sai com um bloco no fim, depois deste marcador,
// com as fontes oficiais dos fatos usados (nome, link e trecho). A tela
// (public/Logado/Home/resposta-documental-view.js) esconde o bloco e mostra um "Fonte ▾" recolhido.
const MARCADOR_FONTES = '\n\n[[FONTES]]';
const NOMES_DE_SITE = [
    [/^https:\/\/etecmatao\.cps\.sp\.gov\.br\//, 'Site oficial da ETEC Sylvio de Mattos Carvalho'],
    [/^https:\/\/vestibulinho\.etec\.sp\.gov\.br\//, 'Portal oficial do Vestibulinho Etec'],
    [/^https:\/\/nsaetec\.com\.br\//, 'NSA (área do aluno) — aviso da Secretaria Acadêmica'],
    [/^https:\/\/bkpsitecpsnew\.blob\.core\.windows\.net\//, 'Documento oficial publicado pela ETEC'],
];

/** Até 4 fontes oficiais (sem repetir o link) dos fatos citados na resposta. */
function fontesDosFatos(ids, registrosPorId) {
    const fontes = [];
    for (const id of ids) {
        for (const f of registrosPorId.get(id)?.fonte || []) {
            if (!/^https:\/\//.test(f.url || '') || fontes.some(x => x.url === f.url && x.trecho === trechoLegivel(f.evidencia))) continue;
            const titulo = f.referencia || NOMES_DE_SITE.find(([padrao]) => padrao.test(f.url))?.[1] || 'Fonte oficial';
            fontes.push({ titulo, url: f.url, ...(trechoLegivel(f.evidencia) ? { trecho: trechoLegivel(f.evidencia) } : {}) });
            if (fontes.length === 4) return fontes;
        }
    }
    return fontes;
}

// Trecho literal da fonte, apresentável: começa em palavra inteira e tem no máximo 280 caracteres.
function trechoLegivel(evidencia) {
    if (typeof evidencia !== 'string') return '';
    let t = evidencia.replace(/\s+/g, ' ').trim();
    if (/^[a-zà-ú]/.test(t)) t = t.replace(/^\S+\s*/, ''); // coleta começou no meio de uma palavra
    return t.length > 280 ? t.slice(0, 277).replace(/\s+\S*$/, '') + '…' : t;
}

function criarMotorCurado({ modo, lerAmbiente = () => process.env, registrar = () => {}, transporte, base = lerBase(), timeoutMs = TIMEOUT_MS, mostrarFontes = false } = {}) {
    if (!['curado', 'hibrido'].includes(modo)) throw new Error('SYLVINHO_MOTOR_INVALIDO');
    const registrosPorId = new Map(base.registros.map(r => [r.id, r]));
    // Anexa o bloco de fontes às respostas tiradas da base curada (texto aprovado ou gerado e aprovado).
    const comFontes = resultado => {
        if (!mostrarFontes || !['curado_direto', 'gemini_curado'].includes(resultado.tipo) || !Array.isArray(resultado.ids)) return resultado;
        const fontes = fontesDosFatos(resultado.ids, registrosPorId);
        return fontes.length ? { ...resultado, texto: resultado.texto + MARCADOR_FONTES + JSON.stringify(fontes) } : resultado;
    };
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
        // Saudação e perguntas sobre o próprio assistente: resposta fixa do classificador,
        // sem busca nem Gemini (o chat logado chega aqui antes do classificador).
        const local = classificarEscopo(pergunta);
        if (local.categoria === 'social' && local.resposta) {
            log('MOTOR_RESPOSTA', { publico, tipo: 'social', modo: null, codigo: null, ms: 0 });
            return { texto: local.resposta, tipo: 'social' };
        }
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
        // Falha de geração/revisão com um fato aprovado inequívoco: mostra o texto aprovado,
        // em vez de cair no fluxo antigo (que não conhece a base curada) ou pedir nova tentativa.
        if (resultado.tipo === 'falha' && resultado.reserva && typeof resultado.reserva.texto === 'string' && resultado.reserva.texto.trim()) {
            log('MOTOR_RESPOSTA_DIRETA', { publico, motivo: resultado.codigo || null });
            return comFontes({ ...resultado.reserva, tipo: 'curado_direto' });
        }
        const semEvidencia = SEM_EVIDENCIA.has(resultado.tipo) ||
            resultado.retentavel && SEM_EVIDENCIA_CODIGOS.has(resultado.codigo);
        if (modo === 'hibrido' && semEvidencia) {
            log('MOTOR_FLUXO_RESERVA', { publico });
            return null;
        }
        if (modo === 'hibrido' && resultado.tipo === 'falha' && PROVEDOR_ESGOTADO(resultado.codigo)) {
            log('MOTOR_FLUXO_RESERVA', { publico, motivo: resultado.codigo });
            return null;
        }
        if (resultado.retentavel) throw new ErroRespostaTemporaria(motivoTemporario(resultado), resultado.tentarEmSegundos);
        if (typeof resultado.texto !== 'string' || !resultado.texto.trim()) throw new Error('INVALID_GENERATOR_RESPONSE');
        return comFontes(resultado);
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

module.exports = { criarMotorCurado, resolverMotor, lerBase, MOTORES, TIMEOUT_MS, MARCADOR_FONTES };
