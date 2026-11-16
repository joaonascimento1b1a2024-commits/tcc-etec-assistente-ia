// Motor curado no servidor Render: adaptador, modos e rota visitante.
// Somente transportes simulados; nenhuma chamada externa, chave real ou Firebase.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {hashIndice} from '../render-poc/motor-curado/curadoria-local.mjs';
import {criarEndpointVisitante} from '../functions/lib/assistente/visitante.js';
import {ErroRespostaTemporaria} from '../functions/lib/assistente/handler.js';

const require = createRequire(import.meta.url);
const {criarMotorCurado, resolverMotor, lerBase} = require('../render-poc/motor-curado.cjs');
const base = lerBase();
const ambiente = () => ({GEMINI_API_KEY: 'chave-sintetica'});

const gerado = corpo => new Response(JSON.stringify({candidates: [{finishReason: 'STOP',
    content: {role: 'model', parts: [{text: JSON.stringify(corpo)}]}}]}), {status: 200});
const vetor = () => Array.from({length: 768}, (_, i) => i === 0 ? 1 : 0);

// Embeddings sintéticos (sem semelhança real) e geração que cita o primeiro fato recebido.
function provedor({geracao, atraso = 0} = {}) {
    const chamadas = {embeddings: 0, geracao: 0, revisao: 0};
    const transporte = async (url, init) => {
        if (atraso) await new Promise(r => setTimeout(r, atraso));
        const corpo = JSON.parse(init.body);
        if (url.includes('Embed')) {
            chamadas.embeddings++;
            return new Response(JSON.stringify({embeddings: corpo.requests.map(() => ({values: vetor()}))}), {status: 200});
        }
        const pedido = JSON.parse(corpo.contents[0].parts[0].text);
        if ('resposta' in pedido) {chamadas.revisao++; return gerado({sustentada: true});}
        chamadas.geracao++;
        if (geracao) return geracao(pedido);
        return gerado({resposta: 'Resposta curada de teste.', ids: [pedido.fatos[0].id]});
    };
    return {transporte, chamadas};
}

const motor = (modo, opcoes = {}) => criarMotorCurado({modo, lerAmbiente: ambiente, base, ...opcoes});

test('SYLVINHO_MOTOR: padrão fluxo, valor inválido bloqueia e falta de chave volta ao fluxo', () => {
    assert.deepEqual({...resolverMotor({})}, {solicitado: 'fluxo', efetivo: 'fluxo', motivo: null});
    assert.equal(resolverMotor({SYLVINHO_MOTOR: ''}).efetivo, 'fluxo');
    assert.throws(() => resolverMotor({SYLVINHO_MOTOR: 'gemini'}), /SYLVINHO_MOTOR_INVALIDO/);
    assert.deepEqual({...resolverMotor({SYLVINHO_MOTOR: 'hibrido'})},
        {solicitado: 'hibrido', efetivo: 'fluxo', motivo: 'GEMINI_API_KEY_AUSENTE'});
    assert.equal(resolverMotor({SYLVINHO_MOTOR: 'hibrido', GEMINI_API_KEY: '  '}).efetivo, 'fluxo');
    assert.equal(resolverMotor({SYLVINHO_MOTOR: 'curado', GEMINI_API_KEY: 'x'}).efetivo, 'curado');
    assert.throws(() => criarMotorCurado({modo: 'fluxo', base}), /SYLVINHO_MOTOR_INVALIDO/);
});

test('base versionada: vetores correspondem exatamente aos registros curados', () => {
    assert.ok(base.registros.length >= 44);
    assert.ok(base.vetores, 'knowledge-local/embeddings-curados.json ausente');
    // Se falhar, a FAQ mudou sem reindexar: rode scripts/indexar-embeddings-curados.mjs e copie o índice.
    assert.equal(base.vetores.hash, hashIndice(base.registros));
    assert.deepEqual(Object.keys(base.vetores.valores).sort(), base.registros.map(r => r.id).sort());
});

