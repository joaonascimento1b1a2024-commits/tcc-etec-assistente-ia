import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(resolve(localizarPlaywright(),'package.json'))('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const result={data:new Date().toISOString(),project:'demo-sylvinho-render-poc',mensagens:[],pageErrors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>result.pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:5000/Logado/Home/home.html');
 await page.waitForFunction(()=>document.querySelector('#messageInput')?.disabled===false);
 async function enviar(pergunta){
  const count=await page.locator('.message-row.bot').count();
  await page.locator('#messageInput').fill(pergunta);
  const start=Date.now();
  const wait=page.waitForResponse(r=>r.url().startsWith('http://127.0.0.1:5002/')&&r.request().method()==='POST'&&r.request().postDataJSON()?.pergunta===pergunta);
  await page.locator('#messageForm [type=submit]').click();
  const http=await wait;assert.equal(http.status(),200);
  const body=await http.json();
  await page.waitForFunction(n=>document.querySelectorAll('.message-row.bot').length===n,count+1,{timeout:45000});
  await page.waitForFunction(()=>!document.querySelector('#messageInput').disabled&&document.querySelector('#chatStatus').textContent==='Conversa atualizada.');
  result.mensagens.push({pergunta,resposta:body.resposta,ms:Date.now()-start});return {http,resposta:body.resposta};
 }
 const renovacao=await enviar('Como renovo a matrícula?');
 assert.match(renovacao.resposta,/15|quinze/i);assert.doesNotMatch(renovacao.resposta,/Não consegui concluir|MARCADOR_|Trecho documental/);
 const prazo=await enviar('e se eu perder o prazo?');assert.match(prazo.resposta,/Secretaria/i);assert.doesNotMatch(prazo.resposta,/Não consegui concluir/);
 const referencia=await enviar('qual o artigo?');assert.match(referencia.resposta,/art\. 67/);
 const pendente=await enviar('quanto é a camiseta?');assert.match(pendente.resposta,/Secretaria confirma/);assert.doesNotMatch(pendente.resposta,/R\$|50/);
 const antes=await page.locator('.message-row.bot').count();
 const token=await page.evaluate(async()=>{const {getAuth}=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');return getAuth().currentUser.getIdToken();});
 const replay=await fetch(prazo.http.url(),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:prazo.http.request().postData()});
 assert.equal((await replay.json()).resposta,prazo.resposta);
 result.replaySemDuplicacao=true;
 assert.equal((await fetch(prazo.http.url(),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);result.semTokenBloqueado=true;
 await page.reload();await page.waitForFunction(()=>document.querySelector('#messageInput')?.disabled===false);
 assert.equal(await page.locator('.message-row.bot').count(),antes);result.historicoPreservado=true;
 result.url=page.url();
 for(const [width,height] of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});
  const rect=await page.locator('#messageInput').boundingBox();assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=height+1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 result.compositorVisivelDesktopECelular=true;assert.deepEqual(result.pageErrors,[]);
 await page.screenshot({path:'.cache/curadoria-sylvinho/chat-curado-celular.png'});result.success=true;
}catch(e){result.success=false;result.erro=e.message;process.exitCode=1;}
finally{writeFileSync('.cache/curadoria-sylvinho/chat-curado-navegador.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
