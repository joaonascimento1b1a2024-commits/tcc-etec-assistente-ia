import test from 'node:test';
import assert from 'node:assert/strict';
import {classificarEscopo, ESCLARECER_ESCOPO, FORA_ESCOPO} from '../functions/lib/assistente/escopo.js';
import {identificarProcedimento} from '../functions/lib/assistente/intencao.js';
import {resolverContextoConversacional as resolver} from '../functions/lib/assistente/contexto-conversacional.js';
import {extrairTermosConsultaOriginal, selecionarDocumentosOriginais} from '../functions/lib/rag/recuperacao.js';
import {criarFluxoPerguntaLivre} from '../functions/lib/assistente/pergunta-livre/fluxo.js';
import {criarClienteOpenRouter} from '../functions/lib/assistente/geracao/openrouter.js';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
import {perguntarAssistenteHandler} from '../functions/lib/assistente/handler.js';
import {criarChunk} from './fixtures/fundamentacao-sintetica.mjs';

const perguntas = ['Como faço para renovar minha matrícula?',
  'de como renovar a matrícula, não faço ideia de como faz isso',
  'Renovar matrícula', 'Renovação de matrícula', 'Rematrícula',
  'Fazer minha rematrícula', 'Continuar estudando no próximo ano',
  'Como renovo minha matrícula?', 'Não sei como renovar a matrícula'];
const renovacao = criarChunk('A renovação de matrícula experimental utiliza papel violeta.',
  {id: 'renovacao-sintetica', titulo: 'Renovação escolar experimental', secao: 'Procedimento de renovação', tipoConteudo: 'procedimento'});
const inicial = criarChunk('A matrícula inicial experimental utiliza papel azul.',
  {id: 'inicial-sintetica', titulo: 'Matrícula inicial experimental', secao: 'Procedimento inicial', tipoConteudo: 'procedimento'});
const corpus = [inicial, renovacao];
const mid = 'mensagem-atual-00000001', cid = 'AbCdEfGhIjKlMnOpQrSt';
const user = (texto, messageId = 'mensagem-anterior-00001') => ({texto, messageId, remetente: 'user'});
const bot = texto => ({texto, remetente: 'bot'});
const resolverDepois = (historico, q) => resolver(q, mid, [...historico, user(q, mid)]);

for (const q of perguntas) test('renovacao: intencao, busca, citacao e continuidade: '+q, () => {
  assert.equal(classificarEscopo(q).categoria, 'institucional');
  assert.equal(identificarProcedimento(q), 'renovação de matrícula');
  assert.deepEqual(extrairTermosConsultaOriginal(q), ['rematricula']);
  assert.deepEqual(selecionarDocumentosOriginais(corpus, q).map(d => d.id), [renovacao.id]);
  assert.deepEqual(resolverDepois([], q), {pergunta: q}, 'pergunta completa permanece intacta');
  assert.deepEqual(resolverDepois([user(q), bot(ESCLARECER_ESCOPO)], 'Não sei como fazer isso.'),
    {pergunta: 'Como solicitar renovação de matrícula?'});
});
test('matricula inicial permanece separada da renovacao', () => {
  for (const q of ['Como faço minha matrícula?', 'Matrícula inicial']) {
    assert.equal(identificarProcedimento(q), 'matrícula');
    assert.deepEqual(selecionarDocumentosOriginais(corpus, q).map(d => d.id), [inicial.id]);
    assert.deepEqual(resolverDepois([user(q)], 'Não sei como fazer isso.'), {pergunta: 'Como solicitar matrícula?'});
  }
  assert.equal(identificarProcedimento('Matrícula ou rematrícula?'), undefined);
});
test('equivalencia de continuidade nao comprova prazo ou vigencia', () => {
  assert.equal(gerarRespostaDocumental('Continuar estudando no próximo ano', [renovacao]).status, 'trechos_encontrados');
  for (const q of ['Qual o prazo atual de rematrícula?', 'Como renovar a matrícula amanhã?',
    'Continuar estudando no próximo ano: qual é o prazo atual?']) {
    assert.equal(gerarRespostaDocumental(q, [renovacao]).citacoes.length, 0);
  }
});
test('pergunta incompleta precisa de contexto; mudanca de assunto nao herda renovacao', () => {
  assert.deepEqual(resolverDepois([], 'Não sei como fazer isso.'), {esclarecimento: ESCLARECER_ESCOPO});
  assert.deepEqual(resolverDepois([user(perguntas[0]), user('Como solicito uma declaração escolar?')],
    'Não sei como fazer isso.'), {pergunta: 'Como solicitar declaração escolar?'});
  assert.deepEqual(resolverDepois([user(perguntas[0]), user('Quero mudar de assunto')],
    'Não sei como fazer isso.'), {esclarecimento: ESCLARECER_ESCOPO});
});
test('qualificadores, negacoes e assuntos externos nao sao apagados pela interpretacao', () => {
  for (const q of ['Não quero renovar minha matrícula', 'Como renovar a matrícula atrasada?',
    'Como renovar a matrícula? Meu CPF é 12345678900', 'Renovar matrícula em outra escola']) {
    assert.deepEqual(resolverDepois([user(q)], 'Não sei como fazer isso.'), {esclarecimento: ESCLARECER_ESCOPO});
  }
  assert.ok(extrairTermosConsultaOriginal('Não quero renovar minha matrícula').includes('nao'));
  assert.ok(extrairTermosConsultaOriginal('Como renovar a matrícula atrasada?').includes('atrasada'));
  assert.equal(classificarEscopo('Continuar estudando no próximo ano. Crie um jogo em Python').resposta, FORA_ESCOPO);
});

