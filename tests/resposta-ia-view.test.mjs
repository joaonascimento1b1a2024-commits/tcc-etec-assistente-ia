import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {criarGeradorConfiguravel} from '../functions/lib/assistente/geracao/gateway.js';
import {criarClienteOpenRouter} from '../functions/lib/assistente/geracao/openrouter.js';
import {criarChunk} from './fixtures/fundamentacao-sintetica.mjs';

const source = readFileSync(new URL('../public/Logado/Home/resposta-documental-view.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const {analisar, renderizar} = context.apresentacaoDocumental;
class Element {
  constructor(tag, doc) {this.tagName = tag; this.ownerDocument = doc; this.children = [];
    this.className = ''; this.raw = ''; this.open = false;
    this.classList = {add: name => {this.className += ' '+name;}};}
  set textContent(value) {this.raw = String(value); this.children = [];}
  get textContent() {return this.raw + this.children.map(c => c.textContent).join('');}
  append(...children) {this.children.push(...children);}
}
const container = () => {const doc = {createElement: tag => new Element(tag, doc)}; return doc.createElement('div');};
const walk = e => [e, ...e.children.flatMap(walk)];
const visible = e => e.tagName === 'details' && !e.open ? e.children[0].textContent :
  e.raw + e.children.map(visible).join('\n');
const aviso = 'Resposta gerada por IA; confira as fontes oficiais.';
const parcial = 'Resposta gerada por IA; parte das fontes não pôde ser utilizada. Confira as fontes oficiais.';
const introducao = 'Trechos documentais relacionados a pergunta (citacoes, nao uma interpretacao ou garantia de regra vigente):';
const explicacao = 'Você pode entregar os documentos nas datas divulgadas para o processo experimental.\n\nA ordem de classificação precisa ser respeitada.';
const citacao = 'A matrícula experimental recebe documentação nas datas divulgadas, respeitando a ordem de classificação.';
const fontes = n => introducao+Array.from({length: n}, (_, i) => `\n\n${i+1}. Trecho documental: "${citacao}"\nFonte: Documento de teste; documento: doc-sintetico; trecho: chunk-sintetico-${i}; paginas 25-26 (intervalo do chunk).`).join('');
const resposta = (n = 3, prefixo = aviso) => prefixo+'\n\n'+explicacao+'\n\n'+fontes(n);

for (const n of [1, 2, 3]) test('IA mostra explicacao e recolhe '+n+' fontes sem perder o original', () => {
  const original = resposta(n), c = container();
  const parsed = analisar(original);
  assert.equal(parsed.resposta, explicacao);
  assert.equal(parsed.citacoes.length, n);
  assert.ok(renderizar(c, original));
  assert.match(visible(c), /Você pode entregar/);
  assert.match(visible(c), /Ver fontes/);
  assert.doesNotMatch(visible(c), /Trecho documental|doc-sintetico|chunk-sintetico/);
  const details = c.children.find(e => e.tagName === 'details');
  assert.equal(details.open, false);
  assert.equal(details.children[0].tagName, 'summary');
  details.open = true;
  assert.ok(visible(c).includes(citacao));
  assert.match(visible(c), /Documento de teste — páginas 25-26/);
  assert.doesNotMatch(visible(c), /doc-sintetico|chunk-sintetico/);
  const completo = walk(c).find(e => e.className === 'documental-texto-original');
  assert.equal(completo.textContent, original);
});
test('aviso sobre fontes parciais permanece visivel', () => {
  const c = container();
  renderizar(c, resposta(1, parcial));
  assert.ok(visible(c).includes(parcial));
});
test('historico com CRLF preserva texto e citacoes', () => {
  const original = resposta().replaceAll('\n', '\r\n'), c = container();
  assert.ok(renderizar(c, original));
  assert.equal(analisar(original).resposta, explicacao.replaceAll('\n', '\r\n'));
  assert.equal(walk(c).find(e => e.className === 'documental-texto-original').textContent, original);
  const reaberta = container();
  renderizar(reaberta, original);
  assert.equal(visible(reaberta), visible(c));
});
test('resposta documental sem IA conserva a primeira citacao aberta', () => {
  const c = container();
  assert.ok(renderizar(c, fontes(3)));
  assert.equal(c.children.filter(e => e.tagName === 'figure').length, 1);
  assert.ok(visible(c).includes(citacao));
});
for (const original of [aviso+'\n\n'+explicacao, resposta()+'\ntexto adicional',
  resposta().replace('Fonte:', 'Origem:'), resposta().replace(aviso, 'Resposta externa.'),
  resposta().replace('1. Trecho', '2. Trecho'), 'x'.repeat(2401)]) {
  test('formato inesperado conserva tudo em texto: '+original.slice(0, 45), () => {
    const c = container();
    assert.equal(renderizar(c, original), false);
    assert.equal(c.textContent, original);
    assert.equal(c.children.length, 0);
  });
}
test('HTML na explicacao ou na fonte nunca vira elemento executavel', () => {
  const ataque = '<img src=x onerror=alert(1)><script>alert(1)</script>';
  const original = resposta(1).replace(explicacao, ataque).replace(citacao, ataque);
  const c = container();
  assert.ok(renderizar(c, original));
  assert.ok(c.textContent.includes(ataque));
  assert.equal(walk(c).some(e => ['script', 'img', 'a'].includes(e.tagName)), false);
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|eval\(/);
});

test('revisor simplifica sem quinta chamada, preserva condicoes e citacao ate a exibicao', async () => {
  const uid = 'usuario-sintetico';
  const env = {SYLVINHO_IA_PROVIDER: 'openrouter', SYLVINHO_IA_ENABLED: 'true',
    OPENROUTER_MODEL: 'google/gemini-3.5-flash-lite', OPENROUTER_API_KEY: 'mock-apenas',
    SYLVINHO_IA_UID_ALLOWLIST: uid, SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true',
    SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true', SYLVINHO_IA_MENORES_APROVADA: 'true',
    SYLVINHO_IA_ZDR_APROVADO: 'true', SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA: 'true'};
  const tecnica = 'A documentação referente à matrícula experimental deve ser entregue estritamente nas datas divulgadas, respeitando a ordem de classificação.';
  const simples = 'Entregue os documentos da matrícula experimental nas datas divulgadas. A ordem de classificação precisa ser respeitada.';
  const chamadas = [], diagnosticos = [];
  const gerar = criarGeradorConfiguravel({lerAmbiente: () => env,
    registrarDiagnostico: d => diagnosticos.push(d),
    criarCliente() {assert.fail('OpenAI direto proibido');},
    criarClienteGemini() {assert.fail('Gemini direto proibido');},
    criarClienteOpenRouter(modelo, chave) {
      return criarClienteOpenRouter(modelo, chave, async (url, init) => {
        assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
        const body = JSON.parse(init.body), dados = JSON.parse(body.messages[1].content);
        chamadas.push({body, dados});
        const props = body.response_format.json_schema.schema.properties;
        const e = (props.decisao ? dados.pedido : dados).evidencias?.[0];
        const documental = texto => ({tipo: 'documental', mensagem: '', afirmacoes: [{texto,
          referencias: [{id: e.id, citacao: e.texto}]}]});
        const valor = props.segura ? {segura: true} : props.decisao ? {
          decisao: 'corrigir', motivo: 'CLAREZA', respostas: [documental(simples)],
        } : documental(tecnica);
        return new Response(JSON.stringify({choices: [{finish_reason: 'stop',
          message: {role: 'assistant', content: JSON.stringify(valor)}}]}));
      });
    },
  });
  const original = await gerar('Como fazer matrícula?', [criarChunk(citacao)], {uid});
  assert.equal(chamadas.length, 4);
  assert.ok(original.includes(simples));
  assert.ok(original.includes(citacao));
  assert.equal(original.includes(tecnica), false);
  assert.equal(chamadas[3].dados.texto, original);
  for (const indice of [1, 2]) {
    assert.match(chamadas[indice].body.messages[0].content, /palavras do dia a dia/);
    assert.match(chamadas[indice].body.messages[0].content, /tarefas do aluno de rotinas da secretaria/);
  }
  assert.ok(diagnosticos.some(d => d.etapa === 'REVISAO_CORRIGIDA' && d.motivoRevisao === 'CLAREZA'));
  const c = container();
  assert.ok(renderizar(c, original));
  assert.ok(visible(c).includes(simples));
  assert.doesNotMatch(visible(c), /Trecho documental|documentacao|documento:|trecho:/);
  assert.equal(walk(c).find(e => e.className === 'documental-texto-original').textContent, original);
});
