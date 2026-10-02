import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Bootstrap local exige origem exata e conecta ambos antes de autenticar/carregar Home', () => {
    const source = read('local-e2e/bootstrap.js');
    assert.match(source, /location.origin !== 'http:\/\/127\.0\.0\.1:5000'/);
    assert.ok(source.indexOf('connectAuthEmulator(auth,') < source.indexOf('await signInAnonymously'));
    assert.ok(source.indexOf('connectFirestoreEmulator(db,') < source.indexOf('await signInAnonymously'));
    assert.ok(source.indexOf('await signInAnonymously') < source.indexOf("await import('./home.js')"));
    assert.match(source, /inMemoryPersistence/);
});
test('Harness fora do staging ou sem marcador encerra antes de importar SDKs', () => {
    const source = read('local-e2e/function.cjs');
    for (const marker of [undefined, '0', '1']) {
        assert.throws(() => vm.runInNewContext(source, {
            process: { env: { SYLVINHO_LOCAL_E2E: marker } }, __dirname: root,
            require: (name) => {
                if (name === 'node:path') return { resolve: () => root, join: (...parts) => parts.join('/') };
                if (name === 'node:fs') return {};
                if (name === 'node:module') return { createRequire: () => assert.fail('SDK proibido') };
                assert.fail('Import inesperado');
            },
        }), /LOCAL_EMULATORS_REQUIRED/);
    }
});
test('Harness nao importa producao/Gemini; possui guardas antes de initializeApp', () => {
    const source = read('local-e2e/function.cjs');
    assert.doesNotMatch(source, /gemini|genai|GEMINI_API_KEY|defineSecret|lib\/index/i);
    assert.ok(source.indexOf('Object.values(checks)') < source.indexOf('initializeApp({'));
    assert.match(source, /FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099'/);
    assert.match(source, /FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080'/);
    assert.match(source, /GCLOUD_PROJECT === 'tcc-ia-d8891'/);
});
test('Preload bloqueia Firebase/Gemini em HTTP HTTPS fetch TLS e socket antes da rede', () => {
    const code = `
        require('./local-e2e/network-guard.cjs');
        const assert = require('node:assert/strict');
        const http = require('node:http'); const https = require('node:https');
        const net = require('node:net'); const tls = require('node:tls');
        for (const host of ['identitytoolkit.googleapis.com', 'firestore.googleapis.com', 'generativelanguage.googleapis.com']) {
            assert.throws(() => http.request('http://' + host), /NON_LOCAL_NETWORK_BLOCKED/);
            assert.throws(() => https.request('https://' + host), /NON_LOCAL_NETWORK_BLOCKED/);
            assert.throws(() => fetch('https://' + host), /NON_LOCAL_NETWORK_BLOCKED/);
            assert.throws(() => tls.connect({host, port:443}), /NON_LOCAL_NETWORK_BLOCKED/);
            assert.throws(() => new net.Socket().connect({host, port:443}), /NON_LOCAL_NETWORK_BLOCKED/);
        }
        console.log('GUARD_OK');
    `;
    const env = { ...process.env };
    delete env.SYLVINHO_ARTIFACT_DOWNLOAD;
    assert.equal(execFileSync(process.execPath, ['-e', code], { cwd: root, env, encoding: 'utf8' }).trim(), 'GUARD_OK');
});
test('Configuracao de producao continua sem endpoint local ou bootstrap', () => {
    assert.doesNotMatch(read('public/Logado/Home/assistente-config.js'), /5001|127\.0\.0\.1/);
    assert.doesNotMatch(read('public/Logado/Home/home.html'), /local-bootstrap|local-e2e/);
    assert.doesNotMatch(read('functions/src/index.ts'), /local-e2e|SYLVINHO_LOCAL|mock/i);
});
