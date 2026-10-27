'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { criarServidor, criarDependencias, lerConfiguracao, DEMO_PROJECT, MOCK_RESPONSE } = require('../server.cjs');

const trechoSintetico = require('../../tests/fixtures/matricula-sintetica.cjs');
const ID = 'AbCdEfGhIjKlMnOpQrSt';
const ORIGIN = 'http://localhost:5000';
const BODY = { pergunta: 'matricula', conversationId: ID, messageId: 'message-sylvinho-000001', usuarioId: 'intruso' };
function fixture() {
    const state = { calls: [], generations: 0, prompt: '', conversation: {
        titulo: 'Titulo manual', tituloOrigem: 'manual', criadoEm: 1,
        mensagens: [{ texto: 'matricula', remetente: 'user', enviadoEm: 1, messageId: BODY.messageId }],
    } };
    const ref = { get: async () => ({ exists: true, data: () => state.conversation }) };
    const deps = {
        auth: { async verifyIdToken(token) { if (token !== 'ficticio') throw new Error('SECRET_SENTINEL'); return { uid: 'aluno' }; } },
        firestore: {
            collection(name) {
                if (name === 'conhecimento') return { where(...args) {
                    assert.deepEqual(args, ['ativo', '==', true]);
                    return { get: async () => ({ forEach(cb) {
                        cb({ id: trechoSintetico.id, data: () => trechoSintetico });
                        cb({ id: 'inativo', data: () => ({ ativo: false, titulo: 'Matricula', conteudo: 'MARCADOR_INATIVO' }) });
                    } }) };
                } };
                assert.equal(name, 'users');
                return { doc(uid) { state.calls.push(uid); return { collection(sub) {
                    assert.equal(sub, 'conversas'); return { doc(id) { assert.equal(id, ID); return ref; } };
                } }; } };
            },
            async runTransaction(cb) { return cb({ get: ref.get, update(_ref, data) { Object.assign(state.conversation, data); } }); },
        },
        serverTimestamp: () => 'SERVER_TIMESTAMP', agora: () => 123,
        async gerarResposta(pergunta, chunks) {
            state.generations++;
            state.prompt = chunks.map((chunk) => chunk.conteudo).join('\n');
            assert.equal(pergunta, BODY.pergunta);
            return MOCK_RESPONSE;
        },
    };
    return { state, deps };
}

async function withServer(t, options = {}) {
    const server = criarServidor({ config: lerConfiguracao({ SYLVINHO_POC_MODE: 'emulator', GCLOUD_PROJECT: DEMO_PROJECT,
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180',
        ASSISTENTE_CORS_ORIGINS: ORIGIN }), obterDependencias: () => criarDependencias(lerConfiguracao({})), ...options });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    t.after(() => new Promise((done) => { server.close(done); server.closeAllConnections(); }));
    return async (path = '/perguntarAssistente', options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}
const post = (body = BODY, token) => ({ method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
}, body: JSON.stringify(body) });

