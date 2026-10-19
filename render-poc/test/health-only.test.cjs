'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

test('health real: somente GET /health, sem SDKs, credenciais ou efeitos de autenticação', () => {
    const code = String.raw`
        const assert = require('node:assert/strict');
        const Module = require('node:module');
        const original = Module._load;
        Module._load = function(name, ...args) {
            if (/^(firebase-admin|firebase-functions|@google\/genai)(\/|$)/.test(name))
                throw new Error('SDK_FORBIDDEN');
            return original.call(this, name, ...args);
        };
        const fs = require('node:fs'), read = fs.readFileSync;
        fs.readFileSync = function(path, ...args) {
            if (/sylvinho-firebase-admin|application_default_credentials|configstore|\.(pem|key)$/.test(String(path)))
                throw new Error('CREDENTIAL_READ_FORBIDDEN');
            return read.call(this, path, ...args);
        };
        (async () => {
            const { criarServidor, lerConfiguracao } = require('./render-poc/server.cjs');
            const server = criarServidor({ config: lerConfiguracao({ RENDER: 'true', SYLVINHO_POC_MODE: 'health' }),
                obterDependencias: () => assert.fail('Nenhuma dependência pode ser inicializada') });
            await new Promise(done => server.listen(0, '127.0.0.1', done));
            try {
                const base = 'http://127.0.0.1:' + server.address().port;
                const response = await fetch(base + '/health');
                assert.equal(response.status, 200);
                assert.deepEqual(await response.json(), { status: 'ok', service: 'sylvinho-backend' });
                for (const path of ['/health', '/perguntarAssistente', '/diagnostico/auth', '/diagnostico/rag', '/', '/health/'])
                    for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
                        if (path === '/health' && method === 'GET') continue;
                        const result = await fetch(base + path, { method,
                            headers: { 'Content-Type': 'text/plain', Authorization: 'Bearer fixture-invalid', Origin: 'https://untrusted.invalid' },
                            ...(['POST', 'PUT', 'PATCH'].includes(method) ? { body: 'not-json' } : {}) });
                        assert.equal(result.status, 404, method + ' ' + path);
                        assert.equal(result.headers.get('access-control-allow-origin'), null);
                    }
                console.log('HEALTH_ONLY_OK');
            } finally { await new Promise(done => { server.close(done); server.closeAllConnections(); }); }
        })().catch(() => { console.error('HEALTH_ONLY_FAILED'); process.exitCode = 1; });
    `;
    assert.equal(execFileSync(process.execPath, ['-e', code], {
        cwd: resolve(__dirname, '../..'), encoding: 'utf8', windowsHide: true,
    }).trim(), 'HEALTH_ONLY_OK');
});
