import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

const source = readFileSync(new URL('../public/Logado/Home/home.js', import.meta.url), 'utf8')
    .replace('loadAuthenticatedProfile();', '').replaceAll('import(', 'mockImport(');
const clientSource = readFileSync(new URL('../public/Logado/Home/assistente-client.js', import.meta.url), 'utf8');
const { perguntarAssistente: clienteReal } = await import(`data:text/javascript;base64,${Buffer.from(clientSource).toString('base64')}`);
const pendingSource = readFileSync(new URL('../public/Logado/Home/envio-pendente.js', import.meta.url), 'utf8');
const pendingModule = await import(`data:text/javascript;base64,${Buffer.from(pendingSource).toString('base64')}`);
function scenario({ fail, failOnce, failCode, retryMeta = {}, retryWaiting, failRead, waiting, appendFail, appendFailOnce, realClient, pendingRaw, readBlocked = false, removeBlocked = false, confirmed = true, timeoutMs = 30000, endpoint = 'http://localhost/mock' } = {}) {
    const elements = new Map();
    const events = new Map();
    let navigations = 0, confirmations = 0, allocations = 0;
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            children: [], dataset: {}, value: '', textContent: '', disabled: false,
            classList: { add() {}, remove() {}, toggle() {} },
            addEventListener(event, callback) { events.set(String(id) + ':' + event, callback); }, setAttribute() {}, focus() {},
            append(child) { this.children.push(child); },
            replaceChildren() { this.children = []; },
            querySelector: (selector) => element(selector),
        });
        return elements.get(id);
    }
    let appends = 0;
    let reads = 0;
    let requests = 0;
    const persisted = [];
    const values = new Map();
    if (pendingRaw !== undefined) values.set('sylvinho:pendente:alice', pendingRaw);
    const storage = { getItem: (key) => { if (readBlocked) throw new Error('storage blocked'); return values.get(key) || null; }, setItem: (key, value) => values.set(key, value), removeItem: (key) => { if (removeBlocked) throw new Error('storage blocked'); values.delete(key); } };
    const ids = [];
    const criacoes = [];
    let existe = false;
    const store = {
        reserve: () => 'abcdefghijklmnopqrst',
        append: async (_, text, messageId, _enviadoEm, { create = false } = {}) => {
            appends++;
            criacoes.push(create);
            if (appendFail || (appendFailOnce && appends === 1)) throw new Error('Nao salvo');
            if (!existe && !create) throw new Error('Conversa excluída. Inicie uma nova mensagem.');
            existe = true;
            if (!persisted.some((m) => m.remetente === 'user' && m.messageId === messageId))
                persisted.push({ texto: text, remetente: 'user', messageId });
            return 'abcdefghijklmnopqrst';
        },
        open: async () => {
            reads++;
            if (reads === failRead) throw new Error('Conversa removida');
            return { mensagens: persisted.map((item) => ({ ...item })) };
        },
    };
    const context = vm.createContext({
        document: { querySelector: element, querySelectorAll: () => [], createElement: () => element(Symbol()) },
        window: { location: { search: '', assign() { navigations++; }, replace() {} }, history: { replaceState() {} },
            confirm() { confirmations++; return confirmed; } },
        URLSearchParams, AbortController, console, setTimeout, clearTimeout, crypto: { randomUUID: () => { allocations++; return randomUUID(); } },
        mockImport: async (path) => {
            if (path.endsWith('envio-pendente.js')) return {
                carregarEnvioPendente: (uid) => pendingModule.carregarEnvioPendente(uid, storage),
                guardarEnvioPendente: (uid, envio) => pendingModule.guardarEnvioPendente(uid, envio, storage),
                concluirEnvioPendente: (uid) => pendingModule.concluirEnvioPendente(uid, storage),
                inspecionarEnvioPendente: (uid) => pendingModule.inspecionarEnvioPendente(uid, storage),
                descartarEnvioPendente: (uid) => pendingModule.descartarEnvioPendente(uid, storage),
            };
            if (path.endsWith('assistente-config.js')) return { resolverAssistenteConfig: () => ({ endpoint, timeoutMs }) };
            assert.ok(path.endsWith('assistente-client.js'), `Import inesperado: ${path}`);
            return { perguntarAssistente: async (options) => {
                requests++;
                ids.push(options.messageId);
                assert.equal(persisted.filter((m) => m.remetente === 'user').length, 1);
                assert.equal(options.pergunta, 'Pergunta');
                assert.equal(options.conversationId, 'abcdefghijklmnopqrst');
                if (realClient) return clienteReal({ ...options, fetchImpl: async (url, request) => {
                    assert.equal(url, endpoint);
                    assert.equal(request.headers.Authorization, 'Bearer simulado');
                    assert.deepEqual(JSON.parse(request.body), { pergunta: 'Pergunta', conversationId: 'abcdefghijklmnopqrst', messageId: options.messageId });
                    assert.equal(reads, 1, 'A conversa foi confirmada antes do HTTP');
                    persisted.push({ texto: 'Bot confirmado no banco', remetente: 'bot', messageId: options.messageId });
                    return { ok: true, json: async () => ({ resposta: 'Nao renderizar este texto HTTP' }) };
                } });
                if (waiting) await waiting;
                if (retryWaiting && requests > 1) await retryWaiting;
                if (fail || (failOnce && requests === 1)) throw Object.assign(new Error('HTTP 500'), { code: failCode }, retryMeta);
                if (!options.sessaoAtual()) throw new Error('Sessao trocada');
                // Apenas o servidor simulado grava bot; a resposta HTTP e distinta.
                if (!persisted.some((m) => m.remetente === 'bot' && m.messageId === options.messageId))
                    persisted.push({ texto: 'Bot confirmado no banco', remetente: 'bot', messageId: options.messageId });
                return { resposta: 'Nao renderizar este texto HTTP' };
            } };
        },
        store, user: { uid: 'alice', getIdToken: async () => 'simulado' },
    });
    vm.runInContext(source + '\nconversationStore = store; authenticatedUser = user;', context);
    const rendered = () => element('#messages').children.map((row) => row.children.at(-1).textContent);
    return {
        send: () => vm.runInContext('sendMessage("Pergunta")', context),
        switchSession: () => vm.runInContext('sessionVersion++; authenticatedUser = null; conversationStore = null; activeRequest?.abort(); lockComposer(true);', context),
        element, rendered, persisted, ids, criacoes,
        excluir: () => { existe = false; persisted.length = 0; },
        newChat: () => events.get('#newChat:click')(),
        retry: () => events.get('#retrySend:click')(),
        navigation: () => ({ navigations, confirmations }),
        allocations: () => allocations,
        rawPending: () => values.get('sylvinho:pendente:alice'),
        cleanup: () => pendingModule.concluirEnvioPendente('alice', { removeItem() {} }),
        pending: () => pendingModule.carregarEnvioPendente('alice', storage),
        counts: () => ({ appends, reads, requests }),
    };
}
test('Home salva user uma vez e renderiza somente historico confirmado, nao corpo HTTP', async () => {
    const run = scenario();
    await run.send();
    assert.deepEqual(run.counts(), { appends: 1, reads: 2, requests: 1 });
    assert.deepEqual(run.rendered(), ['Pergunta', 'Bot confirmado no banco']);
    const logo = run.element('#messages').children[1].children[0].children[0];
    assert.equal(logo.src, 'Logo s_fundo.png');
    assert.equal(logo.alt, '');
    assert.equal(run.element('#messageInput').value, '');
    assert.equal(run.element('#messageInput').disabled, false);
    assert.equal(run.element('#newChat').disabled, false);
});

