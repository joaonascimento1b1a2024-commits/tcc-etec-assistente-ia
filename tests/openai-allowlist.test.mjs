import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {criarGeradorConfiguravel, usuarioIAAutorizado} from '../functions/lib/assistente/geracao/gateway.js';
import {criarEndpointAssistente} from '../functions/lib/assistente/http.js';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
import {pergunta, criarChunk} from './fixtures/fundamentacao-sintetica.mjs';

// Todos os UIDs/contas/segredos deste arquivo sao ficticios e somente locais.
const autorizado = 'teste-autorizado';
const chunks = [criarChunk()];
const baseline = gerarRespostaDocumental(pergunta, chunks).resposta;
function fixture(lista = autorizado) {
  const env = {SYLVINHO_IA_ENABLED: 'true', SYLVINHO_IA_PROVIDER: 'openai',
    SYLVINHO_IA_UID_ALLOWLIST: lista, OPENAI_MODEL: 'modelo-simulado',
    SYLVINHO_IA_INSTITUCIONAL_APROVADA: 'true', SYLVINHO_IA_PRIVACIDADE_APROVADA: 'true',
    SYLVINHO_IA_MENORES_APROVADA: 'true', SYLVINHO_IA_ZDR_APROVADO: 'true'};
  const chamadas = [], eventos = [];
  let criacoes = 0, leiturasChave = 0;
  Object.defineProperty(env, 'OPENAI_API_KEY', {get() {leiturasChave++; throw Error('NAO_LER_SEGREDO');}});
  const gerar = criarGeradorConfiguravel({lerAmbiente: () => env,
    registrarEvento: c => eventos.push(c), criarCliente() {
      criacoes++;
      return {
        async moderar(texto) {chamadas.push(['moderar', texto]); return true;},
        async propor(p) {
          chamadas.push(['propor', p]);
          return {afirmacoes: [{texto: 'O papel violeta de laboratório é utilizado para o certificado experimental.',
            referencias: [{id: p.evidencias[0].id, citacao: p.evidencias[0].texto}]}]};
        },
        async verificar(p, proposta) {chamadas.push(['verificar', p, proposta]); return true;},
      };
    }});
  return {env, gerar, chamadas, eventos, contadores: () => ({criacoes, leiturasChave})};
}
for (const [nome, lista] of [
  ['ausente', undefined], ['vazia', ''], ['espacos', ' '], ['wildcard', '*'],
  ['wildcard misturado', autorizado + ',*'], ['duplicados', autorizado + ',' + autorizado],
  ['item vazio', autorizado + ','], ['mais de vinte', Array.from({length:21}, (_,i) => 'teste-'+i).join(',')],
  ['formato invalido', autorizado + ',uid com espaco'], ['excessiva', 'x'.repeat(3001)],
]) test('allowlist fail-closed: ' + nome, async () => {
  const f = fixture(lista); // undefined e explicitamente removido abaixo.
  if (lista === undefined) delete f.env.SYLVINHO_IA_UID_ALLOWLIST;
  assert.equal(await f.gerar(pergunta, chunks, {uid: autorizado}), baseline);
  assert.equal(f.chamadas.length, 0);
  assert.deepEqual(f.contadores(), {criacoes: 0, leiturasChave: 0});
});
for (const [nome, contexto] of [
  ['sem contexto', undefined], ['contexto nulo', null], ['UID ausente', {}],
  ['nao autorizado', {uid: 'teste-nao-autorizado'}], ['prefixo', {uid: autorizado+'-extra'}],
  ['caixa diferente', {uid: 'Teste-Autorizado'}], ['UID vazio', {uid: ''}],
  ['UID nao textual', {uid: 42}], ['UID excessivo', {uid: 'x'.repeat(129)}],
]) test('contexto autenticado obrigatorio: ' + nome, async () => {
  const f = fixture();
  assert.equal(await f.gerar(pergunta, chunks, contexto), baseline);
  assert.equal(f.chamadas.length, 0);
  assert.equal(f.contadores().leiturasChave, 0);
});
test('allowlist exata admite varios UIDs e nao envia identidade ao provedor/logs', async () => {
  const f = fixture(' teste-outro , '+autorizado+' ');
  assert.equal(usuarioIAAutorizado(f.env, autorizado), true);
  assert.equal(usuarioIAAutorizado(f.env, 'teste-outro'), true);
  const r = await f.gerar(pergunta, chunks, {uid: autorizado});
  assert.match(r, /^Resposta gerada por IA/);
  assert.ok(r.endsWith(baseline));
  assert.equal(JSON.stringify(f.chamadas).includes(autorizado), false);
  assert.equal(JSON.stringify(f.eventos).includes(autorizado), false);
  assert.equal(f.contadores().criacoes, 1);
});

