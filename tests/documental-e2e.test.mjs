import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { endpointDocumental, documentsDocumentais, prepararFixturesDocumentais } from '../local-e2e/documental-scenarios.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('configuração documental de teste tem somente endpoints loopback e projeto demo', () => {
    for (const value of [endpointDocumental, documentsDocumentais]) {
        const url = new URL(value);
        assert.equal(url.hostname, '127.0.0.1');
        assert.equal(url.protocol, 'http:');
        assert.ok(url.pathname.includes('demo-sylvinho-render-poc'));
    }
});

test('fixtures documentais são fictícias, ativa/inativa e gravadas somente no emulador', async () => {
    const previous = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (url, options) => {
        calls++;
        assert.equal(url, documentsDocumentais + ':commit');
        assert.equal(options.method, 'POST');
        const writes = JSON.parse(options.body).writes;
        assert.equal(writes.length, 2);
        assert.deepEqual(writes.map(w => w.update.fields.ativo.booleanValue), [true, false]);
        for (const { update } of writes) {
            assert.ok(update.name.startsWith('projects/demo-sylvinho-render-poc/databases/(default)/documents/conhecimento/fixture-'));
            assert.equal(update.fields.documentoId.stringValue, 'documento-ficticio');
            assert.match(update.fields.conteudo.stringValue, /MARCADOR_/);
        }
        return { status: 200 };
    };
    try { await prepararFixturesDocumentais(); assert.equal(calls, 1); }
    finally { globalThis.fetch = previous; }
});

test('modo documental é opt-in; runner padrão de autenticação continua sem Functions', () => {
    const runner = read('local-e2e/auth-run.mjs');
    assert.match(runner, /process.argv.includes\('--documental'\)/);
    assert.match(runner, /documental \? 'auth,firestore,functions,hosting' : 'auth,firestore,hosting'/);
    const prepare = read('local-e2e/prepare-history.mjs');
    assert.match(prepare, /authMode = 'anonymous'/);
    assert.match(prepare, /if \(!\['anonymous', 'password'\].includes\(authMode\)\) throw/);
    assert.match(prepare, /authMode === 'password' \? 'local-e2e\/auth-bootstrap.js' : 'local-e2e\/history-bootstrap.js'/);
});
