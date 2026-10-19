import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const original = (path) => execFileSync('git', ['show', `HEAD:${path}`], { cwd: root, encoding: 'utf8' });
function configuration(source) {
    const sandbox = { module: { exports: {} } };
    vm.runInNewContext(source, sandbox);
    return JSON.parse(JSON.stringify(sandbox.module.exports));
}

test('Correcao ESLint preserva integralmente a configuracao e regras do HEAD', () => {
    assert.deepEqual(configuration(read('functions/.eslintrc.js')), configuration(original('functions/.eslintrc.js')));
});
test('Arquivo ESLint usa LF e nao introduz supressao de lint', () => {
    const source = read('functions/.eslintrc.js');
    assert.equal(source.includes('\r'), false);
    assert.doesNotMatch(source, /eslint-disable|linebreak-style/);
    assert.match(source, /"quotes": \["error", "double"\]/);
    assert.match(source, /"indent": \["error", 2\]/);
});
test('firebase.json e comandos predeploy permanecem intactos', () => {
    const current = JSON.parse(read('firebase.json'));
    assert.deepEqual(current, JSON.parse(original('firebase.json')));
    assert.deepEqual(current.functions[0].predeploy, [
        'npm --prefix "$RESOURCE_DIR" run lint',
        'npm --prefix "$RESOURCE_DIR" run build',
    ]);
    assert.equal(current.emulators.auth.port, 9099);
    assert.equal(current.emulators.firestore.port, 8080);
    assert.equal(current.emulators.hosting.port, 5000);
    assert.equal(current.emulators.ui.port, 4000);
    assert.equal(current.emulators.functions, undefined);
});
test('aliases e regras fora do histórico continuam preservados', () => {
    assert.equal(read('.firebaserc').replaceAll('\r\n', '\n'), original('.firebaserc').replaceAll('\r\n', '\n'));
    const before = original('firestore.rules').replaceAll('\r\n', '\n');
    const after = read('firestore.rules').replaceAll('\r\n', '\n');
    const start = '    match /users/{userId}/conversas/{conversationId} {';
    const end = '    // Cada usuário só pode acessar o próprio perfil.';
    assert.ok(before.includes(start) && after.includes(start) && before.includes(end) && after.includes(end));
    assert.equal(after.slice(0, after.indexOf(start)), before.slice(0, before.indexOf(start)));
    assert.equal(after.slice(after.indexOf(end)), before.slice(before.indexOf(end)));
});

test('regras do histórico exigem UID, pergunta identificada e prefixo imutável', () => {
    const rules = read('firestore.rules').replace(/\s+/g, ' ');
    for (const invariant of [
        'return request.auth != null && request.auth.uid == userId;',
        'allow read, delete: if owner();',
        'allow create: if owner() && validConversation()',
        'request.resource.data.mensagens.size() == 1',
        'validUserMessage(request.resource.data.mensagens[0])',
        "message.remetente == 'user'",
        "message.keys().hasOnly(['texto', 'remetente', 'enviadoEm', 'messageId'])",
        'after == before.concat([after[before.size()]])',
        'validUserMessage(after[before.size()])',
        "affectedKeys().hasOnly(['mensagens', 'atualizadoEm'])",
        'request.resource.data.mensagens == resource.data.mensagens',
        'request.resource.data.criadoEm == resource.data.criadoEm',
        'allow update: if owner() && validConversation()',
        'message.texto.size() <= 700', 'data.mensagens.size() <= 100',
    ]) assert.ok(rules.includes(invariant), invariant);
});

test('store usa caminho por UID, servidor e transação sem criar bot pelo cliente', () => {
    const store = read('public/Logado/Conversas/conversation-store.js');
    assert.ok(store.includes("sdk.collection(db, 'users', uid, 'conversas')"));
    assert.ok(store.includes('sdk.getDocFromServer(reference(id))'));
    assert.ok(store.includes('sdk.runTransaction(db,'));
    assert.ok(store.includes("remetente: 'user', enviadoEm, messageId"));
    assert.ok(store.includes('existing[0].texto !== cleanText'));
    assert.doesNotMatch(store, /remetente:\s*['"]bot['"]/);
});

test('Sem isolamento concluido, configuracao do cliente permanece fechada sem URL', async () => {
    const source = read('public/Logado/Home/assistente-config.js');
    const { assistenteConfig } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    assert.equal(assistenteConfig.endpoint, '');
    assert.equal(assistenteConfig.timeoutMs, 30000);
});