test('híbrido: pergunta coberta usa o fato curado certo (trancamento)', async () => {
    const p = provedor();
    const resposta = await motor('hibrido', {transporte: p.transporte})
        .responderConversa('Posso trancar a matrícula? Como funciona?', [], {uid: 'alice'});
    assert.equal(resposta, 'Resposta curada de teste.');
    assert.equal(p.chamadas.geracao, 1);
    assert.equal(p.chamadas.revisao, 1);
});

test('híbrido: sem evidência devolve null; curado responde com a orientação da Secretaria', async () => {
    const pergunta = 'Como peço revisão de nota?';
    const p1 = provedor();
    assert.equal(await motor('hibrido', {transporte: p1.transporte}).responderConversa(pergunta, [], {uid: 'a'}), null);
    assert.equal(p1.chamadas.geracao, 0);
    const p2 = provedor();
    const texto = await motor('curado', {transporte: p2.transporte}).responderConversa(pergunta, [], {uid: 'a'});
    assert.match(texto, /Secretaria confirma/);
});

test('híbrido: busca vetorial indisponível sem resultado lexical também volta ao fluxo', async () => {
    const transporte = async url => url.includes('Embed') ? new Response('{}', {status: 503}) : assert.fail('NAO_GERAR');
    assert.equal(await motor('hibrido', {transporte}).responderVisitante('Como peço revisão de nota?'), null);
});

test('híbrido: informação pendente não cai no fluxo antigo (não inventa preço)', async () => {
    const p = provedor();
    const texto = await motor('hibrido', {transporte: p.transporte})
        .responderConversa('Quanto custa a camiseta do uniforme?', [], {uid: 'a'});
    assert.match(texto, /Secretaria confirma/);
    assert.equal(p.chamadas.geracao, 0);
});

test('limite de uso e resposta não validada viram erro recuperável, sem fluxo reserva', async () => {
    const limite = provedor({geracao: () => new Response('{}', {status: 429})});
    await assert.rejects(motor('hibrido', {transporte: limite.transporte})
        .responderConversa('Posso trancar a matrícula?', [], {uid: 'a'}),
    e => e instanceof ErroRespostaTemporaria && e.motivo === 'LIMITE_USO' && e.esperaSegundos === 30);
    const invalida = provedor({geracao: p => gerado({resposta: 'Custa R$ 999.', ids: [p.fatos[0].id]})});
    await assert.rejects(motor('hibrido', {transporte: invalida.transporte})
        .responderConversa('Posso trancar a matrícula?', [], {uid: 'a'}),
    e => e instanceof ErroRespostaTemporaria && e.motivo === 'RESPOSTA_NAO_VALIDADA');
});

test('cache por conta: repete sem nova chamada para a mesma conta, nunca entre contas', async () => {
    const p = provedor();
    const m = motor('hibrido', {transporte: p.transporte});
    const pergunta = 'Posso trancar a matrícula? Como funciona?';
    await m.responderConversa(pergunta, [], {uid: 'alice'});
    await m.responderConversa(pergunta, [], {uid: 'alice'});
    assert.equal(p.chamadas.geracao, 1);
    await m.responderConversa(pergunta, [], {uid: 'bob'});
    assert.equal(p.chamadas.geracao, 2);
});

test('visitantes simultâneos não se bloqueiam na fila', async () => {
    const p = provedor({atraso: 30});
    const m = motor('hibrido', {transporte: p.transporte});
    const respostas = await Promise.all([
        m.responderVisitante('Posso trancar a matrícula? Como funciona?'),
        m.responderVisitante('Quais documentos preciso para me matricular?'),
    ]);
    assert.deepEqual(respostas, ['Resposta curada de teste.', 'Resposta curada de teste.']);
});

test('visitante: esclarecimento avisa que o chat não guarda contexto; saudação não', async () => {
    const m = motor('hibrido', provedor());
    const esclarecimento = await m.responderVisitante('Como faço a matrícula');
    assert.match(esclarecimento, /^Você quer fazer a matrícula inicial ou renovar.*Reenvie a pergunta completa/);
    const saudacao = await m.responderVisitante('Oi');
    assert.doesNotMatch(saudacao, /Reenvie/);
});

