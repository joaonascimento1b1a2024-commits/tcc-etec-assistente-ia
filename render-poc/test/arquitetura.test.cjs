'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { lerConfiguracao, validarConfiguracao, DEMO_PROJECT } = require('../config.cjs');
const { criarDependencias, criarFabricaDependencias, MOCK_RESPONSE } = require('../dependencias.cjs');
const { criarServidor } = require('../server.cjs');

const ORIGINS = ['https://tcc-ia-d8891.web.app', 'https://tcc-ia-d8891.firebaseapp.com'];
const emulatorEnv = () => ({
    SYLVINHO_POC_MODE: 'emulator', GCLOUD_PROJECT: DEMO_PROJECT,
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199', FIRESTORE_EMULATOR_HOST: 'localhost:8180',
});

function sdkMock(existing = []) {
    const calls = [];
    const app = { name: 'sylvinho-render-poc-emulator', options: { projectId: DEMO_PROJECT } };
    const auth = { verifyIdToken: async () => ({ uid: 'fixture' }) };
    const firestore = {};
    const modules = {
        'firebase-admin/app': {
            getApps: () => existing,
            initializeApp(options, name) { calls.push({ options, name }); existing.push(app); return app; },
        },
        'firebase-admin/auth': { getAuth(value) { assert.equal(value.options.projectId, DEMO_PROJECT); return auth; } },
        'firebase-admin/firestore': {
            getFirestore(value) { assert.equal(value.options.projectId, DEMO_PROJECT); return firestore; },
            FieldValue: { serverTimestamp: () => 'MOCK_TIMESTAMP' },
        },
    };
    return { app, auth, firestore, calls, carregar(name) { assert.ok(modules[name]); return modules[name]; } };
}

test('configuracao padrao preserva health, porta e bind e nao habilita producao', () => {
    assert.deepEqual(lerConfiguracao({}), { mode: 'health', origins: '', port: 10000, host: '0.0.0.0' });
    for (const mode of ['production', 'auth', 'firestore', 'gemini'])
        assert.throws(() => lerConfiguracao({ SYLVINHO_POC_MODE: mode }), /POC_MODE_INVALID/);
});

test('configuracao aceita as origens atuais e porta fornecida pelo host', () => {
    const config = lerConfiguracao({ RENDER: 'true', PORT: '12345', ASSISTENTE_CORS_ORIGINS: ORIGINS.join(',') });
    assert.equal(config.port, 12345);
    assert.equal(config.mode, 'health');
    assert.equal(config.origins, ORIGINS.join(','));
});

test('configuracao invalida de porta CORS e host falha antes de criar servidor', () => {
    for (const PORT of ['0', '-1', '65536', 'NaN', '', '1.5'])
        assert.throws(() => lerConfiguracao({ PORT }), /PORT_INVALID/);
    for (const origin of ['*', 'http://example.invalid', 'https://example.invalid/path', 'https://example.invalid/'])
        assert.throws(() => lerConfiguracao({ ASSISTENTE_CORS_ORIGINS: origin }));
    const valid = lerConfiguracao({});
    for (const config of [{ ...valid, mode: 'production' }, { ...valid, port: 0 },
        { ...valid, host: 'example.invalid' }, { ...valid, origins: '*' }])
        assert.throws(() => criarServidor({ config, obterDependencias: () => assert.fail('Nao inicializar') }));
});

test('configuracao e copia validada sao imutaveis e descartam campos extras', () => {
    const input = { ...lerConfiguracao({}), extra: 'nao propagar' };
    const config = validarConfiguracao(input);
    input.mode = 'emulator';
    assert.equal(config.mode, 'health');
    assert.equal(config.extra, undefined);
    assert.throws(() => { config.mode = 'emulator'; }, TypeError);
    assert.throws(() => validarConfiguracao(null), /POC_MODE_INVALID/);
    assert.throws(() => validarConfiguracao({ ...config, origins: 123 }), /INVALID_CORS_CONFIGURATION/);
});

