import test from 'node:test';
import assert from 'node:assert/strict';
import {motivoTextoBloqueado, textoSuspeito} from '../functions/lib/assistente/fundamentacao/contrato.js';
import {filtrarContextosIA} from '../functions/lib/assistente/geracao/contexto.js';
import {criarFluxoPerguntaLivre} from '../functions/lib/assistente/pergunta-livre/fluxo.js';
import {criarClienteOpenRouter} from '../functions/lib/assistente/geracao/openrouter.js';
import {criarChunk} from './fixtures/fundamentacao-sintetica.mjs';

// Trecho administrativo informado na imagem da conversa, sem dados de alunos.
// Nao e um snapshot do Firestore nem certificacao de vigencia da regra.
const trechoInformado = 'Receber os requerimentos e documentação de matrícula: '+
  'estritamente nas datas estabelecidas e divulgadas na legislação própria do '+
  'Vestibulinho, respeitando a ordem de classificação dos candidatos.';
const pergunta = 'Como faço minha matrícula?';
const documentos = [trechoInformado,
  'Matrícula:\n1. Receber o requerimento experimental com papel violeta.',
  'Documentação de matrícula:\nRG: 2 cópias no procedimento experimental.',
].map((conteudo, i) => criarChunk(conteudo, {id: 'matricula-informada-'+i,
  titulo: 'Sistema Etec - B1 - Inicial na Etec', tipoConteudo: 'procedimento',
  secao: 'MÓDULO B - MATRÍCULA\nB1 - Inicial na Etec'}));

for (const texto of [trechoInformado, trechoInformado.replace(': ', ':\n'),
  trechoInformado.toUpperCase(), 'Matrícula: documentação obrigatória',
  'MATRÍCULA: INGRESSO', 'Matrícula:\n1. Apresentar os documentos.',
  'Matrícula: 2) Preencher o requerimento.', 'Matrícula:\r\n12. Comparecer ao setor.',
  'RG: 2 cópias.', 'CPF - 1 (uma) via.', 'RG\n2 cópias.',
  'MÓDULO B - MATRÍCULA\nB1 - Inicial na Etec',
  'Matrícula: requerimento; CPF: cópia; RG: cópia.',
]) test('texto administrativo nao e valor de identificacao: '+texto.slice(0, 60), () => {
  assert.equal(motivoTextoBloqueado(texto, 'documento'), null);
});
test('regressao do erro visto na imagem: modo documental corrige enquanto legado permanece igual', () => {
  assert.equal(textoSuspeito(trechoInformado), true);
  assert.equal(motivoTextoBloqueado(trechoInformado, 'documento'), null);
  const antes = structuredClone(documentos);
  const resultado = filtrarContextosIA(documentos);
  assert.equal(resultado.permitidos.length, 3);
  assert.equal(resultado.sinalizados, 0);
  assert.equal(resultado.descartados, 0);
  assert.deepEqual(documentos, antes);
});
for (const texto of ['Matrícula: TESTE123', 'Matrícula\nTESTE123', 'Matrícula: 42',
  'Matrícula: 42. Pessoa Sintética', 'Minha matrícula é PESSOA',
  'Matrícula = PESSOA', 'Matrícula # PESSOA', 'Matrícula: B1 - Pessoa Sintética',
  'CPF: 12345678901', 'RG 12345678', 'RM: TESTE123', 'RA\n1234567',
  'RG: 12345678 cópias', 'CPF: 2 cópias. CPF: 12345678901',
  'Matrícula:\n1. Apresentar CPF 12345678901',
  trechoInformado+' Matrícula: TESTE123',
]) test('prosa ou lista nao mascara valor preenchido: '+texto.slice(0, 65), () => {
  assert.equal(motivoTextoBloqueado(texto, 'documento'), 'IDENTIFICADOR_PESSOAL');
  assert.equal(textoSuspeito(texto), true);
});
test('contagem distingue trecho que acionou filtro dos descartados pela mesma fonte', () => {
  const r = filtrarContextosIA([documentos[0],
    {...documentos[1], conteudo: 'Matrícula: TESTE123'}, documentos[2]]);
  assert.equal(r.sinalizados, 1);
  assert.equal(r.descartados, 3);
  assert.equal(r.permitidos.length, 0);
  assert.deepEqual(r.motivos, ['IDENTIFICADOR_PESSOAL']);
});