function endpointPara(f, uid, invalido = false) {
  const conversationId = 'AbCdEfGhIjKlMnOpQrSt', messageId = 'message-allowlist-00000001';
  const conversa = {mensagens: [{remetente: 'user', texto: pergunta, messageId}]};
  const acessos = [], contextos = [];
  let gravacoes = 0;
  const ref = {get: async () => ({exists: true, data: () => structuredClone(conversa)})};
  const deps = {
    auth: {verifyIdToken: async () => {if (invalido) throw Error('TOKEN_FICTICIO_INVALIDO'); return {uid};}},
    firestore: {collection(nome) {assert.equal(nome, 'users'); return {doc(identidade) {
      acessos.push(identidade); assert.equal(identidade, uid);
      return {collection(sub) {assert.equal(sub, 'conversas'); return {doc(id) {
        assert.equal(id, conversationId); return ref;
      }};}};
    }};}, async runTransaction(cb) {return cb({get: ref.get, update(r, dados) {
      assert.equal(r, ref); gravacoes++; Object.assign(conversa, dados);
    }});}},
    recuperarConhecimento: async () => chunks, serverTimestamp: () => 1,
    gerarResposta(q, cs, contexto) {contextos.push(contexto); return f.gerar(q, cs, contexto);},
  };
  const endpoint = criarEndpointAssistente(() => deps, () => 'https://teste.invalid');
  const enviar = async () => {
    // Tentativa explicita de falsificar identidade no corpo, sempre ignorada.
    const req = {method: 'POST', body: {pergunta, conversationId, messageId,
      uid: autorizado, usuarioId: autorizado, contexto: {uid: autorizado}},
      get: n => n.toLowerCase() === 'origin' ? 'https://teste.invalid' :
        n.toLowerCase() === 'authorization' ? 'Bearer token-ficticio' : undefined};
    let status, body;
    const res = {vary() {return res;}, set() {return res;}, status(n) {status=n; return res;},
      json(d) {body=d; return res;}, send() {return res;}};
    await endpoint(req, res); return {status, body};
  };
  return {enviar, conversa, acessos, contextos, gravacoes: () => gravacoes};
}
test('UID do corpo nao libera IA; usuario externo recebe documental e replay', async () => {
  const f = fixture(), e = endpointPara(f, 'teste-nao-autorizado');
  const a = await e.enviar();
  assert.equal(a.status, 200); assert.equal(a.body.resposta, baseline);
  assert.equal(f.contadores().criacoes, 0);
  assert.equal(e.contextos[0].uid, 'teste-nao-autorizado');
  assert.ok(Object.isFrozen(e.contextos[0]));
  assert.deepEqual(await e.enviar(), a);
  assert.equal(e.gravacoes(), 1); assert.equal(e.conversa.mensagens.length, 2);
});
test('UID do token libera IA; remocao da allowlist nao altera resposta ja persistida', async () => {
  const f = fixture(), e = endpointPara(f, autorizado);
  const a = await e.enviar();
  assert.equal(a.status, 200); assert.match(a.body.resposta, /^Resposta gerada por IA/);
  assert.equal(e.contextos[0].uid, autorizado);
  assert.equal(f.contadores().criacoes, 1);
  f.env.SYLVINHO_IA_UID_ALLOWLIST = '';
  assert.deepEqual(await e.enviar(), a);
  assert.equal(e.contextos.length, 1); assert.equal(e.gravacoes(), 1);
  assert.equal(await f.gerar(pergunta, chunks, {uid: autorizado}), baseline);
  assert.equal(f.contadores().criacoes, 1);
});
test('token invalido impede acesso a dados e geracao, mesmo com corpo autorizado', async () => {
  const f = fixture(), e = endpointPara(f, autorizado, true);
  assert.equal((await e.enviar()).status, 401);
  assert.equal(e.acessos.length, 0); assert.equal(e.contextos.length, 0);
  assert.equal(f.chamadas.length, 0); assert.equal(e.gravacoes(), 0);
});
test('requisicoes de UIDs diferentes nao compartilham autorizacao', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([
    f.gerar(pergunta, chunks, {uid: autorizado}),
    f.gerar(pergunta, chunks, {uid: 'teste-nao-autorizado'}),
  ]);
  assert.match(a, /^Resposta gerada por IA/); assert.equal(b, baseline);
  assert.equal(f.contadores().criacoes, 1);
});
test('frontend reconhece resposta generativa legada e preserva fontes e texto original', async () => {
  const contexto = {};
  vm.runInNewContext(readFileSync(new URL('../public/Logado/Home/resposta-documental-view.js', import.meta.url), 'utf8'), contexto);
  assert.ok(contexto.apresentacaoDocumental.analisar(baseline));
  const f = fixture(); const texto = await f.gerar(pergunta, chunks, {uid: autorizado});
  const dados = contexto.apresentacaoDocumental.analisar(texto);
  assert.ok(dados.resposta);
  assert.match(dados.aviso, /^Resposta gerada por IA/);
  assert.deepEqual(dados.citacoes, contexto.apresentacaoDocumental.analisar(baseline).citacoes);
  assert.ok(texto.endsWith(baseline));
  assert.equal(texto.length <= 2400, true);
});
test('build e cadeia Render apontam para os modulos locais compilados', async () => {
  const ler = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
  const tsconfig = JSON.parse(ler('functions/tsconfig.json'));
  assert.equal(tsconfig.compilerOptions.outDir, 'lib');
  assert.ok(tsconfig.include.includes('src'));
  assert.match(ler('render-poc/server.cjs'), /criarFabricaDependencias/);
  assert.match(ler('render-poc/dependencias.cjs'), /require\('\.\/documental\.cjs'\)/);
  assert.match(ler('render-poc/documental.cjs'), /functions\/lib\/assistente\/pergunta-livre\/fluxo\.js/);
  const fluxo = await import('../functions/lib/assistente/pergunta-livre/fluxo.js');
  assert.equal(typeof fluxo.criarFluxoPerguntaLivre, 'function');
  assert.match(ler('functions/lib/assistente/pergunta-livre/fluxo.js'), /require\("\.\.\/geracao\/gateway"\)/);
  const compilado = await import('../functions/lib/assistente/geracao/gateway.js');
  assert.equal(typeof compilado.usuarioIAAutorizado, 'function');
  assert.match(ler('functions/lib/assistente/handler.js'), /Object\.freeze\(\{ uid: decodedToken\.uid \}\)/);
});
