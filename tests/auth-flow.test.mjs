import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function page(kind, { valid = true, remember = true, local = true, appPresent = true } = {}) {
    const calls = [];
    const events = new Map();
    const control = (key) => ({ disabled: false, checked: remember, hidden: true,
        addEventListener: (event, callback) => events.set(`${key}:${event}`, callback),
        focus() {}, value: '' });
    const submit = control('submit');
    const form = control('form');
    for (const [field, value] of Object.entries({ nome: 'Aluno Fixture', email: 'fixture@example.invalid',
        identifier: 'fixture@example.invalid', password: 'fixture-only', 'confirm-password': 'fixture-only' }))
        form[field] = { value, focus() {} };
    form.checkValidity = () => valid;
    form.reportValidity = () => calls.push('validation');
    form.reset = () => calls.push('reset');
    form.querySelector = () => submit;
    const nodes = { '.login-form': form, '.google-button': control('google'),
        '#form-message': control('message'), '#remember': control('remember'),
        'a[href="#forgot-password"]': control('forgot') };
    const auth = { currentUser: null };
    const app = { options: { projectId: 'demo-sylvinho-render-poc' } };
    const context = {
        document: { querySelector: selector => nodes[selector] },
        location: { hostname: '127.0.0.1' }, window: { location: { href: '' } },
        console: { error() {} },
        getApps: () => appPresent ? [app] : [], getApp: () => app,
        initializeApp: () => { assert.fail('fallback para Firebase real proibido'); },
        getAuth: () => auth, getFirestore: () => ({}),
        createUserWithEmailAndPassword: async () => {
            calls.push('signup'); auth.currentUser = { uid: 'fixture-uid' };
            return { user: auth.currentUser };
        },
        updateProfile: async (_, profile) => calls.push(['displayName', profile]),
        doc: (_, ...path) => path.join('/'), serverTimestamp: () => 'timestamp',
        setDoc: async (path, profile) => calls.push(['profile', path, profile]),
        signOut: async () => { calls.push('signout'); auth.currentUser = null; },
        setPersistence: async (_, persistence) => calls.push(['persistence', persistence]),
        browserLocalPersistence: 'local', browserSessionPersistence: 'session',
        signInWithEmailAndPassword: async () => { calls.push('signin'); auth.currentUser = { uid: 'fixture-uid' }; },
        entrarNaAreaLogada: async user => calls.push(['home', user.uid]),
        sendPasswordResetEmail: async (_, email) => calls.push(['resetPassword', email]),
    };
    if (local) context.__LOCAL_E2E__ = { projectId: app.options.projectId };
    const file = kind === 'signup' ? 'Criar-Conta/cadastro.js' : 'Login/login.js';
    const source = readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')
        .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
    const run = () => vm.runInNewContext(source, context);
    return { run, auth, calls, context, form, nodes,
        submit: () => events.get('form:submit')({ preventDefault() {} }),
        forgot: () => events.get('forgot:click')({ preventDefault() {} }) };
}

test('cadastro salva perfil sem privilégio e encerra sessão antes de encaminhar ao Login', async () => {
    const p = page('signup'); p.run(); await p.submit();
    const profile = p.calls.find(c => c[0] === 'profile');
    assert.equal(profile[1], 'users/fixture-uid');
    assert.deepEqual(Object.keys(profile[2]).sort(), ['createdAt', 'email', 'nome', 'uid']);
    assert.ok(p.calls.indexOf('signout') > p.calls.indexOf(profile));
    assert.equal(p.auth.currentUser, null);
    assert.equal(p.context.window.location.href, '../Login/login.html');
});
test('cadastro inválido não cria conta nem perfil', async () => {
    const p = page('signup', { valid: false }); p.run(); await p.submit();
    assert.deepEqual(p.calls, ['validation']);
});
test('confirmação diferente não cria conta', async () => {
    const p = page('signup'); p.run(); p.form['confirm-password'].value = 'different'; await p.submit();
    assert.equal(p.calls.length, 0);
    assert.match(p.nodes['#form-message'].textContent, /não coincidem/);
});
for (const remember of [true, false]) test(`login aplica persistência ${remember ? 'local' : 'de sessão'} antes de autenticar`, async () => {
    const p = page('login', { remember }); p.run(); await p.submit();
    assert.equal(p.calls[0][0], 'persistence');
    assert.equal(p.calls[0][1], remember ? 'local' : 'session');
    assert.equal(p.calls[1], 'signin');
    assert.equal(p.calls[2][1], p.auth.currentUser.uid);
});
test('recuperação utiliza e-mail do formulário sem exigir login', async () => {
    const p = page('login'); p.run(); await p.forgot();
    assert.equal(p.calls[0][0], 'resetPassword');
    assert.equal(p.calls[0][1], 'fixture@example.invalid');
    assert.equal(p.auth.currentUser, null);
});
for (const kind of ['signup', 'login']) test(`${kind} recusa loopback sem bootstrap e sem aplicativo emulado`, () => {
    assert.throws(page(kind, { local: false }).run, /LOCAL_EMULATORS_REQUIRED/);
    assert.throws(page(kind, { appPresent: false }).run, /LOCAL_EMULATORS_REQUIRED/);
});
