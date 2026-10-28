import test from 'node:test';
import assert from 'node:assert/strict';
import {criarFluxoPerguntaLivre} from '../functions/lib/assistente/pergunta-livre/fluxo.js';
import {criarClienteOpenRouter} from '../functions/lib/assistente/geracao/openrouter.js';
import {RESPOSTA_INDISPONIVEL} from '../functions/lib/assistente/geracao/conversa.js';
import {criarChunk, pergunta, texto} from './fixtures/fundamentacao-sintetica.mjs';

// Sem rede, dados de alunos ou configuracao real do processo.
const uid = 'usuario-sintetico';
const env = {SYLVINHO_IA_ENABLED: 'true', SYLVINHO_IA_PROVIDER: 'openrouter',
  SYLVINHO_IA_UID_ALLOWLIST: uid, OPENROUTER_MODEL: 'google/gemini-3.5-flash-lite',
  OPENROUTER_API_KEY: 'segredo-simulado', SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true',
  SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true', SYLVINHO_IA_MENORES_APROVADA: 'true',
  SYLVINHO_IA_ZDR_APROVADO: 'true', SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true'};
function preparar({docs = [criarChunk()], rejeitar = false, falharBusca = false,
  falharTransporte = false, loggerFalha = false} = {}) {
  const diagnosticos = [], chamadas = [], eventos = [];
  let leituras = 0, desserializacoes = 0;
  const fluxo = criarFluxoPerguntaLivre({fonte: {collection(nome) {
    assert.equal(nome, 'conhecimento');
    return {where(...args) {
      assert.deepEqual(args, ['ativo', '==', true]);
      return {async get() {
        leituras++;
        if (falharBusca) throw Error('Detalhe que nao pode entrar no log');
        return {forEach(cb) {docs.forEach(d => cb({id: d.id, data() {desserializacoes++;return d;}}));}};
      }};
    }};
  }}, geracao: {lerAmbiente: () => env,
    registrarDiagnostico(d) {
      diagnosticos.push(d);
      assert.ok(Object.isFrozen(d));
      if (loggerFalha) throw Error('falha local de log');
    }, registrarEvento: (codigo, motivo) => eventos.push({codigo, motivo}),
    criarCliente() {assert.fail('OpenAI direto proibido');},
    criarClienteGemini() {assert.fail('Gemini direto proibido');},
    criarClienteOpenRouter(modelo, chave) {return criarClienteOpenRouter(modelo, chave, async (url, init) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      const body = JSON.parse(init.body), dados = JSON.parse(body.messages[1].content);
      chamadas.push(dados);
      if (falharTransporte) throw Error('Detalhe remoto privado');
      const schema = body.response_format.json_schema.schema.properties;
      const resposta = schema.segura ? {segura: true} : schema.sustentada ? {sustentada: !rejeitar} :
        dados.evidencias.length ? {tipo: 'documental', mensagem: '', afirmacoes: [{
          texto: dados.evidencias[0].texto, referencias: [{id: dados.evidencias[0].id, citacao: dados.evidencias[0].texto}]}]} :
          {tipo: 'sem_base', mensagem: 'Não consegui confirmar essa informação. Consulte a secretaria acadêmica.', afirmacoes: []};
      return new Response(JSON.stringify({choices: [{finish_reason: 'stop',
        message: {role: 'assistant', content: JSON.stringify(resposta)}}]}));
    });},
  }});
  return {responder: () => fluxo.responder(pergunta, {uid}), diagnosticos, chamadas, eventos,
    contagens: () => ({leituras, desserializacoes})};
}
const etapas = f => f.diagnosticos.map(d => d.etapa);
const recebida = f => f.diagnosticos.find(d => d.etapa === 'PROPOSTA_RECEBIDA');

