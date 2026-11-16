// Cache em RAM, segregado por conta. Somente o gerador pode incluir saídas validadas.
import {createHash} from 'node:crypto';
export function criarCacheRespostas({ttlMs=300000,maximo=128,agora=Date.now}={}){
 if(!Number.isInteger(ttlMs)||ttlMs<1||ttlMs>900000||!Number.isInteger(maximo)||maximo<1||maximo>512)throw Error('CACHE_CONFIG_INVALIDA');
 const itens=new Map();
 const chave=dados=>createHash('sha256').update(JSON.stringify(dados)).digest('hex');
 return {
  chave,
  obter(id){const item=itens.get(id);if(!item)return null;if(item.ate<=agora()){itens.delete(id);return null;}itens.delete(id);itens.set(id,item);return structuredClone(item.resposta);},
  guardar(id,resposta){
   if(resposta.tipo!=='gemini_curado'||!Array.isArray(resposta.ids)||!resposta.ids.length||resposta.retentavel)return;
   itens.delete(id);itens.set(id,{ate:agora()+ttlMs,resposta:structuredClone(resposta)});
   while(itens.size>maximo)itens.delete(itens.keys().next().value);
  },
 };
}
