import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {criarEmbeddings} from '../local-e2e/embeddings-curados.mjs';
import {criarPoliticaCurada,criarFiltroContatos,elegivel} from '../local-e2e/curadoria-local.mjs';
import {casos} from '../knowledge-local/casos-avaliacao.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const {parse}=createRequire(resolve('../sylvinho-backend/functions/package.json'))('dotenv');
const key=process.env.GEMINI_API_KEY||parse(readFileSync('../sylvinho-backend/functions/.env')).GEMINI_API_KEY;
const registros=read('knowledge-local/faq-curada.json'),contatos=read('knowledge-local/contatos-publicos.json'),filtro=criarFiltroContatos(contatos),politica=criarPoliticaCurada({contatos});
if(registros.some(r=>!elegivel(r,{hoje:'2026-11-12'})||filtro(r.resposta,'documento')))throw Error('CORPUS_NAO_APROVADO');
const api=criarEmbeddings({lerChave:()=>key});
const resultado={data:new Date().toISOString(),modelo:api.modelo,indice:false,consultas:false};
try{
 const index=await api.indexar(registros);writeFileSync('.cache/curadoria-sylvinho/embeddings.json',JSON.stringify(index));resultado.indice=true;resultado.total=registros.length;
 const ps=[...new Set(casos.map(([p,,op={}])=>politica.planejar(p,op.historico||[])).filter(p=>!p.direta).map(p=>p.pergunta))];
 if(ps.some(p=>filtro(p)))throw Error('CONSULTA_PESSOAL');
 const path='.cache/curadoria-sylvinho/queries-embedding.json';
 const anteriores=existsSync(path)?read(path):null;
 const valores=anteriores?.modelo===api.modelo?anteriores.valores:{};
 const faltam=ps.filter(p=>!Array.isArray(valores[p])||valores[p].length!==768);
 if(faltam.length){const vs=await api.lote(faltam,'RETRIEVAL_QUERY');faltam.forEach((p,i)=>{valores[p]=vs[i];});}
 writeFileSync(path,JSON.stringify({modelo:api.modelo,valores}));resultado.consultas=true;resultado.totalConsultas=ps.length;resultado.consultasNovas=faltam.length;
}catch(e){resultado.erro=/^HTTP_\d+$|TIMEOUT|CHAVE_AUSENTE/.test(e.message)?e.message:e.name==='TimeoutError'?'TIMEOUT':'PROVEDOR_INDISPONIVEL';}
writeFileSync('.cache/curadoria-sylvinho/resultado-embeddings.json',JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado));
