import test from 'node:test';import assert from 'node:assert/strict';
import {criarGeminiSemRag} from '../local-e2e/gemini-sem-rag.mjs';
test('teste sem RAG usa uma chamada e não envia documentos, histórico ou UID',async()=>{
 let body,count=0;
 const f=criarGeminiSemRag({lerChave:()=> 'ficticia',transporte:async(_,init)=>{count++;body=JSON.parse(init.body);return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'Oi! Como posso ajudar?'}]}}]}));}});
 assert.deepEqual(await f.recuperarConhecimento('oi'),[]);
 assert.equal(await f.gerarResposta('oi',[{conteudo:'DOCUMENTO_NAO_ENVIAR'}],{uid:'UID_NAO_ENVIAR'}),'Oi! Como posso ajudar?');assert.equal(count,1);assert.doesNotMatch(JSON.stringify(body),/DOCUMENTO_NAO_ENVIAR|UID_NAO_ENVIAR/);
});
test('limite de uso é informado sem resposta simulada',async()=>{
 const f=criarGeminiSemRag({lerChave:()=> 'ficticia',transporte:async()=>new Response('{}',{status:429})});assert.match(await f.gerarResposta('oi'),/limite de uso/);
});
