import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(path.resolve(localizarPlaywright(),'package.json'))('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SYLVINHO_BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p))});
const sizes=[[1440,900],[1903,945],[2560,1080],[1024,768],[768,800],[390,844],[320,640]];
const checks=[];
fs.mkdirSync('.cache/landing-review/animacoes',{recursive:true});
try {
 for(const mode of ['normal','reduced','sem-js','sem-observer','falha-animate']) {
  const context=await browser.newContext({javaScriptEnabled:mode!=='sem-js',reducedMotion:mode==='reduced'?'reduce':'no-preference'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(mode==='sem-observer') await page.addInitScript(()=>{delete window.IntersectionObserver;});
  if(mode==='falha-animate') await page.addInitScript(()=>{Element.prototype.animate=()=>{throw new Error('Falha simulada');};});
  await page.addInitScript(()=>{
   window.motionCalls=[];
   const original=Element.prototype.animate;
   if(original) Element.prototype.animate=function(frames,options){window.motionCalls.push({frames,options});return original.call(this,frames,options);};
  });
  for(const [width,height] of sizes) {
   await page.setViewportSize({width,height});
   await page.goto('http://127.0.0.1:4173/');await page.waitForLoadState('networkidle');
   await page.evaluate(()=>document.fonts.ready);
   for(const selector of ['.benefit-panel','.resource-grid']) {
    await page.locator(selector).scrollIntoViewIfNeeded();await page.waitForTimeout(900);
    for(const card of await page.locator(selector+' article').all()) {
     const state=await card.evaluate(el=>({opacity:getComputedStyle(el).opacity,transform:getComputedStyle(el).transform,width:el.getBoundingClientRect().width}));
     assert.equal(state.opacity,'1',mode+' '+width);assert.equal(state.transform,'none');assert.ok(state.width>0);
    }
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)),[]);
   if(mode==='normal') {
    const calls=await page.evaluate(()=>window.motionCalls);
    assert.equal(calls.length,14,'9 cards + 5 ícones');
    assert.ok(calls.every(c=>Object.keys(c.frames[0]).every(key=>['opacity','transform'].includes(key))));
    assert.ok(calls.some(c=>c.options.delay===100));
    await page.locator('.resource-grid').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>window.motionCalls.length),14,'Executar uma vez');
    await page.screenshot({path:'.cache/landing-review/animacoes/'+width+'.png'});
   }
   if(mode==='reduced') assert.equal(await page.evaluate(()=>window.motionCalls.length),0);
   checks.push(mode+' '+width+'x'+height);
  }
  assert.deepEqual(errors,[]);
  await context.close();
 }
 // A preferência pode mudar enquanto um efeito está em execução.
 const page=await browser.newPage({reducedMotion:'no-preference'});
 await page.goto('http://127.0.0.1:4173/');await page.locator('.resource-grid').scrollIntoViewIfNeeded();
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 assert.equal(await page.locator('.resource-grid').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
 checks.push('Mudança de preferência cancela movimento');
 fs.writeFileSync('.cache/landing-review/animacoes/result.json',JSON.stringify({passed:checks.length,checks},null,2));
 console.log(JSON.stringify({passed:checks.length}));
} finally {await browser.close();}