test('emulator local exige projeto demo e ambos hosts loopback com portas validas', () => {
    assert.equal(lerConfiguracao(emulatorEnv()).host, '127.0.0.1');
    for (const change of [{ GCLOUD_PROJECT: 'tcc-ia-d8891' }, { GOOGLE_CLOUD_PROJECT: 'outro-projeto' },
        { FIREBASE_AUTH_EMULATOR_HOST: '' }, { FIRESTORE_EMULATOR_HOST: undefined },
        { FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' },
        { FIRESTORE_EMULATOR_HOST: '127.0.0.1:0' }, { FIRESTORE_EMULATOR_HOST: 'localhost:65536' },
        { FIREBASE_AUTH_EMULATOR_HOST: 'http://127.0.0.1:9199' }])
        assert.throws(() => lerConfiguracao({ ...emulatorEnv(), ...change }), /LOCAL_EMULATORS_REQUIRED/);
});

test('Render rejeita emulator mesmo com projeto demo e hosts locais', () => {
    for (const hosted of [{ RENDER: 'true' }, { RENDER_SERVICE_ID: 'srv-fixture' },
        { RENDER_INSTANCE_ID: 'instance-fixture' }, { RENDER_EXTERNAL_HOSTNAME: 'fixture.onrender.com' },
        { RENDER: 'false', RENDER_SERVICE_ID: 'srv-fixture' }])
        assert.throws(() => lerConfiguracao({ ...emulatorEnv(), ...hosted }), /LOCAL_EMULATORS_REQUIRED/);
    for (const RENDER of ['TRUE', '', true, '1'])
        assert.throws(() => lerConfiguracao({ RENDER }), /RENDER_CONFIGURATION_INVALID/);
});

test('Render health rejeita variaveis de emuladores inclusive vazias', () => {
    for (const name of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST',
        'FIREBASE_STORAGE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB'])
        for (const value of ['127.0.0.1:9199', ''])
            assert.throws(() => lerConfiguracao({ RENDER: 'true', [name]: value }), /EMULATORS_FORBIDDEN_ON_RENDER/);
});

test('health nao carrega SDK nem consulta adapter de ambiente e rejeita token', async () => {
    const deps = criarDependencias(lerConfiguracao({}), {
        lerAmbiente: () => assert.fail('Ambiente nao deve ser consultado'),
        carregar: () => assert.fail('SDK nao deve ser carregado'),
    });
    await assert.rejects(deps.auth.verifyIdToken('ficticio'), /AUTH_UNAVAILABLE/);
    assert.deepEqual(deps.firestore, {});
    assert.throws(() => deps.serverTimestamp(), /FIRESTORE_UNAVAILABLE/);
    assert.equal(await deps.gerarResposta(), MOCK_RESPONSE);
});

test('fabrica lazy reutiliza dependencias e inicializa somente quando solicitada', () => {
    let initialized = 0;
    const deps = { marker: 'mock' };
    const get = criarFabricaDependencias(lerConfiguracao({}), {
        obterDependencias() { initialized++; return deps; },
    });
    assert.equal(initialized, 0);
    assert.equal(get(), deps);
    assert.equal(get(), deps);
    assert.equal(initialized, 1);
});

test('falha de inicializacao nao e armazenada como dependencia valida', () => {
    let attempts = 0;
    const deps = {};
    const get = criarFabricaDependencias(lerConfiguracao({}), {
        obterDependencias() { if (++attempts === 1) throw new Error('MOCK_FAILURE'); return deps; },
    });
    assert.throws(get, /MOCK_FAILURE/);
    assert.equal(get(), deps);
    assert.equal(attempts, 2);
});

test('emulator inicializa app demo uma vez por fabrica com SDK inteiramente mockado', async () => {
    const env = emulatorEnv();
    const sdk = sdkMock();
    const get = criarFabricaDependencias(lerConfiguracao(env), { lerAmbiente: () => env, carregar: sdk.carregar });
    assert.equal(sdk.calls.length, 0);
    const deps = get();
    assert.equal(get(), deps);
    assert.deepEqual(sdk.calls, [{ options: { projectId: DEMO_PROJECT }, name: sdk.app.name }]);
    assert.equal(deps.auth, sdk.auth);
    assert.equal(deps.firestore, sdk.firestore);
    assert.equal(deps.serverTimestamp(), 'MOCK_TIMESTAMP');
    assert.equal(await deps.gerarResposta(), MOCK_RESPONSE);
});