test('health 200 sem inicializar dependencias e sem dados sensiveis', async (t) => {
    const request = await withServer(t, { config: lerConfiguracao({}), obterDependencias: () => { throw new Error('NAO_INICIALIZAR'); } });
    const r = await request('/health');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { status: 'ok', service: 'sylvinho-backend' });
});
test('metodo invalido no endpoint original retorna 405', async (t) => {
    const r = await (await withServer(t))(); assert.equal(r.status, 405); assert.equal(r.headers.get('allow'), 'POST');
});
test('health rejeita POST e rota desconhecida retorna 404', async (t) => {
    const request = await withServer(t, { config: lerConfiguracao({}) });
    assert.equal((await request('/health', { method: 'POST' })).status, 404);
    assert.equal((await request('/outra')).status, 404);
});
test('token ausente retorna 401', async (t) => {
    assert.equal((await (await withServer(t))('/perguntarAssistente', post())).status, 401);
});
test('token invalido nao vaza erro, token ou stack', async (t) => {
    const { deps } = fixture(); const request = await withServer(t, { obterDependencias: () => deps });
    const r = await request('/perguntarAssistente', post(BODY, 'TOKEN_SECRETO'));
    assert.equal(r.status, 401); assert.doesNotMatch(await r.text(), /TOKEN_SECRETO|SECRET_SENTINEL|stack/);
});
test('preflight permitido reutiliza CORS e nao inicializa Admin', async (t) => {
    const request = await withServer(t, { obterDependencias: () => { throw new Error('NAO_INICIALIZAR'); } });
    const r = await request('/perguntarAssistente', { method: 'OPTIONS', headers: { Origin: ORIGIN,
        'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization, Content-Type' } });
    assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
});
test('CORS proibido retorna 403 sem executar handler', async (t) => {
    const request = await withServer(t, { obterDependencias: () => { throw new Error('NAO_INICIALIZAR'); } });
    const r = await request('/perguntarAssistente', { method: 'OPTIONS', headers: { Origin: 'https://intruso.invalid' } });
    assert.equal(r.status, 403); assert.equal(r.headers.get('access-control-allow-origin'), null);
});
test('pergunta invalida e id invalido preservam validacoes', async (t) => {
    const { deps, state } = fixture(); const request = await withServer(t, { obterDependencias: () => deps });
    for (const body of [{ ...BODY, pergunta: '' }, { ...BODY, pergunta: 1 }, { ...BODY, conversationId: '../intruso' }])
        assert.equal((await request('/perguntarAssistente', post(body, 'ficticio'))).status, 400);
    assert.equal(state.generations, 0);
});
test('handler original -> UID do token -> RAG V1 -> mock -> somente bot', async (t) => {
    const { deps, state } = fixture(); const request = await withServer(t, { obterDependencias: () => deps });
    const r = await request('/perguntarAssistente', post(BODY, 'ficticio'));
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { resposta: MOCK_RESPONSE });
    assert.deepEqual(state.calls, ['aluno']); assert.equal(state.generations, 1);
    assert.ok(state.prompt.includes(trechoSintetico.conteudo)); assert.doesNotMatch(state.prompt, /MARCADOR_INATIVO/);
    assert.deepEqual(state.conversation.mensagens.map((m) => m.remetente), ['user', 'bot']);
    assert.equal(state.conversation.tituloOrigem, 'manual'); assert.equal(state.conversation.criadoEm, 1);
});
test('JSON invalido, body grande e content-type nao suportado', async (t) => {
    const request = await withServer(t);
    for (const [body, type, expected] of [['{', 'application/json', 400], ['x'.repeat(17000), 'application/json', 413], ['{}', 'text/plain', 415]])
        assert.equal((await request('/perguntarAssistente', { method: 'POST', headers: { 'Content-Type': type }, body })).status, expected);
});
test('erro interno de dependencia retorna generico sem segredo', async (t) => {
    const request = await withServer(t, { obterDependencias: () => { throw new Error('PRIVATE_KEY_SENTINEL'); } });
    const r = await request('/perguntarAssistente', post()); assert.equal(r.status, 500);
    assert.doesNotMatch(await r.text(), /PRIVATE_KEY_SENTINEL|stack/);
});
test('health-only oculta assistente sem ADC ou Firestore', async (t) => {
    const r = await (await withServer(t, { config: lerConfiguracao({}) }))('/perguntarAssistente', post(BODY, 'ficticio'));
    assert.equal(r.status, 404);
});
test('modo emulador exige ambos hosts locais e projeto demo exato', () => {
    const env = { SYLVINHO_POC_MODE: 'emulator', GCLOUD_PROJECT: DEMO_PROJECT,
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180' };
    assert.equal(lerConfiguracao(env).mode, 'emulator');
    for (const change of [{ GCLOUD_PROJECT: 'tcc-ia-d8891' }, { FIRESTORE_EMULATOR_HOST: '' },
        { FIREBASE_AUTH_EMULATOR_HOST: 'google.com:443' }, { RENDER: 'true' }, { SYLVINHO_POC_MODE: 'production' }])
        assert.throws(() => lerConfiguracao({ ...env, ...change }));
});
test('porta invalida e wildcard CORS sao bloqueados', () => {
    for (const PORT of ['', 'abc', '0', '65536']) assert.throws(() => lerConfiguracao({ PORT }));
    assert.throws(() => lerConfiguracao({ ASSISTENTE_CORS_ORIGINS: '*' }));
    const origins = 'https://tcc-ia-d8891.web.app,https://tcc-ia-d8891.firebaseapp.com,http://localhost:5000,http://127.0.0.1:5000';
    assert.equal(lerConfiguracao({ ASSISTENTE_CORS_ORIGINS: origins }).origins, origins);
});
test('adapter nao importa SDK Gemini, Function index ou firebase-functions', () => {
    const source = readFileSync(require.resolve('../server.cjs'), 'utf8');
    assert.doesNotMatch(source, /@google\/genai|firebase-functions|lib\/index|GEMINI_API_KEY|private_key/);
});
