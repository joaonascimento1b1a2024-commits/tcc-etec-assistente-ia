import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extrairTermosConsultaOriginal, selecionarDocumentosOriginais, FONTES_ORIGINAIS} from '../functions/lib/rag/recuperacao.js';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
import {criarFluxoPerguntaLivre} from '../functions/lib/assistente/pergunta-livre/fluxo.js';

// Fixture inteiramente sintetica; ID autorizado exercita somente o filtro.
// Nao representa documento escolar nem e importada pelo runtime.
const fixture = {id: 'declaracao-sintetica-01', documentoId: FONTES_ORIGINAIS[0],
  titulo: 'Unidade sintética - Declarações', secao: 'Atividades experimentais',
  conteudo: '1. Registrar a solicitação de declaração no protocolo violeta de laboratório.',
  tipoConteudo: 'procedimento', ativo: true};
const principal = 'Preciso de uma declaração de matrícula para entregar no trabalho. Como faço para conseguir?';
const consultas = [principal, 'Como conseguir uma declaração de matrícula?',
  'Preciso de uma declaração de matrícula', 'Quero solicitar declaração de matrícula para apresentar na empresa.',
  'Preciso de uma declaração', 'Como solicitar uma declaração escolar?'];
for (const q of consultas) test('pedido e finalidade nao impedem orientacao geral: ' + q, () => {
  assert.deepEqual(extrairTermosConsultaOriginal(q), ['declaracao']);
  const docs = selecionarDocumentosOriginais([fixture], q);
  assert.equal(docs.length, 1);
  const r = gerarRespostaDocumental(q, docs);
  assert.equal(r.status, 'trechos_encontrados');
  assert.ok(r.citacoes.length);
  assert.ok(r.citacoes.every(c => fixture.conteudo.includes(c.texto)));
  if (/matrícula/.test(q)) assert.match(r.resposta, /orientacao geral[\s\S]*nao confirma[\s\S]*matricula/);
});
for (const q of [
  'Como solicitar declaração de matrícula pela internet?',
  'Como solicitar declaração de matrícula sem assinatura?',
  'Qual o prazo para conseguir declaração de matrícula?',
  'Como conseguir declaração de matrícula gratuita?',
  'Como conseguir declaração de matrícula para entregar no trabalho em 2 dias?',
  'Como conseguir declaração de transferência internacional?',
  'Como cancelar minha matrícula para entregar no trabalho?',
]) test('restricao ou assunto sem evidencia continua insuficiente: ' + q, () => {
  const docs = selecionarDocumentosOriginais([fixture], q);
  assert.deepEqual(docs, []);
  assert.equal(gerarRespostaDocumental(q, docs).status, 'informacao_insuficiente');
});
test('finalidade so e removida na expressao reconhecida; outros termos permanecem', () => {
  assert.ok(extrairTermosConsultaOriginal('Como solicitar declaração de matrícula pela internet?').includes('internet'));
  assert.ok(extrairTermosConsultaOriginal('Como solicitar declaração de matrícula sem assinatura?').includes('sem'));
  assert.ok(extrairTermosConsultaOriginal('Como conseguir matrícula para entregar no trabalho?').includes('trabalho'));
  assert.ok(extrairTermosConsultaOriginal('Modelo de declaração de matrícula').includes('matricula'));
});
test('sem procedimento nao usa modelo ou mencao incidental de matricula', () => {
  const docs = [ {...fixture, titulo: 'Matrícula inicial', conteudo: 'A matrícula experimental requer declaração no protocolo violeta.'},
    {...fixture, tipoConteudo: 'modelo'}, {...fixture, tipoConteudo: 'normativo'}, {...fixture, ativo: false} ];
  assert.deepEqual(selecionarDocumentosOriginais(docs, principal), []);
});
test('fluxo completo sem IA preserva pergunta original e citacao literal', async () => {
  let leituras = 0;
  const fonte = {collection(nome) {assert.equal(nome, 'conhecimento');return {where(...filtro) {
    assert.deepEqual(filtro, ['ativo', '==', true]);return {async get() {leituras++;return {forEach(cb) {cb({id: fixture.id, data: () => fixture});}};}};
  }};}};
  const fluxo = criarFluxoPerguntaLivre({fonte, geracao: {lerAmbiente: () => ({}),
    criarCliente() {assert.fail('NAO_CHAMAR_PROVEDOR');}, criarClienteGemini() {assert.fail('NAO_CHAMAR_GEMINI');}}});
  const resposta = await fluxo.responder(principal);
  assert.equal(resposta, gerarRespostaDocumental(principal, selecionarDocumentosOriginais([fixture], principal)).resposta);
  assert.match(resposta, /protocolo violeta/);assert.equal(leituras, 1);
});
const local = process.env.RAG_CORPUS_LOCAL;
test('corpus oficial local: pergunta recupera D5 e orientacao geral com fontes literais', {skip: !local}, () => {
  const raw = JSON.parse(readFileSync(local, 'utf8'));const corpus = Array.isArray(raw) ? raw : raw.documentos;
  for (const q of consultas) {
    const docs = selecionarDocumentosOriginais(corpus, q);
    assert.ok(docs.length > 0);
    assert.ok(docs.every(d => /D5 - Atestados/.test(d.titulo) && d.tipoConteudo === 'procedimento'));
    const r = gerarRespostaDocumental(q, docs);assert.equal(r.status, 'trechos_encontrados');
    assert.ok(r.citacoes.length);
    for (const c of r.citacoes) {
      const origem = corpus.find(d => d.id === c.fonte.chunkId);
      assert.ok(origem.conteudo.includes(c.texto));assert.equal(c.fonte.documentoId, origem.documentoId);
    }
  }
  const semD5 = corpus.filter(d => !/D5 - Atestados/.test(d.titulo));
  assert.deepEqual(selecionarDocumentosOriginais(semD5, principal), []);
});
