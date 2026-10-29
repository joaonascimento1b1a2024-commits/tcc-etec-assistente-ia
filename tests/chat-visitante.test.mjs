import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { criarEndpointVisitante } from '../functions/lib/assistente/visitante.js';
import { criarServidor, lerConfiguracao, DEMO_PROJECT } from '../render-poc/server.cjs';

const origin = 'https://tcc-ia-d8891.web.app';
function backend({ gerarResposta = async () => 'Resposta documental', recuperarConhecimento = async () => [], agora } = {}) {
    const calls = [];
    const handler = criarEndpointVisitante(() => {
        calls.push('deps');
        return {
            recuperarConhecimento: async pergunta => { calls.push(['busca', pergunta]); return recuperarConhecimento(pergunta); },
            gerarResposta: async (...args) => { calls.push(['geracao', ...args]); return gerarResposta(...args); },
        };
    }, () => origin, agora);
    return { calls, async request(body = { pergunta: 'Matrícula' }, method = 'POST', headers = { Origin: origin }) {
        const res = { headers: {}, code: 0, body: null, headersSent: false,
            vary() {}, set(key, value) { this.headers[key] = value; return this; },
            status(code) { this.code = code; return this; },
            json(body) { this.body = body; }, send() {},
        };
        await handler({ body, method, get: key => headers[key] }, res);
        return res;
    } };
}

test('visitante responde sem token, UID, histórico ou dependência de escrita', async () => {
    const run = backend();
    const r = await run.request();
    assert.equal(r.code, 200);
    assert.deepEqual(r.body, { resposta: 'Resposta documental' });
    assert.equal(r.headers['Cache-Control'], 'no-store');
    assert.deepEqual(run.calls, ['deps', ['busca', 'Matrícula'],
        ['geracao', 'Matrícula', [], { publico: 'visitante' }]]);
});

test('corpo inválido ou tentativa de indicar usuário/histórico não executa busca', async () => {
    const run = backend();
    for (const body of [null, [], {}, { pergunta: '' }, { pergunta: '   ' }, { pergunta: 3 },
        { pergunta: 'a'.repeat(701) }, { pergunta: 'oi', conversationId: 'abc' },
        { pergunta: 'oi', usuarioId: 'alice' }, { pergunta: 'oi', historico: [] },
        ...['uid', 'publico', 'contexto', 'provider', 'model', 'url', 'OPENROUTER_API_KEY',
            'SYLVINHO_IA_VISITANTE_ENABLED'].map(key => ({ pergunta: 'Matrícula', [key]: 'injetado' }))]) {
        assert.equal((await run.request(body)).code, 400);
    }
    assert.deepEqual(run.calls, []);
});

test('CORS e método bloqueiam antes de inicializar dependências', async () => {
    const run = backend();
    assert.equal((await run.request({}, 'POST', { Origin: 'https://intruso.invalid' })).code, 403);
    assert.equal((await run.request({}, 'GET')).code, 405);
    assert.equal((await run.request({}, 'OPTIONS', { Origin: origin,
        'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type' })).code, 204);
    assert.deepEqual(run.calls, []);
});

test('limite por minuto dispensa identificadores e libera após a janela', async () => {
    let now = 0;
    const run = backend({ agora: () => now });
    for (let i = 0; i < 30; i++) assert.equal((await run.request()).code, 200);
    const limited = await run.request();
    assert.equal(limited.code, 429);
    assert.equal(limited.headers['Retry-After'], '60');
    now = 60000;
    assert.equal((await run.request()).code, 200);
});

test('concorrência limitada e erros não vazam detalhes nem prendem vagas', async () => {
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    const run = backend({ gerarResposta: async () => { await waiting; throw Error('SEGREDO'); } });
    const pending = Array.from({ length: 4 }, () => run.request());
    assert.equal((await run.request()).code, 429);
    release();
    for (const response of await Promise.all(pending)) {
        assert.equal(response.code, 500);
        assert.doesNotMatch(JSON.stringify(response.body), /SEGREDO/);
    }
    assert.equal((await run.request()).code, 500);
});

