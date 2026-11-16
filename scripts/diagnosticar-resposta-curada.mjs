// Somente pergunta sintética pública; não imprime chave, prompt ou dados de usuários.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {criarGeminiCurado} from '../local-e2e/gemini-curado.mjs';
import {criarEmbeddings} from '../local-e2e/embeddings-curados.mjs';
const {parse}=createRequire(resolve('../sylvinho-backend/functions/package.json'))('dotenv');
const key=process.env.GEMINI_API_KEY||parse(readFileSync('../sylvinho-backend/functions/.env')).GEMINI_API_KEY;
const registros=JSON.parse(readFileSync('knowledge-local/faq-curada.json','utf8')),contatos=JSON.parse(readFileSync('knowledge-local/contatos-publicos.json','utf8'));
const vetores=JSON.parse(readFileSync('.cache/curadoria-sylvinho/embeddings.json','utf8'));
const embeddings=criarEmbeddings({lerChave:()=>key});
const motor=criarGeminiCurado({registros,contatos,vetores,embeddingConsulta:embeddings.consulta,lerChave:()=>key,transporte:async(url,init)=>{
 const r=await fetch(url,init);const b=await r.clone().json();
 const text=b.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('');
 if(text){try{const p=JSON.parse(text);if(p.ids)console.log(JSON.stringify({respostaSintetica:p.resposta,ids:p.ids}));}catch{console.log('JSON_INCOMPLETO');}}
 return r;
},registrar:(evento,metricas)=>console.log(JSON.stringify({evento,...metricas}))});
console.log(JSON.stringify(await motor.responder({pergunta:'Como renovo a matrícula?'})));
