import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='.cache/curadoria-sylvinho';mkdirSync(dir,{recursive:true});
const urls={contato:'https://etecmatao.cps.sp.gov.br/contato/',apm:'https://etecmatao.cps.sp.gov.br/apm/',cursos:'https://etecmatao.cps.sp.gov.br/cursos-etec/',tcc:'https://etecmatao.cps.sp.gov.br/trabalho-de-conclusao-de-curso-tcc/',vestibulinho:'https://vestibulinho.etec.sp.gov.br/calendario/'};
const proofs={};
for(const [id,url] of Object.entries(urls)){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP_'+r.status);
  const html=await r.text();const texto=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
  // Guarda apenas evidências públicas selecionadas; não guarda listas de alunos/pais.
  const termos=id==='contato'?['99637','99716','e103dir@','e103adm@','e103acad@','Cesário Mota','07:00']:id==='apm'?['e103apm@']:id==='tcc'?['120 (','Todos os TCCs']:id==='vestibulinho'?['10/11/2026','06/12/2026','11/01/2027']:['Técnico em Enfermagem','1902 hrs'];
  const excertos=termos.map(t=>{const i=texto.indexOf(t);return {termo:t,texto:i<0?null:texto.slice(Math.max(0,i-50),i+240)};});
  const geral=html.match(/href="(https:\/\/wa.me\/[^"]*991892181[^"]*)"/i)?.[1];
  proofs[id]={url,conferidoEm:new Date().toISOString(),coletaDeclaradaNosMateriais:'2026-11-11',sha256:createHash('sha256').update(html).digest('hex'),excertos,...(geral?{whatsappGeralLink:geral}:{}),ok:true};
 }catch(e){proofs[id]={url,ok:false,erro:e.message};}
}
writeFileSync(dir+'/conferencia-web.json',JSON.stringify(proofs,null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(proofs).map(([k,v])=>[k,{ok:v.ok,erro:v.erro,excertos:v.excertos?.map(x=>({termo:x.termo,encontrado:!!x.texto})),geral:!!v.whatsappGeralLink}]))));
