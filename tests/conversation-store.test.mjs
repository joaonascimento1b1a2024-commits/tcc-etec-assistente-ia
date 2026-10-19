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