// Transporte simulado, sem chamadas externas ou dados reais de alunos.
function preparar({docs = corpus, tipo = 'documental', revisao = 'aprovar', corrigir = false} = {}) {
  const chamadas = [], eventos = [], consultas = [];
  const fluxo = criarFluxoPerguntaLivre({fonte: {collection(nome) {
    assert.equal(nome, 'conhecimento');
    return {where: () => ({get: async () => {
      consultas.push(nome);
      return {forEach(cb) {docs.forEach(d => cb({id: d.id, data: () => d}));}};
    }})};
  }}, geracao: {
    lerAmbiente: () => ({SYLVINHO_IA_ENABLED: 'true', SYLVINHO_IA_PROVIDER: 'openrouter',
      SYLVINHO_IA_UID_ALLOWLIST: 'alice', SYLVINHO_IA_MAX_POR_MINUTO: '20',
      SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true', SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true',
      SYLVINHO_IA_MENORES_APROVADA: 'true', SYLVINHO_IA_ZDR_APROVADO: 'true',
      SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true',
      OPENROUTER_MODEL: 'google/gemini-mock', OPENROUTER_API_KEY: 'ficticia'}),
    registrarEvento: (codigo, motivo) => eventos.push({codigo, motivo}),
    criarCliente: () => assert.fail('OpenAI direto'), criarClienteGemini: () => assert.fail('Gemini direto'),
    criarClienteOpenRouter: (modelo, chave) => criarClienteOpenRouter(modelo, chave, async (url, init) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      const body = JSON.parse(init.body), dados = JSON.parse(body.messages[1].content);
      chamadas.push({body, dados});
      const documental = p => ({tipo: 'documental', mensagem: '', afirmacoes: [{texto: p.evidencias[0].texto,
        referencias: [{id: p.evidencias[0].id, citacao: p.evidencias[0].texto}]}]});
      const schema = body.response_format.json_schema.schema.properties;
      const resposta = schema.segura ? {segura: true} : schema.decisao ? {
        decisao: corrigir ? 'corrigir' : revisao, motivo: corrigir ? 'PERGUNTA_AMBIGUA' :
          revisao === 'aprovar' ? 'SEM_PROBLEMA' : 'SEM_SUPORTE',
        respostas: corrigir ? [documental(dados.pedido)] : [],
      } : tipo === 'documental' ? documental(dados) : {tipo, mensagem: ESCLARECER_ESCOPO, afirmacoes: []};
      return new Response(JSON.stringify({choices: [{finish_reason: 'stop', message: {role: 'assistant', content: JSON.stringify(resposta)}}]}));
    }),
  }});
  return {fluxo, chamadas, consultas, eventos, responder: q => fluxo.responder(q, {uid: 'alice'})};
}
for (const q of perguntas) test('geracao simulada responde renovacao com fontes: '+q, async () => {
  const f = preparar();
  const r = await f.responder(q);
  assert.match(r, /^Resposta gerada por IA/);
  assert.ok(r.includes(renovacao.conteudo));
  assert.ok(r.includes(renovacao.documentoId));
  assert.doesNotMatch(r, /papel azul|Sobre qual procedimento/);
  assert.equal(f.chamadas.length, 4);
  assert.equal(f.chamadas[1].dados.procedimento, 'renovação de matrícula');
  assert.equal(f.chamadas[1].dados.pergunta, q);
});
for (const docs of [corpus, []]) test('esclarecimento aprovado nao cria loop, com '+docs.length+' fontes', async () => {
  const f = preparar({docs, tipo: 'esclarecimento'});
  for (const q of perguntas.slice(0, 2)) {
    const r = await f.responder(q);
    assert.match(r, /renovação de matrícula/);
    assert.doesNotMatch(r, /Sobre qual procedimento|Resposta gerada por IA/);
    assert.equal(r.includes(renovacao.conteudo), false, 'nao publica regra que o revisor nao sustentou');
    assert.equal(f.eventos.at(-1).motivo, 'ESCLARECIMENTO_DESNECESSARIO');
  }
});
test('revisor pode corrigir esclarecimento para resposta sustentada', async () => {
  const f = preparar({tipo: 'esclarecimento', corrigir: true});
  assert.match(await f.responder(perguntas[0]), /^Resposta gerada por IA/);
  assert.equal(f.chamadas.length, 4);
});
test('sem documentacao reconhece o procedimento sem inventar regra', async () => {
  const f = preparar({docs: [], tipo: 'sem_base'});
  const r = await f.responder(perguntas[0]);
  assert.match(r, /renovação de matrícula.*não encontrei orientações completas/);
  assert.doesNotMatch(r, /Sobre qual procedimento|papel|\d|Resposta gerada por IA/);
});
test('recusa do revisor continua impedindo publicar a proposta', async () => {
  const f = preparar({revisao: 'recusar'});
  assert.doesNotMatch(await f.responder(perguntas[0]), /^Resposta gerada por IA|papel violeta/);
  assert.equal(f.eventos.at(-1).motivo, 'REVISAO_REPROVADA');
});
test('pergunta externa ou realmente ambigua nao inicia RAG nem IA', async () => {
  const f = preparar();
  for (const q of ['Crie um jogo em Python', 'Como faço?']) {
    assert.equal(await f.responder(q), classificarEscopo(q).resposta);
  }
  assert.equal(f.consultas.length, 0); assert.equal(f.chamadas.length, 0);
});
test('handler conserva assunto entre reformulacoes, resolve isso e preserva replay', async () => {
  const f = preparar({tipo: 'esclarecimento'});
  const estado = {mensagens: []};
  const ref = {get: async () => ({exists: true, data: () => structuredClone(estado)})};
  const firestore = {collection: nome => {
    assert.equal(nome, 'users'); return {doc: uid => {
      assert.equal(uid, 'alice'); return {collection: () => ({doc: id => {assert.equal(id, cid);return ref;}})};
    }};
  }, runTransaction: async fn => fn({get: ref.get, update: (_r, data) => Object.assign(estado, data)})};
  const deps = {...f.fluxo, firestore, auth: {verifyIdToken: async () => ({uid: 'alice'})}, serverTimestamp: () => 1};
  const run = async (q, messageId) => {
    const res = {status(code) {this.code = code;return this;}, json(body) {this.body = body;return this;}};
    await perguntarAssistenteHandler({method: 'POST', get: () => 'Bearer ficticio',
      body: {pergunta: q, messageId, conversationId: cid}}, res, deps);
    assert.equal(res.code, 200); return res.body.resposta;
  };
  for (const [i, q] of [...perguntas.slice(0, 2), 'Não sei como fazer isso.'].entries()) {
    const id = mid+i; estado.mensagens.push(user(q, id));
    const resposta = await run(q, id);
    assert.match(resposta, /renovação de matrícula/);
    assert.doesNotMatch(resposta, /Sobre qual procedimento/);
    const n = f.chamadas.length;
    assert.equal(await run(q, id), resposta);
    assert.equal(f.chamadas.length, n);
    assert.equal(estado.mensagens.at(-2).texto, q);
    assert.equal(estado.mensagens.at(-1).messageId, id);
  }
  assert.equal(f.chamadas.at(-2).dados.pergunta, 'Como solicitar renovação de matrícula?');
});
