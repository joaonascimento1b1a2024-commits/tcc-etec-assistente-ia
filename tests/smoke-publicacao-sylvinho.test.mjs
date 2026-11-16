import test from 'node:test';
import assert from 'node:assert/strict';
import {verificarPublicacao} from '../scripts/verificar-publicacao-sylvinho.mjs';
function fixture({dominio=true,sobre=true,cors=204}={}){
 const chamadas=[];
 const fetchImpl=async(url,options)=>{
  chamadas.push({url,method:options.method||'GET'});
  if(options.method==='OPTIONS')return new Response(null,{status:cors,headers:cors===204?{'Access-Control-Allow-Origin':'https://sylvinho.web.app'}:{}});
  if(url.endsWith('/assistente-config.js'))return new Response("export const origensPublicadasAssistente = Object.freeze(['"+(dominio?'https://sylvinho.web.app':'https://tcc-ia-d8891.web.app')+"']);");
  if(url.endsWith('/favicon.svg'))return new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}});
  if(url.endsWith('/health'))return new Response('{}');
  return new Response('<a href="'+(sobre?'Sobre/sobre.html':'#sobre')+'">Sobre</a>');
 };
 return {fetchImpl,chamadas};
}
test('smoke aprova publicação alinhada sem POST ou geração',async()=>{
 const f=fixture(),r=await verificarPublicacao(f);assert.equal(r.ok,true);assert.equal(f.chamadas.length,6);assert.ok(f.chamadas.every(c=>['GET','OPTIONS'].includes(c.method)));
});
for(const [nome,options] of [['dominio-no-cliente',{dominio:false}],['sobre-publicado',{sobre:false}],['cors/perguntarVisitante',{cors:403}]])test('smoke reprova '+nome,async()=>{
 const r=await verificarPublicacao(fixture(options));assert.equal(r.ok,false);assert.equal(r.verificacoes.find(v=>v.nome===nome).ok,false);
});
test('smoke não aceita URL arbitrária',async()=>{
 await assert.rejects(verificarPublicacao({origem:'https://intruso.invalid',fetchImpl:()=>assert.fail('NÃO CHAMAR')}),/ORIGEM_DE_TESTE_INVALIDA/);
});
