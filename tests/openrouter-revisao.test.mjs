import test from 'node:test';
import assert from 'node:assert/strict';
import {criarFluxoPerguntaLivre} from '../functions/lib/assistente/pergunta-livre/fluxo.js';
import {criarClienteOpenRouter} from '../functions/lib/assistente/geracao/openrouter.js';
import {avaliarGeracao} from '../functions/lib/assistente/geracao/contrato.js';
import {validarConversa, RESPOSTA_INDISPONIVEL} from '../functions/lib/assistente/geracao/conversa.js';
import {avaliarRevisao} from '../functions/lib/assistente/geracao/revisao.js';
import {criarChunk} from './fixtures/fundamentacao-sintetica.mjs';

// Corpus e transporte inteiramente sinteticos, sem leitura de credenciais.
const fonte = 'A rematrícula experimental utiliza 42 folhas somente quando autorizada.';
const resumo = 'A rematrícula experimental utiliza 42 folhas apenas quando autorizada.';
const evidencia = {id: 'E1', texto: fonte, contexto: 0};
const documental = (texto, citacao = fonte, id = 'E1') => ({tipo: 'documental', mensagem: '',
  afirmacoes: [{texto, referencias: [{id, citacao}]}]});
const aprovar = {decisao: 'aprovar', motivo: 'SEM_PROBLEMA', respostas: []};
const corrigir = (resposta, motivo = 'CONDICAO_RELEVANTE') => ({decisao: 'corrigir', motivo, respostas: [resposta]});

test('parafrase com somente/apenas chega a revisao; validador legado continua literal', () => {
  assert.ok(validarConversa(documental(resumo), [evidencia]).resposta);
  assert.equal(avaliarGeracao({afirmacoes: documental(resumo).afirmacoes}, [evidencia]).motivo,
    'PROPOSTA_CONDICOES_DIVERGENTES');
});
test('sintese pode omitir numero independente sem inventar outro', () => {
  const citacao = fonte + ' O arquivo experimental possui 7 pastas.';
  const e = {...evidencia, texto: citacao};
  assert.ok(validarConversa(documental(resumo, citacao), [e]).resposta);
  assert.equal(validarConversa(documental(resumo.replace('42', '43'), citacao), [e]).motivo,
    'PROPOSTA_NUMEROS_DIVERGENTES');
  assert.equal(avaliarGeracao({afirmacoes: documental(resumo, citacao).afirmacoes}, [e]).motivo,
    'PROPOSTA_NUMEROS_DIVERGENTES');
});
for (const [nome, resposta, motivo] of [
  ['referencia inventada', documental(resumo, fonte, 'E99'), 'PROPOSTA_REFERENCIA_INVALIDA'],
  ['citacao alterada', documental(resumo, fonte + ' alterada'), 'PROPOSTA_CITACAO_DIVERGENTE'],
  ['numero novo', documental(resumo.replace('42', '43')), 'PROPOSTA_NUMEROS_DIVERGENTES'],
  ['html', documental('<script>'), 'PROPOSTA_TEXTO_INVALIDO'],
  ['dado pessoal', documental('CPF 12345678901'), 'PROPOSTA_TEXTO_INVALIDO'],
]) test('correcao do revisor nao libera '+nome, () => {
  const r = avaliarRevisao(corrigir(resposta), documental(fonte), [evidencia]);
  assert.equal(r.resposta, null);
  assert.equal(r.codigo, 'REVISAO_CORRECAO_INVALIDA');
  assert.equal(r.motivo, motivo);
});
for (const motivo of ['SEM_SUPORTE', 'CONTRADICAO', 'CONDICAO_RELEVANTE',
  'ESCOPO_INCORRETO', 'PERGUNTA_AMBIGUA', 'SEGURANCA']) {
  test('recusa concreta preservada: '+motivo, () => {
    assert.deepEqual(avaliarRevisao({decisao: 'recusar', motivo, respostas: []},
      documental(fonte), [evidencia]), {resposta: null, codigo: 'REVISAO_REPROVADA', motivo});
  });
}
for (const entrada of [null, {sustentada: true}, {...aprovar, motivo: 'CLAREZA'},
  {...aprovar, respostas: [documental(fonte)]}, {...aprovar, motivo: 'justificativa privada'},
  {...aprovar, extra: 'dado privado'}, {decisao: 'corrigir', motivo: 'CLAREZA', respostas: []},
  corrigir(documental(fonte), 'SEM_PROBLEMA'),
  {decisao: 'recusar', motivo: 'SEM_PROBLEMA', respostas: []}]) {
  test('decisao malformada nao aprova e nao vaza conteudo: '+JSON.stringify(entrada), () => {
    assert.deepEqual(avaliarRevisao(entrada, documental(fonte), [evidencia]),
      {resposta: null, codigo: 'REVISAO_FORMATO_INVALIDO', motivo: 'FORMATO_INVALIDO'});
  });
}

