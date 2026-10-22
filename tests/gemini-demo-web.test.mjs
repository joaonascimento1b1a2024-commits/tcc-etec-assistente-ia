import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {criarDemonstracaoGemini,CATALOGO_DEMO_SHA256} from '../functions/lib/assistente/geracao/demonstracao.js';
import {criarClienteGemini} from '../functions/lib/assistente/geracao/gemini.js';
import {criarEndpointAssistente} from '../functions/lib/assistente/http.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const uid='adulto-sintetico-teste', now=Date.parse('2026-10-22T12:00:00Z');
const id='papel-experimental-v1';
// Aprovacoes/dossie ficticios EXCLUSIVAMENTE em memoria dos testes offline.
function fixture({envExtra={},dossieExtra={},responder,semDossie=false}={}){
 let arquivo=JSON.stringify({versao:1,escopo:'gemini_demo_sintetica_adultos',
  catalogoSha256:CATALOGO_DEMO_SHA256,allowlistSha256:sha(uid),
  termosRef:'REVISAO_FICTICIA_TERMOS',privacidadeRef:'REVISAO_FICTICIA_DADOS',
  instituicaoRef:'AUTORIZACAO_FICTICIA_TESTE',somenteAdultos:true,retencaoAceita:true,
  emitidoEm:new Date(now-60000).toISOString(),expiraEm:new Date(now+3600000).toISOString(),...dossieExtra});
 const env={SYLVINHO_IA_ENABLED:'true',SYLVINHO_IA_PROVIDER:'gemini',
  SYLVINHO_IA_UID_ALLOWLIST:uid,GEMINI_MODEL:'modelo-simulado',
  SYLVINHO_IA_GEMINI_MODALIDADE:'demonstracao_publica',
  SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA:'true',SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA:'true',
  SYLVINHO_IA_INSTITUCIONAL_APROVADA:'true',SYLVINHO_IA_PRIVACIDADE_APROVADA:'true',
  SYLVINHO_IA_MENORES_APROVADA:'true',SYLVINHO_IA_GEMINI_DEMO_APROVACAO_SHA256:sha(arquivo),...envExtra};
 let criacoes=0,leiturasChave=0;const requests=[],eventos=[];
 Object.defineProperty(env,'GEMINI_API_KEY',{get(){leiturasChave++;return 'credencial-ficticia';}});
 const modo=criarDemonstracaoGemini({lerAmbiente:()=>env,agora:()=>now,
  lerComprovacao:()=>{if(semDossie)throw Error('AUSENTE');return arquivo;},
  registrarEvento:e=>eventos.push(e),criarCliente:(modelo,chave)=>{
   criacoes++;return criarClienteGemini(modelo,chave,async(url,init)=>{
    const body=JSON.parse(init.body),dados=JSON.parse(body.contents[0].parts[0].text);
    requests.push({url,body,dados});
    const schema=body.generationConfig.responseJsonSchema;
    const valor=schema.properties.segura?{segura:true}:schema.properties.sustentada?{sustentada:true}:{afirmacoes:[{
     texto:'O papel violeta de laboratório é utilizado para o certificado experimental.',
     referencias:[{id:'E1',citacao:dados.evidencias[0].texto}]}]};
    const result=responder?.({valor,body,dados,requests});
    return result??new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(valor),thoughtSignature:'assinatura-simulada'}]}}]}));
   });
  }});
 return {modo,env,requests,eventos,contadores:()=>({criacoes,leiturasChave}),mudarArquivo:s=>{arquivo=s;}};
}
for(const flag of ['SYLVINHO_IA_ENABLED','SYLVINHO_IA_PROVIDER','SYLVINHO_IA_UID_ALLOWLIST',
 'SYLVINHO_IA_GEMINI_MODALIDADE','SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA',
 'SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA','SYLVINHO_IA_INSTITUCIONAL_APROVADA',
 'SYLVINHO_IA_PRIVACIDADE_APROVADA','SYLVINHO_IA_MENORES_APROVADA',
 'SYLVINHO_IA_GEMINI_DEMO_APROVACAO_SHA256'])test('demo web exige gate '+flag,()=>{
 const f=fixture({envExtra:{[flag]:undefined}});assert.equal(f.modo.resolverPergunta(id,uid),undefined);assert.deepEqual(f.contadores(),{criacoes:0,leiturasChave:0});
});
for(const d of [{catalogoSha256:'a'.repeat(64)},{allowlistSha256:'a'.repeat(64)},
 {somenteAdultos:false},{retencaoAceita:false},{termosRef:''},{extra:true},
 {expiraEm:new Date(now-1).toISOString()},
 {emitidoEm:new Date(now+1).toISOString()},
 {expiraEm:new Date(now+86400001).toISOString()}])test('dossie invalido bloqueia sem API',()=>{
 const f=fixture({dossieExtra:d});assert.equal(f.modo.resolverPergunta(id,uid),undefined);assert.equal(f.requests.length,0);
});
test('flags e allowlist sem registro externo nao autorizam',()=>{
 const f=fixture({semDossie:true});assert.equal(f.modo.resolverPergunta(id,uid),undefined);assert.deepEqual(f.contadores(),{criacoes:0,leiturasChave:0});
});
test('hash divergente, JSON invalido e revogacao bloqueiam',async()=>{
 const f=fixture();assert.ok(f.modo.resolverPergunta(id,uid));f.mudarArquivo('{}');assert.equal(f.modo.resolverPergunta(id,uid),undefined);
 await assert.rejects(f.modo.gerarResposta(id,uid),/DEMO_NAO_AUTORIZADA/);assert.equal(f.requests.length,0);
 const g=fixture();g.env.SYLVINHO_IA_ENABLED='false';await assert.rejects(g.modo.gerarResposta(id,uid),/DEMO_NAO_AUTORIZADA/);
});
for(const q of ['Qualquer texto livre', '__proto__', 'constructor', '', null, {},'cor-experimental-v2'])test('ID nao permitido bloqueia: '+String(q),()=>{
 const f=fixture();assert.equal(f.modo.resolverPergunta(q,uid),undefined);assert.equal(f.requests.length,0);
});
test('UID nao autorizado nao resolve nem gera',async()=>{
 const f=fixture();assert.equal(f.modo.resolverPergunta(id,'outra-conta'),undefined);await assert.rejects(f.modo.gerarResposta(id,'outra-conta'));assert.equal(f.requests.length,0);
});
for(const perguntaId of [id,'cor-experimental-v1'])test('quatro cargas fechadas e referencia sintetica: '+perguntaId,async()=>{
 const f=fixture();const q=f.modo.resolverPergunta(perguntaId,uid);assert.match(q,/Demonstração sintética/);
 const r=await f.modo.gerarResposta(perguntaId,uid);assert.match(r,/Resposta gerada por IA/);assert.match(r,/Fonte: Exemplo sintético — E1/);
 assert.equal(f.requests.length,4);assert.deepEqual(f.eventos,['GERADA']);
 const p=f.requests[1].dados;assert.deepEqual(Object.keys(p).sort(),['contextos','evidencias','pergunta']);assert.deepEqual(p.evidencias,[{id:'E1',texto:p.contextos[0],contexto:0}]);
 assert.deepEqual(f.requests[0].dados,{texto:p.pergunta+'\n\n'+p.contextos[0]});
 assert.deepEqual(f.requests[2].dados.pedido,p);
 assert.deepEqual(f.requests[3].dados,{texto:f.requests[2].dados.proposta.afirmacoes[0].texto});
 const outbound=JSON.stringify(f.requests);for(const forbidden of [uid,'conversationId','messageId','Firestore','REVISAO_FICTICIA','AUTORIZACAO_FICTICIA','credencial-ficticia','documentoId'])assert.equal(outbound.includes(forbidden),false);
});
for(const mal of [' Ana Silva',' pessoa@example.invalid',' confidencial'])test('saida fora vocabulario nao e reenviada: '+mal,async()=>{
 const f=fixture({responder:({valor})=>{if(valor.afirmacoes)valor.afirmacoes[0].texto+=mal;}});
 const r=await f.modo.gerarResposta(id,uid);assert.equal(f.requests.length,2);assert.equal(r.includes('Resposta gerada por IA'),false);assert.match(r,/Demonstração sintética/);
});
test('falha API, timeout e limite preservam fallback sem retry',async()=>{
 const f=fixture({responder:()=>{throw Error('ERRO_PRIVADO');}});const r=await f.modo.gerarResposta(id,uid);assert.equal(f.requests.length,1);assert.equal(r.includes('ERRO_PRIVADO'),false);assert.match(r,/Citação literal/);
 const g=fixture({envExtra:{SYLVINHO_IA_TIMEOUT_MS:'5'},responder:()=>new Promise(()=>{})});assert.match(await g.modo.gerarResposta(id,uid),/Citação literal/);assert.equal(g.requests.length,1);
 const h=fixture({envExtra:{SYLVINHO_IA_MAX_POR_MINUTO:'1'}});await h.modo.gerarResposta(id,uid);assert.match(await h.modo.gerarResposta(id,uid),/Citação literal/);assert.equal(h.requests.length,4);
});
function endpoint(f,{token=true,tokenInvalido=false,conta=uid,perguntaSalva,modo=true}={}){
 const conversationId='AbCdEfGhIjKlMnOpQrSt',messageId='demo-message-000000000001';
 const texto=perguntaSalva??f.modo.resolverPergunta(id,uid);
 const conversa={mensagens:[{remetente:'user',texto,messageId},{remetente:'user',texto:'HISTORICO_PRIVADO_NAO_ENVIAR'}]};
 let leituras=0,gravacoes=0,rag=0;
 const ref={get:async()=>{leituras++;return {exists:true,data:()=>structuredClone(conversa)};}};
 const deps={auth:{verifyIdToken:async()=>{if(tokenInvalido)throw Error('TOKEN');return {uid:conta};}},
  firestore:{collection(n){assert.equal(n,'users');return {doc(u){assert.equal(u,conta);return {collection(s){assert.equal(s,'conversas');return {doc(c){assert.equal(c,conversationId);return ref;}};}};}};},async runTransaction(cb){return cb({get:ref.get,update(r,d){assert.equal(r,ref);gravacoes++;Object.assign(conversa,d);}});}},
  serverTimestamp:()=>1,gerarResposta:async()=> 'DOCUMENTAL_ORIGINAL_PRESERVADO',recuperarConhecimento:async()=>{rag++;return [];},...(modo?{demonstracao:f.modo}:{})};
 const handler=criarEndpointAssistente(()=>deps,()=> 'https://teste.invalid');
 const enviar=async(extra={},origem='https://teste.invalid',normal=false,catalogo=false)=>{
 let status,body;const res={vary(){return res;},set(){return res;},status(n){status=n;return res;},json(b){body=b;return res;},send(){return res;}};
 const bodyReq=catalogo?{acao:'catalogo_demonstracao',...extra}:{perguntaId:id,conversationId,messageId,...extra};if(normal)delete bodyReq.perguntaId;
 await handler({method:'POST',body:bodyReq,get:n=>n.toLowerCase()==='origin'?origem:n.toLowerCase()==='authorization'&&token?'Bearer token-ficticio':undefined},res);return {status,body};};
 return {enviar,catalogo:extra=>enviar(extra,'https://teste.invalid',false,true),conversa,contadores:()=>({leituras,gravacoes,rag})};
}
test('HTTP demo autenticado persiste somente bot e replay nao gera de novo',async()=>{
 const f=fixture(),e=endpoint(f);const a=await e.enviar();assert.equal(a.status,200);assert.deepEqual(Object.keys(a.body),['resposta']);assert.match(a.body.resposta,/Resposta gerada por IA/);
 assert.deepEqual(await e.enviar(),a);assert.equal(f.requests.length,4);assert.equal(e.conversa.mensagens.filter(m=>m.remetente==='bot').length,1);assert.equal(e.contadores().gravacoes,1);assert.equal(e.contadores().rag,0);
 assert.equal(JSON.stringify(f.requests).includes('HISTORICO_PRIVADO'),false);
});
for(const config of [{token:false},{tokenInvalido:true}])test('HTTP demo rejeita token sem ler conversa',async()=>{
 const f=fixture(),e=endpoint(f,config);assert.equal((await e.enviar()).status,401);assert.equal(e.contadores().leituras,0);assert.equal(f.requests.length,0);
});
test('HTTP conta externa, modo ausente, origem invalida e pergunta desconhecida bloqueiam',async()=>{
 for(const cfg of [{conta:'outra-conta'},{modo:false}]){const f=fixture(),e=endpoint(f,cfg);assert.equal((await e.enviar()).status,403);assert.equal(e.contadores().leituras,0);assert.equal(f.requests.length,0);}
 const f=fixture(),e=endpoint(f);assert.equal((await e.enviar({},'https://invalida.invalid')).status,403);assert.equal((await e.enviar({perguntaId:'invalida'})).status,403);
});
for(const campo of ['pergunta','uid','chunks','historico','contextos'])test('HTTP demo rejeita campo extra '+campo,async()=>{
 const f=fixture(),e=endpoint(f);assert.equal((await e.enviar({[campo]:'DADO_PRIVADO'})).status,400);assert.equal(e.contadores().leituras,0);assert.equal(f.requests.length,0);
});
test('pergunta persistida divergente nao gera e nao grava',async()=>{
 const f=fixture(),e=endpoint(f,{perguntaSalva:'TEXTO_PRIVADO_DIVERGENTE'});assert.equal((await e.enviar()).status,409);assert.equal(f.requests.length,0);assert.equal(e.contadores().gravacoes,0);
});
test('requisicao documental normal nao e convertida em exemplo sintetico',async()=>{
 const f=fixture(),e=endpoint(f,{perguntaSalva:'Pergunta original'});
 const r=await e.enviar({pergunta:'Pergunta original'},'https://teste.invalid',true);assert.equal(r.status,200);
 assert.equal(r.body.resposta,'DOCUMENTAL_ORIGINAL_PRESERVADO');assert.equal(e.contadores().rag,1);
 assert.equal(f.requests.length,0);
});

