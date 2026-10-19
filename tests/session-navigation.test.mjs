import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

async function page(kind, { local = true, demo = true, appPresent = true } = {}) {
    const elements = new Map(), calls = [], watchers = [];
    const node = id => {
        if (!elements.has(id)) elements.set(id, {
            children: [], dataset: {}, value: '', disabled: false,
            classList: { add() {}, remove() {}, toggle() {} },
            addEventListener() {}, setAttribute() {}, focus() {}, close() {},
            querySelector: node, append(...items) { this.children.push(...items); },
            replaceChildren() { this.children = []; },
        });
        return elements.get(id);
    };
    let callback;
    const app = { options: { projectId: demo ? 'demo-sylvinho-render-poc' : 'other-project' } };
    const appSDK = { getApps: () => appPresent ? [app] : [], getApp: () => app,
        initializeApp() { assert.fail('Inicialização real proibida no teste'); } };
    const modules = {
        'firebase-app': appSDK,
        'firebase-auth': { getAuth: () => ({}), onAuthStateChanged: (_, cb) => { callback = cb; } },
        'firebase-firestore': { getFirestore: () => ({}), doc: (_, ...path) => path.join('/'),
            setDoc: async path => calls.push(['profile', path]) },
        'envio-pendente.js': { carregarEnvioPendente: () => null },
        'acesso.js': { verificarAdministrador: async () => false, paginaConfiguracoes: () => 'settings' },
        'conversation-store.js': { createConversationStore: async (_, uid) => {
            calls.push(['store', uid]);
            return {
                open: async id => { calls.push(['open', uid, id]); return { mensagens: [{ texto: 'Histórico de ' + uid, remetente: 'bot' }] }; },
                watch: (render) => { watchers.push({ uid, render }); return () => calls.push(['unsubscribe', uid]); },
            };
        } },
    };
    const context = vm.createContext({
        document: { querySelector: node, querySelectorAll: () => [], createElement: () => node(Symbol()) },
        window: { location: { hostname: '127.0.0.1', search: '?conversa=abcdefghijklmnopqrst',
            replace: path => calls.push(['redirect', path]) }, etecTheme: { useAccount: uid => calls.push(['theme', uid]) } },
        URLSearchParams, console: { error() {} },
        mockImport: async path => {
            const name = Object.keys(modules).find(key => path.includes(key));
            assert.ok(name, 'Import inesperado: ' + path); return modules[name];
        },
    });
    if (local) context.__LOCAL_E2E__ = true;
    const path = kind === 'home' ? 'Home/home.js' : 'Conversas/conversas.js';
    const source = readFileSync(new URL('../public/Logado/' + path, import.meta.url), 'utf8')
        .replaceAll('import(', 'mockImport(').replace('loadAuthenticatedProfile();', '').replace(/start\(\);\s*$/, '');
    vm.runInContext(source, context);
    await vm.runInContext(kind === 'home' ? 'loadAuthenticatedProfile()' : 'start()', context);
    return { calls, node, watchers, callback,
        change: uid => callback(uid ? { uid, displayName: uid, providerData: [] } : null) };
}

for (const kind of ['home', 'history']) {
    test(`${kind}: visitante é redirecionado antes de consultar conversas`, async () => {
        const p = await page(kind); await p.change(null);
        assert.deepEqual(p.calls, [['redirect', '../../Login/login.html']]);
    });
    test(`${kind}: restaura UID e tema, troca conta sem reutilizar store anterior`, async () => {
        const p = await page(kind); await p.change('aluno-a'); await p.change('aluno-b');
        assert.deepEqual(p.calls.filter(c => c[0] === 'store'), [['store', 'aluno-a'], ['store', 'aluno-b']]);
        assert.deepEqual(p.calls.filter(c => c[0] === 'theme'), [['theme', 'aluno-a'], ['theme', 'aluno-b']]);
        if (kind === 'home') {
            assert.deepEqual(p.calls.filter(c => c[0] === 'profile'), [['profile', 'users/aluno-a'], ['profile', 'users/aluno-b']]);
            assert.equal(p.node('#messages').children.length, 1);
            assert.equal(p.node('#messages').children[0].children.at(-1).textContent, 'Histórico de aluno-b');
        } else {
            assert.ok(p.calls.some(c => c[0] === 'unsubscribe' && c[1] === 'aluno-a'));
            p.watchers.at(-1).render([{ id: 'abcdefghijklmnopqrst', titulo: 'Conversa' }]);
            assert.equal(p.node('#conversationList').children[0].children[0].href, '../Home/home.html?conversa=abcdefghijklmnopqrst');
        }
        await p.change(null);
        assert.deepEqual(p.calls.at(-1), ['redirect', '../../Login/login.html']);
        assert.equal(p.node(kind === 'home' ? '#messages' : '#conversationList').children.length, 0);
    });
    for (const options of [{ local: false }, { demo: false }, { appPresent: false }])
        test(`${kind}: bloqueia ambiente local inseguro ${JSON.stringify(options)}`, async () => {
            const p = await page(kind, options);
            assert.equal(p.callback, undefined);
            assert.equal(p.calls.length, 0);
        });
}

test('store de histórico usa sempre users/UID/conversas, inclusive para o mesmo ID', async () => {
    const calls = [];
    const sdk = { getFirestore: () => ({}), collection: (_, ...path) => path.join('/'),
        doc: (path, id) => path + '/' + id, getDocFromServer: async path => {
            calls.push(path); return { exists: () => true, data: () => ({ mensagens: [] }) };
        } };
    const source = readFileSync(new URL('../public/Logado/Conversas/conversation-store.js', import.meta.url), 'utf8')
        .replace('export async function', 'async function').replaceAll('import(', 'mockImport(');
    const context = vm.createContext({ mockImport: async () => sdk });
    vm.runInContext(source, context);
    for (const uid of ['aluno-a', 'aluno-b']) {
        const store = await context.createConversationStore({}, uid);
        await store.open('abcdefghijklmnopqrst');
        await assert.rejects(store.open('../outra-conta'), /Conversa inválida/);
    }
    assert.deepEqual(calls, ['users/aluno-a/conversas/abcdefghijklmnopqrst', 'users/aluno-b/conversas/abcdefghijklmnopqrst']);
});
