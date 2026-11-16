import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(resolve(localizarPlaywright(),'package.json'))('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const resultado={data:new Date().toISOString(),mensagens:[],erros:[],nota:'Fluxos determinísticos no navegador; geração real avaliada separadamente.'};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();
 });
 page.on('pageerror',e=>resultado.erros.push(e.message));
 await page.goto('http://127.0.0.1:5000/Logado/Home/home.html');
 await page.waitForFunction(()=>globalThis.__LOCAL_E2E__&&!document.querySelector('#messageInput').disabled,null,{timeout:15000});
 async function enviar(pergunta,esperado){
  const count=await page.locator('.message-row.bot').count();
  await page.locator('#messageInput').fill(pergunta);
  const resposta=page.waitForResponse(r=>r.url().startsWith('http://127.0.0.1:5002/')&&r.request().method()==='POST');
  await page.locator('#messageForm [type=submit]').click();
  const http=await resposta;assert.equal(http.status(),200);
  const body=await http.json();assert.match(body.resposta,esperado);
  await page.waitForFunction(n=>document.querySelectorAll('.message-row.bot').length===n,count+1);
  await page.waitForFunction(()=>!document.querySelector('#messageInput').disabled);
  resultado.mensagens.push({pergunta,resposta:body.resposta});
 }
 await enviar('Quando renovo a matrícula em 2026?',/Qual é o seu curso/);
 await enviar('Quanto custa a camiseta?',/Secretaria confirma/);
 const count=await page.locator('.message-row.bot').count();
 await page.reload();await page.waitForFunction(()=>globalThis.__LOCAL_E2E__&&document.querySelector('#chatStatus')?.textContent==='As mensagens são salvas na sua conta.'&&!document.querySelector('#messageInput').disabled);
 assert.equal(await page.locator('.message-row.bot').count(),count);resultado.historicoPreservado=true;
 for(const [width,height] of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const rect=await page.locator('#messageInput').boundingBox();assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=height+1);
 }
 resultado.desktopECelular=true;assert.deepEqual(resultado.erros,[]);resultado.sucesso=true;
 await page.screenshot({path:'.cache/ia-real-2026-11-16/navegador-mobile.png'});
}catch(e){resultado.sucesso=false;resultado.erro=e.message;process.exitCode=1;}
finally{writeFileSync('.cache/ia-real-2026-11-16/navegador.json',JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado,null,2));await browser.close();}
