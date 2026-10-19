import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/Logado/Conversas/conversation-store.js', import.meta.url), 'utf8')
    .replace('export async function', 'async function').replaceAll('import(', 'mockImport(');
const id = 'abcdefghijklmnopqrst';

test('reabrir consulta servidor sob UID autenticado e recupera perguntas referencias e bots', async () => {
    const calls = [];
    const saved = { titulo: 'Matricula', mensagens: [
        { texto: 'Como funciona a matricula?', remetente: 'user' },
        { texto: 'Trecho documental. Fonte: Documento; pagina 2.', remetente: 'bot' },
    ] };
    let exists = true;
    const sdk = {
        getFirestore: (app) => { assert.equal(app, 'app-demo'); return 'db-demo'; },
        collection: (db, ...parts) => { assert.equal(db, 'db-demo'); return parts.join('/'); },
        doc: (collection, key) => `${collection}/${key}`,
        getDocFromServer: async (path) => {
            calls.push(path);
            return { exists: () => exists, data: () => structuredClone(saved) };
        },
    };
    const context = vm.createContext({ mockImport: async () => sdk });
    vm.runInContext(source + '\nglobalThis.createStore = createConversationStore;', context);
    const store = await context.createStore('app-demo', 'alice');
    const opened = await store.open(id);
    assert.deepEqual(JSON.parse(JSON.stringify(opened)), saved);
    assert.deepEqual(calls, [`users/alice/conversas/${id}`]);
    exists = false;
    await assert.rejects(store.open(id), /não existe mais/);
    await assert.rejects(store.open('../bob'), /Conversa inválida/);
    assert.equal(calls.length, 2, 'ID invalido nao chega ao SDK');
});

test('append reservado e retry mantem uma pergunta; mesmo texto com outro ID e novo envio', async () => {
    const documents = new Map();
    const sdk = {
        getFirestore: () => 'db', collection: (_db, ...parts) => parts.join('/'),
        doc: (collection, key = id) => ({ id: key, path: `${collection}/${key}` }),
        serverTimestamp: () => 999,
        runTransaction: async (_db, callback) => callback({
            get: async (ref) => ({ exists: () => documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)) }),
            set: (ref, data) => documents.set(ref.path, structuredClone(data)),
            update: (ref, data) => documents.set(ref.path, { ...documents.get(ref.path), ...structuredClone(data) }),
        }),
    };
    const context = vm.createContext({ mockImport: async () => sdk });
    vm.runInContext(source + '\nglobalThis.createStore = createConversationStore;', context);
    const store = await context.createStore('app', 'alice');
    assert.equal(store.reserve(), id);
    const mid = 'message-sylvinho-000001';
    await store.append(id, 'Pergunta fixture', mid, 123, { create: true });
    await store.append(id, 'Pergunta fixture', mid, 123);
    assert.equal(documents.get(`users/alice/conversas/${id}`).mensagens.length, 1);
    await assert.rejects(store.append(id, 'Texto alterado', mid, 123), /outra pergunta/);
    await store.append(id, 'Pergunta fixture', 'message-sylvinho-000002', 123);
    assert.equal(documents.get(`users/alice/conversas/${id}`).mensagens.length, 2);
    documents.delete(`users/alice/conversas/${id}`);
    await assert.rejects(store.append(id, 'Pergunta fixture', mid, 123), /Conversa excluída/);
});

for (const failure of ['leitura', 'limpeza', 'import']) test('exclusão confirmada não falha por erro local de ' + failure, async () => {
    let deleted = 0;
    const sdk = { getFirestore: () => ({}), collection: (_, ...path) => path.join('/'),
        doc: (collection, id) => collection + '/' + id, deleteDoc: async () => { deleted++; } };
    const pending = {
        carregarEnvioPendente() { if (failure === 'leitura') throw new SyntaxError('invalid cache'); return { conversationId: id }; },
        concluirEnvioPendente() { throw new Error('storage blocked'); },
    };
    const context = vm.createContext({ mockImport: async path => {
        if (!path.includes('envio-pendente')) return sdk;
        if (failure === 'import') throw new Error('module unavailable');
        return pending;
    } });
    vm.runInContext(source, context);
    const store = await context.createConversationStore({}, 'alice');
    await store.remove(id);
    assert.equal(deleted, 1);
});

test('falha remota de exclusão continua propagada e não limpa pendência', async () => {
    let cleanupImports = 0;
    const sdk = { getFirestore: () => ({}), collection: (_, ...path) => path.join('/'),
        doc: (collection, id) => collection + '/' + id, deleteDoc: async () => { throw new Error('permission-denied'); } };
    const context = vm.createContext({ mockImport: async path => {
        if (path.includes('envio-pendente')) cleanupImports++;
        return sdk;
    } });
    vm.runInContext(source, context);
    const store = await context.createConversationStore({}, 'alice');
    await assert.rejects(store.remove(id), /permission-denied/);
    assert.equal(cleanupImports, 0);
});