const uid = 'usuario-sintetico';
const env = {SYLVINHO_IA_PROVIDER: 'openrouter', SYLVINHO_IA_ENABLED: 'true',
  OPENROUTER_MODEL: 'google/gemini-3.5-flash-lite', OPENROUTER_API_KEY: 'mock-apenas',
  SYLVINHO_IA_UID_ALLOWLIST: uid, SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true',
  SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true', SYLVINHO_IA_MENORES_APROVADA: 'true',
  SYLVINHO_IA_ZDR_APROVADO: 'true', SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true'};
function simular({contaminar = false} = {}) {
  const chamadas = [], diagnosticos = [], eventos = [];
  let consultas = 0;
  // Mesmo volume visto no log; distratores inteiramente sinteticos.
  const corpus = [...documentos.map((d, i) => contaminar && i === 1 ?
    {...d, conteudo: d.conteudo+' Matrícula: TESTE123'} : d),
  ...Array.from({length: 511}, (_, i) => criarChunk('Transporte experimental por canais violetas.',
    {id: 'distrator-sintetico-'+i, titulo: 'Transporte experimental'}))];
  const fluxo = criarFluxoPerguntaLivre({fonte: {collection(nome) {
    assert.equal(nome, 'conhecimento');
    return {where(...args) {assert.deepEqual(args, ['ativo', '==', true]);
      return {async get() {consultas++; return {forEach(cb) {corpus.forEach(d => cb({id: d.id, data: () => d}));}};}};
    }};
  }}, geracao: {lerAmbiente: () => env,
    registrarDiagnostico: d => diagnosticos.push(d),
    registrarEvento: (codigo, motivo) => eventos.push({codigo, motivo}),
    criarCliente() {assert.fail('OpenAI direto proibido');},
    criarClienteGemini() {assert.fail('Gemini direto proibido');},
    criarClienteOpenRouter(modelo, chave) {
      return criarClienteOpenRouter(modelo, chave, async (url, init) => {
        assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
        const body = JSON.parse(init.body), dados = JSON.parse(body.messages[1].content);
        assert.equal(body.provider.zdr, true);
        chamadas.push(dados);
        const props = body.response_format.json_schema.schema.properties;
        const e = dados.evidencias?.find(e => e.texto.includes('Receber os requerimentos')) || dados.evidencias?.[0];
        const resposta = props.segura ? {segura: true} : props.decisao ? {
          decisao: 'aprovar', motivo: 'SEM_PROBLEMA', respostas: [],
        } : e ? {tipo: 'documental', mensagem: '', afirmacoes: [{texto: e.texto,
          referencias: [{id: e.id, citacao: e.texto}]}]} :
          {tipo: 'sem_base', mensagem: 'Não consegui confirmar o procedimento nos documentos disponíveis.', afirmacoes: []};
        return new Response(JSON.stringify({choices: [{finish_reason: 'stop',
          message: {role: 'assistant', content: JSON.stringify(resposta)}}]}));
      });
    },
  }});
  return {responder: () => fluxo.responder(pergunta, {uid}), chamadas, diagnosticos, eventos,
    consultas: () => consultas};
}
test('514 leituras -> 3 trechos da mesma fonte -> OpenRouter com documentos -> revisao -> resposta', async () => {
  const f = simular();
  const resposta = await f.responder();
  assert.equal(f.consultas(), 1);
  assert.deepEqual(f.diagnosticos[0], {etapa: 'BUSCA_CONCLUIDA', lidos: 514, selecionados: 3});
  assert.deepEqual(f.diagnosticos[1], {etapa: 'CONTEXTO_FILTRADO', avaliados: 3,
    permitidos: 3, sinalizados: 0, descartados: 0, motivos: []});
  assert.equal(f.chamadas.length, 4);
  assert.equal(f.chamadas[1].contextos.length, 3);
  assert.ok(f.chamadas[1].evidencias.length > 0);
  assert.ok(f.chamadas[1].contextos.some(c => c.includes(trechoInformado)));
  assert.deepEqual(f.chamadas[2].pedido, f.chamadas[1]);
  assert.equal(f.chamadas[3].texto, resposta);
  assert.match(resposta, /^Resposta gerada por IA;/);
  assert.ok(resposta.includes(trechoInformado));
  assert.ok(f.diagnosticos.some(d => d.etapa === 'REVISAO_APROVADA' && d.tipo === 'documental'));
  assert.equal(f.eventos.at(-1).codigo, 'GERADA');
  for (const dado of [pergunta, trechoInformado, uid, 'mock-apenas', documentos[0].documentoId]) {
    assert.equal(JSON.stringify(f.diagnosticos).includes(dado), false);
  }
});
test('mesmo cenario com identificador preenchido mantem quarentena e nao o envia', async () => {
  const f = simular({contaminar: true});
  await f.responder();
  assert.deepEqual(f.diagnosticos[1], {etapa: 'CONTEXTO_FILTRADO', avaliados: 3,
    permitidos: 0, sinalizados: 1, descartados: 3, motivos: ['IDENTIFICADOR_PESSOAL']});
  assert.deepEqual(f.chamadas[1].contextos, []);
  assert.deepEqual(f.chamadas[1].evidencias, []);
  assert.doesNotMatch(JSON.stringify([f.chamadas, f.diagnosticos]), /TESTE123/);
});
