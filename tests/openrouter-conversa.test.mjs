import test from 'node:test';
import assert from 'node:assert/strict';
import {criarClienteOpenRouter} from '../functions/lib/assistente/geracao/openrouter.js';
import {criarGeradorConfiguravel} from '../functions/lib/assistente/geracao/gateway.js';
import {validarConversa, RESPOSTA_INDISPONIVEL} from '../functions/lib/assistente/geracao/conversa.js';
import {textoSuspeito} from '../functions/lib/assistente/fundamentacao/contrato.js';
import {criarChunk} from './fixtures/fundamentacao-sintetica.mjs';

// Transporte simulado: nenhuma chamada externa nem dados de alunos.
const uid = 'usuario-sintetico';
const env = {SYLVINHO_IA_ENABLED: 'true', SYLVINHO_IA_PROVIDER: 'openrouter',
  SYLVINHO_IA_UID_ALLOWLIST: uid, OPENROUTER_MODEL: 'google/gemini-3.5-flash-lite',
  OPENROUTER_API_KEY: 'mock-apenas', SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true',
  SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true', SYLVINHO_IA_MENORES_APROVADA: 'true',
  SYLVINHO_IA_ZDR_APROVADO: 'true', SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true'};
const mensagem = (tipo, texto) => ({tipo, mensagem: texto, afirmacoes: []});
function simular(saida, {revisao = true, moderacao = true, falhar = 0} = {}) {
  const chamadas = [], eventos = [];
  const gerar = criarGeradorConfiguravel({lerAmbiente: () => env,
    criarCliente() {assert.fail('OpenAI direto proibido');},
    criarClienteGemini() {assert.fail('Gemini direto proibido');},
    registrarEvento: (codigo, motivo) => eventos.push({codigo, motivo}),
    criarClienteOpenRouter(modelo, chave) {
      return criarClienteOpenRouter(modelo, chave, async (url, init) => {
        assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
        const body = JSON.parse(init.body), dados = JSON.parse(body.messages[1].content);
        chamadas.push({body, dados});
        if (falhar) return new Response('erro privado simulado', {status: falhar});
        assert.equal(body.provider.zdr, true);
        const schema = body.response_format.json_schema.schema.properties;
        const resposta = schema.segura ? {segura: moderacao} :
          schema.decisao ? {decisao: revisao ? 'aprovar' : 'recusar',
            motivo: revisao ? 'SEM_PROBLEMA' : 'SEM_SUPORTE', respostas: []} : schema.sustentada ? {sustentada: revisao} :
          typeof saida === 'function' ? saida(dados) : saida;
        return new Response(JSON.stringify({choices: [{finish_reason: 'stop',
          message: {role: 'assistant', content: JSON.stringify(resposta)}}]}));
      });
    },
  });
  return {gerar: (q, docs = [], contexto = {uid}) => gerar(q, docs, contexto), chamadas, eventos};
}
for (const [pergunta, tipo, resposta] of [
  ['Preciso levar RG?', 'esclarecimento', 'Para qual procedimento você precisa do RG: matrícula, rematrícula ou transferência?'],
  ['Qual semestre?', 'esclarecimento', 'Você está perguntando sobre o 1º ou o 2º semestre?'],
  ['Qual é o prazo da inscrição?', 'sem_base', 'Não tenho o prazo confirmado nos documentos disponíveis. Consulte a secretaria para confirmar o período.'],
  ['O que significa RG?', 'geral', 'RG significa Registro Geral, uma identificação civil.'],
  ['Como organizar meus estudos?', 'geral', 'Separe os assuntos por prioridade e reserve momentos para revisar e praticar.'],
  ['Quanto é dois mais dois?', 'geral', '2 + 2 = 4.'],
  ['Olá!', 'conversa', 'Olá! Como posso ajudar você hoje?'],
  ['Envie um email para a escola por mim.', 'fora_escopo', 'Não consigo enviar mensagens por você, mas posso ajudar a escrever uma solicitação para a secretaria.'],
]) test('pergunta sem evidencias recebe resposta pertinente simulada: '+pergunta, async () => {
  const f = simular(mensagem(tipo, resposta));
  const r = await f.gerar(pergunta);
  assert.ok(r.endsWith(resposta));
  assert.equal(f.chamadas.length, 4);
  assert.equal(f.chamadas[1].dados.pergunta, pergunta);
  assert.deepEqual(f.chamadas[1].dados.contextos, []);
  assert.deepEqual(f.chamadas[1].dados.evidencias, []);
  assert.equal(f.chamadas[1].dados.situacao, 'sem_evidencias');
  assert.equal(f.eventos.at(-1).codigo, 'GERADA');
  assert.doesNotMatch(JSON.stringify(f.chamadas), /usuario-sintetico|mock-apenas/);
  if (tipo === 'geral') assert.match(r, /não é uma regra da escola/);
});

test('RG sem procedimento pergunta antes de usar regra de transferencia', async () => {
  const q = 'Preciso levar RG?';
  const doc = criarChunk('Na transferência experimental, apresentar RG em papel violeta.',
    {titulo: 'Transferência experimental'});
  const resposta = 'Para qual procedimento você precisa do RG?';
  const f = simular(mensagem('esclarecimento', resposta));
  assert.ok((await f.gerar(q, [doc])).endsWith(resposta));
  assert.match(f.chamadas[1].dados.contextos[0], /Transferência experimental/);
  assert.doesNotMatch(await simular(mensagem('esclarecimento', resposta)).gerar(q, [doc]), /Trecho documental/);
});

test('pergunta com procedimento responde com fonte e contexto identificados', async () => {
  const conteudo = 'Na transferência experimental, apresentar RG em papel violeta.';
  const doc = criarChunk(conteudo, {titulo: 'Transferência experimental'});
  const f = simular(p => ({tipo: 'documental', mensagem: '', afirmacoes: [{texto: conteudo,
    referencias: [{id: p.evidencias[0].id, citacao: p.evidencias[0].texto}]}]}));
  const r = await f.gerar('Preciso levar RG para a transferência?', [doc]);
  assert.match(r, /^Resposta gerada por IA/);
  assert.match(r, /Fonte:/);
  assert.ok(r.includes(conteudo));
  assert.equal(f.chamadas.length, 4);
});

for (const texto of ['Cópia do RG e CPF.', 'Preencha o nome completo do responsável.',
  'O formulário contém o campo nome completo.', 'RG: matrícula ou transferência?', 'CPF: cópia do documento.', 'Fill in the full name field.']) {
  test('nome de campo generico nao e dado preenchido: '+texto, () => {
    assert.equal(textoSuspeito(texto), false);
  });
}
for (const texto of ['Nome completo: Pessoa Sintética', 'Nome do aluno: Pessoa Sintética',
  'Full name: Synthetic Person', 'Nome completo:\nPessoa Sintética', 'RG 12345678', 'CPF 12345678901', 'Matrícula: ABC123']) {
  test('identificacao sintetica continua bloqueada: '+texto, async () => {
    assert.equal(textoSuspeito(texto), true);
    const f = simular(mensagem('conversa', 'Olá!'));
    assert.match(await f.gerar(texto), /sem nomes/);
    assert.equal(f.chamadas.length, 0);
  });
}
test('contexto privado e descartado integralmente mas pergunta segura chega ao modelo', async () => {
  const f = simular(mensagem('esclarecimento', 'Qual procedimento você deseja realizar?'));
  const r = await f.gerar('Preciso levar RG?', [criarChunk('Apresentar RG. Nome completo: Pessoa Sintética')]);
  assert.match(r, /Qual procedimento/);
  assert.equal(f.chamadas.length, 4);
  assert.equal(f.eventos[0].motivo, 'DADOS_BLOQUEADOS_CONTEXTO');
  assert.equal(f.chamadas[1].dados.situacao, 'contexto_indisponivel');
  assert.deepEqual(f.chamadas[1].dados.contextos, []);
  assert.deepEqual(f.chamadas[1].dados.evidencias, []);
  assert.doesNotMatch(JSON.stringify(f.chamadas), /Pessoa Sintética/);
});
test('instrucoes genericas de formulario seguem com contexto para IA', async () => {
  const f = simular(mensagem('esclarecimento', 'Qual procedimento você deseja realizar?'));
  await f.gerar('Preciso levar RG?', [criarChunk('No procedimento experimental, apresentar RG e CPF e preencher o nome completo do responsável.')]);
  assert.ok(f.chamadas[1].dados.contextos.length);
  assert.equal(f.eventos.some(e => e.motivo === 'DADOS_BLOQUEADOS_CONTEXTO'), false);
});
for (const [saida, motivo] of [
  [mensagem('documental', ''), 'PROPOSTA_VAZIA'],
  [mensagem('geral', '<script>'), 'PROPOSTA_TEXTO_INVALIDO'],
  [mensagem('geral', 'Veja https://example.invalid'), 'PROPOSTA_TEXTO_INVALIDO'],
  [mensagem('geral', 'Nome completo: Pessoa Sintética'), 'PROPOSTA_TEXTO_INVALIDO'],
  [{tipo: 'geral', mensagem: 'Olá!', afirmacoes: [], extra: true}, 'PROPOSTA_SCHEMA_INVALIDO'],
]) test('resposta invalida retorna mensagem local e codigo: '+motivo, async () => {
  const f = simular(saida);
  assert.equal(await f.gerar('Preciso levar RG?'), RESPOSTA_INDISPONIVEL);
  assert.equal(f.eventos.at(-1).motivo, motivo);
  assert.equal(f.chamadas.length, 2);
});
test('revisor impede regra escolar inventada no tipo geral', async () => {
  const f = simular(mensagem('geral', 'A escola exige levar o RG para toda rematrícula.'), {revisao: false});
  assert.equal(await f.gerar('Preciso levar RG?'), RESPOSTA_INDISPONIVEL);
  assert.equal(f.eventos.at(-1).motivo, 'REVISAO_REPROVADA');
  assert.equal(f.chamadas.length, 3);
});
test('erro HTTP nao produz lista de trechos e nao e rotulado como IA', async () => {
  const f = simular(null, {falhar: 503});
  const r = await f.gerar('Preciso levar RG?', [criarChunk('Apresentar RG na transferência experimental.')]);
  assert.equal(r, RESPOSTA_INDISPONIVEL);
  assert.doesNotMatch(r, /gerada por IA|Trecho documental|transferência/);
  assert.equal(f.eventos.at(-1).motivo, 'OPENROUTER_SEM_ENDPOINT_COMPATIVEL');
});
test('validacao admite numeros gerais sem permitir regra documental sem fonte', () => {
  assert.ok(validarConversa(mensagem('geral', '2 + 2 = 4.'), []).resposta);
  assert.equal(validarConversa(mensagem('documental', ''), []).resposta, null);
});