test('HTTP flags sem comprovacao nao consultam conversa nem Gemini',async()=>{
 const f=fixture({semDossie:true}),e=endpoint(f);assert.equal((await e.enviar()).status,403);assert.equal(e.contadores().leituras,0);assert.equal(f.requests.length,0);
});
for(const mudar of [v=>v.afirmacoes[0].referencias[0].id='E99',v=>v.afirmacoes[0].referencias[0].citacao+=' falsa',v=>v.extra=true])test('demo web preserva contrato e citacoes antes do reenvio',async()=>{
 const f=fixture({responder:({valor})=>{if(valor.afirmacoes)mudar(valor);}});
 assert.match(await f.modo.gerarResposta(id,uid),/Citação literal/);assert.equal(f.requests.length,2);assert.equal(f.eventos.includes('GERADA'),false);
});
for(const etapa of [0,2,3])test('moderacao e revisao negativas nao produzem GERADA: '+etapa,async()=>{
 const f=fixture({responder:({valor,requests})=>{if(requests.length-1===etapa){if('segura'in valor)valor.segura=false;else valor.sustentada=false;}}});
 assert.match(await f.modo.gerarResposta(id,uid),/Citação literal/);assert.equal(f.requests.length,etapa+1);assert.equal(f.eventos.includes('GERADA'),false);
});
test('defaults nao leem comprovacao nem criam cliente',()=>{
 let n=0;const modo=criarDemonstracaoGemini({lerAmbiente:()=>({}),lerComprovacao:()=>{n++;throw Error('NAO_LER');},criarCliente:()=>{n++;throw Error('NAO_CRIAR');}});
 assert.equal(modo.resolverPergunta(id,uid),undefined);assert.equal(n,0);
});

