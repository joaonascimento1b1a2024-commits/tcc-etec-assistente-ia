// Composição exclusivamente local. Não altera flags/aprovações de produção.
import {selecionarDocumentosRelevantes} from '../functions/lib/rag/recuperacao.js';
import {criarClienteGemini} from '../functions/lib/assistente/geracao/gemini.js';
import {avaliarGeracao} from '../functions/lib/assistente/geracao/contrato.js';
import {motivoTextoBloqueado} from '../functions/lib/assistente/fundamentacao/contrato.js';
import {criarBuscaLocal} from './busca-local.mjs';
import {VOZ_SYLVINHO} from './conversa-natural.mjs';
const INSUFICIENTE='Não encontrei informação suficiente nos documentos disponíveis para responder com segurança. Você pode esclarecer o procedimento ou consultar a Secretaria Acadêmica.';
export function criarRagGeminiReal({documentos,lerChave,modelo='gemini-3-flash-preview',transporte=fetch,registrar=()=>{},timeoutMs=30000}) {
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('TIMEOUT_INVALIDO');
 const corpus=documentos.filter(d=>d.ativo===true);
 let occupied=false;
 let windowStart=Date.now(),count=0;
 let cooldownUntil=0;
 const recuperar=criarBuscaLocal(corpus);
 let lastFailure='';
 const diagnose=(code,info={})=>{try{registrar(code,info);}catch{/* Telemetria não interrompe atendimento. */}};
 const client=criarClienteGemini(modelo,lerChave,async(url,init)=>{
  const body=JSON.parse(init.body);
  if(modelo==='gemini-2.5-flash')body.generationConfig.thinkingConfig={thinkingBudget:0};
  if(modelo==='gemini-3-flash-preview')body.generationConfig.thinkingConfig={thinkingLevel:'minimal'};
  const proposal=!!body.generationConfig.responseJsonSchema?.properties?.afirmacoes;
  if(proposal){body.systemInstruction.parts[0].text+='\n'+VOZ_SYLVINHO;if(modelo==='gemini-2.5-flash')body.generationConfig.temperature=.3;}
  const started=Date.now();
  try {
   const response=await transporte(url,{...init,body:JSON.stringify(body)});
   if(!response.ok)lastFailure='HTTP_'+response.status;
   if(response.status===429){const seconds=Number(response.headers?.get('retry-after'));cooldownUntil=Date.now()+Math.min(300,Math.max(30,Number.isFinite(seconds)?seconds:30))*1000;}
   diagnose('PROVEDOR_HTTP',{status:response.status,ms:Date.now()-started,etapa:proposal?'proposta':'validacao'});
   return response;
  }catch(error){lastFailure=init.signal?.aborted?'TIMEOUT':'REDE';diagnose('PROVEDOR_REDE',{ms:Date.now()-started});throw error;}
 });
 async function gerar(pergunta,chunks) {
  const started=Date.now();
  const event=(status)=>diagnose(status,{ms:Date.now()-started,trechos:chunks.length});
  if(motivoTextoBloqueado(pergunta)){event('ENTRADA_BLOQUEADA');return 'Reformule sua pergunta sobre o procedimento, sem nomes ou dados pessoais.';}
  if(!chunks.length){event('SEM_EVIDENCIA');
   if(/hor[aá]rio.*secretaria/i.test(pergunta))return 'Ainda não tenho um horário de atendimento da Secretaria Acadêmica confirmado nos documentos disponíveis. O horário geral da escola pode ser diferente do atendimento da secretaria.';
   if(/cursos/i.test(pergunta))return 'Ainda não tenho uma lista confirmada dos cursos oferecidos pela unidade neste período. Prefiro não indicar uma oferta que pode estar desatualizada.';
   return INSUFICIENTE;
  }
  // Somente trechos exatos do corpus público verificado, sem conteúdo do cliente.
  const selected=chunks.filter(c=>corpus.some(d=>d.id===c.id&&d.conteudo===c.conteudo)).slice(0,5);
  const contextos=selected.filter(c=>!motivoTextoBloqueado(c.conteudo,'documento'));
  const allowed=contextos.slice(0,2);
  if(!allowed.length){event('SEM_EVIDENCIA');return INSUFICIENTE;}
  if(Date.now()<cooldownUntil){event('PROVEDOR_EM_ESPERA');return 'O serviço de IA atingiu um limite de uso. Aguarde um pouco antes de tentar novamente; não vou repetir chamadas enquanto o serviço está em espera.';}
  if(occupied){event('OCUPADO');return 'O assistente está processando outra pergunta. Tente novamente em instantes.';}
  if(Date.now()-windowStart>=60000){windowStart=Date.now();count=0;}
  if(count>=5){event('LIMITE_LOCAL');return 'O limite de testes por minuto foi atingido. Aguarde um minuto para enviar outra pergunta.';}
  occupied=true;count++;lastFailure='';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
   const deadline=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('GEMINI_TIMEOUT')),{once:true}));
   const operation=async()=>{
   const evidencias=allowed.map((c,i)=>({id:'E'+(i+1),texto:c.conteudo,contexto:i}));
   const pedido={pergunta,contextos:contextos.map(c=>c.conteudo),evidencias,fontes:allowed.map(c=>({titulo:c.titulo,secao:c.secao,pagina:c.paginaInicial,formaExtracao:c.formaExtracao}))};
   if(!await client.moderar([pergunta,...pedido.contextos].join('\n\n'),controller.signal))throw Error('MODERACAO');
   // Síntese pode omitir números incidentais, nunca acrescentar novos valores.
   // A revisão semântica abaixo é obrigatória neste modo.
   const proposta=avaliarGeracao(await client.propor(pedido,controller.signal),evidencias,'sintese_revisada').proposta;
   if(!proposta?.afirmacoes.length)throw Error('PROPOSTA');
   if(!await client.verificar(pedido,proposta,controller.signal))throw Error('REVISAO');
   const natural=proposta.afirmacoes.map(a=>a.texto).join('\n\n');
   if(!await client.moderar(natural,controller.signal))throw Error('SAIDA');
   const cited=new Set(proposta.afirmacoes.flatMap(a=>a.referencias.map(r=>r.id)));
   const refs=allowed.filter((_,i)=>cited.has('E'+(i+1)));
   const sources=refs.map((c,i)=>`${i+1}. Trecho documental: "${c.conteudo}"\nFonte: ${c.titulo}; documento: ${c.documentoId}; trecho: ${c.id}; secao: ${c.secao.split(' > ').at(-1)}${c.paginaInicial?c.paginaFinal>c.paginaInicial?'; paginas '+c.paginaInicial+'-'+c.paginaFinal+' (intervalo do chunk)':'; pagina '+c.paginaInicial:''}.`).join('\n\n');
   const result='Resposta gerada por IA; confira as fontes oficiais.\n\n'+natural+'\n\nTrechos documentais relacionados a pergunta (citacoes, nao uma interpretacao ou garantia de regra vigente):\n\n'+sources;
   if(result.length>2400)throw Error('LIMITE_SAIDA');
   controller.signal.throwIfAborted();
   event('GERADA_GEMINI_RAG');return result;
   };
   return await Promise.race([operation(),deadline]);
  } catch(error) {
   const reasons=new Set(['MODERACAO','PROPOSTA','REVISAO','SAIDA','LIMITE_SAIDA','GEMINI_INDISPONIVEL']);
   event(controller.signal.aborted?'GEMINI_TIMEOUT':lastFailure|| (reasons.has(error?.message)?error.message:'GEMINI_NAO_VALIDADO'));
   if(lastFailure==='HTTP_429')return 'Estou recebendo muitas solicitações neste momento. Aguarde um pouco e tente novamente. Sua pergunta ficou salva nesta conversa.';
   if(controller.signal.aborted)return 'A resposta demorou mais do que o esperado. Sua pergunta ficou salva. Você pode tentar novamente em instantes.';
   return 'Não consegui concluir uma resposta confiável agora. Sua pergunta ficou salva nesta conversa. Tente novamente em instantes.';
  } finally {clearTimeout(timer);occupied=false;}
 }
 return {recuperarConhecimento:recuperar,gerarResposta:gerar};
}
