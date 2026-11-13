import {motivoTextoBloqueado} from '../functions/lib/assistente/fundamentacao/contrato.js';
export function criarGeminiSemRag({lerChave,modelo='gemini-3-flash-preview',transporte=fetch,registrar=()=>{}}) {
 let busy=false;
 return {recuperarConhecimento:async()=>[],async gerarResposta(pergunta) {
  if(motivoTextoBloqueado(pergunta))return 'Faça o teste sem nomes, documentos ou outros dados pessoais.';
  if(busy)return 'Estou preparando outra resposta. Tente novamente em instantes.';
  busy=true;const started=Date.now();
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
  try {
   const r=await transporte('https://generativelanguage.googleapis.com/v1beta/models/'+modelo+':generateContent',{
    method:'POST',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json','x-goog-api-key':lerChave()},
    body:JSON.stringify({systemInstruction:{parts:[{text:'Você é o Sylvinho em um teste experimental SEM RAG. Converse em português brasileiro acolhedor, direto e simples. Responda de forma breve e natural. Você não tem acesso aos documentos da escola: não invente contatos, normas, prazos ou procedimentos específicos da ETEC e não alegue consultar fontes. Explique essa limitação quando a pergunta depender de informações locais. Você pode responder dúvidas gerais. Não afirme executar serviços ou ações externas.'}]},contents:[{role:'user',parts:[{text:pergunta}]}],generationConfig:{maxOutputTokens:1024,thinkingConfig:{thinkingLevel:'minimal'}},safetySettings:['HATE_SPEECH','SEXUALLY_EXPLICIT','DANGEROUS_CONTENT','HARASSMENT'].map(c=>({category:'HARM_CATEGORY_'+c,threshold:'BLOCK_LOW_AND_ABOVE'}))}),
   });
   registrar('SEM_RAG_HTTP',{status:r.status,ms:Date.now()-started});
   if(r.status===429)return 'O Gemini atingiu um limite de uso. Aguarde antes de testar novamente.';
   if(!r.ok)throw Error('PROVEDOR');
   const reader=r.body.getReader();const parts=[];let size=0;
   try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error('LIMITE');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
   const data=JSON.parse(Buffer.concat(parts).toString('utf8'));
   const c=data.candidates?.[0];
   if(data.promptFeedback?.blockReason||c?.finishReason!=='STOP')throw Error('RESPOSTA');
   const answer=c.content?.parts?.filter(p=>p.thought!==true&&typeof p.text==='string').map(p=>p.text).join('').trim();
   if(!answer||answer.length>5000||c.safetyRatings?.some(s=>s.blocked))throw Error('RESPOSTA');
   return answer;
  }catch{return controller.signal.aborted?'A resposta demorou mais que o esperado. Tente novamente em instantes.':'Não consegui concluir a resposta agora. Tente novamente em instantes.';}
  finally{clearTimeout(timer);busy=false;}
 }};
}