test('timeout preserva pendência e recuperação usa mesmo ID sem duplicar user ou bot', async () => {
    const run = scenario({ failOnce: true, failCode: 'TIMEOUT' });
    await run.send();
    const original = run.pending();
    assert.ok(original);
    assert.equal(run.persisted.length, 1);
    assert.match(run.element('#chatStatus').textContent, /mesmo identificador, sem duplicar/);
    await run.send();
    assert.deepEqual(run.ids, [original.messageId, original.messageId]);
    assert.equal(run.persisted.length, 2);
    assert.equal(run.pending(), null);
});

test('botão de nova tentativa recupera a pergunta salva e não duplica mensagens', async () => {
    const run = scenario({failOnce: true, failCode: 'HTTP_503'});
    await run.send();
    const envio = run.pending();
    assert.equal(run.element('#retrySend').hidden, false);
    assert.equal(run.element('#retrySend').disabled, false);
    assert.equal(envio.aguardarNovaTentativa, true);
    assert.equal(run.persisted.length, 1);
    await run.retry();
    assert.deepEqual(run.ids, [envio.messageId, envio.messageId]);
    assert.equal(run.persisted.length, 2);
    assert.equal(run.pending(), null);
    assert.equal(run.element('#retrySend').hidden, true);
});

test('cliques repetidos no retry durante a resposta não geram novos envios', async () => {
    let release;
    const espera = new Promise(resolve => {release = resolve;});
    const run = scenario({failOnce: true, failCode: 'HTTP_503', retryWaiting: espera});
    await run.send();
    const retry = run.retry();
    await run.retry();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(run.counts().requests, 2);
    release();await retry;
    assert.equal(run.persisted.length, 2);
    assert.equal(new Set(run.ids).size, 1);
});

