import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executarEnsaioSintetico} from '../local-e2e/gemini-sintetico.mjs';
import {validarGeracao} from '../functions/lib/assistente/geracao/contrato.js';
const texto='O certificado experimental utiliza papel violeta de laboratório.';
const pergunta='Qual papel utiliza o certificado experimental?';
const pedido={pergunta,contextos:[texto],evidencias:[{id:'E1',texto,contexto:0}]};
const proposta={afirmacoes:[{texto:'O papel violeta de laboratório é utilizado para o certificado experimental.',referencias:[{id:'E1',citacao:texto}]}]};
const opts={modelo:'modelo-simulado',lerChave:()=> 'credencial-ficticia'};
const response=valor=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(valor),thoughtSignature:'assinatura-simulada'}]}}]}));
function mock(alterar=()=>{}){
 const chamadas=[];
 return {chamadas,transporte:async(url,init)=>{
   const body=JSON.parse(init.body),dados=JSON.parse(body.contents[0].parts[0].text);
   const i=chamadas.length;
   assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/modelo-simulado:generateContent');
   assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
   assert.deepEqual(Object.keys(body).sort(),['contents','generationConfig','safetySettings','systemInstruction','tools']);
   assert.deepEqual(body.tools,[]);
   assert.ok(body.safetySettings.every(s=>s.threshold==='BLOCK_LOW_AND_ABOVE'));
   // Inspecao exata das quatro cargas; nenhum ID de conta, conversa ou Firestore.
   const expected=[{texto:pergunta+'\n\n'+texto},pedido,{pedido,proposta},{texto:proposta.afirmacoes[0].texto}];
   if(i<2)assert.deepEqual(dados,expected[i]);
   chamadas.push({etapa:i,body,dados});
   const valor=structuredClone(i===0||i===3?{segura:true}:i===1?proposta:{sustentada:true});
   const resultado=alterar(valor,i,dados);
   return resultado??response(valor);
 }};
}
test('quatro requisicoes sinteticas exatas, referencias validas e auditoria sanitizada',async()=>{
 const m=mock();const r=await executarEnsaioSintetico({...opts,transporte:m.transporte});
 assert.equal(r.status,'gerada_sintetica');assert.equal(m.chamadas.length,4);
 assert.deepEqual(m.chamadas[2].dados,{pedido,proposta});
 assert.deepEqual(m.chamadas[3].dados,{texto:proposta.afirmacoes[0].texto});
 assert.ok(validarGeracao(proposta,pedido.evidencias));
 assert.deepEqual(r.referencias.map(rs=>rs.map(({id,citacao})=>({id,citacao}))),proposta.afirmacoes.map(a=>a.referencias));
 assert.deepEqual(r.auditoria.map(a=>a.etapa),['classificar_entrada','propor','revisar','classificar_saida']);
 assert.equal(JSON.stringify(r).includes('credencial-ficticia'),false);
 assert.equal(JSON.stringify(r).includes('assinatura-simulada'),false);
});
for(const chave of ['pergunta','chunks','uid','conversationId','messageId','firestore','env'])test('entrada livre nao e aceita: '+chave,async()=>{
 const m=mock();assert.equal((await executarEnsaioSintetico({...opts,transporte:m.transporte,[chave]:'NAO_TRANSMITIR'})).status,'bloqueado');assert.equal(m.chamadas.length,0);
});
for(const adulteracao of [p=>p.afirmacoes[0].referencias[0].id='E99',p=>p.afirmacoes[0].referencias[0].citacao+=' falsa',p=>p.afirmacoes[0].texto+=' Ana Silva',p=>p.afirmacoes[0].texto+=' pessoa@example.invalid',p=>p.afirmacoes[0].texto+=' confidencial',p=>p.extra='x'])test('proposta adversarial nunca chega a terceira requisicao',async()=>{
 const m=mock((v,i)=>{if(i===1)adulteracao(v);});
 const r=await executarEnsaioSintetico({...opts,transporte:m.transporte});
 assert.equal(r.status,'documental_sintetico');assert.equal(r.resposta,texto);assert.equal(m.chamadas.length,2);
});
for(const etapa of [0,2,3])test('recusa da etapa '+etapa+' interrompe sem retry',async()=>{
 const m=mock((v,i)=>{if(i===etapa){if('segura'in v)v.segura=false;else v.sustentada=false;}});
 const r=await executarEnsaioSintetico({...opts,transporte:m.transporte});assert.equal(r.status,'documental_sintetico');assert.equal(m.chamadas.length,etapa+1);
});
test('sem transporte/chave/modelo explicitos nao executa',async()=>{assert.equal((await executarEnsaioSintetico()).status,'bloqueado');});
test('falha do provedor e sanitizada e nao repete',async()=>{
 let n=0;const r=await executarEnsaioSintetico({...opts,transporte:async()=>{n++;throw Error('ERRO_PRIVADO');}});assert.equal(r.status,'documental_sintetico');assert.equal(n,1);assert.equal(JSON.stringify(r).includes('ERRO_PRIVADO'),false);
});
test('timeout aborta e usa fallback sem retry',async()=>{
 let signal;const r=await executarEnsaioSintetico({...opts,timeoutMs:5,transporte:async(_,init)=>{signal=init.signal;return new Promise(()=>{});}});assert.equal(r.status,'documental_sintetico');assert.equal(signal.aborted,true);
});
test('ensaio nao e importado no runtime nem acessa env/Firestore',()=>{
 const src=readFileSync(new URL('../local-e2e/gemini-sintetico.mjs',import.meta.url),'utf8');assert.equal(src.includes('process.env'),false);
 for(const p of ['../render-poc/documental.cjs','../functions/src/index.ts','../functions/src/assistente/geracao/gateway.ts'])assert.equal(readFileSync(new URL(p,import.meta.url),'utf8').includes('gemini-sintetico'),false);
});
