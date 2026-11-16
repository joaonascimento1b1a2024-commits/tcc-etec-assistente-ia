export class ErroFilaCurada extends Error {
 constructor(codigo){super(codigo);this.name='ErroFilaCurada';this.codigo=codigo;}
}

// Também interrompe o await de um transporte de teste que ignore o signal.
// A operação original recebe handlers, mas não pode continuar o fluxo após abort.
export function aguardarComSinal(operacao,signal){
 if(!signal)return Promise.resolve(operacao);
 return new Promise((resolve,reject)=>{
  const abortar=()=>{signal.removeEventListener('abort',abortar);reject(new ErroFilaCurada('CANCELADO'));};
  if(signal.aborted){Promise.resolve(operacao).catch(()=>{});abortar();return;}
  signal.addEventListener('abort',abortar,{once:true});
  Promise.resolve(operacao).then(value=>{signal.removeEventListener('abort',abortar);resolve(value);},error=>{signal.removeEventListener('abort',abortar);reject(error);});
 });
}

// Limites desta instância/processo, não um limitador distribuído de produção.
export function criarControleConcorrencia({maxConcorrentes=2,maxFila=4,esperaFilaMs=3000}={}){
 if(!Number.isInteger(maxConcorrentes)||maxConcorrentes<1||maxConcorrentes>8||!Number.isInteger(maxFila)||maxFila<0||maxFila>32||!Number.isInteger(esperaFilaMs)||esperaFilaMs<1||esperaFilaMs>10000)throw Error('CONCORRENCIA_CONFIG_INVALIDA');
 const contas=new Set(),fila=[];let ativos=0;
 const conceder=(chave,resolve)=>{
  ativos++;contas.add(chave);let liberado=false;
  resolve(()=>{if(liberado)return;liberado=true;ativos--;contas.delete(chave);drenar();});
 };
 const drenar=()=>{
  while(ativos<maxConcorrentes&&fila.length){const item=fila.shift();item.limpar();conceder(item.chave,item.resolve);}
 };
 return {
  estado:()=>({ativos,naFila:fila.length}),
  adquirir(chave,{signal}={}){
   if(signal?.aborted)return Promise.reject(new ErroFilaCurada('CANCELADO'));
   if(contas.has(chave))return Promise.reject(new ErroFilaCurada('CONTA_OCUPADA'));
   if(ativos<maxConcorrentes&&!fila.length)return new Promise(resolve=>conceder(chave,resolve));
   if(fila.length>=maxFila)return Promise.reject(new ErroFilaCurada('FILA_CHEIA'));
   return new Promise((resolve,reject)=>{
    contas.add(chave);
    const remover=codigo=>{const index=fila.indexOf(item);if(index<0)return;fila.splice(index,1);item.limpar();contas.delete(chave);reject(new ErroFilaCurada(codigo));drenar();};
    const abortar=()=>remover('CANCELADO');
    const timer=setTimeout(()=>remover('FILA_ESPERA_EXCEDIDA'),esperaFilaMs);
    const item={chave,resolve,limpar(){clearTimeout(timer);signal?.removeEventListener('abort',abortar);}};
    fila.push(item);signal?.addEventListener('abort',abortar,{once:true});
   });
  },
 };
}
