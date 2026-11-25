// Smoke somente GET/OPTIONS: não autentica, grava conversas ou chama o modelo.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
// VERIFICAÇÃO DA PUBLICAÇÃO (smoke test): depois de publicar, confere com GET e OPTIONS que o servidor
// responde, que o site publicado tem os arquivos certos e que o CORS aceita os domínios oficiais. Não faz
// login, não grava conversas e não chama a IA.
const ORIGENS=['https://sylvinho.web.app','https://sylvinho.firebaseapp.com','https://tcc-ia-d8891.web.app','https://tcc-ia-d8891.firebaseapp.com'];
const BACKEND='https://sylvinho-backend-poc.onrender.com';
export async function verificarPublicacao({origem=ORIGENS[0],fetchImpl=fetch}={}){
 if(!ORIGENS.includes(origem))throw Error('ORIGEM_DE_TESTE_INVALIDA');
 const verificacoes=[];
 async function checar(nome,url,options,validar){
  const inicio=Date.now();
  try{const r=await fetchImpl(url,{...options,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
   const dados=await validar(r);verificacoes.push({nome,status:r.status,ms:Date.now()-inicio,...dados});
  }catch(e){verificacoes.push({nome,ok:false,ms:Date.now()-inicio,codigo:e.name==='TimeoutError'?'TEMPO_EXCEDIDO':'FALHA_DE_REDE'});}
 }
 await checar('backend-health',BACKEND+'/health',{},async r=>({ok:r.status===200}));
 await checar('sobre-publicado',origem+'/',{},async r=>({ok:r.status===200&&/href=["']Sobre\/sobre\.html["'][^>]*>Sobre</.test(await r.text())}));
 await checar('dominio-no-cliente',origem+'/Logado/Home/assistente-config.js',{},async r=>{
  const codigo=await r.text(),lista=codigo.match(/origensPublicadasAssistente\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1]||'';
  return {ok:r.status===200&&[...lista.matchAll(/['"]([^'"]+)['"]/g)].some(m=>m[1]===origem)};
 });
 await checar('favicon',origem+'/favicon.svg',{},async r=>({ok:r.status===200&&(r.headers.get('content-type')||'').includes('image/svg+xml')}));
 for(const path of ['/perguntarAssistente','/perguntarVisitante'])await checar('cors'+path,BACKEND+path,{method:'OPTIONS',headers:{Origin:origem,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}},async r=>({ok:r.status===204&&r.headers.get('access-control-allow-origin')===origem,origemRetornada:r.headers.get('access-control-allow-origin')}));
 return {data:new Date().toISOString(),origem,backend:BACKEND,ok:verificacoes.every(x=>x.ok),verificacoes,limite:'Não valida autenticação, conteúdo factual ou revisão do motor do backend.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const argumentos=process.argv.slice(2);
 if(argumentos.some(a=>!a.startsWith('--origem='))||argumentos.length>1)throw Error('ARGUMENTOS_INVALIDOS');
 const resultado=await verificarPublicacao({origem:argumentos[0]?.slice('--origem='.length)});
 mkdirSync('.cache/correcao-publicacao-2026-11-16',{recursive:true});
 writeFileSync('.cache/correcao-publicacao-2026-11-16/smoke-publicado.json',JSON.stringify(resultado,null,2));
 console.log(JSON.stringify(resultado,null,2));if(!resultado.ok)process.exitCode=1;
}
