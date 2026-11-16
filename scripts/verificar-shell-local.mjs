// QA de interface sobre fixtures locais: não autentica nem consulta produção.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(path.resolve(localizarPlaywright(),'package.json'))('playwright');
const executablePath=process.env.SYLVINHO_BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,executablePath});
const out='.cache/shell-review';fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],requests=[];
const routes=['/Logado/Home/home.html','/Logado/Conversas/conversas.html','/Logado/Avisos/avisos.html','/Logado/Configurações Aluno/configAl.html','/Logado/Configurações Administrador/configAdmin.html','/Logado/Serviços/servicos.html'];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/'))requests.push(new URL(r.url()).origin)});
 const goto=async route=>{await page.goto('http://127.0.0.1:4173'+route);await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);};
 async function fits(label){const m=await page.evaluate(()=>{const input=document.querySelector('#messageInput'),r=input?.getBoundingClientRect(),profile=document.querySelector('#profileLink')?.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1,profileInViewport:profile?profile.right<=innerWidth+1:true,composer:r?{top:r.top,bottom:r.bottom,visible:r.top>=0&&r.bottom<=innerHeight+1}:null}});assert.equal(m.overflow,false,label);assert.equal(m.profileInViewport,true,label+' perfil cortado');if(m.composer)assert.equal(m.composer.visible,true,label+JSON.stringify(m));checks.push({label,...m});}
 async function drawerSettled(open){await page.waitForFunction(open=>{const r=document.querySelector('.sidebar').getBoundingClientRect();return open?Math.abs(r.left)<1:r.right<=0},open);}
 for(const [width,height]of[[320,640],[390,844],[768,800],[1440,900]]){
  await page.setViewportSize({width,height});
  for(const route of routes){await goto(route);await fits(route+' '+width);
   assert.equal(await page.locator('.sidebar nav a[aria-label]').count(),5);
   if(width<=720){
    assert.equal(await page.locator('.sidebar').evaluate(el=>el.inert),true);
    await page.locator('.mobile-menu-toggle').click();
    assert.equal(await page.locator('main').evaluate(el=>el.inert),true);
    assert.equal(await page.locator('.sidebar').getAttribute('aria-modal'),'true');
    assert.equal(await page.locator('.sidebar').evaluate(el=>el.contains(document.activeElement)),true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.sidebar').evaluate(el=>el.contains(document.activeElement)),true);
    await page.keyboard.press('Shift+Tab');await page.keyboard.press('Escape');
    assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
    assert.equal(await page.locator('.mobile-menu-toggle').evaluate(el=>el===document.activeElement),true);
    await page.locator('.mobile-menu-toggle').click();await page.locator('.sidebar-backdrop').click({position:{x:width-5,y:height/2}});
    assert.equal(await page.locator('.sidebar').evaluate(el=>el.inert),true);
   }else{
    await page.locator('.sidebar-collapse').click();
    await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-76)<.5);
    assert.equal(await page.locator('.sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().width)),76);
    assert.equal(await page.locator('.sidebar nav a').first().getAttribute('aria-label'),'Início');
    await fits(route+' '+width+' recolhido');
    await page.reload();await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('body').getAttribute('data-sidebar-collapsed'),'true');
    await page.locator('.sidebar-collapse').click();
    await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-196)<.5);
   }
  }
 }
 const publicRoutes=['/','/Sobre/sobre.html','/Login/login.html','/Criar-Conta/cadastro.html','/Criar-Conta/termos.html','/Criar-Conta/políticaPriv.html','/Chat/chat.html'];
 for(const [width,height]of[[320,640],[390,844],[768,800],[1440,900]]){
  await page.setViewportSize({width,height});
  for(const route of publicRoutes){await goto(route);await fits('pública '+route+' '+width);}
 }
 await page.setViewportSize({width:1440,height:900});await goto(routes[0]);
 await page.evaluate(()=>document.querySelectorAll('.sidebar nav a').forEach((link,i)=>link.classList.toggle('active',i===1)));
 await page.waitForFunction(()=>document.querySelectorAll('.sidebar nav [aria-current=page]').length===1&&document.querySelectorAll('.sidebar nav a')[1].getAttribute('aria-current')==='page');
 await page.evaluate(()=>document.querySelectorAll('.sidebar nav a').forEach((link,i)=>link.classList.toggle('active',i===0)));
 const nav=page.locator('.sidebar nav a').nth(1);
 const background=await nav.evaluate(el=>getComputedStyle(el).backgroundColor);
 await nav.hover();await page.waitForFunction(base=>getComputedStyle(document.querySelectorAll('.sidebar nav a')[1]).backgroundColor!==base,background);
 await page.locator('.new-chat').hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.new-chat'),'::after').opacity==='1');
 await page.mouse.move(1000,600);await page.screenshot({path:out+'/home-desktop.png'});
 await page.locator('.sidebar-collapse').click();await fits('desktop recolhido antes da captura');await page.screenshot({path:out+'/home-recolhido.png'});
 await page.setViewportSize({width:390,height:844});await drawerSettled(false);await fits('390 após redimensionar de menu recolhido');
 assert.equal(await page.locator('.profile-fallback').isVisible(),true);
 await page.screenshot({path:out+'/home-mobile.png'});
 await page.locator('.mobile-menu-toggle').click();await drawerSettled(true);await page.screenshot({path:out+'/menu-mobile.png'});await page.keyboard.press('Escape');await drawerSettled(false);
 await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
 await page.evaluate(()=>document.documentElement.dataset.theme='light');
 const motion=await page.locator('.sidebar').evaluate(el=>getComputedStyle(el).transitionDuration);
 assert.ok(motion.split(',').every(v=>parseFloat(v)===0),'Movimento reduzido');
 await fits('tema claro com movimento reduzido');await page.screenshot({path:out+'/home-mobile-claro.png'});
 await page.locator('#profileName').evaluate(el=>el.textContent='Estudante com nome de teste bastante extenso para conferir o cabeçalho');
 await fits('nome extenso no celular');
 await page.setViewportSize({width:390,height:360});await fits('altura reduzida simulando espaço de teclado');
 await page.locator('.mobile-menu-toggle').click();await drawerSettled(true);
 assert.equal(await page.locator('.sidebar').evaluate(el=>{const r=document.activeElement.getBoundingClientRect();return el.contains(document.activeElement)&&r.top>=0&&r.bottom<=innerHeight}),true,'O foco inicial da gaveta cabe em tela baixa');
 await page.locator('.sidebar').hover();await page.mouse.wheel(0,300);
 await page.waitForFunction(()=>document.querySelector('.sidebar').scrollTop>0);
 await page.keyboard.press('Escape');await drawerSettled(false);
 await context.close();
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 const fallback=await noJs.newPage();await fallback.goto('http://127.0.0.1:4173'+routes[0]);
 assert.equal(await fallback.locator('.sidebar nav a').first().isVisible(),true,'Sem JS a navegação continua disponível');await noJs.close();
 assert.deepEqual(errors,[]);
 const sensitiveRequests=requests.filter(origin=>!['https://fonts.googleapis.com','https://fonts.gstatic.com'].includes(origin));assert.deepEqual(sensitiveRequests,[]);
 fs.writeFileSync(out+'/result.json',JSON.stringify({checks,errors,externalRequests:[...new Set(requests)],interactionCoverage:['gaveta e foco','Escape','backdrop','recolher e persistir','redimensionamento','hover','tema claro','movimento reduzido','nome extenso','sem JavaScript']},null,2));
 console.log(JSON.stringify({layoutChecks:checks.length,pages:routes.length+publicRoutes.length,errors,externalRequests:[...new Set(requests)]}));
}finally{await browser.close();}
