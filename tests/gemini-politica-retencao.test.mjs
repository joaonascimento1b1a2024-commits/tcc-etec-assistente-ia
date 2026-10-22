import test from 'node:test';
import assert from 'node:assert/strict';
import {politicaRetencaoIA,criarGeradorConfiguravel} from '../functions/lib/assistente/geracao/gateway.js';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
import {pergunta,criarChunk} from './fixtures/fundamentacao-sintetica.mjs';

// Reconhecimentos/aprovacoes sinteticos apenas para exercitar bloqueios offline.
const demo={SYLVINHO_IA_ENABLED:'true',SYLVINHO_IA_PROVIDER:'gemini',
  SYLVINHO_IA_UID_ALLOWLIST:'adulto-sintetico',GEMINI_MODEL:'modelo-simulado',
  SYLVINHO_IA_GEMINI_MODALIDADE:'demonstracao_publica',
  SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA:'true',
  SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA:'true',
  SYLVINHO_IA_INSTITUCIONAL_APROVADA:'true',SYLVINHO_IA_PRIVACIDADE_APROVADA:'true',
  SYLVINHO_IA_MENORES_APROVADA:'true'};
const chunks=[criarChunk()];
for(const provider of ['openai','gemini']){
  for(const zdr of [undefined,'false','TRUE','1','true'])test(provider+' preserva gate ZDR: '+zdr,()=>{
    assert.equal(politicaRetencaoIA({SYLVINHO_IA_PROVIDER:provider,SYLVINHO_IA_ZDR_APROVADO:zdr}),zdr==='true'?'zdr':'bloqueada');
  });
}
for(const zdr of [undefined,'false','true'])test('demonstracao reconhece retencao sem atestar ZDR: '+zdr,()=>{
  assert.equal(politicaRetencaoIA({...demo,SYLVINHO_IA_ZDR_APROVADO:zdr}),'demonstracao_bloqueada_dados');
});
for(const reconhecimento of [undefined,'false','TRUE',''])test('reconhecimento ausente/invalido bloqueia: '+reconhecimento,()=>{
  assert.equal(politicaRetencaoIA({...demo,SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA:reconhecimento}),'bloqueada');
});
for(const modo of ['','demo','publica','desconhecida'])test('modalidade desconhecida nao usa ZDR como escape: '+modo,()=>{
  assert.equal(politicaRetencaoIA({...demo,SYLVINHO_IA_GEMINI_MODALIDADE:modo,SYLVINHO_IA_ZDR_APROVADO:'true'}),'bloqueada');
});
for(const zdr of [undefined,'true'])test('modo Gemini nunca dispensa ZDR OpenAI: '+zdr,()=>{
  assert.equal(politicaRetencaoIA({...demo,SYLVINHO_IA_PROVIDER:'openai',SYLVINHO_IA_ZDR_APROVADO:zdr}),zdr==='true'?'zdr':'bloqueada');
});
for(const [nome,q,cs] of [
 ['pergunta publica sintetica',pergunta,chunks],
 ['pessoa nao rotulada',pergunta+' Fale de Ana Silva.',chunks],
 ['email',pergunta+' pessoa@example.invalid',chunks],
 ['chunk pessoal',pergunta,[criarChunk('O certificado experimental utiliza papel violeta de laboratório para Ana Silva.')]],
 ['chunk confidencial',pergunta,[criarChunk(undefined,{titulo:'DOCUMENTO INTERNO CONFIDENCIAL'})]],
])test('demo nunca cria cliente/le chave: '+nome,async()=>{
 let criacoes=0,leituras=0;const eventos=[],env={...demo};
 Object.defineProperty(env,'GEMINI_API_KEY',{get(){leituras++;throw Error('NAO_LER');}});
 const gerar=criarGeradorConfiguravel({lerAmbiente:()=>env,registrarEvento:c=>eventos.push(c),criarClienteGemini(){criacoes++;throw Error('NAO_CRIAR');}});
 const r=await gerar(q,cs,{uid:'adulto-sintetico'});
 assert.equal(r,gerarRespostaDocumental(q,cs).resposta);
 assert.equal(criacoes,0);assert.equal(leituras,0);
 assert.equal(eventos.includes('GERADA'),false);
});
for(const flag of ['SYLVINHO_IA_ENABLED','SYLVINHO_IA_UID_ALLOWLIST',
 'SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA','SYLVINHO_IA_INSTITUCIONAL_APROVADA',
 'SYLVINHO_IA_PRIVACIDADE_APROVADA','SYLVINHO_IA_MENORES_APROVADA'])test('demo nao substitui aprovacao existente: '+flag,async()=>{
 let chamadas=0;const gerar=criarGeradorConfiguravel({lerAmbiente:()=>({...demo,[flag]:undefined}),criarClienteGemini(){chamadas++;throw Error('NAO_CRIAR');}});
 assert.equal(await gerar(pergunta,chunks,{uid:'adulto-sintetico'}),gerarRespostaDocumental(pergunta,chunks).resposta);
 assert.equal(chamadas,0);
});
test('sem configuracao nova mantem comportamento documental padrao',async()=>{
 assert.equal(politicaRetencaoIA({}),'bloqueada');
 assert.equal(await criarGeradorConfiguravel({lerAmbiente:()=>({})})(pergunta,chunks),gerarRespostaDocumental(pergunta,chunks).resposta);
});
