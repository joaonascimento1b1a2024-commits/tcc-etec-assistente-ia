import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
const require = createRequire(import.meta.url);
const {lerConfiguracaoDocumental, criarDependenciasDocumentais} = require('../render-poc/documental.cjs');
const {criarServidor} = require('../render-poc/server.cjs');
const env = {RENDER: 'true', NODE_ENV: 'production', GCLOUD_PROJECT: 'tcc-ia-d8891',
    FIRESTORE_DATABASE_ID: '(default)', SYLVINHO_DOCUMENTAL_ENABLED: 'true', SYLVINHO_DEMO_ACADEMICA: 'false',
    GOOGLE_APPLICATION_CREDENTIALS: '/etc/secrets/sylvinho-firebase-admin.json',
    SYLVINHO_SERVICE_ACCOUNT_EMAIL: 'sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com',
    ASSISTENTE_CORS_ORIGINS: 'https://tcc-ia-d8891.web.app'};

test('Render original recusa fixtures conta diferente projeto errado e CORS aberto', () => {
    for (const alteracao of [{SYLVINHO_DEMO_ACADEMICA: 'true'},
        {SYLVINHO_SERVICE_ACCOUNT_EMAIL: 'outra-conta@tcc-ia-d8891.iam.gserviceaccount.com'},
        {GCLOUD_PROJECT: 'demo-sylvinho-render-poc'}, {ASSISTENTE_CORS_ORIGINS: '*'},
        {ASSISTENTE_CORS_ORIGINS: 'https://tcc-ia-d8891.web.app/'}]) {
        assert.throws(() => lerConfiguracaoDocumental({...env, ...alteracao}));
    }
});

test('Node HTTP -> fabrica Render -> RAG original -> gerador -> historico, com SDKs mockados', async t => {
    const documentos = JSON.parse(readFileSync(new URL('./dados/rag-original.json', import.meta.url))).documentos;
    const conversationId = 'AbCdEfGhIjKlMnOpQrSt', messageId = 'render-original-mensagem-0001';
    const pergunta = 'Qual a frequência mínima para aprovação?';
    const conversa = {mensagens: [{texto: pergunta, remetente: 'user', enviadoEm: 1, messageId}]};
    let gravacoes = 0;
    const ref = {path: `users/usuario-teste/conversas/${conversationId}`,
        async get() {return {exists: true, data: () => structuredClone(conversa)};}};
    const firestore = {collection(nome) {
        if (nome === 'conhecimento') return {where(...args) {
            assert.deepEqual(args, ['ativo', '==', true]);
            return {async get() {return {forEach(cb) {documentos.forEach(d => cb({id: d.id, data: () => d}));}};}};
        }};
        assert.equal(nome, 'users');
        return {doc(uid) {assert.equal(uid, 'usuario-teste'); return {collection(sub) {
            assert.equal(sub, 'conversas'); return {doc(id) {assert.equal(id, conversationId); return ref;}};
        }};}};
    }, async runTransaction(callback) {return callback({get: () => ref.get(), update(r, dados) {
        assert.equal(r, ref); gravacoes++; Object.assign(conversa, dados);
    }});}};
    const carregados = [];
    const deps = criarDependenciasDocumentais(lerConfiguracaoDocumental(env), {
        lerAmbiente: () => env,
        // Somente estrutura de teste; nao existe chave criptografica ou arquivo de credencial.
        lerArquivo: caminho => {assert.equal(caminho, env.GOOGLE_APPLICATION_CREDENTIALS); return JSON.stringify({
            type: 'service_account', project_id: env.GCLOUD_PROJECT, client_email: env.SYLVINHO_SERVICE_ACCOUNT_EMAIL,
            private_key: '-----BEGIN PRIVATE KEY----- MOCK SEM CHAVE', token_uri: 'https://oauth2.googleapis.com/token'});},
        carregar(nome) {
            carregados.push(nome);
            if (nome === 'firebase-admin/app') return {getApps: () => [], cert: () => ({}),
                initializeApp: opts => {assert.equal(opts.projectId, env.GCLOUD_PROJECT); return {};}};
            if (nome === 'firebase-admin/auth') return {getAuth: () => ({verifyIdToken: async token => {
                if (token !== 'token-apenas-teste') throw Error('INVALID_TOKEN'); return {uid: 'usuario-teste'};
            }})};
            if (nome === 'firebase-admin/firestore') return {getFirestore: (_, database) => {
                assert.equal(database, '(default)'); return firestore;
            }, FieldValue: {serverTimestamp: () => 2}};
            assert.fail('Modulo inesperado: ' + nome);
        },
    });
    assert.equal(typeof deps.recuperarConhecimento, 'function');
    const server = criarServidor({config: lerConfiguracaoDocumental(env), obterDependencias: () => deps});
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(done => server.close(done)));
    const endpoint = `http://127.0.0.1:${server.address().port}/perguntarAssistente`;
    const post = (origin = env.ASSISTENTE_CORS_ORIGINS, token = 'token-apenas-teste') => fetch(endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin, Authorization: 'Bearer ' + token},
        body: JSON.stringify({pergunta, conversationId, messageId, usuarioId: 'body-nao-escolhe-uid'}),
    });
    assert.equal((await post('https://origem-nao-autorizada.invalid')).status, 403);
    assert.equal((await post(env.ASSISTENTE_CORS_ORIGINS, 'invalido')).status, 401);
    const resposta = await post(); assert.equal(resposta.status, 200);
    const body = await resposta.json();
    assert.deepEqual(Object.keys(body), ['resposta']);
    assert.match(body.resposta, /75%[\s\S]*componentes curriculares/);
    assert.match(body.resposta, /Regimento Comum - Artigo 83/);
    assert.equal(resposta.headers.get('access-control-allow-origin'), env.ASSISTENTE_CORS_ORIGINS);
    assert.deepEqual(await (await post()).json(), body);
    assert.equal(gravacoes, 1); assert.equal(conversa.mensagens.length, 2);
    assert.equal(conversa.mensagens[1].messageId, messageId);
    assert.deepEqual(carregados, ['firebase-admin/app', 'firebase-admin/auth', 'firebase-admin/firestore']);
});
