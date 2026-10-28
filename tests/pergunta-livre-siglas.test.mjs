import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extrairTermosConsultaOriginal, selecionarDocumentosOriginais,
  extrairTermosUteis,
} from '../functions/lib/rag/recuperacao.js';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
import {criarFluxoPerguntaLivre} from '../functions/lib/assistente/pergunta-livre/fluxo.js';
import {criarClienteOpenRouter} from '../functions/lib/assistente/geracao/openrouter.js';
import {RESPOSTA_INDISPONIVEL} from '../functions/lib/assistente/geracao/conversa.js';
import {avaliarGeracao, validarGeracao} from '../functions/lib/assistente/geracao/contrato.js';
import {criarChunk} from './fixtures/fundamentacao-sintetica.mjs';

// Corpus inteiramente sintetico, nunca importado no banco.
const pertinente = criarChunk('No procedimento experimental, apresentar RG em papel violeta de laboratório.',
  {id: 'sigla-pertinente', titulo: 'Procedimento experimental'});
const distrator = criarChunk('A decisão experimental deve levar em consideração a organização curricular.',
  {id: 'sigla-distrator', titulo: 'Organização experimental'});
const corpus = [distrator, pertinente];
const perguntas = [
  'Preciso levar RG?', 'Posso apresentar RG?', 'Como entregar RG?',
  'Preciso trazer RG?', 'Levo RG?', 'Trago RG?', 'Apresento RG?', 'RG?',
];
for (const q of perguntas) test('assunto curto preservado entre busca e citação: '+q, () => {
  assert.deepEqual(extrairTermosConsultaOriginal(q), ['rg']);
  const docs = selecionarDocumentosOriginais(corpus, q);
  assert.deepEqual(docs.map(d => d.id), [pertinente.id]);
  const baseline = gerarRespostaDocumental(q, docs);
  assert.equal(baseline.status, 'trechos_encontrados');
  assert.equal(baseline.citacoes[0].texto, pertinente.conteudo);
  assert.doesNotMatch(baseline.resposta, /organização curricular/);
});
for (const sigla of ['RG', 'RA', 'RM', 'XY']) test('regra geral de dois caracteres: '+sigla, () => {
  const doc = criarChunk(`O procedimento experimental utiliza ${sigla} em papel violeta.`);
  assert.deepEqual(selecionarDocumentosOriginais([doc], `Preciso levar ${sigla}?`).map(d => d.id), [doc.id]);
});
test('sigla nao vira parte de outra palavra nem e substituida por metadata', () => {
  for (const docs of [[distrator], [criarChunk(distrator.conteudo, {titulo: 'RG', termosBusca: 'rg'})],
    [criarChunk('A organização experimental utiliza papel violeta no laboratório.')]]) {
    const cs = selecionarDocumentosOriginais(docs, 'Preciso levar RG?');
    assert.deepEqual(cs, []);
    assert.equal(gerarRespostaDocumental('Preciso levar RG?', cs).status, 'informacao_insuficiente');
  }
});
test('somente verbos sem assunto nao recuperam documento arbitrario', () => {
  assert.deepEqual(selecionarDocumentosOriginais(corpus, 'Preciso levar?'), []);
});
test('consulta com duas siglas exige ambas na evidencia', () => {
  assert.deepEqual(selecionarDocumentosOriginais(corpus, 'Preciso levar RG e RM?'), []);
  const ambos = criarChunk('No procedimento experimental, apresentar RG e RM em papel violeta.');
  assert.equal(selecionarDocumentosOriginais([...corpus, ambos], 'Preciso levar RG e RM?').length, 1);
});
test('ranking respeita flexoes ja aceitas pelo filtro documental', () => {
  const doc = criarChunk('A renovação da matrícula experimental utiliza papel violeta.',
    {titulo: 'Renovação de matrícula'});
  const cs = selecionarDocumentosOriginais([doc], 'Como renovar minha matrícula?');
  assert.equal(cs.length, 1);
  assert.equal(gerarRespostaDocumental('Como renovar minha matrícula?', cs).status, 'trechos_encontrados');
});
test('tokenizacao legada V1 permanece inalterada', () => {
  assert.deepEqual(extrairTermosUteis('Preciso levar RG?'), ['levar']);
});

