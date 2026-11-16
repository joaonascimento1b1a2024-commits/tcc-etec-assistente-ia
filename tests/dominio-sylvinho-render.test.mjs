import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {criarServidor}=require('../render-poc/server.cjs');
const {lerConfiguracaoDocumental}=require('../render-poc/documental.cjs');
const {OFFICIAL_ORIGINS,validarOrigensProducao}=require('../render-poc/producao.cjs');
const source=readFileSync('public/Logado/Home/assistente-config.js','utf8');
const config=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const novas=['https://sylvinho.web.app','https://sylvinho.firebaseapp.com'];
const env={RENDER:'true',NODE_ENV:'production',GCLOUD_PROJECT:'tcc-ia-d8891',FIRESTORE_DATABASE_ID:'(default)',SYLVINHO_DOCUMENTAL_ENABLED:'true',GOOGLE_APPLICATION_CREDENTIALS:'/etc/secrets/sylvinho-firebase-admin.json',SYLVINHO_SERVICE_ACCOUNT_EMAIL:'sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com'};
for(const origin of novas){
 test('domínio Hosting resolve as rotas Render: '+origin,()=>{
  assert.ok(OFFICIAL_ORIGINS.includes(origin));
  const c=config.resolverAssistenteConfig({origin,local:null});
  assert.equal(c.endpoint,'https://sylvinho-backend-poc.onrender.com/perguntarAssistente');
  assert.equal(c.endpoint.replace(/\/perguntarAssistente$/,'/perguntarVisitante'),'https://sylvinho-backend-poc.onrender.com/perguntarVisitante');
 });
 test('preflight das duas rotas aceita domínio novo sem inicializar IA: '+origin,async t=>{
  let dependencias=0;
  const server=criarServidor({config:lerConfiguracaoDocumental({...env,ASSISTENTE_CORS_ORIGINS:origin}),obterDependencias:()=>{dependencias++;throw Error('NAO_CARREGAR');}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  t.after(()=>new Promise(done=>{server.close(done);server.closeAllConnections();}));
  for(const path of ['/perguntarAssistente','/perguntarVisitante']){
   const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,authorization'}});
   assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);
   const bloqueado=await fetch('http://127.0.0.1:'+server.address().port+path,{method:'OPTIONS',headers:{Origin:'https://sylvinho.web.app.intruso.invalid','Access-Control-Request-Method':'POST'}});
   assert.equal(bloqueado.status,403);assert.equal(bloqueado.headers.get('access-control-allow-origin'),null);
  }
  assert.equal(dependencias,0);
 });
}
test('contrato de produção inclui domínios novos e antigos',()=>{
 assert.doesNotThrow(()=>validarOrigensProducao(OFFICIAL_ORIGINS.join(',')));
 assert.deepEqual(config.origensPublicadasAssistente,OFFICIAL_ORIGINS);
});
for(const origin of ['https://sylvinho.web.app.intruso.invalid','http://sylvinho.web.app','https://sylvinho.web.app:444'])test('domínio semelhante continua bloqueado: '+origin,()=>{
 assert.equal(config.resolverAssistenteConfig({origin,local:null}).endpoint,'');
 assert.throws(()=>lerConfiguracaoDocumental({...env,ASSISTENTE_CORS_ORIGINS:origin}),/CORS/);
});
