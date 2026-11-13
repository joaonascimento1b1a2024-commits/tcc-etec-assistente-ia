import {textoIndice,hashIndice} from './curadoria-local.mjs';
export function criarEmbeddings({lerChave,modelo=process.env.SYLVINHO_EMBEDDING_MODEL||'gemini-embedding-001',transporte=fetch}){
 if(!/^gemini-embedding-[a-z0-9.-]+$/.test(modelo))throw Error('MODELO_INVALIDO');
 const model='models/'+modelo;
 async function lote(textos,tipo){
  if(!Array.isArray(textos)||!textos.length||textos.length>100||textos.some(x=>typeof x!=='string'||x.length>6000))throw Error('LOTE_INVALIDO');
  const key=lerChave();if(!key)throw Error('CHAVE_AUSENTE');
  const r=await transporte('https://generativelanguage.googleapis.com/v1beta/'+model+':batchEmbedContents',{method:'POST',redirect:'error',headers:{'x-goog-api-key':key,'content-type':'application/json'},body:JSON.stringify({requests:textos.map(text=>({model,content:{parts:[{text}]},taskType:tipo,outputDimensionality:768}))}),signal:AbortSignal.timeout(6000)});
  if(!r.ok)throw Error('HTTP_'+r.status);
  const data=await r.json(),vs=data.embeddings?.map(x=>x.values);
  if(vs?.length!==textos.length||vs.some(v=>!Array.isArray(v)||v.length!==768||!v.every(Number.isFinite)||!v.some(x=>x!==0)))throw Error('VETOR_INVALIDO');
  return vs;
 }
 return {modelo,lote,indexar:async registros=>{const vs=await lote(registros.map(textoIndice),'RETRIEVAL_DOCUMENT');return {modelo,dimensoes:768,hash:hashIndice(registros),valores:Object.fromEntries(registros.map((r,i)=>[r.id,vs[i]]))};},consulta:async p=>(await lote([p],'RETRIEVAL_QUERY'))[0]};
}
