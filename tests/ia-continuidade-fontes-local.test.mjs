import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolverConversaCurada} from '../render-poc/motor-curado/contexto-curado.mjs';
import {criarPoliticaCurada} from '../render-poc/motor-curado/curadoria-local.mjs';
import {criarGeminiCurado} from '../render-poc/motor-curado/gemini-curado.mjs';
const registros=JSON.parse(readFileSync('knowledge-local/faq-curada.json','utf8'));
const contatos=JSON.parse(readFileSync('knowledge-local/contatos-publicos.json','utf8'));
const u=texto=>({remetente:'user',texto}),b=texto=>({remetente:'bot',texto});
const historico=[u('Quando renovo a matrícula em 2026?'),b('Qual é o seu curso?')];
test('resposta ao curso com novo assunto preserva a pergunta nova',()=>{
 const pergunta='Enfermagem, preciso fazer estágio?';
 const r=resolverConversaCurada(pergunta,historico);
 assert.equal(r.pergunta,pergunta);assert.equal(r.tema,'estágio');assert.equal(r.escopo.curso,'enfermagem');assert.equal(r.escopo.ano,undefined);
});
test('resposta curta ao curso ainda recupera a pergunta original',()=>{
 const r=resolverConversaCurada('Faço Logística',historico);
 assert.equal(r.pergunta,historico[0].texto);assert.equal(r.escopo.ano,2026);
});
test('curso seguido de pergunta não catalogada não é descartado',()=>{
 const pergunta='Logística, onde fica a escola?';
 assert.equal(resolverConversaCurada(pergunta,historico).pergunta,pergunta);
});
const politica=criarPoliticaCurada({contatos});
for(const frase of ['Qual é a fonte?','Pode me mandar o link?','Onde posso conferir isso?','Qual a referência?']){
 test('pedido de referência acompanha o assunto: '+frase,()=>{
  const h=[u('Qual é a frequência mínima?'),b('A frequência mínima é 75%.')];
  const p=politica.planejar(frase,h);
  assert.equal(p.pedirFonte,true);assert.match(p.pergunta,/frequência/);
 });
}
test('referência sem assunto pede esclarecimento',()=>{
 assert.equal(politica.planejar('Qual é a fonte?').tipo,'esclarecimento');
});
test('referência de resposta pendente não inventa documento',()=>{
 const r=politica.planejar('Qual é a fonte?',[u('Quanto custa a camiseta?'),b(politica.fallback())]);
 assert.equal(r.tipo,'pendente');assert.equal(r.pedirFonte,undefined);
});
test('fonte da perda do prazo mantém a exceção em vez da regra geral',()=>{
 const r=politica.planejar('Qual é a fonte?',[u('Perdi o prazo da renovação, o que faço?'),b('Procure a Secretaria.')]);
 assert.equal(r.pedirFonte,true);assert.match(r.pergunta,/Perdi o prazo/);
});
test('referência é recuperada sem consumir geração ou revisão',async()=>{
 let chamadas=0;
 const motor=criarGeminiCurado({registros,contatos,lerChave:()=> 'sintetica',transporte:async()=>{chamadas++;throw Error('NAO_CHAMAR');}});
 const r=await motor.responder({pergunta:'Qual é a fonte?',historico:[u('Qual é a frequência mínima?'),b('A frequência mínima é 75%.')],escopo:{hoje:'2026-11-16'}});
 assert.equal(r.tipo,'referencia');assert.deepEqual(r.ids,['frequencia']);assert.match(r.texto,/https:\/\//);assert.equal(chamadas,0);
});
test('pedido explícito de fonte sobre assunto novo não herda o tema antigo',()=>{
 const r=politica.planejar('Qual é a fonte da regra de frequência?',[u('Como renovo a matrícula em 2026?')]);
 assert.equal(r.pedirFonte,true);assert.match(r.pergunta,/frequencia|frequência/);assert.doesNotMatch(r.pergunta,/renova/);
});
test('resposta pendente anterior não bloqueia fonte de outro assunto',()=>{
 const r=politica.planejar('Qual é a fonte da regra de frequência?',[u('Quanto custa a camiseta?'),b(politica.fallback())]);
 assert.equal(r.pedirFonte,true);
});
