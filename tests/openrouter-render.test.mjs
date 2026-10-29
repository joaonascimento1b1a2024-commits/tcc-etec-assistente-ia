import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {pergunta, criarChunk, texto} from './fixtures/fundamentacao-sintetica.mjs';
import {VERSAO_FLUXO_CONVERSA} from '../functions/lib/assistente/geracao/conversa.js';
const require = createRequire(import.meta.url);
const {criarDependenciasDocumentais, lerConfiguracaoDocumental} = require('../render-poc/documental.cjs');
const {criarServidor} = require('../render-poc/server.cjs');
const uid = 'usuario-sintetico', cid = 'AbCdEfGhIjKlMnOpQrSt', mid = 'openrouter-sintetico-0001';
const env = {
  RENDER: 'true', NODE_ENV: 'production', SYLVINHO_POC_MODE: 'documental',
  GCLOUD_PROJECT: 'tcc-ia-d8891', FIRESTORE_DATABASE_ID: '(default)', SYLVINHO_DOCUMENTAL_ENABLED: 'true',
  GOOGLE_APPLICATION_CREDENTIALS: '/etc/secrets/sylvinho-firebase-admin.json',
  SYLVINHO_SERVICE_ACCOUNT_EMAIL: 'sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com',
  ASSISTENTE_CORS_ORIGINS: 'https://tcc-ia-d8891.web.app',
  OPENROUTER_MODEL: 'google/gemini-3.5-flash-lite', OPENROUTER_API_KEY: 'chave-ficticia',
  SYLVINHO_IA_PROVIDER: 'openrouter', SYLVINHO_IA_ENABLED: 'true', SYLVINHO_IA_UID_ALLOWLIST: uid,
  SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true', SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true',
  SYLVINHO_IA_MENORES_APROVADA: 'true', SYLVINHO_IA_ZDR_APROVADO: 'true',
  SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true',
};

