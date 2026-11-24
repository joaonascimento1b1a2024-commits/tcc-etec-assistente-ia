'use strict';

const http = require('node:http');
const { criarEndpointAssistente } = require('../functions/lib/assistente/http.js');
const { criarEndpointVisitante } = require('../functions/lib/assistente/visitante.js');
const { recuperarConhecimentoRelevante } = require('../functions/lib/rag/recuperacao.js');
const { lerConfiguracao, validarConfiguracao, DEMO_PROJECT } = require('./config.cjs');
const { criarDependencias, criarFabricaDependencias, MOCK_RESPONSE } = require('./dependencias.cjs');
const { criarDiagnosticoAutenticado } = require('./autenticacao.cjs');
const { criarDiagnosticoConhecimento } = require('./conhecimento.cjs');
const { criarDiagnosticoRag } = require('./rag.cjs');
const { resolverMotor } = require('./motor-curado.cjs');
const whatsappModulo = require('./whatsapp.cjs');

function respostaExpress(res) {
    const adapter = {
        get headersSent() { return res.headersSent; },
        vary(name) { res.setHeader('Vary', name); return adapter; },
        set(name, value) { res.setHeader(name, value); return adapter; },
        status(code) { res.statusCode = code; return adapter; },
        json(body) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); },
        send(body = '') { res.end(body); },
    };
    return adapter;
}

async function lerCorpo(req) {
    if (req.method !== 'POST') return undefined;
    if (!(req.headers['content-type'] || '').split(';')[0].trim().match(/^application\/json$/i))
        throw new Error('UNSUPPORTED_MEDIA_TYPE');
    return new Promise((resolveBody, reject) => {
        const chunks = [];
        let size = 0;
        let settled = false;
        req.on('data', (chunk) => {
            if (settled) return;
            size += chunk.length;
            if (size > 16384) {
                settled = true;
                reject(new Error('PAYLOAD_TOO_LARGE'));
            } else chunks.push(chunk);
        });
        req.on('error', () => { settled = true; reject(new Error('INVALID_JSON')); });
        req.on('end', () => {
            if (settled) return;
            settled = true;
            try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
            catch { reject(new Error('INVALID_JSON')); }
        });
    });
}

function criarServidor({ config = lerConfiguracao(), obterDependencias,
    whatsapp = whatsappModulo.lerConfiguracaoWhatsApp(), transporteWhatsApp } = {}) {
    const validated = validarConfiguracao(config);
    const factory = criarFabricaDependencias(validated, { obterDependencias });
    // Identifica motor e revisão no health do modo documental, sem segredos.
    const saudeMotor = validated.mode === 'documental' ? (() => {
        const motor = resolverMotor(process.env);
        const revisao = /^[0-9a-f]{7,40}$/.test(process.env.RENDER_GIT_COMMIT || '') ? process.env.RENDER_GIT_COMMIT.slice(0, 7) : undefined;
        return { motor: motor.efetivo, ...(motor.motivo ? { motorSolicitado: motor.solicitado } : {}), ...(revisao ? { revisao } : {}) };
    })() : {};
    const diagnostic = criarDiagnosticoAutenticado(factory, () => validated.origins);
    const knowledgeDiagnostic = criarDiagnosticoConhecimento(factory, () => validated.origins);
    const ragDiagnostic = criarDiagnosticoRag(factory, () => validated.origins);
    const endpoint = criarEndpointAssistente(factory, () => validated.origins);
    const visitante = criarEndpointVisitante(() => {
        const deps = factory();
        return {
            recuperarConhecimento: deps.recuperarConhecimento ||
                (pergunta => recuperarConhecimentoRelevante(deps.firestore, pergunta)),
            // Contexto atribuido pela rota publica; o corpo nao define acesso.
            // A mesma instancia do gerador compartilha limites com as contas.
            gerarResposta: (pergunta, chunks, contexto) => deps.gerarResposta(pergunta, chunks, contexto),
            ...(deps.responderVisitante ? { responderVisitante: deps.responderVisitante } : {}),
        };
    }, () => validated.origins);
    // WhatsApp: desligado sem as variáveis WHATSAPP_*; usa o mesmo fluxo do visitante.
    const modosComChat = ['emulator', 'documental', 'documental-emulator'];
    const webhookWhatsApp = whatsapp && modosComChat.includes(validated.mode)
        ? whatsappModulo.criarWebhookWhatsApp({ config: whatsapp, responder: whatsappModulo.responderComoVisitante(visitante),
            ...(transporteWhatsApp ? { transporte: transporteWhatsApp } : {}) })
        : null;
    const server = http.createServer(async (req, res) => {
        const output = respostaExpress(res);
        try {
            if (validated.mode === 'health') {
                if (req.url?.split('?')[0] === '/health' && req.method === 'GET')
                    output.status(200).json({ status: 'ok', service: 'sylvinho-backend' });
                else output.status(404).json({ error: 'Rota nao encontrada.' });
                return;
            }
            const path = new URL(req.url, 'http://localhost').pathname;
            if (path === '/health') {
                if (req.method !== 'GET') output.set('Allow', 'GET').status(405).json({ error: 'Metodo nao permitido.' });
                else output.status(200).json({ status: 'ok', service: 'sylvinho-backend', ...saudeMotor });
                return;
            }
            if (path === whatsappModulo.ROTA && webhookWhatsApp) {
                await webhookWhatsApp(req, res);
                return;
            }
            const diagnosticRoute = path === '/diagnostico/auth' && validated.mode === 'auth-diagnostic';
            const knowledgeRoute = path === '/diagnostico/conhecimento' && validated.mode === 'firestore-diagnostic';
            const ragRoute = path === '/diagnostico/rag' && validated.mode === 'rag-diagnostic';
            const assistantRoute = path === '/perguntarAssistente' && ['emulator', 'documental', 'documental-emulator'].includes(validated.mode);
            const visitorRoute = path === '/perguntarVisitante' && ['emulator', 'documental', 'documental-emulator'].includes(validated.mode);
            if (!diagnosticRoute && !knowledgeRoute && !ragRoute && !assistantRoute && !visitorRoute) {
                output.status(404).json({ error: 'Rota nao encontrada.' });
                return;
            }
            const body = await lerCorpo(req);
            await (visitorRoute ? visitante : ragRoute ? ragDiagnostic : knowledgeRoute ? knowledgeDiagnostic : diagnosticRoute ? diagnostic : endpoint)(
                { method: req.method, body, get: (name) => req.headers[name.toLowerCase()] }, output);
        } catch (error) {
            const status = { INVALID_JSON: 400, PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415 }[error.message] || 500;
            if (!res.headersSent && !res.destroyed) output.status(status).json({ error: 'Requisicao nao processada.' });
        }
    });
    server.requestTimeout = 30000;
    server.headersTimeout = 10000;
    if (webhookWhatsApp) server.aguardarWhatsApp = webhookWhatsApp.aguardarPendentes;
    return server;
}

if (require.main === module) {
    try {
        const config = lerConfiguracao();
        const server = criarServidor({ config });
        server.on('error', () => { console.error('POC_START_FAILED'); process.exitCode = 1; });
        server.listen(config.port, config.host, () => console.log('POC_READY'));
        for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
            server.close(() => process.exit(0));
            server.closeIdleConnections();
        });
    } catch { console.error('POC_CONFIG_INVALID'); process.exitCode = 1; }
}

module.exports = { criarServidor, criarDependencias, lerConfiguracao, DEMO_PROJECT, MOCK_RESPONSE };