test('revisao reprovada mostra que evidencias foram enviadas sem publicar proposta', async () => {
  const f = preparar({rejeitar: true});
  assert.equal(await f.responder(), RESPOSTA_INDISPONIVEL);
  assert.deepEqual(f.contagens(), {leituras: 1, desserializacoes: 1});
  assert.deepEqual(etapas(f), ['BUSCA_CONCLUIDA', 'CONTEXTO_PREPARADO', 'PROPOSTA_RECEBIDA', 'REVISAO_REPROVADA']);
  assert.deepEqual(f.diagnosticos[0], {etapa: 'BUSCA_CONCLUIDA', lidos: 1, selecionados: 1});
  assert.deepEqual(f.diagnosticos.at(-1), {etapa: 'REVISAO_REPROVADA', contextos: 1,
    evidencias: 1, uso: 'DOCUMENTAL', tipo: 'documental'});
  assert.equal(f.chamadas.length, 3);
  assert.equal(f.chamadas[1].evidencias[0].texto, texto);
  assert.ok(f.chamadas[1].contextos[0].includes(texto));
  assert.equal(f.chamadas[2].pedido.evidencias[0].texto, texto);
  assert.equal(f.eventos.at(-1).motivo, 'REVISAO_REPROVADA');
  for (const dado of [uid, pergunta, texto, 'segredo-simulado', criarChunk().id, criarChunk().documentoId]) {
    assert.equal(JSON.stringify(f.diagnosticos).includes(dado), false);
  }
});
test('sucesso usa quatro chamadas e diagnostico nao altera a resposta', async () => {
  const f = preparar();
  assert.match(await f.responder(), /^Resposta gerada por IA/);
  assert.equal(f.chamadas.length, 4);
  assert.equal(f.diagnosticos.at(-1).etapa, 'REVISAO_APROVADA');
  assert.deepEqual(f.contagens(), {leituras: 1, desserializacoes: 1});
});
test('base vazia e consulta sem fonte permitida sao diferenciadas', async () => {
  for (const docs of [[], [criarChunk(texto, {documentoId: 'fonte-fora-da-lista'})],
    [criarChunk('O procedimento experimental de transporte utiliza papel laranja.')]]) {
    const f = preparar({docs});
    assert.match(await f.responder(), /Não consegui confirmar/);
    assert.deepEqual(f.diagnosticos[0], {etapa: 'BUSCA_CONCLUIDA', lidos: docs.length, selecionados: 0});
    assert.deepEqual(recebida(f), {etapa: 'PROPOSTA_RECEBIDA', contextos: 0, evidencias: 0, uso: 'SEM_EVIDENCIAS'});
    assert.deepEqual(f.chamadas[1].contextos, []);
  }
});
test('contexto privado foi lido mas nao foi enviado ao OpenRouter', async () => {
  const f = preparar({docs: [criarChunk(texto+' Nome completo: Pessoa Sintética.')]});
  await f.responder();
  assert.equal(f.diagnosticos[0].selecionados, 1);
  assert.deepEqual(recebida(f), {etapa: 'PROPOSTA_RECEBIDA', contextos: 0, evidencias: 0, uso: 'CONTEXTO_BLOQUEADO'});
  assert.deepEqual(f.chamadas[1].contextos, []);
  assert.doesNotMatch(JSON.stringify([f.diagnosticos, f.chamadas]), /Pessoa Sintética/);
});
test('falha Firestore nao e diagnosticada como base vazia e nao chama modelo', async () => {
  const f = preparar({falharBusca: true});
  await assert.rejects(f.responder(), /BUSCA_DOCUMENTAL_INDISPONIVEL/);
  assert.deepEqual(f.diagnosticos, [{etapa: 'BUSCA_FALHOU'}]);
  assert.equal(f.chamadas.length, 0);
});
test('falha de transporte nao comprova proposta recebida nem revisao', async () => {
  const f = preparar({falharTransporte: true});
  assert.equal(await f.responder(), RESPOSTA_INDISPONIVEL);
  assert.deepEqual(etapas(f), ['BUSCA_CONCLUIDA', 'CONTEXTO_PREPARADO']);
  assert.equal(f.chamadas.length, 1);
});
test('logger falhando nao repete busca nem muda geracao', async () => {
  const f = preparar({loggerFalha: true});
  assert.match(await f.responder(), /^Resposta gerada por IA/);
  assert.deepEqual(f.contagens(), {leituras: 1, desserializacoes: 1});
  assert.equal(f.chamadas.length, 4);
});
