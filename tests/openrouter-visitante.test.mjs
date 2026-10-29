import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {criarClienteOpenRouter} from '../functions/lib/assistente/geracao/openrouter.js';
import {criarFluxoPerguntaLivre} from '../functions/lib/assistente/pergunta-livre/fluxo.js';
import {criarServidor, lerConfiguracao, DEMO_PROJECT} from '../render-poc/server.cjs';
import {criarChunk, pergunta, texto} from './fixtures/fundamentacao-sintetica.mjs';

// Apenas documentos sinteticos, ambiente em memoria e transporte simulado.
const origem = 'https://tcc-ia-d8891.firebaseapp.com';
const visitante = {publico: 'visitante'};
const ambiente = {
  SYLVINHO_IA_ENABLED: 'true', SYLVINHO_IA_PROVIDER: 'openrouter',
  SYLVINHO_IA_VISITANTE_ENABLED: 'true', SYLVINHO_IA_UID_ALLOWLIST: 'conta-sintetica',
  OPENROUTER_MODEL: 'google/gemini-3.5-flash-lite', OPENROUTER_API_KEY: 'chave-ficticia',
  SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true', SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true',
  SYLVINHO_IA_MENORES_APROVADA: 'true', SYLVINHO_IA_ZDR_APROVADO: 'true',
  SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true',
};
function preparar({env = {}, status = 200, jsonInvalido = false, pendente = false,
  revisao = 'aprovar', moderacao = true} = {}) {
  const config = {...ambiente, ...env};
  const chamadas = [], eventos = [], leituras = [];
  const fluxo = criarFluxoPerguntaLivre({fonte: {collection(nome) {
    assert.equal(nome, 'conhecimento', 'Visitante nao consulta usuarios ou conversas');
    return {where(...filtro) {
      assert.deepEqual(filtro, ['ativo', '==', true]);
      return {async get() {
        leituras.push(nome);
        return {forEach(cb) {const d = criarChunk(); cb({id: d.id, data: () => d});}};
      }};
    }};
  }}, geracao: {
    lerAmbiente: () => config,
    registrarEvento: (codigo, motivo) => eventos.push({codigo, motivo}),
    criarCliente: () => assert.fail('OpenAI direto proibido'),
    criarClienteGemini: () => assert.fail('Gemini direto proibido'),
    criarClienteOpenRouter: (modelo, chave) => criarClienteOpenRouter(modelo, chave, async (url, init) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(init.headers.Authorization, 'Bearer chave-ficticia');
      const body = JSON.parse(init.body);
      assert.equal(body.model, config.OPENROUTER_MODEL);
      assert.equal(body.provider.zdr, true);
      assert.equal(body.provider.data_collection, 'deny');
      chamadas.push(body);
      if (pendente) return new Promise((_resolve, reject) =>
        init.signal.addEventListener('abort', () => reject(init.signal.reason), {once: true}));
      if (status !== 200) return new Response('erro privado', {status});
      if (jsonInvalido) return new Response('nao-json');
      const schema = body.response_format.json_schema.schema.properties;
      const dados = JSON.parse(body.messages[1].content);
      const resposta = schema.segura ? {segura: moderacao} : schema.decisao ? {
        decisao: revisao, motivo: revisao === 'aprovar' ? 'SEM_PROBLEMA' : 'SEM_SUPORTE', respostas: [],
      } : {tipo: 'documental', mensagem: '', afirmacoes: [{texto,
        referencias: [{id: dados.evidencias[0].id, citacao: dados.evidencias[0].texto}]}]};
      return new Response(JSON.stringify({choices: [{finish_reason: 'stop',
        message: {role: 'assistant', content: JSON.stringify(resposta)}}]}));
    }),
  }});
  return {fluxo, config, chamadas, eventos, leituras,
    gerar: (contexto = visitante) => fluxo.gerarResposta(pergunta, [criarChunk()], contexto)};
}

test('visitante autorizado gera com fontes e quatro chamadas OpenRouter, sem UID', async () => {
  const f = preparar({env: {SYLVINHO_IA_UID_ALLOWLIST: ''}});
  assert.match(await f.gerar(), /^Resposta gerada por IA/);
  assert.equal(f.chamadas.length, 4);
  const pedido = JSON.parse(f.chamadas[1].messages[1].content);
  assert.ok(pedido.contextos[0].includes(texto));
  assert.equal(pedido.evidencias[0].texto, texto);
  assert.deepEqual(f.eventos, [{codigo: 'GERADA', motivo: undefined}]);
  assert.doesNotMatch(JSON.stringify(f.eventos), /chave-ficticia|certificado|conta-sintetica/);
});

for (const flag of [undefined, '', 'false', 'TRUE', '1']) test('visitante exige opt-in exato: '+flag, async () => {
  const f = preparar({env: {SYLVINHO_IA_VISITANTE_ENABLED: flag}});
  assert.doesNotMatch(await f.gerar(), /^Resposta gerada por IA/);
  assert.equal(f.chamadas.length, 0);
  assert.equal(f.eventos.at(-1).motivo, 'VISITANTE_IA_DESATIVADA');
});

