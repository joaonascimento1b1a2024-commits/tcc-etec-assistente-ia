// Atualiza apenas a cópia emulada, preservando bootstrap e CSP de isolamento.
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
const stage='.cache/local-e2e';
const config=JSON.parse(readFileSync(stage+'/firebase.json','utf8'));
const destino=stage+'/public/Logado/Home/';
const htmlPath=destino+'home.html';
let html=readFileSync(htmlPath,'utf8');
if(config.emulators?.auth?.port!==9099||config.emulators?.firestore?.port!==8080||config.emulators?.hosting?.port!==5000||!html.includes('local-bootstrap.js')||!html.includes('http://127.0.0.1:9099'))throw Error('STAGING_LOCAL_NAO_CONFIRMADO');
if(!html.includes('id="retrySend"')){
 const button=readFileSync('public/Logado/Home/home.html','utf8').match(/<button id="retrySend"[^>]*>[^<]*<\/button>/)?.[0];
 if(!button||!/<p id="chatStatus"[^>]*>[^<]*<\/p>/.test(html))throw Error('ELEMENTOS_DE_RETRY_AUSENTES');
 html=html.replace(/<p id="chatStatus"[^>]*>[^<]*<\/p>/,m=>m+'\n'+button);
}
for(const name of ['home.js','home.css','assistente-client.js','envio-pendente.js'])copyFileSync('public/Logado/Home/'+name,destino+name);
writeFileSync(htmlPath,html);
console.log('Home emulada atualizada; bootstrap, endpoints e CSP locais preservados.');
