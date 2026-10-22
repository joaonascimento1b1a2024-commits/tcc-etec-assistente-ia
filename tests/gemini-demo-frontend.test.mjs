import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const importar=async name=>import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../public/Logado/Home/'+name,import.meta.url),'utf8')).toString('base64'));
const client=await importar('assistente-client.js'),pendencias=await importar('envio-pendente.js');
const id='papel-experimental-v1';
const pergunta='Demonstração sintética; não é informação escolar oficial.\nQual papel utiliza o certificado experimental?';
const perguntas=[{perguntaId:id,pergunta}];
const conversationId='abcdefghijklmnopqrst';
const messageId='demo-message-000000000001';
const user={uid:'conta-ficticia',getIdToken:async()=> 'token-ficticio'};
for(const extra of [{pergunta:'texto livre'}, {perguntaId:'../invalido'}, {perguntaId:{}}])test('cliente nao transmite entrada demo invalida',async()=>{
 let n=0;await assert.rejects(client.perguntarAssistente({user,endpoint:'https://teste.invalid/perguntarAssistente',perguntaId:id,conversationId,messageId,...extra,fetchImpl:async()=>{n++;}}));assert.equal(n,0);
});
test('cliente envia somente ID e identificadores de persistencia; token so em memoria',async()=>{
 let body;
 await client.perguntarAssistente({user,endpoint:'https://teste.invalid/perguntarAssistente',perguntaId:id,conversationId,messageId,historico:'NAO_ENVIAR',uid:'NAO_ENVIAR',fetchImpl:async(_,init)=>{
  body=JSON.parse(init.body);assert.equal(init.headers.Authorization,'Bearer token-ficticio');return {ok:true,json:async()=>({resposta:'Resposta sintetica'})};
 }});
 assert.deepEqual(body,{perguntaId:id,conversationId,messageId});
});
test('consulta de catalogo e autenticada e nao envia pergunta/UID/historico',async()=>{
 const r=await client.consultarDemonstracao({user,endpoint:'https://teste.invalid/perguntarAssistente',pergunta:'NAO_ENVIAR',uid:'NAO_ENVIAR',fetchImpl:async(_,init)=>{
 assert.deepEqual(JSON.parse(init.body),{acao:'catalogo_demonstracao'});assert.equal(init.headers.Authorization,'Bearer token-ficticio');return {ok:true,json:async()=>({perguntas})};
 }});assert.deepEqual(r,{perguntas});
});
for(const invalid of [[],[{perguntaId:id,pergunta:'Sem aviso'}],[...perguntas,...perguntas],[{...perguntas[0],uid:'NAO_EXIBIR'}]])test('catalogo invalido nao habilita interface',async()=>{
 await assert.rejects(client.consultarDemonstracao({user,endpoint:'https://teste.invalid/perguntarAssistente',fetchImpl:async()=>({ok:true,json:async()=>({perguntas:invalid})})}),{code:'RESPOSTA_INVALIDA'});
});
function scenario({permitido=true,failFirst=false}={}){
 const elements=new Map(),events=new Map(),storage=new Map(),saved=[],requests=[];let posts=0,appends=0,autorizado=permitido;
 function element(key){if(!elements.has(key))elements.set(key,{children:[],dataset:{},value:'',textContent:'',hidden:true,disabled:false,
 classList:{add(){},remove(){},toggle(){}},addEventListener(n,cb){events.set(String(key)+':'+n,cb);},setAttribute(){},focus(){},append(...c){this.children.push(...c);},replaceChildren(){this.children=[];},querySelector:s=>element(s)});return elements.get(key);}
 const store={reserve:()=>conversationId,append:async(c,text,id,time)=>{appends++;assert.equal(c,conversationId);assert.equal(text,pergunta);if(!saved.some(m=>m.messageId===id&&m.remetente==='user'))saved.push({texto:text,remetente:'user',messageId:id,enviadoEm:time});return c;},open:async()=>({mensagens:structuredClone(saved)})};
 const storageImpl={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const pending=Object.fromEntries(['carregarEnvioPendente','guardarEnvioPendente','concluirEnvioPendente','inspecionarEnvioPendente','descartarEnvioPendente'].map(n=>[n,(...args)=>pendencias[n](...args,storageImpl)]));
 const fetchImpl=async(_,init)=>{
  const body=JSON.parse(init.body);requests.push(body);
  if(body.acao)return autorizado?{ok:true,json:async()=>({perguntas})}:{ok:false,status:403};
  posts++;assert.ok(saved.some(m=>m.remetente==='user'&&m.messageId===body.messageId));assert.equal('pergunta'in body,false);
  if(failFirst&&posts===1)return {ok:false,status:503};
  if(!saved.some(m=>m.remetente==='bot'&&m.messageId===body.messageId))saved.push({remetente:'bot',texto:'Demonstração sintética — resposta Gemini confirmada e fonte E1.',messageId:body.messageId});
  return {ok:true,json:async()=>({resposta:'NAO_RENDERIZAR_CORPO_HTTP'})};
 };
 const context=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[],createElement:()=>element(Symbol())},
 window:{location:{search:'',assign(){},replace(){}},history:{replaceState(){}}},URLSearchParams,AbortController,console,crypto:{randomUUID},
 store,user,pending,mockImport:async p=>p.endsWith('assistente-config.js')?{resolverAssistenteConfig:()=>({endpoint:'https://teste.invalid/perguntarAssistente',timeoutMs:30000})}:p.endsWith('envio-pendente.js')?pending:p.endsWith('assistente-client.js')?{
  perguntarAssistente:o=>client.perguntarAssistente({...o,fetchImpl}),consultarDemonstracao:o=>client.consultarDemonstracao({...o,fetchImpl})}:assert.fail('IMPORT_INESPERADO')});
 const source=readFileSync(new URL('../public/Logado/Home/home.js',import.meta.url),'utf8').replace('loadAuthenticatedProfile();','').replaceAll('import(','mockImport(');
 vm.runInContext(source+'\nconversationStore=store;authenticatedUser=user;',context);
 return {context,element,saved,requests,pending,storage,counts:()=>({posts,appends}),revogar:()=>{autorizado=false;},
 load:()=>vm.runInContext('carregarDemonstracao(user,sessionVersion)',context),send:()=>events.get('#demonstracaoEnviar:click')(),retry:()=>events.get('#demonstracaoRecuperar:click')(),
 rendered:()=>element('#messages').children.map(r=>r.children.at(-1).textContent)};
}
test('nao autorizado nao ve controles nem grava conversa',async()=>{
 const s=scenario({permitido:false});await s.load();assert.equal(s.element('#demonstracaoPanel').hidden,true);assert.deepEqual(s.counts(),{posts:0,appends:0});
});
test('usuario autorizado seleciona ID e exibe somente historico confirmado',async()=>{
 const s=scenario();await s.load();assert.equal(s.element('#demonstracaoPanel').hidden,false);assert.equal(s.element('#demonstracaoEnviar').disabled,false);
 s.element('#messageInput').value='TEXTO_PRIVADO_NAO_ENVIAR';await s.send();
 assert.deepEqual(s.counts(),{posts:1,appends:1});assert.equal(s.saved[0].texto,pergunta);
 assert.ok(s.rendered().includes(pergunta));assert.equal(s.rendered().includes('NAO_RENDERIZAR_CORPO_HTTP'),false);
 assert.equal(JSON.stringify(s.requests).includes('TEXTO_PRIVADO'),false);
 assert.equal(s.element('#messageInput').value,'TEXTO_PRIVADO_NAO_ENVIAR');
 assert.equal(s.pending.carregarEnvioPendente(user.uid),null);
});
test('revogacao antes do envio nao salva nem chama geracao',async()=>{
 const s=scenario();await s.load();s.revogar();await s.send();assert.deepEqual(s.counts(),{posts:0,appends:0});assert.equal(s.element('#demonstracaoPanel').hidden,true);
});
test('falha preserva ID e retomada exige clique, sem duplicar user/bot',async()=>{
 const s=scenario({failFirst:true});await s.load();await s.send();const antes=s.pending.carregarEnvioPendente(user.uid);assert.equal(antes.perguntaId,id);
 await s.load();assert.equal(s.counts().posts,1);await s.retry();const post=s.requests.filter(r=>r.perguntaId);
 assert.equal(post.length,2);assert.equal(post[0].messageId,post[1].messageId);assert.equal(post[0].messageId,antes.messageId);
 assert.equal(s.saved.filter(m=>m.remetente==='user').length,1);assert.equal(s.saved.filter(m=>m.remetente==='bot').length,1);
 assert.equal(s.pending.carregarEnvioPendente(user.uid),null);
});
test('troca de sessao limpa catalogo e impede envio',async()=>{
 const s=scenario();await s.load();vm.runInContext('sessionVersion++;authenticatedUser=null;conversationStore=null;reiniciarDemonstracao();',s.context);
 await s.send();assert.equal(s.element('#demonstracaoPanel').hidden,true);assert.equal(s.counts().posts,0);
});
test('texto digitado nao consegue forcar modo demo',async()=>{
 const s=scenario();await s.load();await vm.runInContext('sendMessage("TEXTO_PRIVADO", "papel-experimental-v1")',s.context);assert.deepEqual(s.counts(),{posts:0,appends:0});
});
test('pendencia demo alterada e recusada sem converter em documental',()=>{
 const fixture={version:1,conversationId,messageId,pergunta:'Texto livre',perguntaId:id,enviadoEm:1,novaConversa:false};
 assert.throws(()=>pendencias.carregarEnvioPendente('pendencia-ficticia',{getItem:()=>JSON.stringify(fixture)}),{code:'PENDENCIA_INVALIDA'});
});
