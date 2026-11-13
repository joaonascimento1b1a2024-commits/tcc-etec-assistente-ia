import test from 'node:test';
import assert from 'node:assert/strict';
import {criarRagGeminiReal} from '../local-e2e/rag-gemini-real.mjs';
const text='A frequência mínima é de 75% das horas de trabalho escolar efetivo, considerando todos os componentes curriculares em conjunto.';
const doc={id:'frequencia',ativo:true,documentoId:'regimento',titulo:'Regimento da escola',categoria:'frequencia',secao:'Artigo 83',conteudo:text,paginaInicial:26,paginaFinal:26};
function setup({fail=false,bad=false,badNumber=false}={}) {
 const calls=[],events=[];
 const proposta={afirmacoes:[{texto:badNumber?text.replace('75%','76%'):text,referencias:[{id:'E1',citacao:bad?'Citação inventada':text}]}]};
 const values=[{segura:true},proposta,{sustentada:true},{segura:true}];
 const flow=criarRagGeminiReal({documentos:[doc,{...doc,id:'inativo',ativo:false}],lerChave:()=> 'ficticia',registrar:c=>events.push(c),
 transporte:async(url,init)=>{calls.push(JSON.parse(init.body));if(fail)throw Error('erro-com-segredo');return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(values[calls.length-1])}]}}]}));}});
 return {flow,calls,events};
}
test('RAG seleciona fonte ativa e IA recebe somente evidências, sem histórico ou identidade',async()=>{
 const {flow,calls,events}=setup();const chunks=await flow.recuperarConhecimento('Qual a frequência mínima?');
 assert.deepEqual(chunks.map(c=>c.id),['frequencia']);
 const result=await flow.gerarResposta('Qual a frequência mínima?',chunks,{uid:'nao-transmitir'});
 assert.match(result,/Resposta gerada por IA/);assert.match(result,/75%/);assert.match(result,/pagina 26/);
 assert.equal(calls.length,4);assert.doesNotMatch(JSON.stringify(calls),/nao-transmitir|inativo/);assert.equal(events.at(-1),'GERADA_GEMINI_RAG');
 assert.match(calls[1].systemInstruction.parts[0].text,/acolhedora/);assert.equal(calls[1].generationConfig.temperature,undefined);assert.equal(calls[1].generationConfig.thinkingConfig.thinkingLevel,'minimal');assert.equal(calls[1].generationConfig.thinkingConfig.thinkingBudget,undefined);
});
test('sem evidência não chama Gemini nem inventa procedimento',async()=>{
 const {flow,calls}=setup();assert.match(await flow.gerarResposta('Prazo de matrícula?',[]),/Não encontrei informação suficiente/);assert.equal(calls.length,0);
});
test('falha externa não é apresentada como resposta gerada ou extração documental',async()=>{
 const {flow,calls,events}=setup({fail:true});const r=await flow.gerarResposta('Frequência mínima?',[doc]);
 assert.match(r,/Não consegui concluir/);assert.doesNotMatch(r,/erro-com-segredo|Trecho documental|Resposta gerada por IA/);assert.equal(calls.length,1);assert.deepEqual(events,['PROVEDOR_REDE','REDE']);
});
test('citação falsa interrompe antes da revisão e não chega ao usuário',async()=>{
 const {flow,calls}=setup({bad:true});assert.match(await flow.gerarResposta('Frequência mínima?',[doc]),/Não consegui concluir/);assert.equal(calls.length,2);
});
test('dados pessoais e trechos adulterados não são transmitidos',async()=>{
 const {flow,calls}=setup();assert.match(await flow.gerarResposta('Meu nome é Pessoa Teste, qual frequência?',[doc]),/sem nomes ou dados pessoais/);
 assert.match(await flow.gerarResposta('Frequência?',[{...doc,conteudo:'Conteúdo adulterado'}]),/Não encontrei informação suficiente/);assert.equal(calls.length,0);
});
test('síntese revisada continua rejeitando valores numéricos inventados',async()=>{
 const {flow,calls}=setup({badNumber:true});
 assert.match(await flow.gerarResposta('Qual a frequência mínima?',[doc]),/Não consegui concluir/);
 assert.equal(calls.length,2);
});
test('HTTP 429 é identificado e impede chamadas repetidas durante a espera',async()=>{
 let count=0;const events=[];
 const flow=criarRagGeminiReal({documentos:[doc],lerChave:()=> 'ficticia',registrar:c=>events.push(c),transporte:async()=>{count++;return new Response('{}',{status:429});}});
 assert.match(await flow.gerarResposta('Frequência mínima?',[doc]),/muitas solicitações/);
 assert.match(await flow.gerarResposta('Frequência mínima?',[doc]),/limite de uso/);
 assert.equal(count,1);assert.ok(events.includes('HTTP_429'));assert.ok(events.includes('PROVEDOR_EM_ESPERA'));
});
test('prazo total encerra mesmo se o transporte ignorar cancelamento',async()=>{
 const flow=criarRagGeminiReal({documentos:[doc],lerChave:()=> 'ficticia',timeoutMs:15,transporte:()=>new Promise(()=>{})});
 const started=Date.now();assert.match(await flow.gerarResposta('Frequência mínima?',[doc]),/demorou mais/);assert.ok(Date.now()-started<1000);
});