test('exclusão limpa somente pendência da conversa removida', async () => {
    let cleared = 0, pendingId = 'OutraConversa00000000';
    const sdk = { getFirestore: () => ({}), collection: (_, ...path) => path.join('/'),
        doc: (collection, id) => collection + '/' + id, deleteDoc: async () => {} };
    const pending = { carregarEnvioPendente: () => ({ conversationId: pendingId }), concluirEnvioPendente: () => { cleared++; } };
    const context = vm.createContext({ mockImport: async path => path.includes('envio-pendente') ? pending : sdk });
    vm.runInContext(source, context);
    const store = await context.createConversationStore({}, 'alice');
    await store.remove(id); assert.equal(cleared, 0);
    pendingId = id;
    await store.remove(id); assert.equal(cleared, 1);
});

function transactionalStore() {
    const documents = new Map();
    let retry, afterSet, sets = 0;
    const sdk = {
        getFirestore: () => 'db', collection: (_db, ...parts) => parts.join('/'),
        doc: (collection, key = id) => ({ id: key, path: collection + '/' + key }),
        serverTimestamp: () => 999,
        runTransaction: async (_db, callback) => {
            let writes = [];
            const transaction = {
                get: async ref => ({ exists: () => documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)) }),
                set: (ref, data) => writes.push(() => { sets++; documents.set(ref.path, structuredClone(data)); }),
                update: (ref, data) => writes.push(() => documents.set(ref.path, { ...documents.get(ref.path), ...structuredClone(data) })),
            };
            await callback(transaction);
            if (retry) { const action = retry; retry = null; action(documents); writes = []; await callback(transaction); }
            writes.forEach(write => write());
            if (afterSet) { const action = afterSet; afterSet = null; action(); }
        },
    };
    const context = vm.createContext({ mockImport: async () => sdk });
    vm.runInContext(source, context);
    return { documents, create: () => context.createConversationStore('app', 'alice'),
        retry: action => { retry = action; }, afterCommit: action => { afterSet = action; }, sets: () => sets };
}

test('reserva consumida não recria após commit com resposta perdida e exclusão em outra aba', async () => {
    const s = transactionalStore(), store = await s.create();
    const reserved = store.reserve(), mid = 'message-reliability-000001';
    s.afterCommit(() => { throw new Error('ack perdido'); });
    await assert.rejects(store.append(reserved, 'Pergunta', mid, 1, { create: true }), /ack perdido/);
    assert.equal(s.sets(), 1);
    s.documents.clear();
    for (const current of [store, await s.create()]) {
        await assert.rejects(current.append(reserved, 'Pergunta', mid, 1, { create: true }), /Conversa excluída/);
    }
    assert.equal(s.documents.size, 0);
    assert.equal(s.sets(), 1);
});

test('recuperação com reserva antiga preserva resposta confirmada e deduplica pergunta', async () => {
    const s = transactionalStore(), store = await s.create(), reserved = store.reserve();
    const mid = 'message-reliability-000002';
    await store.append(reserved, 'Pergunta', mid, 1, { create: true });
    const saved = s.documents.get('users/alice/conversas/' + reserved);
    saved.mensagens.push({ texto: 'Resposta confirmada', remetente: 'bot', messageId: mid });
    const recovered = await s.create();
    await recovered.append(reserved, 'Pergunta', mid, 1, { create: true });
    assert.equal(saved.mensagens.length, 2);
    assert.equal(s.documents.get('users/alice/conversas/' + reserved).mensagens.length, 2);
    assert.equal(s.sets(), 1);
});

test('retry transacional não recria documento excluído após leitura existente', async () => {
    const s = transactionalStore(), store = await s.create(), reserved = store.reserve();
    s.documents.set('users/alice/conversas/' + reserved, { mensagens: [] });
    s.retry(documents => documents.clear());
    await assert.rejects(store.append(reserved, 'Pergunta', 'message-reliability-000003', 1, { create: true }), /Conversa excluída/);
    assert.equal(s.documents.size, 0);
    assert.equal(s.sets(), 0);
});

test('criação inicial legítima continua disponível com reserva ou ID automático', async () => {
    const s = transactionalStore(), store = await s.create();
    await store.append(store.reserve(), 'Pergunta', 'message-reliability-000004', 1, { create: true });
    assert.equal(s.sets(), 1);
    const next = transactionalStore();
    await (await next.create()).append(null, 'Pergunta', 'message-reliability-000005', 1);
    assert.equal(next.sets(), 1);
});
