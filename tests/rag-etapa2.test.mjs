import test from 'node:test';
import assert from 'node:assert/strict';
import {antes, depois} from '../scripts/benchmark-rag.mjs';
import {corpus, perguntas} from './fixtures/rag-benchmark.mjs';
import {selecionarDocumentosOriginais as selecionar, formatarDocumentoContexto} from '../functions/lib/rag/recuperacao.js';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
for (const {pergunta, esperados} of perguntas) test('benchmark sintético: '+pergunta, () => {
  const docs = selecionar(corpus, pergunta);
  assert.deepEqual(docs.map(d => d.id), esperados);
  assert.ok(docs.map(formatarDocumentoContexto).join('\n\n').length <= 8000);
  for (const d of docs) {
    const original = corpus.find(c => c.id === d.id);
    for (const k of ['conteudo', 'documentoId', 'titulo', 'secao', 'paginaInicial', 'paginaFinal', 'tipoConteudo']) assert.equal(d[k], original[k]);
  }
});
test('duplicatas nao consomem orçamento; paginas e fontes distintas permanecem', () => {
  const d = corpus[4];
  const copias = Array.from({length: 7}, (_, i) => ({...d, id: 'copia-'+i}));
  const pagina = {...d, id: 'outra-pagina', paginaInicial: 2, paginaFinal: 2};
  const docs = selecionar([...copias, pagina], 'Calendário acadêmico');
  assert.equal(docs.length, 2);
  assert.ok(docs.some(d => d.id === pagina.id));
});
test('conflito nao e removido como duplicata nem apresentado como resposta segura', () => {
  const d = corpus[2];
  const docs = selecionar([d, {...d, id: 'conflito', conteudo: d.conteudo.replace('80%', '60%')}], 'Frequência mínima');
  assert.equal(docs.length, 2);
  assert.equal(gerarRespostaDocumental('Frequência mínima', docs).motivo, 'trechos_contraditorios');
});
test('reranking prefere assunto reunido sem cortar ressalvas do trecho', () => {
  const base = corpus[4];
  const disperso = {...base, id: 'a-disperso', secao: '',
    conteudo: 'O calendário foi debatido. O projeto acadêmico foi aprovado.'};
  const direto = {...base, id: 'z-direto', secao: '',
    conteudo: 'O calendário acadêmico depende de aprovação. Consulte as ressalvas no anexo experimental.'};
  assert.equal(selecionar([disperso, direto], 'Calendário acadêmico')[0].id, 'z-direto');
  assert.equal(selecionar([direto], 'Calendário acadêmico')[0].conteudo, direto.conteudo);
});
test('deduplicacao conserva proveniencias distintas e diferencas numericas', () => {
  const base = corpus[4];
  const outro = {...base, id: 'outra-fonte', documentoId: 'doc-3319912252fbc4089c42a062f73d1b58'};
  assert.equal(selecionar([base, outro], 'Calendário acadêmico').length, 2);
});
test('trecho excessivo nao e truncado, nem tem excecao removida para caber', () => {
  const base = corpus[4];
  const gigante = {...base, conteudo: base.conteudo + ' Condição experimental.'.repeat(500)};
  assert.deepEqual(selecionar([gigante], 'Calendário acadêmico'), []);
});
test('consulta ambigua nao usa mencao conjunta como escolha de procedimento', () => {
  const misto = {...corpus[1], conteudo: 'A rematrícula e a matrícula experimental têm procedimentos próprios.'};
  assert.deepEqual(selecionar([misto], 'Matrícula ou rematrícula?'), []);
});
test('benchmark compara baseline congelado sem inventar metrica', () => {
  assert.ok(perguntas.length >= 30);
  assert.ok(depois().metricas.coberturaRespondiveis > antes().metricas.coberturaRespondiveis);
  assert.equal(depois().metricas.precisaoFontes, 100);
});
