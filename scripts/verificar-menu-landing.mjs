import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(path.resolve(localizarPlaywright(),'package.json'))('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SYLVINHO_BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p))});
const errors=[];let checks=0;
try {
 for(const width of [1440,1903,2560,1024,768,390,320]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/');await page.evaluate(()=>document.fonts.ready);
  for(const id of ['sobre','servicos','sobre','inicio']) {
   await page.evaluate(id=>{const el=document.getElementById(id);scrollTo({top:el.getBoundingClientRect().top+scrollY,behavior:'instant'});},id);
   await page.waitForFunction(id=>document.querySelector('.landing-header .nav-link.active')?.hash==='#'+id,id);
   assert.equal(await page.locator('.landing-header [aria-current="location"]').count(),1);
   checks++;
  }
  // Acionamento por teclado mantém a âncora nativa e o foco do link.
  const link=page.locator('.landing-header a[href="#sobre"]');
  await link.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.nav-link.active')?.hash==='#sobre');
  assert.equal(new URL(page.url()).hash,'#sobre');checks++;
  await page.close();
 }
 const page=await browser.newPage({javaScriptEnabled:false});
 await page.goto('http://127.0.0.1:4173/');
 await page.locator('.landing-header a[href="#servicos"]').click();
 assert.equal(new URL(page.url()).hash,'#servicos');checks++;
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:checks,pageErrors:errors}));
} finally {await browser.close();}
