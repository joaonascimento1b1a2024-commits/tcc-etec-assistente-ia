// CLI explícita para testar a composição nova, sem mudar o servidor ou gravar histórico.
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {criarGeminiCurado} from '../local-e2e/gemini-curado.mjs';
import {criarEmbeddings} from '../local-e2e/embeddings-curados.mjs';
const pergunta=process.argv.slice(2).join(' ').trim();if(!pergunta)throw Error('Informe uma pergunta, entre aspas.');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const {parse}=createRequire(resolve('../sylvinho-backend/functions/package.json'))('dotenv');
const key=process.env.GEMINI_API_KEY||parse(readFileSync('../sylvinho-backend/functions/.env')).GEMINI_API_KEY;
const registros=read('knowledge-local/faq-curada.json'),contatos=read('knowledge-local/contatos-publicos.json');
const vetores=existsSync('.cache/curadoria-sylvinho/embeddings.json')?read('.cache/curadoria-sylvinho/embeddings.json'):null;
const api=criarEmbeddings({lerChave:()=>key});
const motor=criarGeminiCurado({registros,contatos,lerChave:()=>key,vetores,embeddingConsulta:api.consulta});
const resultado=await motor.responder({pergunta});console.log(resultado.texto);
console.log(JSON.stringify({tipo:resultado.tipo,modo:resultado.modo,ms:resultado.ms,codigo:resultado.codigo}));
