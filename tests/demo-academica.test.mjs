import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { fixtures, criarLeitorDemonstracao, lerModoDemonstracao } = require('../render-poc/demonstracao.cjs');
const { gerarRespostaDocumental } = require('../functions/lib/assistente/resposta-documental.js');
const { lerConfiguracao } = require('../render-poc/config.cjs');
const { criarServidor } = require('../render-poc/server.cjs');
const configSource = readFileSync(new URL('../public/Logado/Home/assistente-config.js', import.meta.url), 'utf8');
const front = await import('data:text/javascript;base64,' + Buffer.from(configSource).toString('base64'));
const env = { SYLVINHO_POC_MODE: 'documental-emulator', GCLOUD_PROJECT: 'demo-sylvinho-render-poc',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    ASSISTENTE_CORS_ORIGINS: 'http://127.0.0.1:5000', SYLVINHO_DEMO_ACADEMICA: 'true' };
function knowledge(rows = fixtures.map(f => [f.id, { ...f.dados }])) {
    const values = new Map(rows), reads = [];
    const firestore = { collection(name) {
        assert.equal(name, 'conhecimento');
        return { where() { assert.fail('Consulta geral proibida'); }, get() { assert.fail('Leitura geral proibida'); },
            doc(id) { assert.ok(fixtures.some(f => f.id === id)); reads.push(id);
                return { get: async () => ({ exists: values.has(id), data: () => values.get(id) }) }; } };
    } };
    return { firestore, values, reads };
}
test('seleção consulta somente os três IDs fixos e produz referência fictícia', async () => {
    const s = knowledge([...fixtures.map(f => [f.id, { ...f.dados }]), ['fora-selecao', { ativo: true, conteudo: 'Não permitido' }]]);
    const chunks = await criarLeitorDemonstracao(s.firestore)('Como faço minha matrícula?');
    assert.deepEqual(s.reads.sort(), fixtures.map(f => f.id).sort());
    const result = gerarRespostaDocumental('Como faço minha matrícula?', chunks);
    assert.equal(result.status, 'trechos_encontrados');
    assert.match(result.resposta, /AZUL-42/);
    assert.match(result.resposta, /fictícia/);
    assert.match(result.resposta, /fixture-inventada-matricula/);
});
test('nenhuma fixture disponível retorna insuficiência sem fallback', async () => {
    const s = knowledge([['fora-selecao', { ativo: true, titulo: 'Matrícula', conteudo: 'REGRA_NAO_PERMITIDA' }]]);
    const chunks = await criarLeitorDemonstracao(s.firestore)('matricula');
    assert.deepEqual(chunks, []);
    assert.equal(gerarRespostaDocumental('matricula', chunks).status, 'informacao_insuficiente');
    assert.equal(s.reads.length, 3);
});
for (const change of [{ ativo: false }, { fixtureDemo: false }, { versaoDocumento: 'outra' },
    { conteudo: 'Regra não aprovada' }, { titulo: 'Fonte não aprovada' }]) {
    test('fixture alterada ou inativa não é aceita: ' + JSON.stringify(change), async () => {
        const s = knowledge(fixtures.map(f => [f.id, { ...f.dados, ...change }]));
        assert.deepEqual(await criarLeitorDemonstracao(s.firestore)('matricula'), []);
    });
}
test('metadados extras do banco não entram no contexto', async () => {
    const s = knowledge(fixtures.map(f => [f.id, { ...f.dados, fonteSecreta: 'FORA_CONTEXTO' }]));
    assert.doesNotMatch(JSON.stringify(await criarLeitorDemonstracao(s.firestore)('matricula')), /FORA_CONTEXTO/);
});
test('falha de leitura não libera consulta geral', async () => {
    await assert.rejects(criarLeitorDemonstracao({ collection: () => ({ doc: () => ({
        get: async () => { throw new Error('offline'); } }) }) })('matricula'), /offline/);
});
test('flag opt-in é estrita e health continua padrão', () => {
    assert.equal(lerModoDemonstracao({}), false);
    assert.equal(lerModoDemonstracao({ SYLVINHO_DEMO_ACADEMICA: 'false' }), false);
    assert.equal(lerConfiguracao({}).mode, 'health');
    assert.equal(lerConfiguracao(env).demonstracao, true);
    assert.equal(lerConfiguracao({ ...env, SYLVINHO_DEMO_ACADEMICA: 'false' }).demonstracao, undefined);
    assert.throws(() => lerConfiguracao({ SYLVINHO_DEMO_ACADEMICA: 'true' }), /DEMO_REQUIRES/);
    for (const value of ['1', '', 'TRUE', '*']) assert.throws(() => lerModoDemonstracao({ SYLVINHO_DEMO_ACADEMICA: value }), /DEMO_FLAG_INVALID/);
});
test('endpoint publicado permanece vazio; HTTPS e rota são exigidos; timeout publicado 120s', () => {
    assert.equal(front.assistenteConfig.endpoint, '');
    assert.equal(front.assistenteConfig.timeoutMs, 120000);
    assert.equal(front.resolverAssistenteConfig({ origin: 'http://127.0.0.1:5000', local: null }).endpoint, '');
    assert.equal(front.validarEndpointPublicado('https://fixture.example.invalid/perguntarAssistente'), 'https://fixture.example.invalid/perguntarAssistente');
    for (const value of ['', 'http://fixture.example.invalid/perguntarAssistente', 'https://fixture.example.invalid/health',
        'https://u:p@fixture.example.invalid/perguntarAssistente', 'https://fixture.example.invalid/perguntarAssistente?q=1',
        'https://localhost/perguntarAssistente']) assert.throws(() => front.validarEndpointPublicado(value), /ENDPOINT_PUBLICADO_INVALIDO/);
});
test('aviso acadêmico é estático e acessível nas páginas principais', () => {
    const aviso = 'Demonstração acadêmica — dados fictícios — não é atendimento oficial da escola.';
    for (const p of ['Login/login.html', 'Criar-Conta/cadastro.html', 'Logado/Home/home.html', 'Logado/Conversas/conversas.html',
        'Logado/Configurações Aluno/configAl.html']) {
        const html = readFileSync(new URL('../public/' + p, import.meta.url), 'utf8');
        assert.ok(html.includes(aviso)); assert.match(html, /class="academic-demo-banner" role="note"/);
    }
});
test('HTTP real com handler: token, messageId, seleção fechada e replay preservados', async t => {
    const s = knowledge();
    const mid = 'message-academica-000001', cid = 'abcdefghijklmnopqrst';
    const conversation = { mensagens: [{ texto: 'matricula', remetente: 'user', messageId: mid }] };
    const ref = { get: async () => ({ exists: true, data: () => conversation }) };
    const firestore = { collection(name) { if (name === 'conhecimento') return s.firestore.collection(name);
        assert.equal(name, 'users'); return { doc(uid) { assert.equal(uid, 'fixture-uid'); return {
            collection: () => ({ doc(id) { assert.equal(id, cid); return ref; } }) }; } }; },
        runTransaction: async cb => cb({ get: ref.get, update: (_, value) => Object.assign(conversation, value) }) };
    const server = criarServidor({ config: lerConfiguracao(env), obterDependencias: () => ({
        firestore, auth: { verifyIdToken: async token => { assert.equal(token, 'fixture-token'); return { uid: 'fixture-uid' }; } },
        recuperarConhecimento: criarLeitorDemonstracao(firestore), serverTimestamp: () => 1,
        gerarResposta: async (p, chunks) => gerarRespostaDocumental(p, chunks).resposta,
    }) });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const url = 'http://127.0.0.1:' + server.address().port + '/perguntarAssistente';
    const send = () => fetch(url, { method: 'POST', headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: 'matricula', conversationId: cid, messageId: mid }) });
    const a = await send(), b = await send();
    assert.equal(a.status, 200); assert.equal(b.status, 200); assert.deepEqual(await a.json(), await b.json());
    assert.equal(conversation.mensagens.length, 2); assert.equal(s.reads.length, 3);
});

