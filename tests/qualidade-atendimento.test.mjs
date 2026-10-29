import test from 'node:test';
import assert from 'node:assert/strict';
import {selecionarDocumentosOriginais, FONTES_ORIGINAIS} from '../functions/lib/rag/recuperacao.js';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
import {criarGeradorConfiguravel} from '../functions/lib/assistente/geracao/gateway.js';
import {criarClienteGemini} from '../functions/lib/assistente/geracao/gemini.js';
import {INSTRUCAO_CONVERSA} from '../functions/lib/assistente/geracao/conversa.js';

// Corpus exclusivamente sintetico: nao representa regras da ETEC.
const casos = [
  ['Matrícula', 'Como fazer matrícula?', 'B1 Inicial', 'procedimento',
    'A matrícula inicial exige apresentar o formulário experimental na secretaria.'],
  ['Renovação', 'Como renovar minha matrícula?', 'Renovação rematrícula', 'procedimento',
    'A rematrícula exige confirmar o interesse no formulário experimental.'],
  ['Frequência', 'Qual a frequência mínima?', 'Frequência', 'normativo',
    'A frequência mínima experimental é de 80%, salvo a exceção descrita no regulamento experimental.'],
  ['Declaração', 'Como solicitar declaração escolar?', 'Declarações', 'procedimento',
    'A declaração escolar deve ser solicitada na secretaria experimental.'],
  ['Calendário', 'Calendário acadêmico', 'Calendário acadêmico', 'normativo',
    'O calendário acadêmico experimental será divulgado após aprovação.'],
  ['Atendimento', 'Atendimento da secretaria', 'Atendimento', 'procedimento',
    'O atendimento da secretaria experimental ocorre mediante agendamento.'],
];
const docs = casos.map(([, , titulo, tipoConteudo, conteudo], i) => ({
  id: `sintetico-${i}`, documentoId: FONTES_ORIGINAIS[0], titulo,
  tipoConteudo, conteudo, ativo: true, secao: 'Teste sintético',
  paginaInicial: i + 1, paginaFinal: i + 1,
}));
for (const [assunto, pergunta, , , evidencia] of casos) {
  test(`${assunto}: busca e fallback conservam evidencia, condicoes e fonte sem chamar IA`, async () => {
    const chunks = selecionarDocumentosOriginais(docs, pergunta);
    assert.ok(chunks.length);
    const esperado = gerarRespostaDocumental(pergunta, chunks);
    assert.equal(esperado.status, 'trechos_encontrados');
    assert.ok(esperado.citacoes.some(c => c.texto === evidencia));
    assert.ok(esperado.citacoes.every(c => docs.some(d => d.id === c.fonte.chunkId && d.conteudo.includes(c.texto))));
    const proibido = () => assert.fail('Nao pode criar cliente externo');
    const gerar = criarGeradorConfiguravel({lerAmbiente: () => ({}),
      criarCliente: proibido, criarClienteGemini: proibido, criarClienteOpenRouter: proibido});
    assert.equal(await gerar(pergunta, chunks), esperado.resposta);
    assert.doesNotMatch(esperado.resposta, /gerada por IA/);
    assert.match(esperado.resposta, /Fonte:/);
    assert.ok(esperado.resposta.length <= 2400);
  });
}
for (const pergunta of ['E quanto tempo demora?', 'Quais documentos?', 'Como faço?', 'Qual o prazo?']) {
  test(`pergunta incompleta pede assunto sem inferir historico: ${pergunta}`, () => {
    // Mesmo se um chamador fornecer documentos, nao escolher um procedimento.
    const r = gerarRespostaDocumental(pergunta, docs.slice(0, 3));
    assert.equal(r.status, 'informacao_insuficiente');
    assert.deepEqual(r.citacoes, []);
    assert.match(r.resposta, /Sobre qual procedimento/);
    assert.doesNotMatch(r.resposta, /80%|gerada por IA/);
  });
}
test('pergunta sem resposta nao recebe prazo inventado e encaminha a secretaria', () => {
  const q = 'Qual o prazo para diploma?';
  const r = gerarRespostaDocumental(q, selecionarDocumentosOriginais(docs, q));
  assert.equal(r.status, 'informacao_insuficiente');
  assert.deepEqual(r.citacoes, []);
  assert.match(r.resposta, /secretaria/i);
  assert.doesNotMatch(r.resposta, /\d|gerada por IA/);
});
test('nao confunde pergunta especifica com esclarecimento e conserva excecao', () => {
  const r = gerarRespostaDocumental('Qual a frequência mínima?', [docs[2]]);
  assert.match(r.resposta, /80%, salvo/);
  assert.doesNotMatch(r.resposta, /Sobre qual procedimento/);
});
test('Gemini recebe orientacoes de atendimento com dados separados, via transporte simulado', async () => {
  let payload;
  const cliente = criarClienteGemini('modelo-simulado', () => 'chave-ficticia', async (_url, init) => {
    payload = JSON.parse(init.body);
    return new Response(JSON.stringify({candidates: [{finishReason: 'STOP',
      content: {role: 'model', parts: [{text: JSON.stringify({afirmacoes: []})}]}}]}));
  });
  await cliente.propor({pergunta: 'Como fazer matrícula?', evidencias: [], contextos: []}, new AbortController().signal);
  const sistema = payload.systemInstruction.parts[0].text;
  for (const texto of ['Responda diretamente', 'Datas, prazos, valores', 'rotina interna', 'abstencao']) {
    assert.ok(sistema.includes(texto));
    assert.ok(INSTRUCAO_CONVERSA.includes(texto));
  }
  assert.ok(sistema.includes('Use SOMENTE evidencias'));
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
});
