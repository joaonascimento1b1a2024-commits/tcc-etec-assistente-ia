import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../public/Logado/Home/home.js', import.meta.url), 'utf8')
    .replace('loadAuthenticatedProfile();', '').replaceAll('import(', 'mockImport(');
function scenario({ fail, failRead, waiting, appendFail } = {}) {
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            children: [], dataset: {}, value: '', textContent: '', disabled: false,
            classList: { add() {}, remove() {}, toggle() {} },
            addEventListener() {}, setAttribute() {}, focus() {},
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
    const store = {
        append: async (_, text) => {
            appends++;
            if (appendFail) throw new Error('Nao salvo');
            persisted.push({ texto: text, remetente: 'user' });
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
        window: { location: { search: '', assign() {}, replace() {} }, history: { replaceState() {} } },
        URLSearchParams, AbortController, console,
        mockImport: async (path) => {
            if (path.endsWith('assistente-config.js')) return { assistenteConfig: { endpoint: 'http://localhost/mock' } };
            assert.ok(path.endsWith('assistente-client.js'), `Import inesperado: ${path}`);
            return { perguntarAssistente: async (options) => {
                requests++;
                assert.equal(appends, 1);
                assert.equal(options.pergunta, 'Pergunta');
                assert.equal(options.conversationId, 'abcdefghijklmnopqrst');
                if (waiting) await waiting;
                if (fail) throw new Error('HTTP 500');
                if (!options.sessaoAtual()) throw new Error('Sessao trocada');
                // Apenas o servidor simulado grava bot; a resposta HTTP e distinta.
                persisted.push({ texto: 'Bot confirmado no banco', remetente: 'bot' });
                return { resposta: 'Nao renderizar este texto HTTP' };
            } };
        },
        store, user: { getIdToken: async () => 'simulado' },
    });
    vm.runInContext(source + '\nconversationStore = store; authenticatedUser = user;', context);
    const rendered = () => element('#messages').children.map((row) => row.children.at(-1).textContent);
    return {
        send: () => vm.runInContext('sendMessage("Pergunta")', context),
        switchSession: () => vm.runInContext('sessionVersion++; authenticatedUser = null; conversationStore = null; activeRequest?.abort(); lockComposer(true);', context),
        element, rendered, persisted,
        counts: () => ({ appends, reads, requests }),
    };
}
test('Home salva user uma vez e renderiza somente historico confirmado, nao corpo HTTP', async () => {
    const run = scenario();
    await run.send();
    assert.deepEqual(run.counts(), { appends: 1, reads: 2, requests: 1 });
    assert.deepEqual(run.rendered(), ['Pergunta', 'Bot confirmado no banco']);
    assert.equal(run.element('#messageInput').value, '');
    assert.equal(run.element('#messageInput').disabled, false);
    assert.equal(run.element('#newChat').disabled, false);
});
test('Falha IA conserva user, nao grava bot, nao faz retry, desbloqueia', async () => {
    const run = scenario({ fail: true });
    await run.send();
    assert.deepEqual(run.counts(), { appends: 1, reads: 1, requests: 1 });
    assert.deepEqual(run.persisted, [{ texto: 'Pergunta', remetente: 'user' }]);
    assert.deepEqual(run.rendered(), ['Pergunta']);
    assert.match(run.element('#chatStatus').textContent, /pergunta foi salva/);
    assert.equal(run.element('#messageInput').value, '');
    assert.equal(run.element('#messageInput').disabled, false);
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
