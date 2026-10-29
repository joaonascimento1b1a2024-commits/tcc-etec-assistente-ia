import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
import {criarGeradorConfiguravel} from '../functions/lib/assistente/geracao/gateway.js';
import {criarClienteOpenRouter} from '../functions/lib/assistente/geracao/openrouter.js';
import {corpus} from './fixtures/rag-benchmark.mjs';

for (const perfil of ['aluno', 'responsável', 'professor', 'visitante']) {
  test(`encaminhamento sem dados e sem confirmar servico: ${perfil}`, async () => {
    const gerar = criarGeradorConfiguravel({lerAmbiente: () => ({}),
      criarCliente: () => assert.fail('IA desabilitada')});
    const r = await gerar(`Sou ${perfil}. Qual o prazo para diploma?`, []);
    assert.match(r, /Confirme com a Secretaria Acadêmica/);
    assert.match(r, /Qual é o prazo/);
    assert.doesNotMatch(r, /\d|https?:|@|gerada por IA|registrado|enviado/);
  });
}
for (const q of ['Qual o telefone da secretaria?', 'Qual o e-mail?', 'Qual o horário de atendimento?']) {
  test('nao fabrica canal de atendimento: '+q, () => {
    const r = gerarRespostaDocumental(q, []).resposta;
    assert.match(r, /canais oficiais divulgados pela escola/);
    assert.doesNotMatch(r, /\d|https?:|@|compareça|ligue para/);
  });
}
test('texto livre pessoal nao e reproduzido no encaminhamento', () => {
  const r = gerarRespostaDocumental('Meu nome é Pessoa Fictícia. Qual o prazo?', []).resposta;
  assert.doesNotMatch(r, /Pessoa Fictícia/);
});
test('esclarecimento continua curto e nao recebe outra sugestao', () => {
  const r = gerarRespostaDocumental('Quais documentos?', []).resposta;
  assert.match(r, /Sobre qual procedimento/);
  assert.doesNotMatch(r, /Confirme com|Qual é o prazo/);
});
test('procedimento documental conserva citacao, fonte e parser sem falsa interpretacao', () => {
  const r = gerarRespostaDocumental('Como solicitar declaração escolar?', [corpus[3]]);
  const ctx = {};
  vm.runInNewContext(readFileSync(new URL('../public/Logado/Home/resposta-documental-view.js', import.meta.url), 'utf8'), ctx);
  assert.ok(ctx.apresentacaoDocumental.analisar(r.resposta));
  assert.equal(r.citacoes[0].texto, corpus[3].conteudo);
  assert.match(r.resposta, /Fonte:/);
  assert.doesNotMatch(r.resposta, /gerada por IA|Próxima ação|solicitação registrada/);
});
test('conflito continua sem proxima acao escolar inferida', () => {
  const r = gerarRespostaDocumental('Frequência mínima', [corpus[2], {...corpus[2], id: 'divergente', conteudo: corpus[2].conteudo.replace('80%', '60%')}]);
  assert.equal(r.motivo, 'trechos_contraditorios');
  assert.equal(r.citacoes.length, 0);
  assert.doesNotMatch(r.resposta, /80%|60%/);
});

const env = {SYLVINHO_IA_ENABLED: 'true', SYLVINHO_IA_PROVIDER: 'openrouter',
  SYLVINHO_IA_UID_ALLOWLIST: 'teste', OPENROUTER_MODEL: 'google/gemini-3.5-flash-lite',
  OPENROUTER_API_KEY: 'somente-mock', SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true',
  SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true', SYLVINHO_IA_MENORES_APROVADA: 'true',
  SYLVINHO_IA_ZDR_APROVADO: 'true', SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true'};
test('geracao e revisao recebem padrao adaptativo; saida simulada preserva fontes', async () => {
  const cargas = [];
  const gerar = criarGeradorConfiguravel({lerAmbiente: () => env,
    criarClienteOpenRouter: (modelo, chave) => criarClienteOpenRouter(modelo, chave, async (_url, init) => {
      const body = JSON.parse(init.body); cargas.push(body);
      const schema = body.response_format.json_schema.schema.properties;
      const pedido = JSON.parse(body.messages[1].content);
      const saida = schema.segura ? {segura: true} : schema.decisao ?
        {decisao: 'aprovar', motivo: 'SEM_PROBLEMA', respostas: []} :
        {tipo: 'documental', mensagem: '', afirmacoes: [{texto: 'Solicite a declaração escolar na secretaria experimental.',
          referencias: [{id: pedido.evidencias[0].id, citacao: pedido.evidencias[0].texto}]}]};
      return new Response(JSON.stringify({choices: [{finish_reason: 'stop', message: {role: 'assistant', content: JSON.stringify(saida)}}]}));
    })});
  const r = await gerar('Como solicitar declaração escolar?', [corpus[3]], {uid: 'teste'});
  assert.match(r, /Resposta gerada por IA/); assert.match(r, /Fonte:/);
  assert.equal(cargas.length, 4);
  const prompt = cargas[1].messages[0].content;
  for (const trecho of ['alunos, responsaveis, professores e visitantes', 'Nao force cinco titulos',
    'proxima acao sustentada', 'no maximo uma pergunta', 'nao executa servicos escolares']) assert.ok(prompt.includes(trecho), trecho);
  assert.match(cargas[2].messages[0].content, /confirmacoes de envio/);
});
