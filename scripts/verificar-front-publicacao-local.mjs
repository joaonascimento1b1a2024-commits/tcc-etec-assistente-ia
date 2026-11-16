// Preview efêmero: não publica nem altera a cópia dos emuladores.
import {createServer} from 'node:http';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const raiz=resolve('public'),dir='.cache/correcao-publicacao-2026-11-16';mkdirSync(dir,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const servidor=createServer((req,res)=>{try{
 const caminho=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=resolve(raiz,'.'+(caminho==='/'?'/index.html':caminho));
 if(!file.startsWith(raiz+sep)||!statSync(file).isFile())throw Error('NOT_FOUND');
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(done=>servidor.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+servidor.address().port;
const {chromium}=createRequire(resolve(localizarPlaywright(),'package.json'))('playwright');
let browser;const resultado={telas:[],erros:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 page.on('pageerror',e=>resultado.erros.push(e.message));
 for(const width of [360,375,390,414,768,1440]){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/');await page.evaluate(()=>document.fonts.ready);
  const estado=await page.evaluate(()=>{
   const painel=document.querySelector('.benefit-panel'),c=document.createElement('canvas').getContext('2d');
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,colunas:getComputedStyle(painel).gridTemplateColumns.split(' ').length,titulos:[...painel.querySelectorAll('h3')].map(e=>{
    const s=getComputedStyle(e);c.font=s.fontWeight+' '+s.fontSize+' '+s.fontFamily;
    return {texto:e.textContent,width:e.clientWidth,maiorPalavra:Math.max(...e.textContent.split(/\s+/).map(x=>c.measureText(x).width)),color:s.color,bg:getComputedStyle(painel).backgroundColor};
   })};
  });
  assert.equal(estado.overflow,false);
  if(width<=414)assert.equal(estado.colunas,1);
  for(const t of estado.titulos)assert.ok(t.maiorPalavra<=t.width+1,t.texto);
  const luma=s=>{const a=s.match(/\d+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
  const t=estado.titulos[0],a=luma(t.color),b=luma(t.bg);estado.contraste=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(estado.contraste>=4.5);
  await page.getByRole('navigation').getByRole('link',{name:'Sobre',exact:true}).click();await page.waitForURL('**/Sobre/sobre.html');
  assert.match(await page.locator('h1').textContent(),/Projeto Sylvinho/);
  const icone=await page.locator('link[rel=icon]').getAttribute('href');assert.equal((await page.request.get(new URL(icone,page.url()).href)).status(),200);
  await page.goBack();await page.waitForURL(origin+'/');
  resultado.telas.push({width,...estado,sobre:true,voltar:true,icone:true});
  if(width===375||width===1440)await page.screenshot({path:dir+'/landing-'+width+'.png',fullPage:true});
 }
 assert.deepEqual(resultado.erros,[]);resultado.sucesso=true;
}catch(e){resultado.sucesso=false;resultado.erro=e.message;process.exitCode=1;}
finally{if(browser)await browser.close();await new Promise(done=>servidor.close(done));writeFileSync(dir+'/frontend.json',JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado,null,2));}