test('fábrica Render emulada conecta a seleção somente quando a flag está ativa', async () => {
    const { criarDependencias } = require('../render-poc/dependencias.cjs');
    const s = knowledge();
    const carregar = name => name.endsWith('/app') ? { getApps: () => [],
        initializeApp: options => ({ options }) } : name.endsWith('/auth') ? { getAuth: () => ({}) } :
        { getFirestore: () => s.firestore, FieldValue: { serverTimestamp: () => 1 } };
    const deps = criarDependencias(lerConfiguracao(env), { carregar, lerAmbiente: () => env });
    assert.equal(typeof deps.recuperarConhecimento, 'function');
    assert.equal((await deps.recuperarConhecimento('matricula')).length, 1);
    const normal = { ...env, SYLVINHO_DEMO_ACADEMICA: 'false' };
    assert.equal(criarDependencias(lerConfiguracao(normal), { carregar, lerAmbiente: () => normal }).recuperarConhecimento, undefined);
});
test('mudança da flag no runtime é rejeitada antes de ler credencial documental', () => {
    const { lerConfiguracaoDocumental, criarDependenciasDocumentais } = require('../render-poc/documental.cjs');
    const online = { RENDER: 'true', NODE_ENV: 'production', GCLOUD_PROJECT: 'tcc-ia-d8891',
        FIRESTORE_DATABASE_ID: '(default)', SYLVINHO_DOCUMENTAL_ENABLED: 'true',
        SYLVINHO_SERVICE_ACCOUNT_EMAIL: 'sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com',
        GOOGLE_APPLICATION_CREDENTIALS: '/etc/secrets/sylvinho-firebase-admin.json',
        ASSISTENTE_CORS_ORIGINS: 'https://tcc-ia-d8891.web.app', SYLVINHO_DEMO_ACADEMICA: 'true' };
    const config = lerConfiguracaoDocumental(online);
    assert.throws(() => criarDependenciasDocumentais(config, { lerAmbiente: () => ({ ...online, SYLVINHO_DEMO_ACADEMICA: 'false' }),
        lerArquivo: () => assert.fail('Nenhuma credencial pode ser lida neste teste') }), /DOCUMENTAL_RUNTIME_CHANGED/);
});

