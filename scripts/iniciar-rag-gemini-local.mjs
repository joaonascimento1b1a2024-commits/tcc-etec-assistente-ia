import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {criarRagGeminiReal} from '../local-e2e/rag-gemini-real.mjs';
import {criarEndpointAssistente} from '../functions/lib/assistente/http.js';
import {ErroRespostaTemporaria} from '../functions/lib/assistente/handler.js';
import {escopoNatural,contextoNatural} from '../local-e2e/conversa-natural.mjs';
import {criarGeminiSemRag} from '../local-e2e/gemini-sem-rag.mjs';
import {criarGeminiCurado} from '../local-e2e/gemini-curado.mjs';
import {criarEmbeddings} from '../local-e2e/embeddings-curados.mjs';
const semRag=process.argv.includes('--sem-rag');
const curada=process.argv.includes('--faq-curada');
if(semRag&&curada)throw Error('MODOS_INCOMPATIVEIS');
const project='demo-sylvinho-render-poc';
// Confirmar emuladores antes de carregar Admin; nunca usar credenciais reais.
const hub=await fetch('http://127.0.0.1:4400/emulators',{signal:AbortSignal.timeout(3000)}).then(r=>r.json());
if(hub.auth?.port!==9099||hub.firestore?.port!==8080||hub.hosting?.port!==5000)throw Error('EMULADORES_LOCAIS_NECESSARIOS');
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
process.env.GCLOUD_PROJECT=project;
const require=createRequire(resolve('functions/package.json'));
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {parse}=createRequire(resolve('../sylvinho-backend/functions/package.json'))('dotenv');
const key=process.env.GEMINI_API_KEY||parse(readFileSync(resolve('../sylvinho-backend/functions/.env'))).GEMINI_API_KEY;
if(!key)throw Error('CHAVE_GEMINI_LOCAL_AUSENTE');
const documentos=JSON.parse(readFileSync('.cache/chat-rag/base.json','utf8'));
const app=initializeApp({projectId:project},'rag-gemini-local');
const events=[];
const modelo=process.env.SYLVINHO_GEMINI_MODEL||'gemini-3-flash-preview';
const rag=(semRag?criarGeminiSemRag:criarRagGeminiReal)({documentos,modelo,lerChave:()=>key,registrar:(codigo,metricas)=>{
 events.push({codigo,data:new Date().toISOString(),...metricas});
 writeFileSync('.cache/chat-rag/eventos.json',JSON.stringify(events.slice(-100),null,2));
}});
const deps={auth:getAuth(app),firestore:getFirestore(app),serverTimestamp:()=>FieldValue.serverTimestamp(),resolverContexto:semRag?(pergunta=>({pergunta})):contextoNatural,classificarEscopo:semRag?(()=>({categoria:'institucional'})):escopoNatural,...rag};
let motorCurado;
if(curada){
 const read=p=>JSON.parse(readFileSync(p,'utf8'));
 const registros=read('knowledge-local/faq-curada.json');
 const contatos=read('knowledge-local/contatos-publicos.json');
 const vetores=existsSync('.cache/curadoria-sylvinho/embeddings.json')?read('.cache/curadoria-sylvinho/embeddings.json'):null;
 const embeddings=criarEmbeddings({lerChave:()=>key});
 motorCurado=criarGeminiCurado({registros,contatos,modelo,lerChave:()=>key,vetores,embeddingConsulta:embeddings.consulta,registrar:(codigo,metricas)=>{
  events.push({codigo,data:new Date().toISOString(),...metricas});
  writeFileSync('.cache/chat-rag/eventos.json',JSON.stringify(events.slice(-100),null,2));
 }});
 deps.responderConversa=async(pergunta,historico,contexto)=>{
  const resultado=await motorCurado.responder({pergunta,historico,cacheNamespace:contexto.uid});
  events.push({codigo:'RESPOSTA_CURADA',tipo:resultado.tipo,modo:resultado.modo,ms:resultado.ms,data:new Date().toISOString()});
  writeFileSync('.cache/chat-rag/eventos.json',JSON.stringify(events.slice(-100),null,2));
  if(resultado.retentavel){
   const motivo=resultado.tipo==='ocupado'?'OCUPADO':resultado.codigo==='HTTP_429'?'LIMITE_USO':resultado.codigo==='TIMEOUT'?'TEMPO_EXCEDIDO':['NAO_SUSTENTADA','LINGUAGEM','FORMATO','NUMERO_OU_DADO_NAO_SUSTENTADO'].includes(resultado.codigo)?'RESPOSTA_NAO_VALIDADA':'INDISPONIVEL';
   throw new ErroRespostaTemporaria(motivo,resultado.tentarEmSegundos);
  }
  return resultado.texto;
 };
}
const endpoint=criarEndpointAssistente(()=>deps,()=> 'http://127.0.0.1:5000');
const server=http.createServer(async(req,res)=>{
 const out={get headersSent(){return res.headersSent;},set(k,v){res.setHeader(k,v);return out;},vary(k){res.setHeader('Vary',k);return out;},status(n){res.statusCode=n;return out;},json(body){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));},send(body=''){res.end(body);}};
 if(req.url==='/health'){out.status(200).json({modo:curada?'gemini-rag-curado-local':semRag?'gemini-sem-rag-local':'gemini-rag-local',modelo,chunks:curada?JSON.parse(readFileSync('knowledge-local/faq-curada.json','utf8')).length:semRag?0:documentos.length,project,reserva:motorCurado?.configuracao.modeloReserva});return;}
 if(req.url!=='/demo-sylvinho-render-poc/southamerica-east1/perguntarAssistente'){out.status(404).json({error:'Rota inexistente.'});return;}
 try {
  let body;
  if(req.method==='POST') {
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)throw Error('CORPO');}
   body=JSON.parse(raw);
  }
  await endpoint({method:req.method,body,get:name=>req.headers[name.toLowerCase()]},out);
 }catch{if(!res.headersSent)out.status(400).json({error:'Requisição inválida.'});}
});
server.listen(5002,'127.0.0.1',()=>{
 // Alterar apenas a cópia ignorada servida pelo Hosting Emulator.
 const file='.cache/local-e2e/public/Logado/Home/assistente-config.js';
 const config=readFileSync(file,'utf8');
 writeFileSync(file,config.replace("functions: '127.0.0.1:5001'","functions: '127.0.0.1:5002'").replace('timeoutMs: 30000,','timeoutMs: 45000,'));
 const view='public/Logado/Home/resposta-documental-view.js';
 writeFileSync('.cache/local-e2e/'+view,readFileSync(view));
 // As duas CSPs (meta + header) do staging precisam permitir o novo endpoint.
 const html='.cache/local-e2e/public/Logado/Home/home.html';
 const heading=semRag?'Assistente ETEC IA — teste sem RAG':'Assistente ETEC IA';
 writeFileSync(html,readFileSync(html,'utf8').replaceAll('http://127.0.0.1:5001','http://127.0.0.1:5002').replace(/<span>Assistente ETEC IA(?: — teste sem RAG)?<\/span>/,'<span>'+heading+'</span>'));
 console.log('RAG_GEMINI_LOCAL_READY http://127.0.0.1:5000/Logado/Home/home.html');
});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
