import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {criarBuscaLocal} from '../local-e2e/busca-local.mjs';
import {escopoNatural} from '../local-e2e/conversa-natural.mjs';
const docs=JSON.parse(readFileSync('.cache/chat-rag/base.json','utf8'));
const search=criarBuscaLocal(docs);
const questions=['Qual a frequência mínima?','Como é apurada a frequência?','O que acontece com as faltas?','Como faço a matrícula?','Como renovar minha matrícula?','Qual o período de matrícula?','Menor de idade precisa de representante?','Posso pedir transferência?','Como funciona o trancamento de matrícula?','Como funciona a avaliação?','O que é recuperação?','Como funciona o conselho de classe?','Quais são os direitos dos alunos?','Quais são os deveres dos alunos?','Como funciona o estágio?','Quais documentos preciso para matrícula?','Qual o horário da secretaria?','Quais cursos estão disponíveis?','oi','qual o valor de pi?','e quais documentos?','Como solicito meu diploma?','Como pedir histórico escolar?','Quero falar com um atendente'];
const results=[];
for(const pergunta of questions){const started=performance.now();const scope=escopoNatural(pergunta);const chunks=scope.resposta?[]:await search(pergunta);results.push({pergunta,categoria:scope.categoria,trechos:chunks.length,ids:chunks.map(c=>c.id),fontes:chunks.map(c=>({titulo:c.titulo,pagina:c.paginaInicial})),ms:Math.round((performance.now()-started)*100)/100});}
writeFileSync('.cache/chat-rag/avaliacao-busca.json',JSON.stringify({data:new Date().toISOString(),documentos:docs.length,resultados:results,nota:'Avaliação de recuperação e latência, não validação de respostas geradas.'},null,2));
console.log(JSON.stringify({perguntas:results.length,chunks:docs.length,tempoMedioMs:results.reduce((n,r)=>n+r.ms,0)/results.length,semTrechos:results.filter(r=>!r.trechos).map(r=>r.pergunta)}));