test('Render responde ao visitante sem tocar em Auth/Firestore e mantém rota logada protegida', async t => {
    const forbidden = new Proxy({}, { get() { assert.fail('Visitante acessou Auth/Firestore'); } });
    const server = criarServidor({ config: lerConfiguracao({ SYLVINHO_POC_MODE: 'emulator',
        GCLOUD_PROJECT: DEMO_PROJECT, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', ASSISTENTE_CORS_ORIGINS: origin }),
        obterDependencias: () => ({ auth: forbidden, firestore: forbidden,
            recuperarConhecimento: async () => [], gerarResposta: async () => 'Resposta sem salvar' }) });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ pergunta: 'Matrícula' }) };
    const result = await fetch(base + '/perguntarVisitante', options);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { resposta: 'Resposta sem salvar' });
    assert.equal((await fetch(base + '/perguntarAssistente', options)).status, 401);
});

const clientSource = readFileSync(new URL('../public/Chat/cliente.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/m, '');
const client = await import(`data:text/javascript;base64,${Buffer.from(clientSource).toString('base64')}`);
test('cliente envia apenas pergunta, sem credenciais ou cache', async () => {
    const answer = await client.perguntarVisitante({ pergunta: 'Matrícula', endpoint: 'https://example.invalid/perguntarVisitante',
        fetchImpl: async (_url, request) => {
            assert.deepEqual(JSON.parse(request.body), { pergunta: 'Matrícula' });
            assert.deepEqual(request.headers, { 'Content-Type': 'application/json' });
            assert.equal(request.credentials, 'omit');
            assert.equal(request.cache, 'no-store');
            return { ok: true, json: async () => ({ resposta: 'Olá' }) };
        } });
    assert.equal(answer, 'Olá');
});
test('cliente expira e cancela a requisição, sem repetição automática', async () => {
    let requests = 0;
    await assert.rejects(client.perguntarVisitante({ pergunta: 'Oi', endpoint: 'https://example.invalid', timeoutMs: 5,
        fetchImpl: async (_url, { signal }) => {
            requests++;
            return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('ABORT'))));
        } }), /TIMEOUT/);
    assert.equal(requests, 1);
});

const pageSource = readFileSync(new URL('../public/Chat/chat.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replaceAll('import.meta.url', '"https://tcc-ia-d8891.web.app/Chat/chat.js"');
async function page({ answer = async () => 'Resposta', endpoint = 'https://example.invalid' } = {}) {
    const elements = new Map(), events = new Map(), navigations = [], requests = [];
    let onUser, onError;
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            children: [], value: '', disabled: false, hidden: false, textContent: '',
            append(child) { this.children.push(child); child.parent = this; },
            remove() { this.parent.children = this.parent.children.filter(child => child !== this); },
            replaceChildren() { this.children = []; }, setAttribute() {}, focus() {},
            querySelector: element, addEventListener: (event, cb) => events.set(`${id}:${event}`, cb),
        });
        return elements.get(id);
    }
    const context = vm.createContext({
        document: { querySelector: element, querySelectorAll: () => [], createElement: () => element(Symbol()) },
        window: { location: { replace: path => navigations.push(path) },
            addEventListener: (event, cb) => events.set(event, cb) },
        URL, AbortController,
        observarSessao: async (callback, failure) => { onUser = callback; onError = failure; return () => {}; },
        configuracaoVisitante: () => ({ endpoint }),
        perguntarVisitante: async options => { requests.push(options); return answer(options); },
    });
    vm.runInContext(pageSource, context);
    await new Promise(resolve => setImmediate(resolve));
    return { element, events, navigations, requests, user: value => onUser(value), fail: () => onError(),
        send: text => { element('#messageInput').value = text; return vm.runInContext('sendMessage(input.value)', context); } };
}

test('espera sessão restaurada; conta conectada redireciona sem enviar pergunta', async () => {
    const p = await page();
    await p.send('Não enviar');
    assert.equal(p.requests.length, 0);
    assert.equal(p.element('#messageInput').disabled, true);
    p.user({ uid: 'alice' });
    assert.deepEqual(p.navigations, ['https://tcc-ia-d8891.web.app/Logado/Home/home.html']);
    assert.equal(p.element('#messages').children.length, 0);
});

