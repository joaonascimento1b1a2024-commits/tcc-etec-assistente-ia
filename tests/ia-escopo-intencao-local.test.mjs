import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {criarBuscaCurada,criarPoliticaCurada,elegivel,hashIndice} from '../local-e2e/curadoria-local.mjs';
import {criarGeminiCurado} from '../local-e2e/gemini-curado.mjs';
import {resolverConversaCurada} from '../local-e2e/contexto-curado.mjs';
const registros=JSON.parse(readFileSync('knowledge-local/faq-curada.json','utf8'));
const contatos=JSON.parse(readFileSync('knowledge-local/contatos-publicos.json','utf8'));
const escopo={hoje:'2026-11-16'};
const cal=registros.find(r=>r.id==='renovacao-2026');
const response=value=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(value)}]}}]}),{status:200});
function motorMock(resposta,id){
 let calls=0;
 const motor=criarGeminiCurado({registros,contatos,lerChave:()=> 'sintetica',transporte:async(_url,init)=>{
  calls++;const schema=JSON.parse(init.body).generationConfig.responseJsonSchema;
  return response(schema.properties.resposta?{resposta,ids:[id]}:{sustentada:true});
 }});
 return {motor,calls:()=>calls};
}
test('regra geral de frequência não é bloqueada só por mencionar Logística',async()=>{
 const politica=criarPoliticaCurada({contatos});
 assert.equal(politica.planejar('Qual é a frequência mínima em Logística?').tipo,'buscar');
 const {motor,calls}=motorMock('A frequência mínima é 75% do total de aulas.','frequencia');
 const result=await motor.responder({pergunta:'Qual é a frequência mínima em Logística?',escopo});
 assert.equal(result.tipo,'gemini_curado');assert.deepEqual(result.ids,['frequencia']);assert.equal(calls(),2);
});
test('calendário restrito exige curso e continua excluindo outro curso',()=>{
 assert.equal(elegivel(cal,escopo),false);
 assert.equal(elegivel(cal,{...escopo,curso:'logistica'}),true);
 assert.equal(elegivel(cal,{...escopo,curso:'enfermagem'}),false);
});
test('busca distingue curso ausente de ausência de informação',async()=>{
 const busca=criarBuscaCurada({registros:[cal]});
 const missing=await busca(cal.pergunta,escopo);
 assert.equal(missing.selecionados.length,0);assert.equal(missing.motivo,'CURSO_NECESSARIO');
 assert.equal(missing.esclarecimento,'Qual é o seu curso?');
 const known=await busca(cal.pergunta,{...escopo,curso:'logistica'});
 assert.equal(known.selecionados[0].registro.id,cal.id);
});
test('gerador pede curso antes de enviar calendário específico ao provedor',async()=>{
 const {motor,calls}=motorMock('A renovação anual acontece de 15 a 21 de dezembro de 2026.',cal.id);
 const result=await motor.responder({pergunta:cal.pergunta,escopo});
 assert.equal(result.tipo,'esclarecimento');assert.equal(result.texto,'Qual é o seu curso?');assert.equal(calls(),0);
});
test('vizinho semântico genérico não substitui calendário que exige curso',async()=>{
 const docs=[cal,registros.find(r=>r.id==='frequencia')];
 const vector=[1,0];
 const busca=criarBuscaCurada({registros:docs,vetores:{hash:hashIndice(docs),valores:Object.fromEntries(docs.map(r=>[r.id,vector]))},embeddingConsulta:async()=>vector});
 const result=await busca(cal.pergunta,escopo);
 assert.equal(result.motivo,'CURSO_NECESSARIO');assert.equal(result.selecionados.length,0);
});
test('esclarecimento inequívoco não espera nem consome embeddings',async()=>{
 let calls=0;
 const busca=criarBuscaCurada({registros,vetores:{hash:hashIndice(registros),valores:{}},embeddingConsulta:async()=>{calls++;throw Error('NAO_CHAMAR');}});
 const result=await busca(cal.pergunta,escopo);
 assert.equal(result.motivo,'CURSO_NECESSARIO');assert.equal(calls,0);
});
test('responder ao esclarecimento preserva a pergunta original e o ano',async()=>{
 const historico=[{remetente:'user',texto:cal.pergunta},{remetente:'bot',texto:'Qual é o seu curso?'}];
 const contexto=resolverConversaCurada('Logística',historico);
 assert.equal(contexto.pergunta,cal.pergunta);assert.equal(contexto.escopo.curso,'logistica');assert.equal(contexto.escopo.ano,2026);
 const {motor,calls}=motorMock('A renovação anual acontece de 15 a 21 de dezembro de 2026.',cal.id);
 const result=await motor.responder({pergunta:'Logística',historico,escopo});
 assert.equal(result.tipo,'gemini_curado');assert.deepEqual(result.ids,[cal.id]);assert.equal(calls(),2);
});
test('regra geral sem curso continua respondível, sem esclarecimento desnecessário',async()=>{
 const {motor,calls}=motorMock('A frequência mínima é 75% do total de aulas.','frequencia');
 const result=await motor.responder({pergunta:'Preciso de quantos % de presença?',escopo});
 assert.equal(result.tipo,'gemini_curado');assert.equal(calls(),2);
});
test('registro pendente ou vencido não provoca pergunta de curso nem entra na resposta',async()=>{
 for(const registro of [{...cal,status:'pendente'},{...cal,vigencia:{...cal.vigencia,fim:'2026-11-01'}}]){
  const result=await criarBuscaCurada({registros:[registro]})(cal.pergunta,escopo);
  assert.equal(result.selecionados.length,0);assert.equal(result.esclarecimento,undefined);
 }
});
test('informação de outro assunto não pede curso só por existir um calendário no catálogo',async()=>{
 const result=await criarBuscaCurada({registros:[cal]})('Quero solicitar um diploma',escopo);
 assert.equal(result.selecionados.length,0);assert.equal(result.esclarecimento,undefined);
});
test('conflitos de calendário não são apresentados como simples ausência de curso',async()=>{
 const outro={...cal,id:'conflito-sintetico',resposta:'Calendário sintético conflitante.'};
 const result=await criarBuscaCurada({registros:[cal,outro]})(cal.pergunta,escopo);
 assert.equal(result.selecionados.length,0);assert.equal(result.esclarecimento,undefined);
});
test('não inventa oferta de Logística, nem preço ou prazo operacional pendente',async()=>{
 const {motor,calls}=motorMock('Não deve ser gerada.','enfermagem-catalogo');
 const result=await motor.responder({pergunta:'Tem curso de Logística?',escopo});
 assert.equal(result.tipo,'sem_evidencia');assert.equal(calls(),0);
 const politica=criarPoliticaCurada({contatos});
 for(const pergunta of ['Quanto custa a camiseta?','Como renovo pelo NSA?','Qual o horário da secretaria?'])assert.equal(politica.planejar(pergunta).tipo,'pendente');
});
