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

test('híbrido: modelo sem fato aplicável (ids vazio) volta ao fluxo; curado orienta a Secretaria', async () => {
    // Caso real de 16/11: "dois cursos" trazia 5 fatos de outros assuntos e o modelo respondeu ids: [].
    const geracao = () => gerado({resposta: 'A Secretaria Acadêmica confirma isso.', ids: []});
    const pergunta = 'Posso trancar a matrícula? Como funciona?';
    const p1 = provedor({geracao});
    assert.equal(await motor('hibrido', {transporte: p1.transporte}).responderVisitante(pergunta), null);
    assert.equal(p1.chamadas.geracao, 1);
    assert.equal(p1.chamadas.revisao, 0);
    const p2 = provedor({geracao});
    assert.match(await motor('curado', {transporte: p2.transporte}).responderConversa(pergunta, [], {uid: 'a'}), /Secretaria confirma/);
    // ids com valor desconhecido continua sendo resposta inválida.
    const p3 = provedor({geracao: () => gerado({resposta: 'x', ids: ['inexistente']})});
    await assert.rejects(motor('hibrido', {transporte: p3.transporte}).responderVisitante(pergunta),
        e => e instanceof ErroRespostaTemporaria && e.motivo === 'RESPOSTA_NAO_VALIDADA');
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

test('limite em todos os modelos: híbrido usa o fluxo; curado vira erro recuperável', async () => {
    const eventos = [];
    const limite = provedor({geracao: () => new Response('{}', {status: 429})});
    assert.equal(await motor('hibrido', {transporte: limite.transporte, registrar: (e, d) => eventos.push({e, ...d})})
        .responderConversa('Posso trancar a matrícula?', [], {uid: 'a'}), null);
    assert.ok(eventos.some(x => x.e === 'MOTOR_FLUXO_RESERVA' && x.motivo === 'HTTP_429'));
    const sobrecarga = provedor({geracao: () => new Response('{}', {status: 503})});
    assert.equal(await motor('hibrido', {transporte: sobrecarga.transporte}).responderVisitante('Posso trancar a matrícula?'), null);
    const limiteCurado = provedor({geracao: () => new Response('{}', {status: 429})});
    await assert.rejects(motor('curado', {transporte: limiteCurado.transporte})
        .responderConversa('Posso trancar a matrícula?', [], {uid: 'a'}),
    e => e instanceof ErroRespostaTemporaria && e.motivo === 'LIMITE_USO' && e.esperaSegundos === 30);
});

test('Regimento com moderação: uma menção sustentada pelo fato passa; excesso ou sem apoio é barrado', async () => {
    const {criarGeminiCurado} = await import('../render-poc/motor-curado/gemini-curado.mjs');
    const casos = [
        {comRegimento: true, resposta: 'Pode fazer junto com o ensino médio. Sobre dois cursos técnicos, o Regimento não traz uma regra e a Secretaria confirma.', esperado: 'gemini_curado'},
        {comRegimento: true, resposta: 'O Regimento permite a forma concomitante. O Regimento não traz regra para dois cursos.', esperado: 'LINGUAGEM'},
        {comRegimento: false, resposta: 'Segundo o Regimento, o trancamento depende da Direção.', esperado: 'LINGUAGEM', pergunta: 'Posso trancar a matrícula? Como funciona?'},
    ];
    for (const caso of casos) {
        const transporte = async (url, init) => {
            const corpo = JSON.parse(init.body);
            if (url.includes('Embed')) return new Response(JSON.stringify({embeddings: corpo.requests.map(() => ({values: vetor()}))}), {status: 200});
            const pedido = JSON.parse(corpo.contents[0].parts[0].text);
            if ('resposta' in pedido) return gerado({sustentada: true});
            const fato = pedido.fatos.find(f => /\bregimento\b/i.test(f.texto) === caso.comRegimento);
            assert.ok(fato, 'a busca precisa trazer um fato ' + (caso.comRegimento ? 'com' : 'sem') + ' Regimento');
            return gerado({resposta: caso.resposta, ids: [fato.id]});
        };
        const m = criarGeminiCurado({...base, lerChave: () => 'chave-sintetica', transporte, modelo: 'gemini-a', modeloReserva: ''});
        const r = await m.responder({pergunta: caso.pergunta || 'Posso fazer o curso técnico junto com o ensino médio, ou dois cursos técnicos ao mesmo tempo?'});
        assert.equal(r.tipo === 'falha' ? r.codigo : r.tipo, caso.esperado, caso.resposta);
    }
});

test('lista de modelos: pula os que estão no limite, na geração e na revisão', async () => {
    const {criarGeminiCurado} = await import('../render-poc/motor-curado/gemini-curado.mjs');
    const usados = [];
    let revisoes = 0;
    const transporte = async (url, init) => {
        const corpo = JSON.parse(init.body);
        if (url.includes('Embed')) return new Response(JSON.stringify({embeddings: corpo.requests.map(() => ({values: vetor()}))}), {status: 200});
        const modelo = url.split('/models/')[1].split(':')[0];
        const pedido = JSON.parse(corpo.contents[0].parts[0].text);
        usados.push(modelo + ('resposta' in pedido ? ':revisao' : ':geracao'));
        if (modelo === 'gemini-a' || modelo === 'gemini-b') return new Response('{}', {status: 429});
        if ('resposta' in pedido) {
            // A revisão do modelo que gerou também bate no limite; a próxima da lista revisa.
            if (modelo === 'gemini-c' && revisoes++ === 0) return new Response('{}', {status: 429});
            return gerado({sustentada: true});
        }
        return gerado({resposta: 'Resposta curada de teste.', ids: [pedido.fatos[0].id]});
    };
    const motorLista = criarGeminiCurado({...base, lerChave: () => 'chave-sintetica', transporte,
        modelo: 'gemini-a', modeloReserva: ' gemini-b, gemini-c ,gemini-d'});
    assert.deepEqual(motorLista.configuracao.modelos, ['gemini-a', 'gemini-b', 'gemini-c', 'gemini-d']);
    const r = await motorLista.responder({pergunta: 'Posso trancar a matrícula? Como funciona?'});
    assert.equal(r.tipo, 'gemini_curado');
    assert.equal(r.modelo, 'gemini-c');
    // a e b entram em espera após o 429 e não são chamados de novo na revisão.
    assert.deepEqual(usados, ['gemini-a:geracao', 'gemini-b:geracao', 'gemini-c:geracao', 'gemini-c:revisao', 'gemini-d:revisao']);
    assert.throws(() => criarGeminiCurado({...base, lerChave: () => 'x', modelo: 'gemini-a', modeloReserva: 'gemini-b,outro'}), /MODELO_INVALIDO/);
});

test('tempo excedido no provedor não cai no fluxo (somaria dois tempos de espera)', async () => {
    const {criarGeminiCurado} = await import('../render-poc/motor-curado/gemini-curado.mjs');
    const lento = provedor({geracao: () => {throw new Error('PROVEDOR_TIMEOUT');}});
    const r = await criarGeminiCurado({...base, lerChave: () => 'x', transporte: lento.transporte, modelo: 'gemini-a', modeloReserva: ''})
        .responder({pergunta: 'Posso trancar a matrícula? Como funciona?'});
    assert.equal(r.codigo, 'PROVEDOR_TIMEOUT');
    assert.match(r.texto, /demorou/);
    const lentoAdaptador = provedor({geracao: () => {throw new Error('PROVEDOR_TIMEOUT');}});
    await assert.rejects(motor('hibrido', {transporte: lentoAdaptador.transporte}).responderVisitante('Posso trancar a matrícula? Como funciona?'),
        e => e instanceof ErroRespostaTemporaria && e.motivo === 'TEMPO_EXCEDIDO');
});

test('resposta não validada vira erro recuperável, sem fluxo reserva', async () => {
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

test('rota visitante: pergunta sem palavra-chave tenta o motor; sem fato, mantém o esclarecimento sem fluxo', async () => {
    const pergunta = 'Posso fazer o técnico junto com o ensino médio?';
    let a = antigo();
    let r = await visitante({...a, responderVisitante: async () => 'Sim, na forma concomitante.'}, pergunta);
    assert.equal(r.body.resposta, 'Sim, na forma concomitante.');
    a = antigo();
    r = await visitante({...a, responderVisitante: async () => null}, pergunta);
    assert.match(r.body.resposta, /Sobre qual procedimento/);
    assert.equal(a.calls.antigo, 0);
    // Modo fluxo (sem gancho): comportamento anterior.
    a = antigo();
    r = await visitante(a, pergunta);
    assert.match(r.body.resposta, /Sobre qual procedimento/);
    assert.equal(a.calls.antigo, 0);
    // Fora de escopo e saudação continuam locais, sem consultar o motor.
    let consultas = 0;
    for (const p of ['Qual a capital da França?', 'Oi']) {
        r = await visitante({...antigo(), responderVisitante: async () => {consultas++; return 'x';}}, p);
        assert.notEqual(r.body.resposta, 'x');
    }
    assert.equal(consultas, 0);
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