test('visitante conversa na página, novo chat e saída apagam tudo', async () => {
    const p = await page(); p.user(null);
    await p.send('Matrícula');
    assert.equal(p.navigations.length, 0);
    assert.equal(p.element('#messages').children.length, 2);
    assert.equal(p.element('#messageInput').value, '');
    p.events.get('#newChat:click')();
    assert.equal(p.element('#messages').children.length, 0);
    await p.send('Frequência');
    p.events.get('pagehide')();
    assert.equal(p.element('#messages').children.length, 0);
    assert.equal(p.element('#messageInput').value, '');
    assert.equal(p.element('#messageInput').disabled, true);
    p.events.get('pageshow')({ persisted: true });
    p.user(null);
    assert.equal(p.element('#messageInput').disabled, false);
});

test('envio duplicado e resposta após novo chat ou login são descartados', async () => {
    for (const action of ['new', 'login', 'leave']) {
        let release;
        const p = await page({ answer: () => new Promise(resolve => { release = resolve; }) });
        p.user(null);
        const pending = p.send('Pergunta');
        await p.send('Duplicada');
        assert.equal(p.requests.length, 1);
        if (action === 'new') p.events.get('#newChat:click')();
        else if (action === 'login') p.user({ uid: 'alice' });
        else p.events.get('pagehide')();
        assert.equal(p.requests[0].signal.aborted, true);
        release('Resposta antiga');
        await pending;
        assert.equal(p.element('#messages').children.length, 0);
    }
});

test('erro preserva pergunta para tentar novamente e não inventa resposta', async () => {
    const p = await page({ answer: async () => { throw Error('HTTP_429'); } });
    p.user(null); await p.send('Matrícula');
    assert.equal(p.element('#messages').children.length, 0);
    assert.equal(p.element('#messageInput').value, 'Matrícula');
    assert.match(p.element('#chatStatus').textContent, /um minuto/);
    assert.equal(p.element('#messageInput').disabled, false);
});

test('falha de sessão oferece recuperação sem assumir que o usuário está deslogado', async () => {
    const p = await page(); p.fail();
    assert.equal(p.element('#retrySession').hidden, false);
    assert.equal(p.element('#messageInput').disabled, true);
    await p.send('Não enviar');
    assert.equal(p.requests.length, 0);
});

test('página não importa persistência nem apresenta navegação da área logada', () => {
    const html = readFileSync(new URL('../public/Chat/chat.html', import.meta.url), 'utf8');
    assert.doesNotMatch(pageSource, /localStorage|sessionStorage|conversation-store|envio-pendente|firestore/);
    assert.doesNotMatch(html, /sidebar|Avisos\/|Serviços\/|Conversas\/|Configurações/);
    const landing = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    assert.match(landing, /href="(?:\.\/)?Chat\/chat.html"[^>]*>Ver como funciona/);
});

test('observador aguarda Firebase e não usa marcas antigas de login', async () => {
    const source = readFileSync(new URL('../public/Chat/sessao.js', import.meta.url), 'utf8')
        .replace('export async function', 'async function').replaceAll('import(', 'mockImport(');
    let callback, initialized = 0;
    const users = [];
    const app = {};
    const context = vm.createContext({
        location: { hostname: 'tcc-ia-d8891.web.app' },
        mockImport: async path => path.includes('firebase-app') ? {
            getApps: () => [], initializeApp: () => { initialized++; return app; },
        } : { getAuth: actual => { assert.equal(actual, app); return {}; },
            onAuthStateChanged: (_auth, cb) => { callback = cb; return () => {}; } },
    });
    vm.runInContext(source, context);
    await context.observarSessao(user => users.push(user));
    assert.equal(initialized, 1);
    assert.equal(users.length, 0, 'Não decide antes de restaurar a sessão');
    callback({ uid: 'sessao-restaurada' });
    callback(null);
    assert.deepEqual(users, [{ uid: 'sessao-restaurada' }, null]);
});

test('preview local sem emuladores nunca inicializa Firebase de produção', async () => {
    const source = readFileSync(new URL('../public/Chat/sessao.js', import.meta.url), 'utf8')
        .replace('export async function', 'async function').replaceAll('import(', 'mockImport(');
    const users = [];
    const context = vm.createContext({ location: { hostname: '127.0.0.1' },
        mockImport: async () => assert.fail('Preview acessou Firebase') });
    vm.runInContext(source, context);
    await context.observarSessao(user => users.push(user));
    assert.deepEqual(users, [null]);
});