test('limite de uso mantém retry bloqueado durante a espera e preserva o prazo', async () => {
    const run = scenario({failOnce: true, failCode: 'HTTP_429', retryMeta: {motivo: 'LIMITE_USO', retentavel: true, retryAfterSeconds: 30}});
    await run.send();
    assert.match(run.element('#chatStatus').textContent, /limite de uso/);
    assert.equal(run.element('#retrySend').hidden, false);
    assert.equal(run.element('#retrySend').disabled, true);
    assert.ok(run.pending().tentarApos > Date.now());
    await run.retry();assert.equal(run.counts().requests, 1);
    run.switchSession();await run.retry();assert.equal(run.counts().requests, 1);
});

test('falha de autenticação não oferece retry como substituto do login', async () => {
    const run = scenario({fail: true, failCode: 'HTTP_401'});
    await run.send();assert.equal(run.element('#retrySend').hidden, true);assert.ok(run.pending());
});

test('Home e cliente real integram token body e sincronizacao sem duplicar bot', async () => {
    const run = scenario({ realClient: true });
    await run.send();
    assert.deepEqual(run.counts(), { appends: 1, reads: 2, requests: 1 });
    assert.deepEqual(run.rendered(), ['Pergunta', 'Bot confirmado no banco']);
    assert.equal(run.persisted.filter((item) => item.remetente === 'bot').length, 1);
    assert.equal(run.element('#chatStatus').textContent, 'Conversa atualizada.');
});
test('Falha IA conserva user, nao grava bot, nao faz retry, desbloqueia', async () => {
    const run = scenario({ fail: true });
    await run.send();
    assert.deepEqual(run.counts(), { appends: 1, reads: 1, requests: 1 });
    assert.equal(run.persisted.length, 1);
    assert.equal(run.persisted[0].remetente, 'user');
    assert.deepEqual(run.rendered(), ['Pergunta']);
    assert.match(run.element('#chatStatus').textContent, /pergunta foi salva/);
    assert.equal(run.element('#messageInput').value, '');
    assert.equal(run.element('#messageInput').disabled, false);
});

test('endpoint ausente nao salva pergunta nem chama HTTP e preserva texto', async () => {
    const run = scenario({ endpoint: '' });
    await run.send();
    assert.deepEqual(run.counts(), { appends: 0, reads: 0, requests: 0 });
    assert.equal(run.element('#messageInput').value, 'Pergunta');
    assert.match(run.element('#chatStatus').textContent, /Nenhuma pergunta foi salva/);
});

