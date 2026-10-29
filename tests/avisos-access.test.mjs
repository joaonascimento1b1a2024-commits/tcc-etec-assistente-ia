// Testa a sessão e as consultas reais da página com o SDK e o DOM simulados.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
    new URL('../public/Logado/Avisos/avisos.js', import.meta.url),
    'utf8',
).replaceAll('import(', 'mockImport(');
// Usa o modo declarado na pagina publicada, nao um DOM que omite suas flags.
const html = readFileSync(new URL('../public/Logado/Avisos/avisos.html', import.meta.url), 'utf8');
const rootTag = html.match(/<html\b[^>]*>/)[0];
const demoAcademica = rootTag.match(/data-demo-academica="([^"]*)"/)?.[1];
function node() {
    return { children: [], hidden: false, textContent: '', dataset: {},
        classList: { add() {} }, setAttribute() {},
        append(child) { this.children.push(child); } };
}
function card() {
    const nodes = new Map();
    return { querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector, node());
        return nodes.get(selector);
    } };
}
const elements = new Map();
const get = (id) => {
    if (!elements.has(id))
        elements.set(id, {
            hidden: false,
            textContent: '',
            dataset: {},
            addEventListener() {},
            setAttribute() {},
            children: [],
            replaceChildren(...children) { this.children = children; },
        });
    return elements.get(id);
};
get('#noticeTemplate').content = { cloneNode: card };
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
                prepareCard() {},
            };
        },
    },
};
vm.runInNewContext(source, {
    window: { etecTheme: { useAccount() {} } },
    document: { documentElement: { dataset: { demoAcademica } }, querySelector: get,
        createDocumentFragment: node, createElement: node, createElementNS: node },
    console,
    mockImport: async (path) => modules[Object.keys(modules).find((name) => path.includes(name))],
});
await new Promise((resolve) => setImmediate(resolve));
assert.equal(typeof authCallback, 'function', 'a pagina de Avisos deve iniciar a consulta autenticada, sem modo prototipo');
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
const publicado = { titulo: 'Aviso publicado de teste', descricao: 'Primeira linha\nSegunda linha',
    categoria: 'geral', publicado: true, criadoEm: { toMillis: () => 100 } };
const rascunho = { ...publicado, titulo: 'Rascunho de teste', publicado: false };
const snapshot = (items) => ({ metadata: { fromCache: false },
    docs: items.map((data, i) => ({ id: String(i), data: () => data })) });
const cards = () => get('#noticeList').children[0].children;
adminQuery.callback(snapshot([publicado, rascunho]));
assert.equal(cards().length, 2);
assert.equal(cards()[0].querySelector('h2').textContent, publicado.titulo);
assert.equal(cards()[0].querySelector('.notice-copy p').textContent, publicado.descricao);
assert.equal(cards()[0].querySelector('.draft-label').hidden, true);
assert.equal(cards()[1].querySelector('.draft-label').hidden, false);
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
studentQuery.callback(snapshot([publicado]));
assert.equal(cards().length, 1);
assert.equal(cards()[0].querySelector('h2').textContent, publicado.titulo);
assert.equal(get('#status').hidden, true);
const novo = { ...publicado, titulo: 'Novo aviso de teste', criadoEm: { toMillis: () => 200 } };
studentQuery.callback(snapshot([publicado, novo]));
assert.equal(cards().length, 2, 'novo aviso aparece pela atualizacao em tempo real');
assert.equal(cards()[0].querySelector('h2').textContent, novo.titulo, 'mais recente vem primeiro');
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