test('diagnóstico não registra a pergunta nem a resposta', async () => {
    const eventos = [];
    const pergunta = 'Posso trancar a matrícula? Sou a Maria Silva.';
    await motor('hibrido', {...provedor(), registrar: (c, d) => eventos.push([c, d])})
        .responderVisitante(pergunta).catch(() => {});
    const texto = JSON.stringify(eventos);
    assert.ok(eventos.some(([c]) => c === 'MOTOR_RESPOSTA'));
    assert.doesNotMatch(texto, /Maria|trancar|Resposta curada/);
});

test('falha ao carregar o motor: híbrido usa o fluxo, curado responde indisponível', async () => {
    const quebrada = {...base, registros: [{id: 'ID INVALIDO'}]};
    assert.equal(await motor('hibrido', {base: quebrada}).responderVisitante('Posso trancar?'), null);
    await assert.rejects(motor('curado', {base: quebrada}).responderVisitante('Posso trancar?'),
        e => e instanceof ErroRespostaTemporaria && e.motivo === 'INDISPONIVEL');
});

// Rota visitante com o gancho opcional.
async function visitante(deps, pergunta = 'Posso trancar a matrícula?') {
    const endpoint = criarEndpointVisitante(() => deps, () => 'https://sylvinho.web.app');
    const res = {code: null, body: null, headers: {}, headersSent: false,
        set(n, v) {this.headers[n] = v; return this;}, vary() {return this;},
        status(c) {this.code = c; return this;}, json(b) {this.body = b; this.headersSent = true; return this;}};
    await endpoint({method: 'POST', body: {pergunta}, get: n => n.toLowerCase() === 'origin' ? 'https://sylvinho.web.app' : undefined}, res);
    return res;
}
const antigo = () => {
    const calls = {antigo: 0};
    return {calls, recuperarConhecimento: async () => {calls.antigo++; return [];},
        gerarResposta: async () => 'Resposta do fluxo documental'};
};

test('rota visitante: usa o motor curado e só chama o fluxo antigo quando recebe null', async () => {
    const a = antigo();
    let r = await visitante({...a, responderVisitante: async () => 'Resposta curada'});
    assert.equal(r.code, 200);
    assert.equal(r.body.resposta, 'Resposta curada');
    assert.equal(a.calls.antigo, 0);
    r = await visitante({...a, responderVisitante: async () => null});
    assert.equal(r.body.resposta, 'Resposta do fluxo documental');
    assert.equal(a.calls.antigo, 1);
    r = await visitante(antigo());
    assert.equal(r.body.resposta, 'Resposta do fluxo documental');
});

test('rota visitante: erro recuperável vira 429/503 com Retry-After, como na rota da conta', async () => {
    let r = await visitante({...antigo(), responderVisitante: async () => {throw new ErroRespostaTemporaria('LIMITE_USO', 30);}});
    assert.equal(r.code, 429);
    assert.equal(r.headers['Retry-After'], '30');
    assert.equal(r.body.codigo, 'LIMITE_USO');
    r = await visitante({...antigo(), responderVisitante: async () => {throw new ErroRespostaTemporaria('TEMPO_EXCEDIDO', 2);}});
    assert.equal(r.code, 503);
    r = await visitante({...antigo(), responderVisitante: async () => {throw new Error('interno');}});
    assert.equal(r.code, 500);
});

// Servidor documental completo com Firebase e provedor simulados.
const {criarDependenciasDocumentais, lerConfiguracaoDocumental} = require('../render-poc/documental.cjs');
const {criarServidor} = require('../render-poc/server.cjs');
const envDocumental = {
    RENDER: 'true', NODE_ENV: 'production', SYLVINHO_POC_MODE: 'documental',
    GCLOUD_PROJECT: 'tcc-ia-d8891', FIRESTORE_DATABASE_ID: '(default)', SYLVINHO_DOCUMENTAL_ENABLED: 'true',
    GOOGLE_APPLICATION_CREDENTIALS: '/etc/secrets/sylvinho-firebase-admin.json',
    SYLVINHO_SERVICE_ACCOUNT_EMAIL: 'sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com',
    ASSISTENTE_CORS_ORIGINS: 'https://sylvinho.web.app',
};
function depsDocumentais(env) {
    return criarDependenciasDocumentais(lerConfiguracaoDocumental(env), {
        lerAmbiente: () => env,
        lerArquivo: () => JSON.stringify({type: 'service_account', project_id: env.GCLOUD_PROJECT,
            client_email: env.SYLVINHO_SERVICE_ACCOUNT_EMAIL, private_key: '-----BEGIN PRIVATE KEY----- SOMENTE MOCK',
            token_uri: 'https://oauth2.googleapis.com/token'}),
        carregar(nome) {
            if (nome === 'firebase-admin/app') return {getApps: () => [], cert: () => ({}), initializeApp: () => ({})};
            if (nome === 'firebase-admin/auth') return {getAuth: () => ({async verifyIdToken() {throw Error('invalido');}})};
            if (nome === 'firebase-admin/firestore') return {getFirestore: () => ({}), FieldValue: {serverTimestamp: () => 1}};
            assert.fail('modulo inesperado');
        },
    });
}

