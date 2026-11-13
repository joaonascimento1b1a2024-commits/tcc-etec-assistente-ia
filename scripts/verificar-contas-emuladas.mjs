// Requer Auth 9099, Firestore 8080 e Hosting 5000 no projeto demo abaixo.
// O bootstrap de .cache/auth-lote1 conecta os SDKs antes de carregar a aplicação.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localizarPlaywright} from '../local-e2e/environment.mjs';
const {chromium}=createRequire(path.resolve(localizarPlaywright(),'package.json'))('playwright');
const executablePath=process.env.SYLVINHO_BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const project='demo-sylvinho-render-poc',origin='http://127.0.0.1:5000';
const out='.cache/mobile-final-2026-11-12';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath});
const states=[],errors=[],blocked=[],networkFailures=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='127.0.0.1'||u.origin==='https://www.gstatic.com'&&u.pathname.startsWith('/firebasejs/10.12.5/'))return route.continue();
  blocked.push(u.origin+u.pathname);return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>networkFailures.push({origin:new URL(r.url()).origin,error:r.failure()?.errorText}));
 const go=async route=>{await page.goto(origin+route);await page.waitForFunction(()=>globalThis.__LOCAL_E2E__);assert.equal(await page.evaluate(()=>globalThis.__LOCAL_E2E__.projectId),project);};
 const ready=async()=>{await page.waitForURL('**/Logado/Home/home.html*');await page.waitForFunction(()=>globalThis.__LOCAL_E2E__&&!document.querySelector('#messageInput').disabled);};
 const uid=()=>page.evaluate(()=>globalThis.__LOCAL_E2E__.uid);
 async function signup(email){
  await go('/Criar-Conta/cadastro.html');
  await page.locator('[name=nome]').fill('Aluno de teste isolado');await page.locator('[name=email]').fill(email);
  await page.locator('[name=password]').fill('Fixture-Only-2026!');await page.locator('[name="confirm-password"]').fill('Fixture-Only-2026!');
  await page.locator('[name=terms]').check();await page.locator('button[type=submit]').click();
  await page.waitForURL('**/Login/login.html');await page.waitForFunction(()=>globalThis.__LOCAL_E2E__);
 }
 async function login(email){await page.locator('[name=identifier]').fill(email);await page.locator('[name=password]').fill('Fixture-Only-2026!');await page.locator('button[type=submit]').click();await ready();return uid();}
 async function logout(){await go('/Logado/Configurações Aluno/configAl.html');await page.locator('#logout:not(:disabled)').click();await page.waitForURL('**/Login/login.html');await page.waitForFunction(()=>globalThis.__LOCAL_E2E__);assert.equal(await uid(),null);}
 await go('/Logado/Home/home.html');await page.waitForURL('**/Login/login.html');states.push('visitante redirecionado');
 await signup('mobile-a@fixture.invalid');const a=await login('mobile-a@fixture.invalid');assert.ok(a);
 const conversation=await page.evaluate(async()=>{
  const {getApp}=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const {getAuth}=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
  const {createConversationStore}=await import('/Logado/Conversas/conversation-store.js');
  const store=await createConversationStore(getApp(),getAuth().currentUser.uid);
  return store.append(null,'Pergunta fictícia para teste de histórico.',crypto.randomUUID(),Date.now());
 });
 await go('/Logado/Conversas/conversas.html');
 await page.locator(`.conversation-link[href$="conversa=${conversation}"]`).waitFor();
 await page.locator(`.conversation-link[href$="conversa=${conversation}"]`).click();await ready();
 await page.locator('#messages .bubble').filter({hasText:'Pergunta fictícia'}).waitFor();
 await page.reload();await ready();assert.equal(await uid(),a);
 states.push('cadastro/login A, histórico reaberto e sessão preservada após recarga');
 await page.locator('.mobile-menu-toggle').click();await page.locator('#settingsLink').click();
 await page.locator('#theme:not(:disabled)').selectOption('light');await page.locator('#preference-status').filter({hasText:'Tema salvo.'}).waitFor();
 await go('/Logado/Home/home.html');await ready();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 states.push('gaveta móvel navega para configurações e tema persiste');
 await logout();await signup('mobile-b@fixture.invalid');const b=await login('mobile-b@fixture.invalid');assert.notEqual(a,b);
 await go('/Logado/Conversas/conversas.html');await page.waitForFunction(()=>document.querySelector('#historyStatus')?.textContent.includes('Você ainda não tem conversas'));
 assert.equal(await page.locator(`.conversation-link[href$="conversa=${conversation}"]`).count(),0);
 const isolation=await page.evaluate(async({a,conversation})=>{
  const s=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
  const ref=s.doc(s.getFirestore(),'users',a,'conversas',conversation);
  const attempt=async fn=>{try{await fn();return 'ALLOWED';}catch(e){return e.code;}};
  return {read:await attempt(()=>s.getDocFromServer(ref)),edit:await attempt(()=>s.updateDoc(ref,{titulo:'Tentativa isolada'})),remove:await attempt(()=>s.deleteDoc(ref))};
 },{a,conversation});
 assert.ok(Object.values(isolation).every(v=>v==='permission-denied'));states.push('conta B não lista, lê, altera ou exclui conversa de A');
 await logout();await page.locator('[name=identifier]').fill('mobile-a@fixture.invalid');await page.locator('a[href="#forgot-password"]').click();await page.locator('#form-message.success').waitFor();
 const actions=await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${project}/oobCodes`).then(r=>r.json());
 assert.ok(actions.oobCodes.some(a=>a.email==='mobile-a@fixture.invalid'&&a.requestType==='PASSWORD_RESET'));
 states.push('recuperação gera código exclusivamente no emulador, sem e-mail real');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:out+'/contas-mobile.png'});
 fs.writeFileSync(out+'/contas.json',JSON.stringify({success:true,states,isolation,errors,blocked,productionAccess:false,geminiCalls:0},null,2));
 console.log(JSON.stringify({success:true,states,isolation,errors}));
}catch(e){fs.writeFileSync(out+'/contas-failure.json',JSON.stringify({error:e.message,states,errors,blocked,networkFailures},null,2));throw e;}
finally{await browser.close();}
