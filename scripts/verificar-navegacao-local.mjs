// Navegação nativa na prévia: mede desde a primeira pintura, com ui.js atrasado.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(path.resolve(localizarPlaywright(),'package.json'))('playwright');
const executablePath=process.env.SYLVINHO_BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,executablePath});
const out='.cache/navigation-review';fs.mkdirSync(out,{recursive:true});
const routes=['Home/home.html','Conversas/conversas.html','Avisos/avisos.html','Serviços/servicos.html','Configurações Aluno/configAl.html','Configurações Administrador/configAdmin.html'];
const checks=[],errors=[];
try{
 for(const collapsed of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(value=>{
   if(localStorage.getItem('sylvinho:sidebar-collapsed')===null)localStorage.setItem('sylvinho:sidebar-collapsed',String(value));
   window.shellFrames=[];
   window.nativeTransition=false;
   window.addEventListener('pagereveal',event=>{window.nativeTransition=Boolean(event.viewTransition);});
   const start=performance.now();
   function frame(){
    const s=document.querySelector('.sidebar'),m=document.querySelector('main');
    if(s&&m)window.shellFrames.push({t:performance.now()-start,width:s.getBoundingClientRect().width,left:m.getBoundingClientRect().left,firstLink:s.querySelector('nav a')?.getBoundingClientRect().top,entryAnimation:getComputedStyle(m).animationName});
    if(performance.now()-start<1000)requestAnimationFrame(frame);
   }
   requestAnimationFrame(frame);
  },collapsed);
  const page=await context.newPage();page.on('pageerror',e=>errors.push({message:e.message,url:page.url(),stack:e.stack}));
  await page.route('**/ui.js',async route=>{await new Promise(done=>setTimeout(done,250));await route.continue();});
  for(const route of routes){
   await page.goto('http://127.0.0.1:4173/Logado/'+route);await page.waitForTimeout(350);
   const frames=await page.evaluate(()=>window.shellFrames);
   assert.ok(frames.length>2);
   assert.ok(frames.every(f=>Math.abs(f.width-(collapsed?76:196))<.5),route+' largura oscila');
   assert.ok(frames.every(f=>Math.abs(f.left-(collapsed?76:196))<.5),route+' conteúdo salta');
   assert.ok(frames.every(f=>f.entryAnimation==='none'),route+' entrada duplicada');
   assert.ok(Math.max(...frames.map(f=>f.firstLink))-Math.min(...frames.map(f=>f.firstLink))<.5,route+' menu salta verticalmente');
   assert.equal(await page.locator('.sidebar nav .nav-label').count(),5,'Sem rótulos duplicados');
   checks.push({route,collapsed,frames});
  }
  await page.goto('http://127.0.0.1:4173/Logado/Home/home.html');await page.waitForLoadState('networkidle');
  await page.locator('.sidebar nav a').nth(1).click();await page.waitForURL('**/Conversas/conversas.html');await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>window.nativeTransition),true,'Transição entre documentos realmente iniciada');
  await page.goBack();await page.waitForURL('**/Home/home.html');await page.waitForLoadState('networkidle');await page.waitForTimeout(350);
  await page.goForward();await page.waitForURL('**/Conversas/conversas.html');await page.waitForLoadState('networkidle');await page.waitForTimeout(350);
  assert.equal(await page.locator('.sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().width)),collapsed?76:196);
  const current=page.url();await page.waitForTimeout(700);assert.equal(page.url(),current,'Sem navegação automática');
  // O Voltar restaura um documento antigo, mas deve usar a preferência atual.
  await page.locator('.sidebar-collapse').click();
  await page.waitForFunction(width=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-width)<.5,collapsed?196:76);
  await page.goBack();await page.waitForLoadState('networkidle');await page.waitForTimeout(350);
  assert.equal(await page.locator('.sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().width)),collapsed?196:76);
  await page.screenshot({path:out+`/desktop-${collapsed?'expandido':'recolhido'}.png`});
  await context.close();
 }
 const reduced=await browser.newContext({reducedMotion:'reduce'});const rp=await reduced.newPage();await rp.goto('http://127.0.0.1:4173/Logado/Home/home.html');
 const optIn=await rp.evaluate(()=>[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch{return []}}).filter(r=>r.conditionText?.includes('prefers-reduced-motion: no-preference')).map(r=>({condition:r.conditionText,matches:matchMedia(r.conditionText).matches,text:r.cssText})).filter(r=>r.text.includes('@view-transition')));
 assert.ok(optIn.length&&optIn.every(r=>!r.matches),'Movimento reduzido não habilita transições entre páginas');
 await reduced.close();
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const np=await noJs.newPage();await np.goto('http://127.0.0.1:4173/Logado/Home/home.html');
 assert.equal(await np.locator('.sidebar nav a').first().isVisible(),true);await noJs.close();
 const failedUi=await browser.newContext({viewport:{width:390,height:844}});const fp=await failedUi.newPage();await fp.route('**/ui.js',r=>r.abort());await fp.goto('http://127.0.0.1:4173/Logado/Home/home.html');await fp.waitForLoadState('load');
 assert.equal(await fp.locator('html').evaluate(el=>el.classList.contains('shell-ready')),false);assert.equal(await fp.locator('.sidebar nav a').first().isVisible(),true);await failedUi.close();
 fs.writeFileSync(out+'/result.json',JSON.stringify({checks,errors,nativeBackForward:true,preferenceAfterBack:true,reducedMotion:true,noJs:true,uiFailureFallback:true},null,2));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({earlyPaintChecks:checks.length,nativeBackForward:true,preferenceAfterBack:true,reducedMotion:true,noJs:true,uiFailureFallback:true,errors}));
}finally{await browser.close();}
