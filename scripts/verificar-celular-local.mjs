// Emulação mobile e contrato de VisualViewport; não reproduz teclado físico.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium,webkit}=createRequire(path.resolve(localizarPlaywright(),'package.json'))('playwright');
const executablePath=process.env.SYLVINHO_BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const engines=[['chromium',chromium,{executablePath}]];
if(fs.existsSync(webkit.executablePath()))engines.push(['webkit',webkit,{}]);
const out='.cache/mobile-continuacao-2026-11-12';fs.mkdirSync(out,{recursive:true});
const checks=[],failures=[],errors=[];
for(const [name,engine,options]of engines){
 const browser=await engine.launch({headless:true,...options});
 try{
  const context=await browser.newContext({isMobile:true,hasTouch:true,deviceScaleFactor:3});
  // Distingue redução da janela visual de simples resize da janela de layout.
  await context.addInitScript(()=>{
   const viewport=new EventTarget();
   Object.assign(viewport,{height:innerHeight,width:innerWidth,scale:1,offsetTop:0,offsetLeft:0});
   Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push({engine:name,error:e.message}));
  for(const [width,height,keyboardHeight]of [[320,568,280],[390,844,360],[430,932,400],[844,390,240]]){
   await page.setViewportSize({width,height});
   for(const route of ['/Logado/Home/home.html','/Chat/chat.html']){
    const label=`${name} ${route} ${width}x${height}`;
    try{
     await page.goto('http://127.0.0.1:4173'+route);await page.waitForLoadState('networkidle');
     await page.locator('#messageInput').fill('Mensagem móvel fictícia');
     await page.locator('#messageInput').press('Enter');await page.waitForSelector('.copy-response');
     await page.evaluate(h=>{window.visualViewport.height=h;window.visualViewport.dispatchEvent(new Event('resize'));},keyboardHeight);
     await page.waitForTimeout(60);
     const composer=await page.locator('#messageInput').evaluate(el=>{const r=el.getBoundingClientRect();const send=document.querySelector('#messageForm button[type=submit]').getBoundingClientRect();return {bottom:r.bottom,top:r.top,font:parseFloat(getComputedStyle(el).fontSize),sendWidth:send.width,sendHeight:send.height,viewport:visualViewport.height,overflow:document.documentElement.scrollWidth>innerWidth+1,bodyHeight:document.body.getBoundingClientRect().height};});
     assert.ok(composer.bottom<=keyboardHeight+1&&composer.top>=0,JSON.stringify(composer));
     assert.ok(composer.sendWidth>=44&&composer.sendHeight>=44,'Área de toque do envio: '+JSON.stringify(composer));
     assert.ok(composer.font>=16&&!composer.overflow);
     if(route.includes('/Home/')&&width<=720){
      await page.locator('.mobile-menu-toggle').click();
      await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left)<1);
      const drawer=await page.locator('.sidebar').evaluate(el=>({height:el.getBoundingClientRect().height,active:el.contains(document.activeElement)}));
      assert.ok(drawer.height<=keyboardHeight+1&&drawer.active,'Gaveta respeita a altura útil: '+JSON.stringify(drawer));
      await page.locator('.sidebar-collapse').focus();
      const close=await page.locator('.sidebar-collapse').boundingBox();
      assert.ok(close.y>=0&&close.y+close.height<=keyboardHeight+1,'Fechar menu acessível com teclado aberto');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
     }
     await page.locator('#messageInput').fill('Linha de teste\n'.repeat(12));
     const multiline=await page.locator('#messageInput').evaluate(el=>{const r=el.getBoundingClientRect();return {bottom:r.bottom,top:r.top};});
     assert.ok(multiline.bottom<=keyboardHeight+1&&multiline.top>=0);
     assert.ok(multiline.bottom-multiline.top<=Math.max(50,keyboardHeight*.24)+1,'Texto multilinha respeita a altura útil');
     const typed=await page.locator('#messageInput').inputValue();
     await page.screenshot({path:`${out}/${name}-${route.includes('/Home/')?'home':'publico'}-${width}-teclado-simulado.png`});
     await page.evaluate(()=>{window.visualViewport.scale=2;window.visualViewport.dispatchEvent(new Event('resize'));});
     await page.waitForTimeout(60);
     assert.equal(await page.locator('body').evaluate(el=>el.style.getPropertyValue('--chat-viewport-height')),'','Pinch zoom mantém comportamento nativo');
     await page.evaluate(h=>{window.visualViewport.scale=1;window.visualViewport.height=h;window.visualViewport.dispatchEvent(new Event('resize'));},height);
     await page.waitForTimeout(60);
     assert.equal(await page.locator('#messageInput').inputValue(),typed,'Abrir/fechar teclado preserva o rascunho');
     if(route==='/Chat/chat.html')assert.equal(await page.locator('.guest-header').isVisible(),true,'Cabeçalho volta ao fechar teclado');
     await page.screenshot({path:`${out}/${name}-${route.includes('/Home/')?'home':'publico'}-${width}.png`});
     checks.push({label,composer,multiline});
    }catch(e){failures.push({label,error:e.message});}
   }
  }
 }finally{await browser.close();}
}
fs.writeFileSync(out+'/result.json',JSON.stringify({checks,failures,errors,engines:engines.map(e=>e[0]),physicalDevice:false},null,2));
console.log(JSON.stringify({passed:checks.length,failures,errors,engines:engines.map(e=>e[0]),physicalDevice:false}));
assert.equal(failures.length,0);assert.equal(errors.length,0);