for (const decisao of ['aprovar', 'corrigir']) test('HTTP -> Firebase simulado -> busca -> OpenRouter -> transacao e replay: '+decisao, async t => {
  const realFetch = globalThis.fetch;
  const chamadas = [], logs = [];
  const propostaTexto = decisao === 'corrigir' ? 'Segundo o trecho fornecido, '+texto : texto;
  t.mock.method(console, 'info', (...items) => logs.push(items));
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    // Nenhuma conexao externa: interceptar todo o transporte do provedor.
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(init.body); chamadas.push(body);
    assert.equal(body.model, env.OPENROUTER_MODEL);
    assert.equal(init.headers.Authorization, 'Bearer chave-ficticia');
    const props = body.response_format.json_schema.schema.properties;
    const dados = JSON.parse(body.messages[1].content);
    const evidencias = props.decisao ? dados.pedido.evidencias : dados.evidencias;
    const resposta = valorTexto => ({tipo: 'documental', mensagem: '', afirmacoes: [{texto: valorTexto,
      referencias: [{id: evidencias[0].id, citacao: evidencias[0].texto}]}]});
    const valor = props.segura ? {segura: true} : props.decisao ? {
      decisao, motivo: decisao === 'corrigir' ? 'CLAREZA' : 'SEM_PROBLEMA',
      respostas: decisao === 'corrigir' ? [resposta(texto)] : [],
    } : resposta(propostaTexto);
    return new Response(JSON.stringify({choices: [{finish_reason: 'stop',
      message: {role: 'assistant', content: JSON.stringify(valor)}}]}));
  });
  const legado = [{remetente: 'user', texto: 'Mensagem antiga sintetica'},
    {remetente: 'bot', texto: 'Resposta antiga sintetica'}];
  const conversa = {titulo: 'Titulo preservado', mensagens: [...legado, {remetente: 'user', texto: pergunta, messageId: mid}]};
  let gravacoes = 0, leituras = 0;
  const ref = {path: `users/${uid}/conversas/${cid}`, async get() {
    leituras++; return {exists: true, data: () => structuredClone(conversa)};
  }};
  const firestore = {collection(nome) {
    if (nome === 'conhecimento') return {where(...args) {
      assert.deepEqual(args, ['ativo', '==', true]);
      return {async get() {return {forEach(cb) {const d = criarChunk(); cb({id: d.id, data: () => d});}};}};
    }};
    assert.equal(nome, 'users'); return {doc(identidade) {return {collection(sub) {
      assert.equal(sub, 'conversas'); return {doc(id) {
        assert.equal(id, cid); return identidade === uid ? ref : {get: async () => ({exists: false})};
      }};
    }};}};
  }, async runTransaction(cb) {return cb({get: () => ref.get(), update(r, data) {
    assert.equal(r, ref); gravacoes++; Object.assign(conversa, data);
  }});}};
  const config = lerConfiguracaoDocumental(env);
  const deps = criarDependenciasDocumentais(config, {
    lerAmbiente: () => env,
    lerArquivo: () => JSON.stringify({type: 'service_account', project_id: env.GCLOUD_PROJECT,
      client_email: env.SYLVINHO_SERVICE_ACCOUNT_EMAIL, private_key: '-----BEGIN PRIVATE KEY----- SOMENTE MOCK',
      token_uri: 'https://oauth2.googleapis.com/token'}),
    carregar(nome) {
      if (nome === 'firebase-admin/app') return {getApps: () => [], cert: () => ({}), initializeApp: () => ({})};
      if (nome === 'firebase-admin/auth') return {getAuth: () => ({async verifyIdToken(token) {
        if (token === 'ficticio') return {uid};
        if (token === 'outro') return {uid: 'outra-pessoa-sintetica'};
        throw Error('invalido');
      }})};
      if (nome === 'firebase-admin/firestore') return {getFirestore: () => firestore, FieldValue: {serverTimestamp: () => 1}};
      assert.fail('modulo inesperado');
    },
  });
  const server = criarServidor({config, obterDependencias: () => deps});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => {server.close(resolve); server.closeAllConnections();}));
  const base = 'http://127.0.0.1:'+server.address().port;
  const post = (body, {token = 'ficticio', origin = env.ASSISTENTE_CORS_ORIGINS, path = '/perguntarAssistente'} = {}) =>
    realFetch(base+path, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin,
      ...(token ? {Authorization: 'Bearer '+token} : {})}, body: JSON.stringify(body)});
  const payload = {pergunta, conversationId: cid, messageId: mid,
    provider: 'gemini', model: 'modelo-injetado', GEMINI_API_KEY: 'injetada', OPENROUTER_API_KEY: 'injetada',
    url: 'https://destino-invalido.invalid', uid};
  assert.equal((await realFetch(base+'/health')).status, 200);
  assert.equal(leituras, 0); assert.equal(chamadas.length, 0);
  for (const token of ['', 'invalido']) assert.equal((await post(payload, {token})).status, 401);
  assert.equal(leituras, 0);
  assert.equal((await post(payload, {origin: 'https://intruso.invalid'})).status, 403);
  assert.equal((await post(payload, {token: 'outro'})).status, 404);
  assert.equal(chamadas.length, 0);
  const rs = await Promise.all(Array.from({length: 5}, () => post(payload)));
  assert.ok(rs.every(r => r.status === 200));
  const bodies = await Promise.all(rs.map(r => r.json()));
  assert.ok(bodies.every(b => b.resposta === bodies[0].resposta));
  assert.match(bodies[0].resposta, /^Resposta gerada por IA/);
  assert.ok(bodies[0].resposta.includes(texto));
  if (decisao === 'corrigir') {
    assert.equal(bodies[0].resposta.includes(propostaTexto), false);
    const moderada = JSON.parse(chamadas[3].messages[1].content).texto;
    assert.equal(moderada, bodies[0].resposta);
  }
  assert.equal(chamadas.length, 4); assert.equal(gravacoes, 1);
  assert.equal(conversa.titulo, 'Titulo preservado');
  assert.deepEqual(conversa.mensagens.slice(0, 2), legado);
  assert.equal(conversa.mensagens.length, 4);
  assert.equal(conversa.mensagens[3].texto, bodies[0].resposta);
  assert.deepEqual(await (await post(payload)).json(), bodies[0]);
  assert.equal(chamadas.length, 4); assert.equal(gravacoes, 1);
  assert.equal((await post({...payload, pergunta: 'Outra pergunta'})).status, 409);
  const visitante = await post({pergunta}, {token: '', path: '/perguntarVisitante'});
  assert.equal(visitante.status, 200);
  assert.doesNotMatch((await visitante.json()).resposta, /^Resposta gerada por IA/);
  assert.equal(chamadas.length, 4); assert.equal(gravacoes, 1);
  assert.equal((await post({acao: 'catalogo_demonstracao'})).status, 403);
  for (const segredo of [uid, pergunta, texto, env.OPENROUTER_API_KEY, mid, cid]) {
    assert.equal(JSON.stringify(logs).includes(segredo), false);
  }
  assert.equal(logs.filter(l => l.join(' ') === 'SYLVINHO_IA_FLUXO '+VERSAO_FLUXO_CONVERSA).length, 1);
  const diagnosticos = logs.filter(l => l[0] === 'SYLVINHO_DIAGNOSTICO').map(l => JSON.parse(l[1]));
  assert.deepEqual(diagnosticos.filter(d => d.etapa === 'BUSCA_CONCLUIDA'), [
    {etapa: 'BUSCA_CONCLUIDA', lidos: 1, selecionados: 1},
    {etapa: 'BUSCA_CONCLUIDA', lidos: 1, selecionados: 1}, // visitante, sem nova geracao
  ]);
  assert.deepEqual(diagnosticos.filter(d => d.etapa === 'PROPOSTA_RECEBIDA'), [
    {etapa: 'PROPOSTA_RECEBIDA', contextos: 1, evidencias: 1, uso: 'DOCUMENTAL'},
  ]);
  const etapa = decisao === 'corrigir' ? 'REVISAO_CORRIGIDA' : 'REVISAO_APROVADA';
  assert.ok(diagnosticos.some(d => d.etapa === etapa && d.tipo === 'documental'));
  assert.ok(logs.some(l => l.join(' ') === 'SYLVINHO_IA GERADA'));
  assert.ok(logs.some(l => l.join(' ') === 'SYLVINHO_IA FALLBACK VISITANTE_IA_DESATIVADA'));
});