test('catalogo web autorizado nao le Firestore nem instancia Gemini',async()=>{
 const f=fixture(),e=endpoint(f);const r=await e.catalogo();assert.equal(r.status,200);assert.equal(r.body.perguntas.length,2);
 for(const item of r.body.perguntas){assert.deepEqual(Object.keys(item).sort(),['pergunta','perguntaId']);assert.match(item.pergunta,/Demonstração sintética/);}
 assert.deepEqual(e.contadores(),{leituras:0,gravacoes:0,rag:0});assert.deepEqual(f.contadores(),{criacoes:0,leiturasChave:0});
 assert.equal(JSON.stringify(r.body).includes(uid),false);assert.equal(JSON.stringify(r.body).includes('REVISAO_FICTICIA'),false);
});
for(const cfg of [{token:false},{tokenInvalido:true},{conta:'conta-nao-autorizada'},{modo:false}])test('catalogo nao revela disponibilidade a conta sem permissao',async()=>{
 const f=fixture(),e=endpoint(f,cfg);assert.ok([401,403].includes((await e.catalogo()).status));assert.equal(e.contadores().leituras,0);assert.equal(f.requests.length,0);
});
test('consulta catalogo rejeita campos extras e exige comprovacao',async()=>{
 const f=fixture(),e=endpoint(f);assert.equal((await e.catalogo({uid:'injetado'})).status,400);
 const g=fixture({semDossie:true}),outro=endpoint(g);assert.equal((await outro.catalogo()).status,403);assert.equal(g.requests.length,0);
});
