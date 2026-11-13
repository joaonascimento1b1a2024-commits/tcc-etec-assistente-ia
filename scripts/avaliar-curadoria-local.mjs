import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {criarBuscaCurada,criarPoliticaCurada,criarFiltroContatos} from '../local-e2e/curadoria-local.mjs';
import {casos} from '../knowledge-local/casos-avaliacao.mjs';
const registros=JSON.parse(readFileSync('knowledge-local/faq-curada.json','utf8')),contatos=JSON.parse(readFileSync('knowledge-local/contatos-publicos.json','utf8'));
const politica=criarPoliticaCurada({contatos}),filtro=criarFiltroContatos(contatos);
let vetores=null,queries=null;
try{vetores=JSON.parse(readFileSync('.cache/curadoria-sylvinho/embeddings.json','utf8'));queries=JSON.parse(readFileSync('.cache/curadoria-sylvinho/queries-embedding.json','utf8'));}catch{}
const buscar=criarBuscaCurada({registros,vetores,embeddingConsulta:queries?(async p=>queries.valores[p]||null):null});
const resultados=[];
for(let i=0;i<casos.length;i++){
 const [pergunta,esperado,op={}]=casos[i],start=performance.now(),plano=politica.planejar(pergunta,op.historico||[]);
 const busca=plano.direta?null:await buscar(plano.pergunta,{hoje:'2026-11-12',...op.escopo});
 const top=busca?.selecionados[0]?.registro;
 // Rascunho de política/recuperação, NÃO é uma resposta gerada pelo Gemini.
 const rascunho=plano.direta||top?.resposta||politica.fallback();
 const escolhido=plano.direta?(plano.tipo==='pendente'?null:plano.tipo):top?.id||null;
 const passou=escolhido===esperado&&(!op.semSaudacao||!/^oi|^ola/i.test(rascunho))&&!filtro(rascunho,'documento');
 resultados.push({id:i+1,pergunta,esperado,escolhido,passou,modo:busca?.modo||'politica',ms:performance.now()-start,rascunho,fonteSolicitada:!!op.fonte,candidatos:busca?.selecionados.map(x=>({id:x.registro.id,confianca:x.confianca}))||[]});
}
const falhas=resultados.filter(r=>!r.passou),jargao=resultados.filter(r=>!r.fonteSolicitada&&/\b(RAG|trecho|base de dados|contexto fornecido|segundo o regimento|fonte)\b/i.test(r.rascunho));
const relatorio={tipo:'avaliação offline de política e recuperação; não mede correção factual nem latência do Gemini',data:new Date().toISOString(),total:resultados.length,passou:resultados.length-falhas.length,acertoTop1:(resultados.length-falhas.length)/resultados.length,jargaoNaoSolicitado:jargao.length,msMedio:resultados.reduce((s,r)=>s+r.ms,0)/resultados.length,falhas:falhas.map(r=>({id:r.id,pergunta:r.pergunta,esperado:r.esperado,escolhido:r.escolhido})),resultados};
mkdirSync('docs/curadoria-local',{recursive:true});writeFileSync('docs/curadoria-local/avaliacao-offline.json',JSON.stringify(relatorio,null,2));
console.log(JSON.stringify({...relatorio,resultados:undefined},null,2));
if(falhas.length)process.exitCode=1;
