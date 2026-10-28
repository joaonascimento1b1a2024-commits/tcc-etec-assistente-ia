import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {createRequire} from 'node:module';

const source = readFileSync(new URL('../public/Logado/Home/assistente-client.js', import.meta.url), 'utf8');
const { perguntarAssistente } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const configSource = readFileSync(new URL('../public/Logado/Home/assistente-config.js', import.meta.url), 'utf8');
const { assistenteConfig, resolverAssistenteConfig, origensPublicadasAssistente } = await import(`data:text/javascript;base64,${Buffer.from(configSource).toString('base64')}`);
const base = {
    user: { getIdToken: async () => 'token-simulado' },
    endpoint: 'http://127.0.0.1:5001/demo-local/southamerica-east1/perguntarAssistente',
    pergunta: 'Como funciona a matricula?',
    conversationId: 'abcdefghijklmnopqrst',
    messageId: 'message-sylvinho-000001',
    timeoutMs: 1000,
    fetchImpl: async () => ({ ok: true, json: async () => ({ resposta: 'Resposta do servidor' }) }),
};
const rejects = (options, code) => assert.rejects(perguntarAssistente({ ...base, ...options }), { code });

test('Authorization, body exato e sucesso sem cookies, redirecionamento ou usuarioId', async () => {
    let calls = 0;
    const result = await perguntarAssistente({
        ...base, usuarioId: 'ignorado',
        fetchImpl: async (url, options) => {
            calls++;
            assert.equal(url, base.endpoint);
            assert.equal(options.method, 'POST');
            assert.equal(options.headers.Authorization, 'Bearer token-simulado');
            assert.equal(options.headers['Content-Type'], 'application/json');
            assert.deepEqual(JSON.parse(options.body), { pergunta: base.pergunta, conversationId: base.conversationId, messageId: base.messageId });
            assert.equal(options.credentials, 'omit');
            assert.equal(options.redirect, 'error');
            assert.ok(options.signal instanceof AbortSignal);
            return { ok: true, json: async () => ({ resposta: 'Resposta', extra: 'ignorado' }) };
        },
    });
    assert.deepEqual(result, { resposta: 'Resposta' });
    assert.equal(calls, 1);
});
for (const status of [400, 401, 403, 404, 409, 500]) {
    test(`HTTP ${status} encerra sem retry e sem ler corpo de erro`, async () => {
        let calls = 0;
        await rejects({ fetchImpl: async () => {
            calls++;
            return { ok: false, status, json: () => assert.fail('Nao deve ler erro remoto') };
        } }, `HTTP_${status}`);
        assert.equal(calls, 1);
    });
}
test('JSON invalido', () => rejects({ fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError(); } }) }, 'JSON_INVALIDO'));
for (const data of [null, {}, { resposta: '' }, { resposta: '  ' }, { resposta: 12 }]) {
    test(`Contrato invalido ${JSON.stringify(data)}`, () => rejects({ fetchImpl: async () => ({ ok: true, json: async () => data }) }, 'RESPOSTA_INVALIDA'));
}
test('Falha de rede nao propaga detalhes nem repete chamada', async () => {
    let calls = 0;
    await rejects({ fetchImpl: async () => { calls++; throw new Error('detalhe-remoto'); } }, 'REDE_OU_TOKEN');
    assert.equal(calls, 1);
});
for (const user of [null, {}, { getIdToken: async () => '' }, { getIdToken: async () => null }]) {
    test(`Usuario/token ausente ${typeof user?.getIdToken}`, async () => {
        await rejects({ user, fetchImpl: () => assert.fail('Sem token nao pode chamar rede') },
            typeof user?.getIdToken === 'function' ? 'TOKEN_INVALIDO' : 'SESSAO_INVALIDA');
    });
}
test('Falha ao obter token', () => rejects({ user: { getIdToken: async () => { throw new Error('expirado'); } } }, 'REDE_OU_TOKEN'));
test('Endpoint vazio continua impedindo rede', () => rejects({ ...assistenteConfig, endpoint: '', fetchImpl: () => assert.fail('Endpoint vazio') }, 'ENDPOINT_INVALIDO'));
test('Configuracao publicada envia somente ao Render com fetch simulado', async () => {
    let calls = 0;
    await perguntarAssistente({ ...base, ...assistenteConfig, fetchImpl: async (url, options) => {
        calls++;
        assert.equal(url, 'https://sylvinho-backend-poc.onrender.com/perguntarAssistente');
        assert.equal(options.headers.Authorization, 'Bearer token-simulado');
        return {ok: true, json: async () => ({resposta: 'Resposta simulada de teste'})};
    }});
    assert.equal(calls, 1);
});
for (const endpoint of ['http://example.invalid/function', 'https://user:pass@example.invalid/f', 'https://example.invalid/f?key=x', 'https://example.invalid/f#fragment']) {
    test(`Endpoint rejeitado ${endpoint}`, () => rejects({ endpoint, fetchImpl: () => assert.fail('URL invalida') }, 'ENDPOINT_INVALIDO'));
}
test('Sessao trocada enquanto token aguarda impede HTTP', async () => {
    let current = true;
    await rejects({ sessaoAtual: () => current, user: { getIdToken: async () => { current = false; return 'token'; } },
        fetchImpl: () => assert.fail('Sessao trocada') }, 'SESSAO_INVALIDA');
});
test('Sessao trocada depois de HTTP impede aceitar resposta', async () => {
    let current = true;
    await rejects({ sessaoAtual: () => current, fetchImpl: async () => {
        current = false; return { ok: true, json: () => assert.fail('Sessao trocada') };
    } }, 'SESSAO_INVALIDA');
});
test('Abort externo cancela operacao sem retry', async () => {
    const controller = new AbortController();
    const pending = perguntarAssistente({ ...base, signal: controller.signal,
        fetchImpl: async (_, options) => {
            controller.abort();
            assert.equal(options.signal.aborted, true);
            return new Promise(() => {});
        } });
    await assert.rejects(pending, { code: 'SESSAO_INVALIDA' });
});
test('Timeout aborta rede mesmo se mock ignorar o signal', async () => {
    let signal;
    await rejects({ timeoutMs: 10, fetchImpl: async (_, options) => {
        signal = options.signal; return new Promise(() => {});
    } }, 'TIMEOUT');
    assert.equal(signal.aborted, true);
});
test('Timeout ao obter token impede HTTP tardio', async () => {
    let release;
    await rejects({ timeoutMs: 10, user: { getIdToken: () => new Promise((resolve) => { release = resolve; }) },
        fetchImpl: () => assert.fail('Token tardio nao autoriza rede') }, 'TIMEOUT');
    release('token-tardio');
    await new Promise((resolve) => setImmediate(resolve));
});
test('Cliente nao possui acesso a SDK Firestore nem persistencia bot', () => {
    assert.doesNotMatch(source, /firebase|setDoc|updateDoc|append\(|runTransaction|GEMINI_API_KEY/i);
});


const require = createRequire(import.meta.url);
const {OFFICIAL_ORIGINS} = require('../render-poc/producao.cjs');
test('frontend e backend reconhecem os mesmos dois dominios oficiais', () => {
    assert.deepEqual(origensPublicadasAssistente, OFFICIAL_ORIGINS);
    assert.ok(Object.isFrozen(origensPublicadasAssistente));
});
for (const origin of ['https://tcc-ia-d8891.web.app', 'https://tcc-ia-d8891.firebaseapp.com']) {
    test('origem publicada resolve endpoint e envia token uma vez: '+origin, async () => {
        let chamadas = 0;
        const config = resolverAssistenteConfig({origin, local: null});
        const result = await perguntarAssistente({...base, ...config, fetchImpl: async (url, init) => {
            chamadas++;
            assert.equal(url, assistenteConfig.endpoint);
            assert.equal(init.headers.Authorization, 'Bearer token-simulado');
            assert.deepEqual(JSON.parse(init.body), {pergunta: base.pergunta,
                conversationId: base.conversationId, messageId: base.messageId});
            return {ok: true, json: async () => ({resposta: 'Resposta simulada'})};
        }});
        assert.equal(chamadas, 1);
        assert.equal(result.resposta, 'Resposta simulada');
    });

}
for (const origin of ['https://tcc-ia-d8891.firebaseapp.com.intruso.invalid',
    'https://outro-projeto.firebaseapp.com', 'http://tcc-ia-d8891.firebaseapp.com',
    'https://tcc-ia-d8891.firebaseapp.com:444', 'http://localhost:5500']) {
    test('alias nao libera origens externas ou locais: '+origin, () => {
        assert.equal(resolverAssistenteConfig({origin, local: null}).endpoint, '');
    });
}