test('recuperacao reaproveita ID e nao duplica pergunta', async () => {
    const run = scenario({ failOnce: true });
    await run.send();
    assert.ok(run.pending());
    await run.send();
    assert.equal(run.ids[0], run.ids[1]);
    assert.equal(run.persisted.length, 2);
    assert.equal(run.pending(), null);
});
for (const failRead of [1, 2]) {
    test(`Conversa removida na releitura ${failRead}: nao duplica append nem fabrica bot`, async () => {
        const run = scenario({ failRead });
        await run.send();
        assert.equal(run.counts().appends, 1);
        assert.match(run.element('#chatStatus').textContent, /conversa foi excluída/);
        assert.doesNotMatch(run.rendered().join(' '), /Nao renderizar/);
        assert.equal(run.element('#messageInput').disabled, false);
    });
}
test('Falha antes de salvar conserva input e nao chama IA', async () => {
    const run = scenario({ appendFail: true });
    await run.send();
    assert.deepEqual(run.counts(), { appends: 1, reads: 0, requests: 0 });
    assert.equal(run.element('#messageInput').value, 'Pergunta');
});
test('Sending impede duplo envio e mantem composer/newChat bloqueados aguardando IA', async () => {
    let release;
    const waiting = new Promise((resolve) => { release = resolve; });
    const run = scenario({ waiting });
    const pending = run.send();
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(run.element('#chatStatus').textContent, /Aguardando resposta/);
    assert.equal(run.element('#messageInput').disabled, true);
    assert.equal(run.element('#newChat').disabled, true);
    await run.send();
    assert.equal(run.counts().appends, 1);
    release();
    await pending;
});
test('Troca/perda de sessao descarta conclusao antiga e nao desbloqueia conta ausente', async () => {
    let release;
    const waiting = new Promise((resolve) => { release = resolve; });
    const run = scenario({ waiting });
    const pending = run.send();
    await new Promise((resolve) => setImmediate(resolve));
    run.switchSession();
    const before = run.element('#chatStatus').textContent;
    release();
    await pending;
    assert.equal(run.element('#chatStatus').textContent, before);
    assert.equal(run.element('#messageInput').disabled, true);
    assert.equal(run.counts().reads, 1);
    assert.equal(run.persisted.length, 1);
});


test('falha de resultado incerto não autoriza criação na recuperação nem troca IDs', async () => {
    const run = scenario({ appendFailOnce: true });
    await run.send();
    const pending = run.pending();
    assert.ok(pending);
    assert.equal(pending.novaConversa, true);
    await run.send();
    assert.deepEqual(run.criacoes, [true, false]);
    assert.equal(run.persisted.length, 0);
    assert.equal(run.counts().requests, 0);
    assert.equal(run.pending().messageId, pending.messageId);
    assert.equal(run.allocations(), 1);
    assert.match(run.element('#chatStatus').textContent, /Conversa excluída/);
});


const pendingFixture = JSON.stringify({ version: 1, conversationId: 'abcdefghijklmnopqrst',
    messageId: 'message-sylvinho-000001', pergunta: 'Pergunta', enviadoEm: 123, novaConversa: false });
for (const pendingRaw of [pendingFixture, '{']) {
    test('Novo chat não descarta pendência sem confirmação: ' + (pendingRaw === '{' ? 'inválida' : 'válida'), async () => {
        const run = scenario({ pendingRaw, confirmed: false });
        await run.newChat();
        assert.deepEqual(run.navigation(), { navigations: 0, confirmations: 1 });
        assert.equal(run.rawPending(), pendingRaw);
        assert.equal(run.ids.length, 0);
        assert.equal(run.allocations(), 0);
    });
    test('Novo chat descarta explicitamente sem gerar mensagem: ' + (pendingRaw === '{' ? 'inválida' : 'válida'), async () => {
        const run = scenario({ pendingRaw });
        await run.newChat();
        assert.deepEqual(run.navigation(), { navigations: 1, confirmations: 1 });
        assert.equal(run.rawPending(), undefined);
        assert.equal(run.ids.length, 0);
        assert.equal(run.allocations(), 0);
        assert.equal(run.counts().appends, 0);
    });
}
for (const options of [{ readBlocked: true, removeBlocked: true }, { pendingRaw: pendingFixture, removeBlocked: true }]) {
    test('Novo chat abre na página atual quando limpeza é indisponível: ' + JSON.stringify(options), async () => {
        const run = scenario(options);
        try {
            await run.newChat();
            assert.deepEqual(run.navigation(), { navigations: 0, confirmations: 1 });
            assert.match(run.element('#chatStatus').textContent, /descarte vale somente nesta página/);
            assert.equal(run.ids.length, 0);
        assert.equal(run.allocations(), 0);
            assert.equal(run.counts().appends, 0);
            assert.equal(run.rawPending(), options.pendingRaw);
            assert.equal(run.pending(), null);
        } finally { run.cleanup(); }
    });
}