const uid = 'sintetico-autorizado';
const env = {SYLVINHO_IA_ENABLED: 'true', SYLVINHO_IA_PROVIDER: 'openrouter',
  OPENROUTER_MODEL: 'google/gemini-3.5-flash-lite', OPENROUTER_API_KEY: 'mock-apenas',
  SYLVINHO_IA_UID_ALLOWLIST: uid, SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true',
  SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true', SYLVINHO_IA_MENORES_APROVADA: 'true',
  SYLVINHO_IA_ZDR_APROVADO: 'true', SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true'};
const pergunta = 'Como faço para renovar minha matrícula?';
function simular({proposta = documental(resumo), revisao = aprovar, saidaSegura = true,
  esperarRevisao = false} = {}) {
  const chamadas = [], eventos = [], diagnosticos = [];
  const doc = criarChunk([fonte,
    'A rematrícula experimental utiliza papel violeta de laboratório.',
    'A rematrícula experimental possui conferência no setor experimental.'].join(' '),
  {titulo: 'Renovação de matrícula experimental'});
  const fluxo = criarFluxoPerguntaLivre({fonte: {collection(nome) {
    assert.equal(nome, 'conhecimento');
    return {where() {return {async get() {return {forEach(cb) {cb({id: doc.id, data: () => doc});}};}};}};
  }}, geracao: {lerAmbiente: () => ({...env, SYLVINHO_IA_TIMEOUT_MS: esperarRevisao ? '200' : '20000'}),
    registrarEvento: (codigo, motivo) => eventos.push({codigo, motivo}),
    registrarDiagnostico: d => diagnosticos.push(d),
    criarCliente() {assert.fail('OpenAI direto nao permitido');},
    criarClienteGemini() {assert.fail('Gemini direto nao permitido');},
    criarClienteOpenRouter(modelo, chave) {
      const cliente = criarClienteOpenRouter(modelo, chave, async (url, init) => {
        assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
        const body = JSON.parse(init.body), dados = JSON.parse(body.messages[1].content);
        chamadas.push({dados, signal: init.signal});
        assert.equal(body.provider.zdr, true);
        assert.equal(body.response_format.type, 'json_schema');
        const props = body.response_format.json_schema.schema.properties;
        if (props.decisao && esperarRevisao) return new Promise(() => {});
        const valor = props.segura ? {segura: chamadas.length === 1 || saidaSegura} :
          props.decisao ? typeof revisao === 'function' ? revisao(dados) : revisao : proposta;
        return new Response(JSON.stringify({choices: [{finish_reason: 'stop',
          message: {role: 'assistant', content: JSON.stringify(valor)}}]}));
      });
      return cliente;
    },
  }});
  return {responder: () => fluxo.responder(pergunta, {uid}), chamadas, eventos, diagnosticos};
}

test('renovacao com um contexto e tres evidencias aprova sintese em quatro chamadas', async () => {
  const f = simular();
  const resposta = await f.responder();
  assert.ok(resposta.startsWith('Resposta gerada por IA;'));
  assert.ok(resposta.includes(resumo));
  assert.equal(f.chamadas.length, 4);
  assert.equal(f.chamadas[1].dados.contextos.length, 1);
  assert.equal(f.chamadas[1].dados.evidencias.length, 3);
  assert.equal(f.chamadas[2].dados.proposta.afirmacoes[0].texto, resumo);
  assert.ok(f.diagnosticos.some(d => d.etapa === 'REVISAO_APROVADA' && d.motivoRevisao === 'SEM_PROBLEMA'));
});
test('revisor corrige condicao relevante omitida e publica somente a resposta corrigida', async () => {
  const original = 'A rematrícula experimental utiliza 42 folhas.';
  const f = simular({proposta: documental(original), revisao: dados => {
    assert.equal(dados.proposta.afirmacoes[0].texto, original);
    assert.equal(dados.pedido.evidencias[0].texto, fonte);
    return corrigir(documental(resumo));
  }});
  const resposta = await f.responder();
  assert.ok(resposta.includes(resumo));
  assert.equal(resposta.includes(original), false);
  assert.equal(f.chamadas.length, 4);
  assert.ok(f.chamadas[3].dados.texto.includes(resumo));
  assert.equal(f.chamadas[3].dados.texto.includes(original), false);
  assert.ok(f.diagnosticos.some(d => d.etapa === 'REVISAO_CORRIGIDA' && d.motivoRevisao === 'CONDICAO_RELEVANTE'));
});
test('revisor recusa contradicao sem ser ignorado pelo gateway', async () => {
  const f = simular({proposta: documental('A rematrícula experimental nunca utiliza 42 folhas.'),
    revisao: {decisao: 'recusar', motivo: 'CONTRADICAO', respostas: []}});
  assert.equal(await f.responder(), RESPOSTA_INDISPONIVEL);
  assert.equal(f.chamadas.length, 3);
  assert.equal(f.eventos.at(-1).motivo, 'REVISAO_REPROVADA');
  assert.equal(f.diagnosticos.at(-1).motivoRevisao, 'CONTRADICAO');
});
test('correcao pode pedir esclarecimento sem publicar a exigencia anterior', async () => {
  const mensagem = 'Você está perguntando sobre renovação ou transferência?';
  const f = simular({revisao: corrigir({tipo: 'esclarecimento', mensagem, afirmacoes: []}, 'PERGUNTA_AMBIGUA')});
  const resposta = await f.responder();
  assert.equal(resposta, 'Sobre qual procedimento você quer saber?');
  assert.doesNotMatch(resposta, /42|Trecho documental/);
  assert.equal(f.chamadas.length, 3);
});
test('correcao com citacao inventada e rejeitada com motivo seguro', async () => {
  const f = simular({revisao: corrigir(documental(resumo, fonte + ' valor privado'))});
  assert.equal(await f.responder(), RESPOSTA_INDISPONIVEL);
  assert.equal(f.chamadas.length, 3);
  assert.equal(f.diagnosticos.at(-1).motivoRevisao, 'PROPOSTA_CITACAO_DIVERGENTE');
  assert.doesNotMatch(JSON.stringify(f.diagnosticos), /valor privado/);
});
test('moderacao final permanece obrigatoria depois da correcao', async () => {
  const f = simular({revisao: corrigir(documental(resumo), 'CLAREZA'), saidaSegura: false});
  assert.equal(await f.responder(), RESPOSTA_INDISPONIVEL);
  assert.equal(f.chamadas.length, 4);
  assert.equal(f.eventos.at(-1).motivo, 'SAIDA_INSEGURA');
  assert.equal(f.eventos.some(e => e.codigo === 'GERADA'), false);
});
test('timeout da revisao nao inicia outra tentativa nem publica proposta', async () => {
  const f = simular({esperarRevisao: true});
  assert.equal(await f.responder(), RESPOSTA_INDISPONIVEL);
  assert.equal(f.chamadas.length, 3);
  assert.equal(f.eventos.at(-1).motivo, 'GERACAO_TIMEOUT');
  assert.ok(f.chamadas.every(c => c.signal.aborted));
});
