import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolverConversaCurada} from '../local-e2e/contexto-curado.mjs';
import {criarPoliticaCurada} from '../local-e2e/curadoria-local.mjs';
import {criarCacheRespostas} from '../local-e2e/cache-respostas-curadas.mjs';
import {criarGeminiCurado} from '../local-e2e/gemini-curado.mjs';
const registros=JSON.parse(readFileSync('knowledge-local/faq-curada.json','utf8')),contatos=JSON.parse(readFileSync('knowledge-local/contatos-publicos.json','utf8'));
const u=texto=>({remetente:'user',texto}),b=texto=>({remetente:'bot',texto});
test('acompanhamentos preservam tema e não inventam canal ou lista de renovação',()=>{
 const politica=criarPoliticaCurada({contatos}),hist=[u('Como renovo a matrícula?')];
 assert.match(resolverConversaCurada('onde entrego?',hist).pergunta,/renovação/);
 assert.equal(politica.planejar('onde entrego?',hist).tipo,'pendente');
 assert.equal(politica.planejar('quais documentos?',hist).tipo,'pendente');
 assert.equal(politica.planejar('precisa de responsável?',hist).tipo,'pendente');
 assert.equal(politica.planejar('qual o prazo?',hist).categoria,'calendario');
 assert.equal(politica.planejar('Como faço a matrícula?').tipo,'esclarecimento');
 assert.equal(politica.planejar('qual o artigo?',[u('quanto custa a camiseta?'),b(politica.fallback())]).tipo,'pendente');
});
test('acompanhamento de prazo em 2027 não usa calendário de 2026',async()=>{
 let calls=0;const motor=criarGeminiCurado({registros,contatos,lerChave:()=> 'sintetica',transporte:async()=>{calls++;throw Error('NAO_CHAMAR');}});
 const r=await motor.responder({pergunta:'qual o prazo?',historico:[u('Como renovo a matrícula em 2027?')],escopo:{hoje:'2026-11-12'}});assert.equal(r.tipo,'sem_evidencia');assert.equal(calls,0);
});
test('falha de revisão não entra no cache e idades diferentes não compartilham entrada',async()=>{
 let calls=0;const motor=criarGeminiCurado({registros,contatos,lerChave:()=> 'sintetica',transporte:async(_url,init)=>{calls++;return http(JSON.parse(init.body).generationConfig.responseJsonSchema.properties.resposta?{resposta:'A partir dos 16 anos, o candidato pode fazer a matrícula.',ids:['matricula-idade']}:{sustentada:calls!==2});}});
 const opts={pergunta:'precisa de responsável?',escopo:{hoje:'2026-11-12'},cacheNamespace:'a',historico:[u('Tenho 16 anos e quero fazer matrícula')]};
 assert.equal((await motor.responder(opts)).tipo,'falha');
 assert.equal((await motor.responder(opts)).tipo,'gemini_curado');assert.equal(calls,4);
 assert.equal((await motor.responder(opts)).cacheHit,true);assert.equal(calls,4);
 await motor.responder({...opts,historico:[u('Tenho 15 anos e quero fazer matrícula')]});assert.equal(calls,6);
});
test('responsável para matrícula usa a idade declarada e mantém regra distinta da saída',()=>{
 const hist=[u('Tenho 16 anos. Como faço minha matrícula?')];
 const a=resolverConversaCurada('precisa de responsável?',hist);assert.equal(a.escopo.idade,16);assert.match(a.pergunta,/matricular sozinho/);
 const s=resolverConversaCurada('precisa de responsável?',[u('Tenho 16 anos e quero sair mais cedo')]);assert.equal(s.tema,'saída antecipada');assert.doesNotMatch(s.pergunta,/matricular sozinho/);
 assert.equal(resolverConversaCurada('A escola tem 40 anos; preciso de matrícula').escopo.idade,undefined);
 assert.equal(resolverConversaCurada('Meu filho tem 15 anos; preciso de matrícula').escopo.idade,15);
});
test('curso e ano acompanham perguntas elípticas, com troca explícita de curso',()=>{
 const h=[u('Preciso de estágio em Enfermagem em 2026?')];
 const r=resolverConversaCurada('e no meu curso?',h);assert.equal(r.escopo.curso,'enfermagem');assert.equal(r.escopo.ano,2026);
 const novo=resolverConversaCurada('e em Desenvolvimento de Sistemas em 2027?',h);assert.equal(novo.escopo.curso,'desenvolvimento de sistemas');assert.equal(novo.escopo.ano,2027);
 assert.equal(resolverConversaCurada('e no meu curso?',[]).esclarecimento,'Qual é o seu curso?');
});
test('pergunta nova não herda curso e assunto desconhecido encerra tema anterior',()=>{
 assert.equal(resolverConversaCurada('Qual é o endereço?',[u('Estágio em Enfermagem')]).escopo.curso,undefined);
 assert.ok(resolverConversaCurada('onde entrego?',[u('Matrícula inicial'),u('agora quero saber do estacionamento')]).esclarecimento);
});
test('resposta curta após esclarecimento retoma matrícula ou curso',()=>{
 const a=resolverConversaCurada('renovar',[b('Você quer fazer a matrícula inicial ou renovar uma matrícula que já possui?')]);assert.match(a.pergunta,/renovo/);
 const c=resolverConversaCurada('Enfermagem',[u('Tem estágio obrigatório?'),u('e no meu curso?'),b('Qual é o seu curso?')]);assert.match(c.pergunta,/estágio/);assert.equal(c.escopo.curso,'enfermagem');
 const idade=resolverConversaCurada('a inicial',[u('Tenho 16 anos e quero matrícula em 2027'),b('Você quer fazer a matrícula inicial ou renovar uma matrícula que já possui?')]);assert.equal(idade.escopo.idade,16);assert.equal(idade.escopo.ano,2027);
 assert.equal(resolverConversaCurada('precisa de responsável?',[u('Como peço trancamento de matrícula?')]).tema,'trancamento');
 assert.equal(resolverConversaCurada('onde entrego?',[u('Preciso de declaração de matrícula')]).tema,'declaração');
});
test('cache expira, limita tamanho e nunca guarda falha ou resposta pendente',()=>{
 let clock=0;const cache=criarCacheRespostas({ttlMs:10,maximo:1,agora:()=>clock});
 cache.guardar('a',{tipo:'falha',ids:['a']});assert.equal(cache.obter('a'),null);
 cache.guardar('a',{tipo:'gemini_curado',ids:['a'],texto:'ok'});assert.equal(cache.obter('a').texto,'ok');
 cache.guardar('b',{tipo:'gemini_curado',ids:['b'],texto:'outro'});assert.equal(cache.obter('a'),null);
 clock=11;assert.equal(cache.obter('b'),null);
});
const http=p=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(p)}]}}]}),{status:200});
test('cache reutiliza apenas saída revisada, separa contas e invalida mudança de fonte',async()=>{
 let calls=0;const docs=structuredClone(registros);
 const motor=criarGeminiCurado({registros:docs,contatos,lerChave:()=> 'sintetica',transporte:async(_url,init)=>{
  calls++;const props=JSON.parse(init.body).generationConfig.responseJsonSchema.properties;
  return http(props.resposta?{resposta:'É preciso ter 75% de presença no total das aulas.',ids:['frequencia']}:{sustentada:true});
 }});
 const pergunta='Preciso de quantos % de presença?',escopo={hoje:'2026-11-12'};
 const a=await motor.responder({pergunta,escopo,cacheNamespace:'conta-a'});assert.equal(a.tipo,'gemini_curado');assert.equal(calls,2);
 const hit=await motor.responder({pergunta,escopo,historico:[u(pergunta),b(a.texto)],cacheNamespace:'conta-a'});assert.equal(hit.cacheHit,true);assert.equal(calls,2);
 await motor.responder({pergunta,escopo,cacheNamespace:'conta-b'});assert.equal(calls,4);
 docs.find(d=>d.id==='frequencia').versao++;
 const atualizado=await motor.responder({pergunta,escopo,cacheNamespace:'conta-a'});assert.notEqual(atualizado.cacheHit,true);assert.equal(calls,6);
 await motor.responder({pergunta,escopo:{...escopo,ano:2027},cacheNamespace:'conta-a'});assert.equal(calls,8);
});
test('cache não dispensa validação de entrada nem é usado sem namespace autenticado',async()=>{
 let calls=0;const motor=criarGeminiCurado({registros,contatos,lerChave:()=> 'sintetica',transporte:async(_url,init)=>{calls++;return http(JSON.parse(init.body).generationConfig.responseJsonSchema.properties.resposta?{resposta:'Você precisa de 75% de presença.',ids:['frequencia']}:{sustentada:true});}});
 const opts={pergunta:'Preciso de quantos % de presença?',escopo:{hoje:'2026-11-12'}};
 await motor.responder(opts);await motor.responder(opts);assert.equal(calls,4);
 const r=await motor.responder({...opts,pergunta:'Meu CPF: 123.456.789-01',cacheNamespace:'a'});assert.equal(r.tipo,'entrada_bloqueada');assert.equal(calls,4);
});
