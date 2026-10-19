import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../public/Logado/Home/envio-pendente.js', import.meta.url), 'utf8');
const { carregarEnvioPendente, guardarEnvioPendente, concluirEnvioPendente, inspecionarEnvioPendente, descartarEnvioPendente } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const fixture = { version: 1, conversationId: 'abcdefghijklmnopqrst',
    messageId: 'message-sylvinho-000001', pergunta: 'Matricula fixture?', enviadoEm: 123, novaConversa: true };

test('recarga recupera identificadores originais e isola contas', () => {
    const values = new Map();
    const storage = { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
    guardarEnvioPendente('alice', fixture, storage);
    assert.deepEqual(carregarEnvioPendente('alice', storage), fixture);
    assert.equal(carregarEnvioPendente('bob', storage), null);
    concluirEnvioPendente('alice', storage);
    assert.equal(carregarEnvioPendente('alice', storage), null);
});

test('armazenamento indisponivel e pendencia invalida falham sem criar novo ID', () => {
    const unavailable = { getItem() { throw new Error('storage blocked'); }, setItem() { throw new Error('storage blocked'); } };
    assert.throws(() => carregarEnvioPendente('alice', unavailable));
    assert.throws(() => guardarEnvioPendente('alice', fixture, unavailable));
    for (const raw of ['null', '{', JSON.stringify({ ...fixture, messageId: '../other' }),
        JSON.stringify({ ...fixture, pergunta: 'x'.repeat(701) })]) {
        assert.throws(() => carregarEnvioPendente('alice', { getItem: () => raw }));
    }
});

test('inspeção diferencia ausência, pendência inválida e storage indisponível sem apagar', () => {
    assert.equal(inspecionarEnvioPendente('ausente', { getItem: () => null }).estado, 'ausente');
    for (const raw of ['{', 'null', JSON.stringify({ ...fixture, version: 2 })])
        assert.equal(inspecionarEnvioPendente('invalida', { getItem: () => raw }).estado, 'invalido');
    assert.equal(inspecionarEnvioPendente('bloqueada', { getItem() { throw new Error('blocked'); } }).estado, 'indisponivel');
});

test('descarte explícito só remove o UID solicitado e não altera IDs de outra conta', () => {
    const values = new Map([['sylvinho:pendente:a', JSON.stringify(fixture)], ['sylvinho:pendente:b', JSON.stringify(fixture)]]);
    const storage = { getItem: key => values.get(key), removeItem: key => values.delete(key) };
    assert.deepEqual(descartarEnvioPendente('a', storage), { persistente: true });
    assert.equal(carregarEnvioPendente('a', storage), null);
    assert.deepEqual(carregarEnvioPendente('b', storage), fixture);
});

test('falha de remoção mantém bytes mas suspende recuperação somente nesta página após descarte', () => {
    let raw = JSON.stringify(fixture);
    const storage = { getItem: () => raw, removeItem() { throw new Error('blocked'); }, setItem: (_, value) => { raw = value; } };
    assert.deepEqual(descartarEnvioPendente('temporaria', storage), { persistente: false });
    assert.equal(raw, JSON.stringify(fixture));
    assert.equal(carregarEnvioPendente('temporaria', storage), null);
    const next = { ...fixture, messageId: 'message-sylvinho-000002' };
    guardarEnvioPendente('temporaria', next, storage);
    assert.deepEqual(carregarEnvioPendente('temporaria', storage), next);
});

test('getter sessionStorage bloqueado também permite inspeção e descarte explícito', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('blocked'); } });
    try {
        assert.equal(inspecionarEnvioPendente('getter').estado, 'indisponivel');
        assert.deepEqual(descartarEnvioPendente('getter'), { persistente: false });
        assert.equal(carregarEnvioPendente('getter'), null);
    } finally {
        if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor);
        else delete globalThis.sessionStorage;
    }
});
