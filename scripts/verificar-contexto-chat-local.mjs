// Cenários de esclarecimento e falta de informação: não exigem chamadas Gemini.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(resolve(localizarPlaywright(),'package.json'))('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const result={data:new Date().toISOString(),mensagens:[],pageErrors:[],tipo:'esclarecimentos e informação pendente no servidor local'};
try{
 const page=await browser.newPage();page.on('pageerror',e=>result.pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:5000/Logado/Home/home.html');
 await page.waitForFunction(()=>globalThis.__LOCAL_E2E__&&document.querySelector('#messageInput')?.disabled===false);
 for(const [pergunta,esperado,proibido] of [
  ['Como faço a matrícula?',/matrícula inicial ou renovar/,/Não consegui/],
  ['onde entrego?',/Secretaria confirma/,/presencialmente|NSA/],
  ['quais documentos para renovação?',/Secretaria confirma/,/3x4|CPF/],
  ['e qual o prazo em 2027?',/Secretaria confirma/,/2026|15 a 21/],
  ['e no meu curso?',/Qual é o seu curso/,/Enfermagem|Mecatrônica/],
 ]){
  const count=await page.locator('.message-row.bot').count();
  await page.locator('#messageInput').fill(pergunta);
  await page.locator('#messageForm [type=submit]').click();
  await page.waitForFunction(n=>document.querySelectorAll('.message-row.bot').length===n&&document.querySelector('#chatStatus').textContent==='Conversa atualizada.',count+1);
  const texto=await page.locator('.message-row.bot .bubble').last().innerText();assert.match(texto,esperado);assert.doesNotMatch(texto,proibido);result.mensagens.push({pergunta,texto});
 }
 assert.deepEqual(result.pageErrors,[]);result.success=true;
}catch(e){result.success=false;result.erro=e.message;process.exitCode=1;}
finally{writeFileSync('.cache/curadoria-sylvinho/contexto-navegador.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