test('emulator reutiliza somente app nomeado com projeto demo correto', () => {
    const env = emulatorEnv();
    const sdk = sdkMock([{ name: 'sylvinho-render-poc-emulator', options: { projectId: DEMO_PROJECT } }]);
    const deps = criarDependencias(lerConfiguracao(env), { lerAmbiente: () => env, carregar: sdk.carregar });
    assert.equal(deps.auth, sdk.auth);
    assert.equal(sdk.calls.length, 0);
    const wrong = sdkMock([{ name: sdk.app.name, options: { projectId: 'outro-projeto' } }]);
    assert.throws(() => criarDependencias(lerConfiguracao(env), {
        lerAmbiente: () => env, carregar: wrong.carregar,
    }), /LOCAL_EMULATORS_REQUIRED/);
});

test('fabrica revalida ambiente real antes de qualquer carga de SDK emulator', () => {
    const config = lerConfiguracao(emulatorEnv());
    for (const env of [{}, { ...emulatorEnv(), RENDER: 'true' },
        { ...emulatorEnv(), FIRESTORE_EMULATOR_HOST: 'remote.invalid:443' }]) {
        const get = criarFabricaDependencias(config, {
            lerAmbiente: () => env, carregar: () => assert.fail('SDK nao deve ser carregado'),
        });
        assert.throws(get, /LOCAL_EMULATORS_REQUIRED/);
    }
});

test('exports anteriores do servidor continuam compativeis', () => {
    const previous = require('../server.cjs');
    assert.equal(previous.lerConfiguracao, lerConfiguracao);
    assert.equal(previous.criarDependencias, criarDependencias);
    assert.equal(previous.DEMO_PROJECT, DEMO_PROJECT);
    assert.equal(previous.MOCK_RESPONSE, MOCK_RESPONSE);
});

test('import e fabrica health funcionam com SDKs bloqueados e rede externa bloqueada', () => {
    const code = String.raw`
        require('./local-e2e/network-guard.cjs');
        const Module = require('node:module');
        const original = Module._load;
        Module._load = function(name, ...args) {
            if (/^(firebase-admin|firebase-functions|@google\/genai)(\/|$)/.test(name))
                throw new Error('SDK_FORBIDDEN');
            return original.call(this, name, ...args);
        };
        const { lerConfiguracao, criarDependencias } = require('./render-poc/server.cjs');
        const config = lerConfiguracao({ RENDER: 'true' });
        const deps = criarDependencias(config);
        deps.auth.verifyIdToken('ficticio').then(() => { process.exitCode = 1; }, (error) => {
            if (error.message !== 'AUTH_UNAVAILABLE') process.exitCode = 1;
            else console.log('HEALTH_ISOLATED');
        });
    `;
    assert.equal(execFileSync(process.execPath, ['-e', code], {
        cwd: resolve(__dirname, '../..'), encoding: 'utf8',
    }).trim(), 'HEALTH_ISOLATED');
});

test('health não expõe assistente nem preflight; somente GET health permanece público', async (t) => {
    const server = criarServidor({ config: lerConfiguracao({ RENDER: 'true', ASSISTENTE_CORS_ORIGINS: ORIGINS.join(',') }) });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    t.after(() => new Promise((done) => { server.close(done); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', service: 'sylvinho-backend' });
    for (const Origin of ORIGINS) {
        const preflight = await fetch(`${base}/perguntarAssistente`, { method: 'OPTIONS', headers: {
            Origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization, Content-Type',
        } });
        assert.equal(preflight.status, 404);
        assert.equal(preflight.headers.get('access-control-allow-origin'), null);
        const response = await fetch(`${base}/perguntarAssistente`, { method: 'POST', headers: {
            Origin, Authorization: 'Bearer ficticio', 'Content-Type': 'application/json',
        }, body: JSON.stringify({ pergunta: 'matricula', conversationId: 'AbCdEfGhIjKlMnOpQrSt' }) });
        assert.equal(response.status, 404);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
        assert.doesNotMatch(await response.text(), /ficticio|stack/);
    }
    const forbidden = await fetch(`${base}/perguntarAssistente`, { method: 'OPTIONS', headers: {
        Origin: 'https://intruso.invalid', 'Access-Control-Request-Method': 'POST',
    } });
    assert.equal(forbidden.status, 404);
    assert.equal(forbidden.headers.get('access-control-allow-origin'), null);
});
