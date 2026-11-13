// Regressão local: requer a prévia em 127.0.0.1:4173 e Playwright já instalado.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(path.resolve(localizarPlaywright(),'package.json'))('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SYLVINHO_BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p))});
try {
const context=await browser.newContext();
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const checks=[];fs.mkdirSync('.cache/ui-review/responsive',{recursive:true});
async function visibleComposer(label){
 const result=await page.locator('#messageInput').evaluate(el=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return {top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight,hit:document.elementFromPoint(x,y)===el,horizontal:document.documentElement.scrollWidth<=innerWidth+1,scroll:document.scrollingElement.scrollTop};});
 assert.ok(result.top>=0&&result.bottom<=result.viewport+1&&result.height>=44&&result.hit&&result.horizontal,label+': '+JSON.stringify(result));
 checks.push(label);
}
for(const [width,height] of [[1903,945],[1440,900],[1366,650],[1280,600],[768,600],[390,700],[320,480],[390,360]]){
await page.setViewportSize({width,height});
for(const route of ['/Logado/Home/home.html','/Chat/chat.html']){
await page.goto('http://127.0.0.1:4173'+route);await page.waitForLoadState('networkidle');
assert.equal(await page.locator('.academic-demo-banner').count(),0);
await visibleComposer(route+' '+width+'x'+height+' inicial');
await page.locator('#messageInput').fill('Pergunta de teste');await page.locator('#messageInput').press('Enter');await page.waitForSelector('.copy-response');
await page.evaluate(()=>{const messages=document.querySelector('#messages');for(let i=0;i<30;i++){const row=document.createElement('article');row.className='message-row user';const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent='Mensagem longa fictícia '+i+' — conteúdo de teste para verificar rolagem independente. '.repeat(8);row.append(bubble);messages.append(row);}messages.scrollTop=messages.scrollHeight;});
await visibleComposer(route+' '+width+'x'+height+' 30 mensagens');
await page.locator('#messageInput').focus();await page.locator('#messageInput').fill('Texto com várias linhas\n'.repeat(7));await page.locator('#messageInput').dispatchEvent('input');
await visibleComposer(route+' '+width+'x'+height+' digitando');
if(route.includes('/Home/')&&width<=720){
 await page.locator('.mobile-menu-toggle').click();
 assert.equal(await page.locator('.mobile-menu-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('main').evaluate(el=>el.inert),true,'O fundo não recebe foco enquanto a gaveta está aberta');
 assert.equal(await page.locator('.sidebar').getAttribute('aria-modal'),'true');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.mobile-menu-toggle').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
 await visibleComposer(route+' '+width+'x'+height+' menu fechado após Escape');
}
if((width===1903||width===390)&&height>=700)await page.screenshot({path:'.cache/ui-review/responsive/'+(route.includes('/Home/')?'home':'publico')+'-'+width+'.png'});
}
}
assert.deepEqual(errors,[]);fs.writeFileSync('.cache/ui-review/responsive/result.json',JSON.stringify({checks,pageErrors:errors},null,2));console.log(JSON.stringify({passed:checks.length,pageErrors:errors}));} finally { await browser.close(); }
