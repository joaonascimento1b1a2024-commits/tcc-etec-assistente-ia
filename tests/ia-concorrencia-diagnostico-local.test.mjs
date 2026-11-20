import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {criarGeminiCurado} from '../render-poc/motor-curado/gemini-curado.mjs';
import {criarBuscaCurada,hashIndice} from '../render-poc/motor-curado/curadoria-local.mjs';
import {criarEmbeddings} from '../render-poc/motor-curado/embeddings-curados.mjs';
import {criarControleConcorrencia,aguardarComSinal} from '../render-poc/motor-curado/concorrencia-curada.mjs';
const registros=JSON.parse(readFileSync('knowledge-local/faq-curada.json','utf8'));
const contatos=JSON.parse(readFileSync('knowledge-local/contatos-publicos.json','utf8'));
const escopo={hoje:'2026-11-16'};
const pergunta='De presença, preciso de quantos %?';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const resposta=init=>{
 const schema=JSON.parse(init.body).generationConfig.responseJsonSchema;
 return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(schema.properties.resposta?{resposta:'A frequência mínima é 75% do total de aulas.',ids:['frequencia']}:{sustentada:true})}]}}]}),{status:200});
};
function setup(extra={}){
 const gate=deferred(),two=deferred();let generations=0;
 const motor=criarGeminiCurado({registros,contatos,lerChave:()=> 'sintetica',timeoutMs:1000,transporte:async(_url,init)=>{
  if(JSON.parse(init.body).generationConfig.responseJsonSchema.properties.resposta){generations++;if(generations===2)two.resolve();}
  await gate.promise;return resposta(init);
 },...extra});
 const send=conta=>motor.responder({pergunta,escopo,cacheNamespace:conta});
 return {motor,send,gate,two,generations:()=>generations};
}
test('duas contas são atendidas simultaneamente dentro do limite',async()=>{
 const s=setup();const a=s.send('a'),b=s.send('b');
 try{assert.equal(await Promise.race([s.two.promise.then(()=>true),pause(150).then(()=>false)]),true);}
 finally{s.gate.resolve();}
 assert.deepEqual((await Promise.all([a,b])).map(r=>r.tipo),['gemini_curado','gemini_curado']);
});
test('fila respeita ordem e capacidade; excesso recebe falha recuperável',async()=>{
 const s=setup({maxConcorrentes:1,maxFila:1,esperaFilaMs:500});
 const a=s.send('a');await pause(5);
 let secondDone=false;const b=s.send('b').then(r=>{secondDone=true;return r;});
 await pause(5);const c=await s.send('c');
 try{assert.equal(secondDone,false);assert.equal(c.tipo,'ocupado');assert.equal(c.codigo,'FILA_CHEIA');assert.equal(s.generations(),1);}
 finally{s.gate.resolve();}
 assert.deepEqual((await Promise.all([a,b])).map(r=>r.tipo),['gemini_curado','gemini_curado']);
});
test('mesma conta não ocupa duas vagas ou duas posições na fila',async()=>{
 const s=setup();const first=s.send('conta');await pause(5);
 const duplicate=await s.send('conta');s.gate.resolve();await first;
 assert.equal(duplicate.tipo,'ocupado');assert.equal(duplicate.codigo,'CONTA_OCUPADA');assert.equal(s.generations(),1);
});
test('tempo máximo de fila não é confundido com falta de informação',async()=>{
 const s=setup({maxConcorrentes:1,maxFila:1,esperaFilaMs:20});
 const first=s.send('a');await pause(5);const queued=await s.send('b');
 s.gate.resolve();await first;
 assert.equal(queued.codigo,'FILA_ESPERA_EXCEDIDA');assert.equal(queued.tipo,'ocupado');assert.equal(queued.retentavel,true);assert.equal(s.generations(),1);
});
test('cancelar pedido na fila libera a posição sem chamar o provedor',async()=>{
 const s=setup({maxConcorrentes:1,maxFila:1,esperaFilaMs:500});
 const first=s.send('a');await pause(5);const controller=new AbortController();
 const queued=s.motor.responder({pergunta,escopo,cacheNamespace:'b',signal:controller.signal});controller.abort();
 const cancelled=await queued;s.gate.resolve();await first;
 assert.equal(cancelled.codigo,'CANCELADO');assert.equal(cancelled.retentavel,true);assert.equal(s.generations(),1);
 assert.equal((await s.send('b')).tipo,'gemini_curado');
});
test('timeout cancela embedding e não inicia geração tardia',async()=>{
 let signalEmbedding,calls=0;
 const motor=criarGeminiCurado({registros,contatos,lerChave:()=> 'sintetica',timeoutMs:20,vetores:{hash:hashIndice(registros),valores:{}},embeddingConsulta:async(_p,options)=>{signalEmbedding=options?.signal;return new Promise(()=>{});},transporte:async()=>{calls++;throw Error('NAO_CHAMAR');}});
 const r=await motor.responder({pergunta,escopo,cacheNamespace:'a'});
 assert.equal(r.codigo,'TIMEOUT');assert.equal(signalEmbedding?.aborted,true);assert.equal(calls,0);
});
test('provedor que ignora cancelamento não dispara revisão depois do timeout',async()=>{
 const gate=deferred();let calls=0;
 const motor=criarGeminiCurado({registros,contatos,lerChave:()=> 'sintetica',timeoutMs:20,transporte:async(_url,init)=>{calls++;await gate.promise;return resposta(init);}});
 const result=await motor.responder({pergunta,escopo,cacheNamespace:'a'});gate.resolve();await pause(20);
 assert.equal(result.codigo,'TIMEOUT');assert.equal(calls,1);
});
test('degradação de embedding preserva busca lexical e registra código seguro',async()=>{
 const logs=[];const buscar=criarBuscaCurada({registros,vetores:{hash:hashIndice(registros),valores:{}},embeddingConsulta:async()=>{throw Error('HTTP_429');},registrar:(evento,dados)=>logs.push({evento,...dados})});
 const r=await buscar(pergunta,escopo);
 assert.equal(r.selecionados[0].registro.id,'frequencia');assert.equal(r.modo,'bm25');
 assert.equal(r.diagnostico.embedding.codigo,'HTTP_429');assert.ok(logs.some(l=>l.evento==='BUSCA_CURADA'));
 assert.equal(JSON.stringify(logs).includes(pergunta),false);
});
test('mensagem arbitrária do erro de embedding não vaza no diagnóstico',async()=>{
 const logs=[];const segredo='CONTEUDO_PRIVADO_NAO_REGISTRAR';
 const r=await criarBuscaCurada({registros,vetores:{hash:hashIndice(registros),valores:{}},embeddingConsulta:async()=>{throw Error(segredo);},registrar:(e,d)=>logs.push({e,...d})})(pergunta,escopo);
 assert.equal(r.diagnostico.embedding.codigo,'EMBEDDING_INDISPONIVEL');assert.equal(JSON.stringify([r.diagnostico,logs]).includes(segredo),false);
});
test('sem correspondência e embedding indisponível retorna falha técnica retentável',async()=>{
 const motor=criarGeminiCurado({registros,contatos,lerChave:()=> 'sintetica',vetores:{hash:hashIndice(registros),valores:{}},embeddingConsulta:async()=>{throw Error('HTTP_503');},transporte:async()=>{throw Error('NAO_CHAMAR');}});
 const r=await motor.responder({pergunta:'Orientação xyzabcdef completamente desconhecida',escopo});
 assert.equal(r.tipo,'falha');assert.equal(r.codigo,'BUSCA_INDISPONIVEL');assert.equal(r.retentavel,true);assert.doesNotMatch(r.texto,/Secretaria confirma/);
});
test('embedding recebe cancelamento externo e não envia requisição já cancelada',async()=>{
 let calls=0;const api=criarEmbeddings({lerChave:()=> 'sintetica',transporte:async()=>{calls++;throw Error('NAO_CHAMAR');}});
 const controller=new AbortController();controller.abort();
 await assert.rejects(api.consulta(pergunta,{signal:controller.signal}));assert.equal(calls,0);
});
test('configuração inválida de concorrência é rejeitada',()=>{
 for(const opts of [{maxConcorrentes:0},{maxFila:-1},{esperaFilaMs:0},{maxConcorrentes:99}])assert.throws(()=>setup(opts),/CONCORRENCIA_CONFIG_INVALIDA/);
});
test('fila FIFO entrega três contas em ordem e liberação repetida é inofensiva',async()=>{
 const controle=criarControleConcorrencia({maxConcorrentes:1,maxFila:2,esperaFilaMs:500});
 const first=await controle.adquirir('a'),order=[];
 const b=controle.adquirir('b').then(release=>{order.push('b');return release;});
 const c=controle.adquirir('c').then(release=>{order.push('c');return release;});
 assert.deepEqual(controle.estado(),{ativos:1,naFila:2});first();first();
 const releaseB=await b;assert.deepEqual(order,['b']);releaseB();(await c)();
 assert.deepEqual(order,['b','c']);assert.deepEqual(controle.estado(),{ativos:0,naFila:0});
});
test('expiração da fila remove a conta e permite nova tentativa',async()=>{
 const controle=criarControleConcorrencia({maxConcorrentes:1,maxFila:1,esperaFilaMs:10});
 const first=await controle.adquirir('a');await assert.rejects(controle.adquirir('b'),/FILA_ESPERA_EXCEDIDA/);
 first();const retry=await controle.adquirir('b');retry();assert.deepEqual(controle.estado(),{ativos:0,naFila:0});
});
test('pedido já cancelado e operação rejeitada são encerrados sem deixar fila',async()=>{
 const controller=new AbortController();controller.abort();
 const controle=criarControleConcorrencia();await assert.rejects(controle.adquirir('a',{signal:controller.signal}),/CANCELADO/);
 await assert.rejects(aguardarComSinal(Promise.reject(Error('DESCARTADO')),controller.signal),/CANCELADO/);
 assert.equal(await aguardarComSinal(Promise.resolve('ok')), 'ok');
 await assert.rejects(aguardarComSinal(Promise.reject(Error('FALHA')),new AbortController().signal),/FALHA/);
 assert.deepEqual(controle.estado(),{ativos:0,naFila:0});
});
test('referências da mesma conta respeitam limite mesmo sem usar cache',async()=>{
 const s=setup();const first=s.send('a');await pause(5);
 const other=await s.motor.responder({pergunta:'qual o artigo?',historico:[{remetente:'user',texto:pergunta}],escopo,cacheNamespace:'a'});
 s.gate.resolve();await first;assert.equal(other.codigo,'CONTA_OCUPADA');
});
test('fila e busca não registram identificador de conta ou pergunta',async()=>{
 const logs=[];const s=setup({registrar:(evento,dados)=>logs.push({evento,...dados})});
 const account='identidade-privada-nao-logar';const p=s.send(account);s.gate.resolve();assert.equal((await p).tipo,'gemini_curado');
 const texto=JSON.stringify(logs);assert.equal(texto.includes(account),false);assert.equal(texto.includes(pergunta),false);assert.ok(logs.some(l=>l.evento==='FILA_CURADA'));
});
test('busca sem índice ou com índice antigo informa estado, sem chamar embedding',async()=>{
 let calls=0;const embeddingConsulta=async()=>{calls++;return [1,0];};
 for(const [vetores,estado]of [[null,'sem_indice'],[{hash:'antigo',valores:{}},'indice_desatualizado'],[{hash:hashIndice(registros),valores:{}},'sem_consulta']]){
  const r=await criarBuscaCurada({registros,vetores,embeddingConsulta:estado==='sem_consulta'?null:embeddingConsulta})(pergunta,escopo);
  assert.equal(r.diagnostico.embedding.estado,estado);assert.equal(r.selecionados[0].registro.id,'frequencia');
 }
 assert.equal(calls,0);
});
test('vetor inválido degrada com diagnóstico e falha no logger não impede resposta',async()=>{
 const r=await criarBuscaCurada({registros,vetores:{hash:hashIndice(registros),valores:{}},embeddingConsulta:async()=>[NaN],registrar:()=>{throw Error('LOG_FALHOU');}})(pergunta,escopo);
 assert.equal(r.diagnostico.embedding.codigo,'VETOR_INVALIDO');assert.equal(r.selecionados[0].registro.id,'frequencia');
});
test('embedding abortado durante transporte encerra o await e sinaliza o provedor',async()=>{
 let received;const controller=new AbortController();
 const api=criarEmbeddings({lerChave:()=> 'sintetica',transporte:async(_u,init)=>{received=init.signal;return new Promise(()=>{});}});
 const pending=api.consulta(pergunta,{signal:controller.signal});controller.abort();
 await assert.rejects(pending);assert.equal(received.aborted,true);
});