function fluxoSimulado(docs, respostaProposta) {
  const chamadas = [], eventos = [];
  const uid = 'uid-sintetico';
  const env = {SYLVINHO_IA_ENABLED: 'true', SYLVINHO_IA_PROVIDER: 'openrouter',
    OPENROUTER_MODEL: 'google/gemini-3.5-flash-lite', OPENROUTER_API_KEY: 'somente-mock',
    SYLVINHO_IA_UID_ALLOWLIST: uid, SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true',
    SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true', SYLVINHO_IA_MENORES_APROVADA: 'true',
    SYLVINHO_IA_ZDR_APROVADO: 'true', SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true'};
  const fluxo = criarFluxoPerguntaLivre({fonte: {collection() {return {where() {
    return {async get() {return {forEach(cb) {docs.forEach(d => cb({id: d.id, data: () => d}));}};}};
  }};}}, geracao: {lerAmbiente: () => env,
    registrarEvento: (codigo, motivo) => eventos.push({codigo, motivo}),
    criarCliente() {assert.fail('sem OpenAI direto');},
    criarClienteGemini() {assert.fail('sem Gemini direto');},
    criarClienteOpenRouter(modelo, chave) {return criarClienteOpenRouter(modelo, chave, async (url, init) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      const b = JSON.parse(init.body), dados = JSON.parse(b.messages[1].content);
      chamadas.push(dados);
      const schema = b.response_format.json_schema.schema.properties;
      const valor = schema.segura ? {segura: true} : schema.sustentada ? {sustentada: true} :
        respostaProposta ? respostaProposta(dados) : !dados.evidencias.length ?
          {tipo: 'sem_base', mensagem: 'Não encontrei informação para confirmar essa exigência. Consulte a secretaria acadêmica.', afirmacoes: []} :
          {tipo: 'documental', mensagem: '', afirmacoes: [{texto: dados.evidencias[0].texto,
          referencias: [{id: dados.evidencias[0].id, citacao: dados.evidencias[0].texto}]}]};
      return new Response(JSON.stringify({choices: [{finish_reason: 'stop',
        message: {role: 'assistant', content: JSON.stringify(valor)}}]}));
    });},
  }});
  return {responder: () => fluxo.responder('Preciso levar RG?', {uid}), chamadas, eventos};
}
test('pergunta RG chega a quatro chamadas OpenRouter sem enviar trecho irrelevante', async () => {
  const f = fluxoSimulado(corpus);
  assert.match(await f.responder(), /^Resposta gerada por IA/);
  assert.equal(f.chamadas.length, 4);
  assert.equal(JSON.stringify(f.chamadas).includes(distrator.conteudo), false);
});
test('sem assunto no corpus, IA explica a limitacao sem citacao desconexa', async () => {
  const f = fluxoSimulado([distrator]);
  const r = await f.responder();
  assert.doesNotMatch(r, /organização curricular/);
  assert.equal(f.chamadas.length, 4);
  assert.match(r, /Não encontrei informação/);
  assert.deepEqual(f.chamadas[1].evidencias, []);
});
test('recusa estruturada do modelo tem diagnostico especifico sem inventar resposta', async () => {
  const f = fluxoSimulado(corpus, () => ({tipo: 'documental', mensagem: '', afirmacoes: []}));
  const r = await f.responder();
  assert.equal(f.chamadas.length, 2);
  assert.equal(f.eventos.at(-1).motivo, 'PROPOSTA_VAZIA');
  assert.doesNotMatch(r, /organização curricular/);
  assert.equal(r, RESPOSTA_INDISPONIVEL);
});

const evidencia = {id: 'E1', texto: 'O ensaio utiliza 42 folhas somente quando autorizado.', contexto: 0};
const proposta = () => ({afirmacoes: [{texto: evidencia.texto,
  referencias: [{id: 'E1', citacao: evidencia.texto}]}]});
for (const [motivo, alterar] of [
  ['PROPOSTA_SCHEMA_INVALIDO', () => null],
  ['PROPOSTA_VAZIA', () => ({afirmacoes: []})],
  ['PROPOSTA_TEXTO_INVALIDO', p => {p.afirmacoes[0].texto = '<script>';return p;}],
  ['PROPOSTA_REFERENCIA_INVALIDA', p => {p.afirmacoes[0].referencias[0].id = 'E99';return p;}],
  ['PROPOSTA_CITACAO_DIVERGENTE', p => {p.afirmacoes[0].referencias[0].citacao += 'alterada';return p;}],
  ['PROPOSTA_NUMEROS_DIVERGENTES', p => {p.afirmacoes[0].texto = evidencia.texto.replace('42', '43');return p;}],
  ['PROPOSTA_CONDICOES_DIVERGENTES', p => {p.afirmacoes[0].texto = 'O ensaio utiliza 42 folhas.';return p;}],
]) test('validacao conserva protecao e diagnostica '+motivo, () => {
  const valor = alterar(proposta());
  assert.deepEqual(avaliarGeracao(valor, [evidencia]), {proposta: null, motivo});
  assert.equal(validarGeracao(valor, [evidencia]), null);
});
