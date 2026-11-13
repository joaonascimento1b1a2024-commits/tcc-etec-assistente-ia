// Falhas de rede simuladas só nesta página de teste; servidor e usuários não são alterados.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(resolve(localizarPlaywright(),'package.json'))('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const result={data:new Date().toISOString(),falhasSimuladas:true,chamadasGemini:0,pageErrors:[]};
const endpoint='http://127.0.0.1:5002/demo-sylvinho-render-poc/southamerica-east1/perguntarAssistente';
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>result.pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:5000/Logado/Home/home.html');
 await page.waitForFunction(()=>document.querySelector('#messageInput')?.disabled===false);
 const envios=[];let primeira=true;
 await page.route(endpoint,async route=>{
  const body=route.request().postDataJSON();
  if(body?.pergunta!=='Quero falar com um atendente.')return route.continue();
  envios.push(body);
  if(primeira){primeira=false;return route.fulfill({status:503,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:5000'},body:JSON.stringify({codigo:'INDISPONIVEL',retryAfterSeconds:1,error:'Falha sintética de rede'})});}
  return route.continue();
 });
 await page.locator('#messageInput').fill('Quero falar com um atendente.');
 await page.locator('#messageForm [type=submit]').click();
 await page.locator('#retrySend').waitFor({state:'visible'});
 assert.equal(await page.locator('.message-row.bot').count(),0);
 assert.equal(await page.locator('.message-row.user').count(),1);
 assert.match(await page.locator('#chatStatus').innerText(),/temporariamente indisponível/);
 assert.doesNotMatch(await page.locator('#chatStatus').innerText(),/Secretaria confirma/);
 const uid=await page.evaluate(()=>globalThis.__LOCAL_E2E__.uid);
 const pendente=await page.evaluate(uid=>JSON.parse(sessionStorage.getItem('sylvinho:pendente:'+uid)),uid);
 assert.equal(pendente.aguardarNovaTentativa,true);
 for(const [width,height] of [[390,844],[320,640]]){
  await page.setViewportSize({width,height});
  const box=await page.locator('#messageInput').boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=height+1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.screenshot({path:'.cache/curadoria-sylvinho/retry-celular.png'});
 await page.reload();
 await page.locator('#retrySend').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('#messageInput').disabled);
 assert.equal(envios.length,1,'Recarregar não deve repetir uma falha técnica automaticamente');
 await page.waitForFunction(()=>!document.querySelector('#retrySend').disabled);
 await page.evaluate(()=>{document.querySelector('#retrySend').click();document.querySelector('#retrySend').click();});
 await page.waitForFunction(()=>document.querySelector('#chatStatus').textContent==='Conversa atualizada.');
 assert.equal(envios.length,2);
 assert.equal(envios[0].messageId,envios[1].messageId);
 assert.equal(envios[0].conversationId,envios[1].conversationId);
 assert.equal(await page.locator('.message-row.user').count(),1);
 assert.equal(await page.locator('.message-row.bot').count(),1);
 const contato=await page.locator('.message-row.bot .bubble').innerText();assert.match(contato,/Secretaria Acadêmica/);assert.match(contato,/99637-1226/);assert.doesNotMatch(contato,/Essa parte/);
 assert.equal(await page.locator('#retrySend').isVisible(),false);
 result.retryApos503SemDuplicacao=true;result.reloadAguardaAcaoManual=true;result.cliqueRepetidoBloqueado=true;result.contatoHumanoDireto=true;result.compositorVisivelCelular=true;
 await page.locator('#messageInput').fill('quanto é a camiseta?');await page.locator('#messageForm [type=submit]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.message-row.bot').length===2&&document.querySelector('#chatStatus').textContent==='Conversa atualizada.');
 assert.match(await page.locator('.message-row.bot .bubble').last().innerText(),/Secretaria confirma/);
 assert.equal(await page.locator('#retrySend').isVisible(),false);result.informacaoPendenteSemRetryTecnico=true;
 let perdeu=true;const recuperacoes=[];
 await page.route(endpoint,async route=>{
  const body=route.request().postDataJSON();if(body?.pergunta!=='Quero atendimento humano')return route.fallback();
  recuperacoes.push(body);
  if(perdeu){perdeu=false;const http=await route.fetch();assert.equal(http.status(),200);return route.abort('failed');}
  return route.continue();
 });
 await page.locator('#messageInput').fill('Quero atendimento humano');await page.locator('#messageForm [type=submit]').click();
 await page.locator('#retrySend').waitFor({state:'visible'});
 await page.locator('#retrySend').click();
 await page.waitForFunction(()=>document.querySelectorAll('.message-row.bot').length===3&&document.querySelector('#chatStatus').textContent==='Conversa atualizada.');
 assert.equal(recuperacoes.length,2);assert.equal(recuperacoes[0].messageId,recuperacoes[1].messageId);
 assert.equal(await page.locator('.message-row.user').count(),3);result.respostaPerdidaAposCommitRecuperada=true;
 assert.equal((await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#messageInput')?.disabled===false&&document.querySelectorAll('.message-row.bot').length===3);
 assert.equal(await page.locator('.message-row.bot').count(),3);assert.equal(await page.locator('.message-row.user').count(),3);
 assert.deepEqual(result.pageErrors,[]);result.success=true;
}catch(e){result.success=false;result.erro=e.message;result.estado=await page?.evaluate(()=>({url:location.href,status:document.querySelector('#chatStatus')?.textContent,bot:document.querySelectorAll('.message-row.bot').length,user:document.querySelectorAll('.message-row.user').length})).catch(()=>null);process.exitCode=1;}
finally{writeFileSync('.cache/curadoria-sylvinho/retry-navegador.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
