import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(path.resolve(localizarPlaywright(),'package.json'))('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SYLVINHO_BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p))});
try{
const page=await browser.newPage();const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)requests.push([r.status(),r.url()]);});
fs.mkdirSync('.cache/landing-review',{recursive:true});
const checks=[];
for(const [width,height] of [[1440,900],[1903,945],[2560,1080],[1024,768],[768,800],[390,844],[320,640]]){
await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:4173/');await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.waitForTimeout(250);await page.evaluate(()=>scrollTo(0,0));
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width+' '+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.className,e.getBoundingClientRect().right]).slice(0,12))));
assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('.resource-grid article').count(),5);assert.equal(await page.locator('.landing-steps li').count(),3);
for(const selector of ['.landing-content','.landing-header','.landing-hero','.landing-footer']){
const bounds=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right};});
assert.ok(Math.abs(bounds.left)<1&&Math.abs(bounds.right-width)<1,'Largura total '+selector+' em '+width);
}
const broken=await page.locator('img').evaluateAll(images=>images.filter(img=>!img.complete||img.naturalWidth===0).map(img=>img.src));assert.deepEqual(broken,[],'Imagens '+width);
const targets=await page.locator('a[href^="#"]').evaluateAll(links=>links.map(link=>link.hash).filter(hash=>!document.querySelector(hash)));assert.deepEqual(targets,[]);
const primary=page.locator('.hero-copy .hero-button-primary');assert.match(await primary.getAttribute('href'),/Login\/login.html/);
if(width===1440){const rects=await page.locator('.landing-content > section,.landing-product,.landing-footer').evaluateAll(els=>els.map(el=>({name:el.className,y:Math.round(el.getBoundingClientRect().top),height:Math.round(el.getBoundingClientRect().height)})));fs.writeFileSync('.cache/landing-review/geometry.json',JSON.stringify(rects,null,2));}
await page.screenshot({path:'.cache/landing-review/landing-'+width+'.png',fullPage:true});checks.push('Layout, imagens, seções e destinos '+width+'x'+height);
}
await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4173/');await page.getByRole('link',{name:'Serviços',exact:true}).click();assert.equal(new URL(page.url()).hash,'#servicos');assert.ok(await page.locator('#servicos').evaluate(el=>Math.abs(el.getBoundingClientRect().top)<40));checks.push('Âncora Serviços funciona');
await page.goto('http://127.0.0.1:4173/');await page.keyboard.press('Tab');assert.equal(await page.locator('.landing-skip').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');checks.push('Atalho de teclado pula para o conteúdo');
assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);fs.writeFileSync('.cache/landing-review/result.json',JSON.stringify({checks,pageErrors:errors,failedRequests:requests},null,2));console.log(JSON.stringify({passed:checks.length,pageErrors:errors}));
}finally{await browser.close();}
