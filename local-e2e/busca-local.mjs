import {normalizarTexto,extrairTermosUteis} from '../functions/lib/rag/recuperacao.js';
import {normalizarProcedimentos} from '../functions/lib/rag/assuntos.js';
// BM25 em memória + termos exatos, sem API, índice remoto ou nova dependência.
export function criarBuscaLocal(documentos) {
 const tokens=s=>{const n=normalizarProcedimentos(normalizarTexto(s)).replace(/\brematricula\b/g,'renovacao').replace(/\brenovacoes\b/g,'renovacao').replace(/\bmatriculas\b/g,'matricula').replace(/\bfaltas\b/g,'falta').replace(/\balunos\b/g,'aluno').replace(/\bdireitos\b/g,'direito').replace(/\bdeveres\b/g,'dever');const useful=new Set(extrairTermosUteis(n));return n.split(/\s+/).filter(t=>useful.has(t));};
 const ignored=new Set(['preciso','necessarios','necessario','poderia','saber','exigida','qual','quais','faco','solicitar']);
 const rows=documentos.filter(d=>d.ativo===true).map(doc=>({doc,body:tokens(doc.conteudo),title:tokens(doc.titulo+' '+doc.secao)}));
 const average=rows.reduce((n,r)=>n+r.body.length,0)/Math.max(1,rows.length);
 return async pergunta=>{
  const plain=normalizarTexto(pergunta);
  // Norma geral não comprova catálogo local nem horário da secretaria.
  if(/quais.*cursos|cursos.*disponiveis|horario.*secretaria/.test(plain))return [];
  const query=tokens(pergunta).filter(t=>!ignored.has(t));
  if(!query.length)return [];
  const ranked=rows.map(row=>{
   let score=0,hits=0;
   for(const term of query){
    const freq=row.body.filter(t=>t===term).length;
    if(!freq)continue;
    hits++;
    const df=rows.filter(r=>r.body.includes(term)).length;
    const idf=Math.log(1+(rows.length-df+.5)/(df+.5));
    score+=idf*(freq*2.2)/(freq+1.2*(.25+.75*row.body.length/Math.max(average,1)));
    if(row.title.includes(term))score+=.25;
   }
   return {doc:row.doc,score,hits};
  }).filter(r=>r.hits>0).sort((a,b)=>b.score-a.score||a.doc.id.localeCompare(b.doc.id));
  const candidates=ranked.slice(0,15);
  // Cobertura lexical é uma regra de seleção, não probabilidade de confiança.
  return candidates.filter(r=>r.hits>=Math.min(2,query.length)||r.score>=candidates[0].score*.65).slice(0,5).map(r=>r.doc);
 };
}
