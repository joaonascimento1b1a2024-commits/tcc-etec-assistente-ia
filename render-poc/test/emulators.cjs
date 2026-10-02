'use strict';
const assert = require('node:assert/strict');
const { criarServidor, criarDependencias, lerConfiguracao, DEMO_PROJECT, MOCK_RESPONSE } = require('../server.cjs');
let stage = 'config';

async function run() {
    const config = lerConfiguracao();
    assert.equal(config.mode, 'emulator');
    stage = 'admin-init';
    const deps = criarDependencias(config);
    stage = 'auth-signup';
    const result = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
    });
    assert.equal(result.status, 200);
    const session = await result.json();
    stage = 'auth-verify';
    const decoded = await deps.auth.verifyIdToken(session.idToken);
    assert.equal(decoded.uid, session.localId);
    assert.equal(decoded.aud, DEMO_PROJECT);
    const ref = deps.firestore.collection('users').doc(decoded.uid).collection('conversas').doc();
    stage = 'firestore-fixtures';
    await ref.set({ titulo: 'POC ficticia', tituloOrigem: 'provisorio',
        criadoEm: deps.serverTimestamp(), atualizadoEm: deps.serverTimestamp(),
        mensagens: [{ texto: 'matricula', remetente: 'user', enviadoEm: 1 }],
    });
    for (const ativo of [true, false]) await deps.firestore.collection('conhecimento').doc(`poc-${ativo}`).set({
        ativo, titulo: 'Matricula ficticia', documentoId: 'fixture-local', paginaInicial: 1, paginaFinal: 2,
        conteudo: ativo ? 'MARCADOR_ATIVO: matricula simulada.' : 'MARCADOR_INATIVO: nao usar.',
    });
    let generations = 0;
    let prompt;
    deps.gerarResposta = async (value) => { generations++; prompt = value; return MOCK_RESPONSE; };
    const server = criarServidor({ config, obterDependencias: () => deps });
    stage = 'http-start';
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    try {
        const base = `http://127.0.0.1:${server.address().port}`;
        stage = 'health';
        assert.equal((await fetch(`${base}/health`)).status, 200);
        stage = 'authenticated-post';
        const response = await fetch(`${base}/perguntarAssistente`, { method: 'POST', headers: {
            'Content-Type': 'application/json', Authorization: `Bearer ${session.idToken}`, Origin: 'http://localhost:5000',
        }, body: JSON.stringify({ pergunta: 'matricula', conversationId: ref.id, usuarioId: 'nao-autorizado' }) });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { resposta: MOCK_RESPONSE });
        stage = 'firestore-verification';
        const saved = (await ref.get()).data();
        assert.equal(saved.mensagens.length, 2);
        assert.deepEqual(saved.mensagens.map((m) => m.remetente), ['user', 'bot']);
        assert.equal(saved.mensagens[1].texto, MOCK_RESPONSE);
        assert.equal(saved.tituloOrigem, 'provisorio');
        assert.equal(generations, 1);
        assert.match(prompt, /MARCADOR_ATIVO/); assert.doesNotMatch(prompt, /MARCADOR_INATIVO/);
        stage = 'invalid-token';
        const invalid = await fetch(`${base}/perguntarAssistente`, { method: 'POST', headers: {
            'Content-Type': 'application/json', Authorization: 'Bearer invalido',
        }, body: JSON.stringify({ pergunta: 'matricula', conversationId: ref.id }) });
        assert.equal(invalid.status, 401); assert.equal(generations, 1);
        console.log(JSON.stringify({ success: true, project: DEMO_PROJECT, health: 200, authenticatedPost: 200,
            invalidToken: 401, messages: 2, mockCalls: generations, geminiCalls: 0, productionAccess: false }));
    } finally {
        await new Promise((done) => { server.close(done); server.closeAllConnections(); });
        await deps.firestore.terminate();
    }
}
run().catch((error) => {
    const code = /^[a-zA-Z0-9_/-]+$/.test(String(error.code || '')) ? error.code : 'DETAILS_OMITTED';
    console.error(JSON.stringify({ error: 'POC_EMULATOR_TEST_FAILED', stage, code }));
    process.exitCode = 1;
});
