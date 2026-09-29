// Testa a lógica real das configurações com sessão/DOM simulados, sem rede.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(
    new URL('../public/Logado/Configurações Aluno/configAl.js', import.meta.url),
    'utf8',
).replaceAll('import(', 'mockImport(');

async function scenario({ role, page, user = true, error = false }) {
    const elements = new Map();
    const get = (id) => {
        if (!elements.has(id))
            elements.set(id, {
                hidden: false,
                disabled: false,
                dataset: {},
                textContent: '',
                value: '',
                addEventListener() {},
            });
        return elements.get(id);
    };
    let authCallback,
        roleCallback,
        redirect,
        initialized = 0,
        disposed = 0;
    const sdk = {
        getFirestore: () => ({}),
        doc: (_, ...path) => path.join('/'),
        getDocFromServer: async () => ({
            data: () => ({ preferencias: { tema: 'dark', avisosEmail: false } }),
        }),
        onSnapshot: (_, __, callback) => {
            roleCallback = callback;
            return () => {};
        },
    };
    const modules = {
        'firebase-app': { getApps: () => [], initializeApp: () => ({}) },
        'firebase-auth': {
            getAuth: () => ({}),
            onAuthStateChanged: (_, callback) => {
                authCallback = callback;
                return () => {};
            },
        },
        'firebase-firestore': sdk,
        'acesso.js': {
            verificarAdministrador: async () => {
                if (error) throw new Error('offline');
                return role;
            },
            paginaConfiguracoes: (admin) => (admin ? 'ADMIN' : 'ALUNO'),
        },
        'admin.js': {
            iniciarAdministracao: () => {
                initialized++;
                return {
                    dispose() {
                        disposed++;
                    },
                };
            },
        },
    };
    vm.runInNewContext(source, {
        document: {
            getElementById: get,
            body: { dataset: { role: page } },
            documentElement: { dataset: {} },
        },
        window: {
            location: {
                replace(url) {
                    redirect = url;
                },
            },
        },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        console,
        setTimeout,
        clearTimeout,
        mockImport: async (path) => {
            const key = Object.keys(modules).find((name) => path.includes(name));
            assert.ok(key, `Módulo inesperado: ${path}`);
            return modules[key];
        },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(authCallback);
    await authCallback(
        user
            ? { uid: 'teste', email: 'teste@example.test', displayName: 'Teste', providerData: [] }
            : null,
    );
    await new Promise((resolve) => setImmediate(resolve));
    return {
        get,
        initialized,
        get redirect() {
            return redirect;
        },
        get disposed() {
            return disposed;
        },
        changeRole(value) {
            roleCallback({
                metadata: { fromCache: false },
                exists: () => value,
                data: () => ({ ativo: value }),
            });
        },
    };
}

const aluno = await scenario({ role: false, page: 'aluno' });
assert.equal(aluno.get('account-settings').hidden, false);
assert.equal(aluno.initialized, 0);
const admin = await scenario({ role: true, page: 'admin' });
assert.equal(admin.get('account-settings').hidden, false);
assert.equal(admin.initialized, 1);
assert.equal((await scenario({ role: false, page: 'admin' })).redirect, 'ALUNO');
assert.equal((await scenario({ role: true, page: 'aluno' })).redirect, 'ADMIN');
assert.equal((await scenario({ page: 'admin', user: false })).redirect, '../../Login/login.html');
const failed = await scenario({ role: true, page: 'admin', error: true });
assert.equal(failed.get('account-settings').hidden, true);
assert.equal(failed.get('retry').hidden, false);
assert.equal(failed.initialized, 0);
admin.changeRole(false);
assert.equal(admin.redirect, 'ALUNO');
assert.equal(admin.get('account-settings').hidden, true);
assert.equal(admin.disposed, 1);
aluno.changeRole(true);
assert.equal(aluno.redirect, 'ADMIN');
console.log(
    'OK: aluno, administrador, URLs trocadas, visitante, falha de conexão, promoção e revogação em tempo real.',
);
