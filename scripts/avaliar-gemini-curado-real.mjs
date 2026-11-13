// Apenas requisições de teste com perguntas sintéticas e fatos públicos aprovados.
// Não inicia servidor, não acessa Firebase e não muda o modo sem RAG.
import {readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {criarGeminiCurado} from '../local-e2e/gemini-curado.mjs';
import {criarEmbeddings} from '../local-e2e/embeddings-curados.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const {parse}=createRequire(resolve('../sylvinho-backend/functions/package.json'))('dotenv');
const key=process.env.GEMINI_API_KEY||parse(readFileSync('../sylvinho-backend/functions/.env')).GEMINI_API_KEY;
const registros=read('knowledge-local/faq-curada.json'),contatos=read('knowledge-local/contatos-publicos.json');
const events=[];
const vetores=existsSync('.cache/curadoria-sylvinho/embeddings.json')?read('.cache/curadoria-sylvinho/embeddings.json'):null;
const embeddings=criarEmbeddings({lerChave:()=>key});
const motor=criarGeminiCurado({registros,contatos,lerChave:()=>key,vetores,embeddingConsulta:vetores?embeddings.consulta:null,registrar:(codigo,dados)=>events.push({codigo,...dados})});
const perguntas=['Preciso de quantos % de presença?','Sou menor, posso me matricular sozinho?'];
const resultados=[];
for(const pergunta of perguntas){const r=await motor.responder({pergunta,escopo:{hoje:'2026-11-12'}});resultados.push({pergunta,...r});if(r.codigo==='HTTP_429')break;}
const relatorio={data:new Date().toISOString(),tipo:'amostra real Gemini; não certifica 56 respostas',...motor.configuracao,resultados,events};
if(existsSync('docs/curadoria-local/avaliacao-gemini-real.json')&&!existsSync('docs/curadoria-local/avaliacao-gemini-real-inicial.json'))copyFileSync('docs/curadoria-local/avaliacao-gemini-real.json','docs/curadoria-local/avaliacao-gemini-real-inicial.json');
writeFileSync('docs/curadoria-local/avaliacao-gemini-real.json',JSON.stringify(relatorio,null,2));console.log(JSON.stringify(relatorio,null,2));