test('produção: SYLVINHO_MOTOR ausente ou fluxo mantém exatamente as dependências anteriores', t => {
    t.mock.method(console, 'info', () => {});
    const chaves = env => Object.keys(depsDocumentais(env)).sort();
    const antes = chaves(envDocumental);
    assert.deepEqual(chaves({...envDocumental, SYLVINHO_MOTOR: 'fluxo', GEMINI_API_KEY: 'x'}), antes);
    assert.deepEqual(chaves({...envDocumental, SYLVINHO_MOTOR: 'hibrido'}), antes, 'sem chave volta ao fluxo');
    assert.ok(!antes.includes('responderConversa') && !antes.includes('responderVisitante'));
    assert.throws(() => lerConfiguracaoDocumental({...envDocumental, SYLVINHO_MOTOR: 'outro'}), /SYLVINHO_MOTOR_INVALIDO/);
});

test('produção híbrida: HTTP visitante -> motor curado -> Gemini simulado; health identifica motor', async t => {
    const env = {...envDocumental, SYLVINHO_MOTOR: 'hibrido', GEMINI_API_KEY: 'chave-sintetica'};
    const logs = [];
    t.mock.method(console, 'info', (...itens) => logs.push(itens.join(' ')));
    const realFetch = globalThis.fetch;
    const p = provedor();
    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        urls.push(String(url));
        assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\//);
        assert.equal(init.headers['x-goog-api-key'], 'chave-sintetica');
        return p.transporte(url, init);
    });
    const antes = {...process.env};
    t.after(() => {for (const k of ['SYLVINHO_MOTOR', 'GEMINI_API_KEY', 'RENDER_GIT_COMMIT']) if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k];});
    Object.assign(process.env, {SYLVINHO_MOTOR: 'hibrido', GEMINI_API_KEY: 'chave-sintetica', RENDER_GIT_COMMIT: 'abcdef1234567890'});
    const deps = depsDocumentais(env);
    assert.equal(typeof deps.responderConversa, 'function');
    const server = criarServidor({config: lerConfiguracaoDocumental(env), obterDependencias: () => deps});
    server.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    t.after(() => new Promise(r => {server.close(r); server.closeAllConnections();}));
    const base = 'http://127.0.0.1:' + server.address().port;
    const saude = await (await realFetch(base + '/health')).json();
    assert.deepEqual(saude, {status: 'ok', service: 'sylvinho-backend', motor: 'hibrido', revisao: 'abcdef1'});
    assert.doesNotMatch(JSON.stringify(saude), /chave-sintetica/);
    const r = await realFetch(base + '/perguntarVisitante', {method: 'POST',
        headers: {'Content-Type': 'application/json', Origin: 'https://sylvinho.web.app'},
        body: JSON.stringify({pergunta: 'Posso trancar a matrícula? Como funciona?'})});
    assert.equal(r.status, 200);
    assert.equal((await r.json()).resposta, 'Resposta curada de teste.');
    assert.equal(p.chamadas.geracao, 1);
    assert.equal(p.chamadas.revisao, 1);
    assert.ok(logs.some(l => l.includes('MOTOR_RESPOSTA')));
    assert.doesNotMatch(logs.join('\n'), /trancar|chave-sintetica|Resposta curada/);
});