test('resposta confirmada continua visível quando limpeza local falha; replay mantém ID', async () => {
    const run = scenario({ removeBlocked: true });
    try {
        await run.send();
        const original = run.pending();
        assert.ok(original);
        assert.deepEqual(run.rendered(), ['Pergunta', 'Bot confirmado no banco']);
        assert.match(run.element('#chatStatus').textContent, /Resposta confirmada e salva/);
        assert.match(run.element('#chatStatus').textContent, /limpar a pendência local/);
        assert.doesNotMatch(run.element('#chatStatus').textContent, /não foi possível confirmar a resposta/);
        assert.equal(run.element('#messageInput').disabled, false);
        await run.send();
        assert.deepEqual(run.ids, [original.messageId, original.messageId]);
        assert.equal(run.persisted.length, 2);
        assert.equal(run.allocations(), 1);
        assert.deepEqual(run.criacoes, [true, false]);
    } finally { run.cleanup(); }
});

test('recuperação de conversa excluída não cria novamente nem chama backend', async () => {
    const run = scenario({ failOnce: true });
    await run.send();
    const original = run.pending();
    run.excluir();
    await run.send();
    assert.equal(run.persisted.length, 0);
    assert.deepEqual(run.criacoes, [true, false]);
    assert.equal(run.counts().requests, 1);
    assert.equal(run.pending().messageId, original.messageId);
    assert.equal(run.allocations(), 1);
    assert.match(run.element('#chatStatus').textContent, /Conversa excluída/);
});

test('espera de 120 segundos informa retomada do servidor e mantém o envio único', async () => {
    let finish;
    const waiting = new Promise(resolve => { finish = resolve; });
    const run = scenario({ timeoutMs: 120000, waiting });
    const sent = run.send();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(run.element('#chatStatus').textContent, /até dois minutos para iniciar/);
    assert.equal(run.counts().appends, 1);
    assert.equal(run.allocations(), 1);
    assert.equal(run.element('#messageInput').disabled, true);
    finish();
    await sent;
    assert.equal(run.persisted.length, 2);
});

for (const [code, expected] of [
    ['HTTP_401', /sessão expirou/], ['SESSAO_INVALIDA', /sessão expirou/],
    ['TOKEN_INVALIDO', /sessão expirou/], ['HTTP_502', /temporariamente indisponível/],
    ['HTTP_503', /temporariamente indisponível/], ['HTTP_504', /temporariamente indisponível/],
    ['REDE_OU_TOKEN', /conexão e o login/], ['TIMEOUT', /demorou para responder/],
]) {
    test('Erro ' + code + ' preserva pendencia sem retry ou bot local', async () => {
        const run = scenario({fail: true, failCode: code});
        await run.send();
        assert.deepEqual(run.counts(), {appends: 1, reads: 1, requests: 1});
        assert.match(run.element('#chatStatus').textContent, expected);
        assert.match(run.element('#chatStatus').textContent, /mesmo identificador/);
        assert.ok(run.pending());
        assert.equal(run.persisted.length, 1);
        assert.equal(run.persisted[0].remetente, 'user');
    });
}