for (const [env, motivo] of [
  [{SYLVINHO_IA_PROVIDER: 'gemini'}, 'VISITANTE_PROVEDOR_INVALIDO'],
  [{SYLVINHO_IA_PROVIDER: 'openai'}, 'VISITANTE_PROVEDOR_INVALIDO'],
  [{SYLVINHO_IA_ENABLED: 'false'}, 'IA_DESATIVADA'],
  ...['INSTITUCIONAL', 'PRIVACIDADE', 'MENORES', 'OPENROUTER_MODALIDADE'].map(nome =>
    [{['SYLVINHO_IA_'+nome+'_APROVADA']: 'false'}, 'APROVACAO_PENDENTE']),
  [{SYLVINHO_IA_ZDR_APROVADO: 'false'}, 'RETENCAO_BLOQUEADA'],
  [{OPENROUTER_API_KEY: ''}, 'OPENROUTER_CHAVE_AUSENTE'],
]) test('visitante preserva gate: '+Object.keys(env)[0], async () => {
  const f = preparar({env});
  assert.doesNotMatch(await f.gerar(), /^Resposta gerada por IA/);
  assert.equal(f.eventos.at(-1).motivo, motivo);
  assert.equal(f.chamadas.length, 0);
});

test('opt-in publico nao libera UID externo nem chamadas sem contexto; conta autorizada independe do opt-in', async () => {
  const f = preparar();
  for (const contexto of [{uid: 'fora-da-lista'}, null, {}]) {
    assert.doesNotMatch(await f.gerar(contexto), /^Resposta gerada por IA/);
    assert.equal(f.eventos.at(-1).motivo, 'UID_NAO_AUTORIZADO');
  }
  assert.equal(f.chamadas.length, 0);
  f.config.SYLVINHO_IA_VISITANTE_ENABLED = 'false';
  assert.match(await f.gerar({uid: 'conta-sintetica'}), /^Resposta gerada por IA/);
});

for (const [opcoes, motivo] of [
  [{status: 402}, 'OPENROUTER_SEM_CREDITOS'],
  [{status: 429}, 'OPENROUTER_LIMITE'],
  [{jsonInvalido: true}, 'OPENROUTER_JSON_INVALIDO'],
  [{pendente: true, env: {SYLVINHO_IA_TIMEOUT_MS: '5'}}, 'GERACAO_TIMEOUT'],
  [{revisao: 'recusar'}, 'REVISAO_REPROVADA'],
  [{moderacao: false}, 'ENTRADA_INSEGURA'],
]) test('visitante preserva fallback seguro: '+motivo, async () => {
  const f = preparar(opcoes);
  assert.doesNotMatch(await f.gerar(), /^Resposta gerada por IA|erro privado/);
  assert.equal(f.eventos.at(-1).motivo, motivo);
});

test('cota de geracoes e compartilhada entre visitantes e contas', async () => {
  const f = preparar({env: {SYLVINHO_IA_MAX_POR_MINUTO: '1'}});
  assert.match(await f.gerar(), /^Resposta gerada por IA/);
  assert.doesNotMatch(await f.gerar({uid: 'conta-sintetica'}), /^Resposta gerada por IA/);
  assert.equal(f.eventos.at(-1).motivo, 'LIMITE_LOCAL');
  assert.equal(f.chamadas.length, 4);
});

test('concorrencia publica nao cria segundo provedor nem prende vaga apos timeout', async () => {
  const f = preparar({pendente: true, env: {SYLVINHO_IA_TIMEOUT_MS: '10'}});
  const primeira = f.gerar();
  await f.gerar();
  assert.equal(f.eventos.at(-1).motivo, 'OCUPADO');
  await primeira;
  await f.gerar();
  assert.equal(f.chamadas.length, 2);
  assert.equal(f.eventos.at(-1).motivo, 'GERACAO_TIMEOUT');
});

// Exercita o servidor HTTP real com streams em memoria, sem abrir portas.
function enviar(server, body, {path = '/perguntarVisitante', origin = origem} = {}) {
  return new Promise(resolve => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    Object.assign(req, {method: 'POST', url: path,
      headers: {'content-type': 'application/json', origin}});
    const res = {headersSent: false, destroyed: false, headers: {}, statusCode: 200,
      setHeader(nome, valor) {this.headers[nome] = valor;},
      end(value) {this.headersSent = true; resolve({status: this.statusCode,
        headers: this.headers, body: JSON.parse(value)});}};
    server.emit('request', req, res);
  });
}

test('Render: visitante -> leitura Firestore simulada -> OpenRouter; rota privada e corpo permanecem protegidos', async () => {
  const f = preparar();
  const proibido = new Proxy({}, {get() {assert.fail('Auth/historico acessado por visitante');}});
  const server = criarServidor({config: lerConfiguracao({SYLVINHO_POC_MODE: 'emulator',
    GCLOUD_PROJECT: DEMO_PROJECT, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', ASSISTENTE_CORS_ORIGINS: origem}),
  obterDependencias: () => ({...f.fluxo, auth: proibido, firestore: proibido})});
  const resposta = await enviar(server, {pergunta});
  assert.equal(resposta.status, 200);
  assert.match(resposta.body.resposta, /^Resposta gerada por IA/);
  assert.equal(resposta.headers['Cache-Control'], 'no-store');
  assert.equal(f.leituras.length, 1);
  assert.equal(f.chamadas.length, 4);
  assert.equal((await enviar(server, {pergunta}, {path: '/perguntarAssistente'})).status, 401);
  assert.equal((await enviar(server, {pergunta}, {origin: 'https://intruso.invalid'})).status, 403);
  for (const key of ['uid', 'publico', 'contexto', 'provider', 'model', 'url', 'OPENROUTER_API_KEY']) {
    assert.equal((await enviar(server, {pergunta, [key]: 'injetado'})).status, 400);
  }
  f.config.SYLVINHO_IA_VISITANTE_ENABLED = 'false';
  assert.doesNotMatch((await enviar(server, {pergunta})).body.resposta, /^Resposta gerada por IA/);
  assert.equal(f.eventos.at(-1).motivo, 'VISITANTE_IA_DESATIVADA');
  assert.equal(f.chamadas.length, 4);
});
