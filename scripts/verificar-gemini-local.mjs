// Ensaio manual com dados sintéticos fixos: não lê Firebase nem conversas.
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {executarEnsaioSintetico} from '../local-e2e/gemini-sintetico.mjs';
const backend = resolve(process.env.SYLVINHO_BACKEND_LOCAL || '../sylvinho-backend');
let key = process.env.GEMINI_API_KEY;
if (!key) {
 try {
  const {parse}=createRequire(resolve(backend,'functions/package.json'))('dotenv');
  key=parse(readFileSync(resolve(backend,'functions/.env'))).GEMINI_API_KEY;
 } catch { /* A ausência é apresentada sem expor conteúdo do arquivo. */ }
}
if (!key) {
 console.log(JSON.stringify({status:'chave_local_ausente',geminiValidado:false}));
 process.exitCode=1;
} else {
 const statuses=[],diagnosticos=[];
 const modelo=process.env.SYLVINHO_GEMINI_TEST_MODEL || 'gemini-3-flash-preview';
 const result=await executarEnsaioSintetico({modelo,lerChave:()=>key,timeoutMs:30000,
  transporte:async(url,init)=>{
   if(new URL(url).origin!=='https://generativelanguage.googleapis.com') throw Error('DESTINO_INVALIDO');
   const body=JSON.parse(init.body);
   if(modelo==='gemini-3-flash-preview')body.generationConfig.thinkingConfig={thinkingLevel:'minimal'};
   const response=await fetch(url,{...init,body:JSON.stringify(body)});
   statuses.push(response.status);
   const metadata=await response.clone().json().catch(()=>null);
   diagnosticos.push({finishReason:metadata?.candidates?.[0]?.finishReason || null,partes:metadata?.candidates?.[0]?.content?.parts?.map(p=>({pensamento:p.thought===true,caracteres:typeof p.text==='string'?p.text.length:0})) || [],bloqueada:!!metadata?.promptFeedback?.blockReason});
   return response;
  }});
 const report={data:new Date().toISOString(),status:result.status,geminiValidado:result.status==='gerada_sintetica',httpStatus:statuses,diagnosticos,auditoria:result.auditoria,dados:'Pergunta e evidência sintéticas fixas, sem dados escolares ou pessoais.',firebaseAcessado:false};
 mkdirSync('.cache/chat-local',{recursive:true});
 writeFileSync('.cache/chat-local/gemini-sintetico.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 if(!report.geminiValidado) process.exitCode=1;
}
