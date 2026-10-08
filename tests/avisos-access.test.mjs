// Testa a sessão e as consultas reais da página com o SDK e o DOM simulados.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
    new URL('../public/Logado/Avisos/avisos.js', import.meta.url),
    'utf8',
).replaceAll('import(', 'mockImport(');
const elements = new Map();
const get = (id) => {
    if (!elements.has(id))
        elements.set(id, {
            hidden: false,
            textContent: '',
            dataset: {},
            addEventListener() {},
            setAttribute() {},
            replaceChildren() {},
        });
    return elements.get(id);
};
const subscriptions = [];
const auth = { currentUser: null };
let authCallback;
let initialized = 0;
let disposed = 0;
const modules = {
    'firebase-app': { getApps: () => [], initializeApp: () => ({}) },
    'firebase-auth': {
        getAuth: () => auth,
        onAuthStateChanged: (_, callback) => {
            authCallback = callback;
            return () => {};
        },
    },
    'firebase-firestore': {
        getFirestore: () => ({}),
        doc: (_, ...path) => path.join('/'),
        collection: (_, path) => ({ collection: path }),
        where: (...filter) => filter,
        query: (collection, filter) => ({ ...collection, filter }),
        onSnapshot: (target, _, callback, error) => {
            const subscription = { target, callback, error, stopped: false };
            subscriptions.push(subscription);
            return () => {
                subscription.stopped = true;
            };
        },
    },
    'acesso.js': { paginaConfiguracoes: (admin) => (admin ? 'ADMIN' : 'ALUNO') },
    'avisos-admin.js': {
        iniciarGestaoAvisos: () => {
            initialized++;
            return {
                dispose: () => {
                    disposed++;
                },
                updateNotices() {},
            };
        },
    },
};
vm.runInNewContext(source, {
    window: { etecTheme: { useAccount() {} } },
    document: { querySelector: get, createDocumentFragment: () => ({ append() {} }) },
    console,
    mockImport: async (path) => modules[Object.keys(modules).find((name) => path.includes(name))],
});
await new Promise((resolve) => setImmediate(resolve));
const user = { uid: 'admin' };
auth.currentUser = user;
authCallback(user);
const role = subscriptions.at(-1);
const roleSnapshot = (active, fromCache = false) => ({
    metadata: { fromCache },
    exists: () => true,
    data: () => ({ ativo: active }),
});
role.callback(roleSnapshot(true, true));
assert.equal(initialized, 0, 'cache nunca concede acesso administrativo');
role.callback(roleSnapshot(true));
assert.equal(initialized, 1);
assert.equal(get('#settings-link').href, 'ADMIN');
const adminQuery = subscriptions.at(-1);
assert.equal(adminQuery.target.collection, 'avisos');
assert.equal(adminQuery.target.filter, undefined, 'administrador consulta publicados e rascunhos');
role.callback(roleSnapshot(false));
assert.equal(disposed, 1, 'revogação remove os controles e confirmações');
assert.equal(adminQuery.stopped, true);
assert.equal(get('#settings-link').href, 'ALUNO');
const studentQuery = subscriptions.at(-1);
assert.deepEqual(studentQuery.target.filter, ['publicado', '==', true]);
adminQuery.callback({ metadata: { fromCache: false }, docs: [] });
assert.equal(
    get('#status').textContent,
    'Carregando avisos...',
    'ignora resposta da consulta antiga',
);
studentQuery.callback({ metadata: { fromCache: false }, docs: [] });
assert.equal(get('#status').textContent, 'Nenhum aviso publicado no momento.');
auth.currentUser = null;
authCallback(null);
assert.equal(role.stopped, true);
assert.equal(studentQuery.stopped, true);
assert.equal(get('#login').hidden, false);
role.callback(roleSnapshot(true));
assert.equal(initialized, 1, 'resposta de sessão encerrada não libera controles');
auth.currentUser = user;
authCallback(user);
subscriptions.at(-1).error({ code: 'unavailable' });
assert.equal(initialized, 1);
assert.equal(get('#retry').hidden, false, 'falha de consulta do cargo permite tentar novamente');
console.log(
    'OK: cargo confirmado no servidor, consultas por permissão, revogação, saída e falha de conexão.',
);
