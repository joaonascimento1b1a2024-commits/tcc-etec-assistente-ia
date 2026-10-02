'use strict';

const http = require('node:http');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { criarEndpointAssistente, origensPermitidas } = require('../functions/lib/assistente/http.js');
const DEMO_PROJECT = 'demo-sylvinho-render-poc';
const MOCK_RESPONSE = 'Resposta simulada da POC. Nenhuma IA real foi chamada.';
const localHost = (value) => /^(127\.0\.0\.1|localhost):[1-9][0-9]{0,4}$/.test(value || '') &&
    Number(value.split(':')[1]) <= 65535;

function lerConfiguracao(env = process.env) {
    const mode = env.SYLVINHO_POC_MODE || 'health';
    if (!['health', 'emulator'].includes(mode)) throw new Error('POC_MODE_INVALID');
    const origins = env.ASSISTENTE_CORS_ORIGINS || '';
    origensPermitidas(origins);
    const port = env.PORT === undefined ? 10000 : Number(env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT_INVALID');
    if (mode === 'emulator' && (
        env.GCLOUD_PROJECT !== DEMO_PROJECT ||
        !localHost(env.FIREBASE_AUTH_EMULATOR_HOST) ||
        !localHost(env.FIRESTORE_EMULATOR_HOST) || env.RENDER === 'true'
    )) throw new Error('LOCAL_EMULATORS_REQUIRED');
    return { mode, origins, port, host: mode === 'emulator' ? '127.0.0.1' : '0.0.0.0' };
}

function criarDependencias(config) {
    // Health-only never initializes Admin, reads credentials, or contacts Firebase.
    if (config.mode === 'health') return {
        auth: { async verifyIdToken() { throw new Error('AUTH_UNAVAILABLE'); } },
        firestore: {},
        serverTimestamp: () => { throw new Error('FIRESTORE_UNAVAILABLE'); },
        gerarResposta: async () => MOCK_RESPONSE,
    };
    if (lerConfiguracao(process.env).mode !== 'emulator') throw new Error('LOCAL_EMULATORS_REQUIRED');
    const localRequire = createRequire(resolve(__dirname, '../functions/package.json'));
    const { initializeApp, getApps } = localRequire('firebase-admin/app');
    const { getAuth } = localRequire('firebase-admin/auth');
    const { getFirestore, FieldValue } = localRequire('firebase-admin/firestore');
    const name = 'sylvinho-render-poc-emulator';
    // Firestore Admin requires its standard credential type, even with emulators.
    // Explicit demo project + both local hosts + isolated runner prevent production access.
    const app = getApps().find((item) => item.name === name) || initializeApp({ projectId: DEMO_PROJECT }, name);
    return {
        auth: getAuth(app), firestore: getFirestore(app),
        serverTimestamp: () => FieldValue.serverTimestamp(),
        gerarResposta: async () => MOCK_RESPONSE,
    };
}

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

function criarServidor({ config = lerConfiguracao(), obterDependencias } = {}) {
    let deps;
    const endpoint = criarEndpointAssistente(() => {
        deps ||= obterDependencias ? obterDependencias() : criarDependencias(config);
        return deps;
    }, () => config.origins);
    const server = http.createServer(async (req, res) => {
        const output = respostaExpress(res);
        try {
            const path = new URL(req.url, 'http://localhost').pathname;
            if (path === '/health') {
                if (req.method !== 'GET') output.set('Allow', 'GET').status(405).json({ error: 'Metodo nao permitido.' });
                else output.status(200).json({ status: 'ok', service: 'sylvinho-backend' });
                return;
            }
            if (path !== '/perguntarAssistente') {
                output.status(404).json({ error: 'Rota nao encontrada.' });
                return;
            }
            const body = await lerCorpo(req);
            await endpoint({ method: req.method, body, get: (name) => req.headers[name.toLowerCase()] }, output);
        } catch (error) {
            const status = { INVALID_JSON: 400, PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415 }[error.message] || 500;
            if (!res.headersSent && !res.destroyed) output.status(status).json({ error: 'Requisicao nao processada.' });
        }
    });
    server.requestTimeout = 30000;
    server.headersTimeout = 10000;
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
