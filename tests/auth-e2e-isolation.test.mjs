import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

async function bootstrap(origin, path = '/Login/login.html') {
    const calls = [];
    const source = read('local-e2e/auth-bootstrap.js')
        .replace(/^import[^\n]*\n/gm, '').replaceAll('import(', 'loadModule(');
    const context = vm.createContext({
        location: { origin, pathname: path },
        initializeApp: options => { calls.push(['app', options.projectId]); return { options }; },
        getAuth: () => ({ currentUser: null, authStateReady: async () => calls.push(['ready']) }),
        getFirestore: () => ({}),
        connectAuthEmulator: (_, url) => calls.push(['auth', url]),
        connectFirestoreEmulator: (_, host, port) => calls.push(['firestore', host, port]),
        loadModule: async path => calls.push(['module', path]),
    });
    await vm.runInContext('(async () => {' + source + '})()', context);
    return { calls, context };
}

test('bootstrap recusa origem diferente antes de inicializar Firebase', async () => {
    await assert.rejects(bootstrap('https://example.invalid'), /LOCAL_ORIGIN_REQUIRED/);
});
test('bootstrap conecta SDKs emulados antes de restaurar sessão e carregar Login', async () => {
    const { calls, context } = await bootstrap('http://127.0.0.1:5000');
    assert.deepEqual(calls, [['app', 'demo-sylvinho-render-poc'], ['auth', 'http://127.0.0.1:9099'],
        ['firestore', '127.0.0.1', 8080], ['ready'], ['module', '../../Login/login.js']]);
    assert.equal(context.__LOCAL_E2E__.uid, null);
});
test('bootstrap não autentica visitantes e recusa páginas fora do roteiro', async () => {
    assert.doesNotMatch(read('local-e2e/auth-bootstrap.js'), /signInAnonymously|signInWith|service_account/);
    await assert.rejects(bootstrap('http://127.0.0.1:5000', '/outra.html'), /LOCAL_PAGE_REQUIRED/);
});
test('runner usa somente Auth, Firestore e Hosting com demo, perfil isolado e guarda de rede', () => {
    const source = read('local-e2e/auth-run.mjs');
    assert.match(source, /const project = 'demo-sylvinho-render-poc'/);
    assert.match(source, /'auth,firestore,hosting'/);
    assert.match(source, /no-credentials\.json/);
    assert.match(source, /network-guard\.cjs/);
    assert.doesNotMatch(source, /conhecimento|perguntarAssistente|prepararArtefatos/);
    assert.match(source, /context\.route\('\*\*\/\*'/);
});
test('staging de autenticação protege HTML com CSP local e não configura Functions', () => {
    const source = read('local-e2e/prepare-auth.mjs');
    assert.match(source, /connect-src http:\/\/127\.0\.0\.1:9099 http:\/\/127\.0\.0\.1:8080;/);
    assert.doesNotMatch(source, /functions:|downloadIfNecessary|writeFileSync\([^\n]*\.env/);
    assert.match(source, /ui: \{ enabled: false \}/);
});
