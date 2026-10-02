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
test('conversation-store e Rules nao foram alterados para facilitar teste', () => {
    for (const path of ['public/Logado/Conversas/conversation-store.js', 'firestore.rules', '.firebaserc']) {
        assert.equal(read(path).replaceAll('\r\n', '\n'), original(path).replaceAll('\r\n', '\n'));
    }
});
test('Sem isolamento concluido, configuracao do cliente permanece fechada sem URL', async () => {
    const source = read('public/Logado/Home/assistente-config.js');
    const { assistenteConfig } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    assert.equal(assistenteConfig.endpoint, '');
    assert.equal(assistenteConfig.timeoutMs, 30000);
});
