// Avaliação retomável com teto de chamadas. Não confunde cache/política com geração.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {criarGeminiCurado} from '../local-e2e/gemini-curado.mjs';
import {criarEmbeddings} from '../local-e2e/embeddings-curados.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const registros=read('knowledge-local/faq-curada.json'),contatos=read('knowledge-local/contatos-publicos.json');
const fatos=registros.filter(r=>r.categoria!=='contato');
const casos=[...fatos.map(r=>({id:r.id,pergunta:r.pergunta,esperado:r.id})),...fatos.slice(0,50-fatos.length).map(r=>({id:r.id+'-variacao',pergunta:r.variacoes[0],esperado:r.id}))].slice(0,50);
const hash=createHash('sha256').update(JSON.stringify(casos)+JSON.stringify(registros)+readFileSync('local-e2e/gemini-curado.mjs')+readFileSync('local-e2e/contexto-curado.mjs')+readFileSync('local-e2e/curadoria-local.mjs')).digest('hex');
const file='docs/curadoria-local/avaliacao-50-real.json';
let anterior=existsSync(file)?read(file):null;
if(anterior&&anterior.hash!==hash){writeFileSync('.cache/curadoria-sylvinho/avaliacao-50-anterior-'+Date.now()+'.json',JSON.stringify(anterior,null,2));anterior=null;}
const resultados=anterior?.resultados?.filter(r=>r.tipo==='gemini_curado'&&r.cacheHit!==true)||[];
const limite=Number(process.argv.find(x=>x.startsWith('--max-chamadas='))?.split('=')[1]||12);
if(!Number.isInteger(limite)||limite<2||limite>100)throw Error('LIMITE_DE_CHAMADAS_INVALIDO');
const {parse}=createRequire(resolve('../sylvinho-backend/functions/package.json'))('dotenv');
const key=process.env.GEMINI_API_KEY||parse(readFileSync('../sylvinho-backend/functions/.env')).GEMINI_API_KEY;
const embeddings=criarEmbeddings({lerChave:()=>key});
const vetores=existsSync('.cache/curadoria-sylvinho/embeddings.json')?read('.cache/curadoria-sylvinho/embeddings.json'):null;
let chamadas=0,budget=false;const falhas=[];
const motor=criarGeminiCurado({registros,contatos,lerChave:()=>key,vetores,embeddingConsulta:vetores?embeddings.consulta:null,transporte:async(url,init)=>{
 if(chamadas>=limite){budget=true;throw Error('LIMITE_AVALIACAO');}chamadas++;return fetch(url,init);
}});
function salvar(motivo){
 const aceitas=resultados.filter(r=>r.ids?.includes(r.esperado)&&!r.cacheHit&&!/\b(RAG|trecho|segundo o regimento|contexto fornecido)\b/i.test(r.texto));
 const relatorio={hash,data:new Date().toISOString(),alvo:50,geradas:resultados.length,checagemAutomaticaAceitou:aceitas.length,mediaMs:resultados.length?resultados.reduce((s,r)=>s+r.ms,0)/resultados.length:null,pendentes:casos.filter(c=>!resultados.some(r=>r.id===c.id)).map(c=>c.id),chamadasNestaRodada:chamadas,limiteChamadas:limite,concluida:resultados.length===50,motivo,nota:'IDs e revisão automática não certificam precisão factual geral; requer auditoria humana. Falhas não contam como respostas geradas. Sem cache de respostas.',resultados,falhasNestaRodada:falhas};
 writeFileSync(file,JSON.stringify(relatorio,null,2));
}
for(const c of casos){
 if(resultados.some(r=>r.id===c.id))continue;
 if(chamadas>limite-2){salvar('teto_de_chamadas');break;}
 const r=await motor.responder({pergunta:c.pergunta,escopo:{hoje:'2026-11-12'}});
 if(r.tipo==='gemini_curado'&&!r.cacheHit)resultados.push({...c,...r});else falhas.push({...c,...r});
 salvar(budget?'teto_de_chamadas':r.codigo==='HTTP_429'?'cota_do_provedor':'em_andamento');
 console.log(JSON.stringify({id:c.id,tipo:r.tipo,codigo:r.codigo,geradas:resultados.length,chamadas}));
 if(budget||r.codigo==='HTTP_429')break;
 if(resultados.length<50&&chamadas<=limite-2)await new Promise(done=>setTimeout(done,30000));
}
salvar(resultados.length===50?'concluida':budget||chamadas>limite-2?'teto_de_chamadas':falhas.at(-1)?.codigo==='HTTP_429'?'cota_do_provedor':'rodada_encerrada');
const final=read(file);console.log(JSON.stringify({geradas:final.geradas,pendentes:final.pendentes.length,chamadas,concluida:final.concluida,motivo:final.motivo}));
