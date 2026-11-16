// Execução manual autorizada: teto global de requisições, incluindo embeddings.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {criarGeminiCurado} from '../local-e2e/gemini-curado.mjs';
import {criarEmbeddings} from '../local-e2e/embeddings-curados.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const {parse}=createRequire(resolve('../sylvinho-backend/functions/package.json'))('dotenv');
const chave=process.env.GEMINI_API_KEY||parse(readFileSync('../sylvinho-backend/functions/.env')).GEMINI_API_KEY;
if(!chave)throw Error('CHAVE_LOCAL_AUSENTE');
const registros=read('knowledge-local/faq-curada.json'),contatos=read('knowledge-local/contatos-publicos.json');
const limite=20;let chamadas=0,limiteAtingido=false;
const eventos=[];
const transporte=async(url,init)=>{
 if(chamadas>=limite){limiteAtingido=true;throw Error('LIMITE_AVALIACAO');}
 chamadas++;return fetch(url,init);
};
const embeddings=criarEmbeddings({lerChave:()=>chave,transporte});
const vetores=existsSync('.cache/curadoria-sylvinho/embeddings.json')?read('.cache/curadoria-sylvinho/embeddings.json'):null;
const motor=criarGeminiCurado({registros,contatos,lerChave:()=>chave,transporte,vetores,embeddingConsulta:vetores?embeddings.consulta:null,registrar:(evento,dados)=>eventos.push({evento,...dados})});
const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const u=texto=>({remetente:'user',texto}),b=texto=>({remetente:'bot',texto});
const casos=[
 {id:'frequencia',pergunta:'Preciso de quantos % de presença?'},
 {id:'matricula-idade',pergunta:'Sou menor, posso me matricular sozinho?',escopo:{idade:15}},
 {id:'estagio',pergunta:'Tem estágio obrigatório?',escopo:{curso:'enfermagem'}},
 {id:'trancamento',pergunta:'Como funciona o trancamento?'},
 {id:'renovacao-2026',pergunta:'Logística',historico:[u('Quando renovo a matrícula em 2026?'),b('Qual é o seu curso?')]},
 {id:'fonte',pergunta:'Qual é a fonte?',historico:[u('Preciso de quantos % de presença?')]},
 {id:'esclarecimento',pergunta:'Quando renovo a matrícula em 2026?'},
];
const resultados=[];
mkdirSync('.cache/ia-real-2026-11-16',{recursive:true});
const arquivo='.cache/ia-real-2026-11-16/rodada.json';
function salvar(){writeFileSync(arquivo,JSON.stringify({tipo:'amostra real limitada; requer revisão humana',data:new Date().toISOString(),hoje,limite,chamadas,limiteAtingido,configuracao:motor.configuracao,resultados,eventos},null,2));}
for(const c of casos){
 if(chamadas>limite-3)break;
 const antes=chamadas;
 const resultado=await motor.responder({pergunta:c.pergunta,historico:c.historico||[],escopo:{hoje,...c.escopo}});
 resultados.push({...c,...resultado,chamadas:chamadas-antes,fatosCitados:(resultado.ids||[]).map(id=>({id,resposta:registros.find(r=>r.id===id)?.resposta}))});
 salvar();console.log(JSON.stringify({caso:c.id,tipo:resultado.tipo,codigo:resultado.codigo,ms:resultado.ms,chamadas:chamadas-antes}));
 if(limiteAtingido||resultado.codigo==='HTTP_429'||resultado.codigo==='CHAVE_AUSENTE'||resultado.codigo==='HTTP_403')break;
}
salvar();console.log(JSON.stringify({arquivo,total:resultados.length,chamadas,limite}));