test('health não depende do módulo acadêmico nem carrega fixtures', () => {
    const { execFileSync } = require('node:child_process');
    const code = [
        "const Module = require('node:module'), original = Module._load;",
        "Module._load = function(name, ...args) { if (/demonstracao|fixtures.json/.test(name)) throw Error('FIXTURE_LOAD_FORBIDDEN'); return original.call(this, name, ...args); };",
        "const { criarServidor } = require('./render-poc/server.cjs');",
        "const { lerConfiguracao } = require('./render-poc/config.cjs');",
        "criarServidor({ config: lerConfiguracao({ SYLVINHO_DEMO_ACADEMICA: 'false' }) }); console.log('HEALTH_INDEPENDENT');",
    ].join('\n');
    assert.equal(execFileSync(process.execPath, ['-e', code], { encoding: 'utf8' }).trim(), 'HEALTH_INDEPENDENT');
});

test('mudança da flag emulada também é rejeitada antes de carregar SDKs', () => {
    const { criarDependencias } = require('../render-poc/dependencias.cjs');
    const config = lerConfiguracao(env);
    assert.throws(() => criarDependencias(config, {
        lerAmbiente: () => ({ ...env, SYLVINHO_DEMO_ACADEMICA: 'false' }),
        carregar: () => assert.fail('SDK não deve carregar após mudança de modo'),
    }), /LOCAL_EMULATORS_REQUIRED/);
});
