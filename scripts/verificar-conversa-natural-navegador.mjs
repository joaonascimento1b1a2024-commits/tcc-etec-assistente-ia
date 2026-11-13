import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(resolve(localizarPlaywright(),'package.json'))('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5000/Logado/Home/home.html');
 await page.waitForFunction(()=>document.querySelector('#messageInput')?.disabled===false);
 let count=0;const checks=[];
 for(const [question,expected] of [['oir',/Oi! Sou o Sylvinho/],['Como faço a matrícula?',/inicial ou renovar/],['Quais cursos estão disponíveis?',/lista confirmada/],['Quero falar com um atendente',/atendimento humano/]]){
  await page.locator('#messageInput').fill(question);await page.locator('#messageForm button[type=submit]').click();count++;
  await page.waitForFunction(n=>document.querySelectorAll('.message-row.bot').length===n&&document.querySelector('#chatStatus')?.textContent==='Conversa atualizada.',count);
  assert.match(await page.locator('.message-row.bot .bubble').last().evaluate(el=>el.sylvinhoOriginalText),expected);checks.push(question);
 }
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'.cache/chat-rag/conversa-natural.png',fullPage:true});
 fs.writeFileSync('.cache/chat-rag/conversa-natural-navegador.json',JSON.stringify({data:new Date().toISOString(),checks,pageErrors:errors,nota:'Fluxos locais sem chamadas Gemini; geração real depende da cota externa.'},null,2));
 console.log(JSON.stringify({passed:checks.length,pageErrors:errors}));
}finally{await browser.close();}
