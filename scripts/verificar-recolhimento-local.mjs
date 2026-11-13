// Somente a prévia com fixtures. Não chama IA nem serviços de produção.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(path.resolve(localizarPlaywright(),'package.json'))('playwright');
const executablePath=process.env.SYLVINHO_BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,executablePath});
const out='.cache/sidebar-continuacao-2026-11-12';
fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 for(const reducedMotion of ['no-preference','reduce']){
  await page.emulateMedia({reducedMotion});
  await page.goto('http://127.0.0.1:4173/Logado/Home/home.html');
  await page.waitForLoadState('networkidle');
  await page.evaluate(()=>{localStorage.removeItem('sylvinho:sidebar-collapsed');});
  await page.reload();await page.waitForLoadState('networkidle');
  const result=await page.evaluate(async()=>{
   const sidebar=document.querySelector('.sidebar'),main=document.querySelector('main');
   const frames=[];const start=performance.now();
   document.querySelector('.sidebar-collapse').click();
   await new Promise(resolve=>{
    function frame(now){
     const r=sidebar.getBoundingClientRect(),m=main.getBoundingClientRect();
     frames.push({ms:now-start,width:r.width,left:m.left,gap:m.left-r.right,overflow:document.documentElement.scrollWidth>innerWidth+1});
     if(now-start<260)requestAnimationFrame(frame);else resolve();
    }
    requestAnimationFrame(frame);
   });
   return frames;
  });
  assert.ok(result.every(f=>Math.abs(f.gap)<1&&!f.overflow),'Lateral e conteúdo permanecem alinhados');
  assert.ok(Math.abs(result.at(-1).width-76)<.5);
  if(reducedMotion==='no-preference')assert.ok(result.some(f=>f.width>77&&f.width<195),'Há posições intermediárias');
  else assert.ok(result.every(f=>Math.abs(f.width-76)<.5),'Movimento reduzido aplica estado imediatamente');
  checks.push({reducedMotion,frames:result});
 }
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.sidebar-collapse').click();
 await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-196)<.5);
 await page.screenshot({path:out+'/desktop-expandido.png'});
 // Cliques durante a transição devem terminar no estado da última ação.
 await page.evaluate(()=>{const button=document.querySelector('.sidebar-collapse');button.click();setTimeout(()=>button.click(),50);});
 await page.waitForTimeout(300);
 assert.equal(await page.locator('body').getAttribute('data-sidebar-collapsed'),'false');
 assert.equal(await page.locator('.sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().width)),196);
 await page.locator('.sidebar-collapse').click();
 await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-76)<.5);
 await page.screenshot({path:out+'/desktop-recolhido.png'});
 await page.setViewportSize({width:390,height:844});
 await page.locator('.mobile-menu-toggle').click();
 await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left)<1);
 await page.screenshot({path:out+'/gaveta-mobile.png'});
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/movimento.json',JSON.stringify({checks,errors,rapidToggle:true,mobileDrawer:true},null,2));
 console.log(JSON.stringify({motionModes:checks.length,rapidToggle:true,mobileDrawer:true,errors}));
}finally{await browser.close();}
