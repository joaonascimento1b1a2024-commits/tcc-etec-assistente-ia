import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {extrairTermosConsultaOriginal, extrairTermosOriginais,
  recuperarConhecimentoRelevante, selecionarDocumentosOriginais} from '../functions/lib/rag/recuperacao.js';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
import {criarGeradorConfiguravel} from '../functions/lib/assistente/geracao/gateway.js';

// Amostra oficial ja existente, somente leitura; nunca substitui consulta live.
const amostra = JSON.parse(readFileSync(new URL('./dados/rag-original.json', import.meta.url), 'utf8')).documentos;
const arquivo = process.env.RAG_CORPUS_LOCAL;
const local = arquivo ? JSON.parse(readFileSync(arquivo, 'utf8')) : amostra;
const corpus = Array.isArray(local) ? local : local.documentos;
const curta = 'Qual a frequência mínima para aprovação?';
const longa = 'Qual é a frequência mínima exigida para aprovação na ETEC?';
const original = amostra.find(d => d.titulo === 'Regimento Comum - Artigo 83');
assert.ok(original);

for (const docs of [amostra, corpus]) {
  test('duas perguntas recuperam os mesmos chunks oficiais do Artigo 83', () => {
    const a = selecionarDocumentosOriginais(docs, curta);
    const b = selecionarDocumentosOriginais(docs, longa);
    assert.ok(a.length > 0);
    assert.deepEqual(b.map(d => d.id), a.map(d => d.id));
    assert.equal(b[0].id, original.id);
    assert.ok(b.every(d => d.ativo === true && d.tipoConteudo === 'normativo'));
  });
  test('gerador reconhece as duas perguntas e preserva resposta e referencias literais', () => {
    const a = gerarRespostaDocumental(curta, selecionarDocumentosOriginais(docs, curta));
    const b = gerarRespostaDocumental(longa, selecionarDocumentosOriginais(docs, longa));
    assert.equal(b.status, 'trechos_encontrados');
    assert.equal(b.resposta, a.resposta);
    assert.deepEqual(b.citacoes, a.citacoes);
    assert.ok(b.citacoes.some(c => c.fonte.chunkId === original.id));
    for (const c of b.citacoes) {
      const fonte = docs.find(d => d.id === c.fonte.chunkId);
      assert.ok(fonte.conteudo.includes(c.texto));
      for (const campo of ['documentoId', 'titulo', 'secao', 'paginaInicial', 'paginaFinal']) {
        assert.equal(c.fonte[campo], fonte[campo]);
      }
    }
    assert.ok(b.resposta.length <= 2400);
  });
}
test('correcao remove apenas ETEC terminal generica e preserva exigida', () => {
  assert.deepEqual(extrairTermosConsultaOriginal(curta), ['frequencia', 'minima']);
  assert.deepEqual(extrairTermosConsultaOriginal(longa), ['frequencia', 'minima', 'exigida']);
  assert.ok(extrairTermosOriginais(original.conteudo).includes('exigida'));
  assert.ok(extrairTermosConsultaOriginal('Qual o telefone na ETEC?').includes('etec'));
  assert.ok(extrairTermosConsultaOriginal('Qual a frequência de transporte na ETEC?').includes('etec'));
});
for (const q of [
  'Qual é a frequência mínima exigida para aprovação na ETEC de outra unidade?',
  'Qual é a frequência mínima exigida para aprovação na ETEC em curso interplanetário?',
]) test('qualificador ou valor sem evidencia continua recusado: ' + q, () => {
  assert.deepEqual(selecionarDocumentosOriginais(corpus, q), []);
  assert.equal(gerarRespostaDocumental(q, []).status, 'informacao_insuficiente');
});
test('percentual sugerido na pergunta nao substitui o texto oficial', () => {
  const q = 'Qual é a frequência mínima exigida para aprovação de 99% na ETEC?';
  const r = gerarRespostaDocumental(q, selecionarDocumentosOriginais(corpus, q));
  const base = gerarRespostaDocumental(curta, selecionarDocumentosOriginais(corpus, curta));
  assert.deepEqual(r.citacoes, base.citacoes);
  assert.equal(r.resposta.includes('99%'), false);
});
test('sem Artigo 83 nao fabrica a resposta quantitativa', () => {
  const removido = corpus.filter(d => d.id !== original.id);
  const r = gerarRespostaDocumental(longa, selecionarDocumentosOriginais(removido, longa));
  assert.equal(r.citacoes.some(c => c.fonte.chunkId === original.id), false);
  assert.equal(r.citacoes.some(c => c.texto === original.conteudo), false);
  assert.equal(r.resposta.includes('75%'), false);
});
for (const q of [curta, longa]) test('leitor consulta conhecimento ativo e chega ao gerador Render sem IA: ' + q, async () => {
  const before = JSON.stringify(amostra);
  let leituras = 0;
  const firestore = {collection(nome) {
    assert.equal(nome, 'conhecimento');
    return {where(campo, op, valor) {
      assert.deepEqual([campo, op, valor], ['ativo', '==', true]);
      return {async get() {leituras++; return {forEach(cb) {
        for (const d of amostra) cb({id: d.id, data: () => d});
      }};}};
    }};
  }};
  const docs = await recuperarConhecimentoRelevante(firestore, q);
  let criacoes = 0;
  const gerar = criarGeradorConfiguravel({lerAmbiente: () => ({}), criarCliente: () => {
    criacoes++; throw Error('NAO_CHAMAR_IA');
  }});
  const r = await gerar(q, docs);
  assert.equal(r, gerarRespostaDocumental(curta, selecionarDocumentosOriginais(amostra, curta)).resposta);
  assert.equal(leituras, 1); assert.equal(criacoes, 0);
  assert.equal(JSON.stringify(amostra), before);
});
