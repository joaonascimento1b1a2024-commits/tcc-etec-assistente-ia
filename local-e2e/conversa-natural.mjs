import {normalizarTexto} from '../functions/lib/rag/recuperacao.js';
import {classificarEscopo} from '../functions/lib/assistente/escopo.js';
import {identificarProcedimento} from '../functions/lib/assistente/intencao.js';
import {resolverContextoConversacional} from '../functions/lib/assistente/contexto-conversacional.js';
export function escopoNatural(texto) {
 const n=normalizarTexto(texto);
 if(/^(oi|ola|oie|oii|oir|ojo|bom dia|boa tarde|boa noite)( tudo bem)?$/.test(n))
  return {categoria:'social',resposta:'Oi! Sou o Sylvinho. Como posso ajudar você com as informações da escola?'};
 if(/^(obrigad[oa]|valeu|muito obrigad[oa])$/.test(n))return {categoria:'social',resposta:'Por nada! Se precisar de mais alguma informação, é só perguntar.'};
 if(/^(quero |preciso |posso )?(falar|conversar) com (um |uma |o |a )?(atendente|pessoa|secretaria)$/.test(n))
  return {categoria:'institucional',resposta:'Para atendimento humano, procure a Secretaria Acadêmica. Por aqui, posso ajudar você a encontrar as informações nos documentos da escola.'};
 if(/^(como (faco|fazer)( minha| a)? matricula|como faco para (fazer )?(a )?matricula)$/.test(n))
  return {categoria:'ambigua',resposta:'Você quer fazer a matrícula inicial ou renovar uma matrícula que já possui?'};
 if(/^(menor de idade precisa de representante|como funciona a avaliacao|quais sao os (direitos|deveres) dos alunos|o que acontece com as faltas)$/.test(n))return {categoria:'institucional'};
 const decision=classificarEscopo(texto);
 return decision.categoria==='ambigua'?{...decision,resposta:'Você quer saber sobre matrícula, documentos, cursos ou outro assunto da escola?'}:decision;
}
export function contextoNatural(pergunta,messageId,mensagens) {
 const n=normalizarTexto(pergunta).replace(/^e /,'');
 const position=mensagens.findIndex(m=>m?.remetente==='user'&&m.messageId===messageId);
 const previous=position>0?mensagens[position-1]:null;
 if(previous?.remetente==='bot'&&previous.texto==='Você quer fazer a matrícula inicial ou renovar uma matrícula que já possui?'){
  if(/^(renovar|renovacao|rematricula)$/.test(n))return {pergunta:'Como renovar a matrícula?'};
  if(/^(inicial|a inicial|primeira matricula)$/.test(n))return {pergunta:'Como fazer a matrícula inicial?'};
 }
 const intents=[[/^(qual (e )?o prazo|o prazo|quando posso pedir|quando posso solicitar|quanto tempo demora)$/,'Qual é o prazo para'],
 [/^(quais (os )?documentos( preciso( levar)?)?|documentos necessarios)$/,'Quais documentos são necessários para'],
 [/^(precisa de assinatura|quem assina)$/,'É necessária assinatura para'],
 [/^(onde (faco|solicito|peco)( isso)?|onde posso solicitar)$/,'Onde solicitar'],
 [/^(posso fazer (pela internet|online)|pode ser online)$/,'Como solicitar pela internet']];
 const intent=intents.find(([regex])=>regex.test(n));
 if(!intent)return resolverContextoConversacional(pergunta,messageId,mensagens);
 const current=mensagens.findIndex(m=>m?.remetente==='user'&&m.messageId===messageId);
 if(current<0)return {esclarecimento:'Você está perguntando sobre qual procedimento?'};
 let characters=0;
 for(let i=current-1;i>=Math.max(0,current-6);i--){
  const m=mensagens[i];characters+=(m?.texto||'').length;
  if(characters>4000)break;
  if(m?.remetente!=='user')continue;
  if(m.texto.length>700)break;
  if(escopoNatural(m.texto).categoria==='social')continue;
  const subject=identificarProcedimento(m.texto);
  if(subject)return {pergunta:`${intent[1]} ${subject}?`};
  if(intents.some(([regex])=>regex.test(normalizarTexto(m.texto).replace(/^e /,''))))continue;
  break;
 }
 return {esclarecimento:'Você quer saber isso sobre matrícula, renovação ou outro procedimento?'};
}
export const VOZ_SYLVINHO = `
Você é o Sylvinho, assistente da Secretaria da ETEC. Fale de forma acolhedora,
direta e em português simples, como um atendente atencioso. Responda diretamente
em uma ou duas frases primeiro; acrescente detalhes e próximo passo somente se
forem úteis e sustentados pelas evidências. Texto corrido por padrão; listas só
para passos ou documentos exigidos. Seja curto por padrão; aprofunde se solicitado.
Não comece toda frase com "De acordo com o documento". Não repita apresentação.
Não invente contatos nem etapas. A data mais recente não prova vigência.
Os exemplos abaixo ensinam ESTILO, não são fontes e não autorizam fatos:
- Pergunta ambígua: faça uma pergunta curta para distinguir os procedimentos.
- Fonte só informa o período: explique o período e diga que o passo a passo não
  foi localizado; nunca apresente informação de calendário como procedimento.
- Fonte informa condição: explique-a em linguagem simples sem perder exceções.
Sua saída deve continuar obedecendo ao JSON e às referências exigidas pelo sistema.
`;
