import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importar, IDS, PROJECT, DEMO, parseArgs, criarClienteExplicito } from '../demo-academica/importar-fixtures.mjs';
const options = { project: PROJECT, database: '(default)' };
const apply = { ...options, apply: true, confirm: 'CRIAR_3_FIXTURES:' + PROJECT + ':(default)' };
function mock({ collision = false, race = false, wrong = false } = {}) {
    const calls = [], writes = [];
    const db = { projectId: wrong ? 'outro' : PROJECT, databaseId: '(default)', collection(name) {
        assert.equal(name, 'conhecimento'); return { doc(id) { assert.ok(IDS.includes(id)); return { id }; } };
    }, getAll: async (...refs) => { calls.push('read'); assert.equal(refs.length, 3); return refs.map((_, i) => ({ exists: collision && i === 0 })); },
    batch() { calls.push('batch'); return { create(ref, data) { writes.push([ref.id, data]); },
        async commit() { calls.push('commit'); if (race) throw Error('ALREADY_EXISTS'); } }; },
    terminate: async () => calls.push('close') };
    return { db, calls, writes };
}
test('simulação padrão não carrega cliente nem consulta credenciais', async () => {
    const r = await importar(options, { criarCliente: () => assert.fail('SDK proibido') });
    assert.equal(r.mode, 'simulacao'); assert.equal(r.gravados, 0); assert.equal(r.remotoVerificado, false);
});
test('projeto/banco incorretos interrompem antes de acessar cliente', async () => {
    for (const change of [{ project: 'outro' }, { database: 'outro' }, { project: DEMO }, { emulator: true }])
        await assert.rejects(importar({ ...options, ...change }, { criarCliente: () => assert.fail() }), /PROJETO_OU_BANCO/);
});
test('gravação exige confirmação específica do destino', async () => {
    for (const confirm of [undefined, 'sim', 'CRIAR_3_FIXTURES:outro:(default)'])
        await assert.rejects(importar({ ...apply, confirm }), /CONFIRMACAO/);
});
test('manifesto alterado ou ID adicional são recusados', async () => {
    for (const change of [v => v.documentos.push(v.documentos[0]), v => v.documentos[0].id = 'outro', v => v.documentos[0].dados.conteudo = 'alterado']) {
        const manifesto = JSON.parse(readFileSync(new URL('../demo-academica/fixtures.json', import.meta.url)));
        change(manifesto); await assert.rejects(importar(options, { manifesto }), /MANIFESTO_NAO_APROVADO/);
    }
});
test('simulação conectada faz somente leitura dos três caminhos', async () => {
    const m = mock(); const r = await importar({ ...options, checkExisting: true }, { criarCliente: async () => m.db });
    assert.deepEqual(m.calls, ['read', 'close']); assert.equal(r.gravados, 0); assert.equal(r.remotoVerificado, true);
});
test('colisão impede inclusive preparar lote de escrita', async () => {
    const m = mock({ collision: true }); await assert.rejects(importar(apply, { criarCliente: async () => m.db }), /COLISAO/);
    assert.deepEqual(m.calls, ['read', 'close']);
});
test('criação utiliza exclusivamente batch.create e um único commit', async () => {
    const m = mock(); const r = await importar(apply, { criarCliente: async () => m.db });
    assert.deepEqual(m.calls, ['read', 'batch', 'commit', 'close']); assert.equal(r.gravados, 3);
    assert.deepEqual(m.writes.map(w => w[0]), IDS); for (const [, data] of m.writes) assert.equal(data.fixtureDemo, true);
});
test('colisão entre leitura e commit é propagada sem retry ou overwrite', async () => {
    const m = mock({ race: true }); await assert.rejects(importar(apply, { criarCliente: async () => m.db }), /ALREADY_EXISTS/);
    assert.equal(m.calls.filter(c => c === 'commit').length, 1);
});
test('destino efetivo do cliente deve corresponder à configuração', async () => {
    const m = mock({ wrong: true }); await assert.rejects(importar(apply, { criarCliente: async () => m.db }), /DESTINO_CLIENTE/);
    assert.deepEqual(m.calls, ['close']);
});
test('CLI rejeita ambiguidades, valores ausentes e destino incorreto', () => {
    assert.equal(parseArgs(['--project', PROJECT, '--database', '(default)']).apply, false);
    for (const args of [[], ['--project'], ['--project', PROJECT, '--project', PROJECT], ['--project', PROJECT, '--force'], ['--project', PROJECT, 'toString', 'valor'], ['--project', PROJECT, '--apply']]) assert.throws(() => parseArgs(args));
});
test('fábrica recusa emulador sem host exato e produção sem credencial explícita', async () => {
    await assert.rejects(criarClienteExplicito({ ...options, emulator: true, project: DEMO }, {}), /EMULADOR_LOCAL/);
    await assert.rejects(criarClienteExplicito(options, {}), /CREDENCIAL_EXTERNA/);
    await assert.rejects(criarClienteExplicito({ ...options, credentialFile: 'não-ler.json' }, { FIRESTORE_EMULATOR_HOST: 'outro' }), /CREDENCIAL_EXTERNA/);
});
if (process.env.SYLVINHO_IMPORT_EMULATOR === '1') test('Firestore Emulator: atomização, colisão, corrida e preservação de documento alheio', async () => {
    assert.equal(process.env.GCLOUD_PROJECT, DEMO); assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8180');
    const opt = { project: DEMO, database: '(default)', emulator: true, apply: true, confirm: 'CRIAR_3_FIXTURES:' + DEMO + ':(default)' };
    const admin = await criarClienteExplicito(opt); const refs = IDS.map(id => admin.collection('conhecimento').doc(id));
    const sentinel = admin.collection('conhecimento').doc('fixture-fora-importacao');
    try {
        assert.ok((await admin.getAll(...refs)).every(s => !s.exists), 'Emulador deve iniciar vazio');
        await sentinel.create({ fixture: true, intacto: 'sim' });
        const factory = o => criarClienteExplicito(o);
        const result = await importar(opt, { criarCliente: factory }); assert.equal(result.gravados, 3);
        const before = (await admin.getAll(...refs)).map(s => s.data());
        await assert.rejects(importar(opt, { criarCliente: factory }), /COLISAO/);
        assert.deepEqual((await admin.getAll(...refs)).map(s => s.data()), before);
        await Promise.all(refs.map(r => r.delete()));
        const raced = async o => { const db = await criarClienteExplicito(o); const getAll = db.getAll.bind(db);
            db.getAll = async (...args) => { const snapshots = await getAll(...args); await admin.doc('conhecimento/' + IDS[0]).create({ corrida: true }); return snapshots; }; return db; };
        await assert.rejects(importar(opt, { criarCliente: raced }));
        assert.equal((await refs[1].get()).exists, false); assert.equal((await refs[2].get()).exists, false);
        assert.deepEqual((await refs[0].get()).data(), { corrida: true });
        assert.deepEqual((await sentinel.get()).data(), { fixture: true, intacto: 'sim' });
    } finally { await admin.terminate(); }
});
