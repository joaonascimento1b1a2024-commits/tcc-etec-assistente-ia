// Prévia visual local: nunca autentica, grava no Firebase ou envia e-mails.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const port=Number(process.env.SYLVINHO_PREVIEW_PORT||4173);
const fixtures=`
document.addEventListener('DOMContentLoaded',()=>{
const q=s=>document.querySelector(s);
if(q('#account-settings')){q('#account-settings').hidden=false;q('#page-status').textContent='Perfil fictício de prévia local';q('#profile-name').textContent='Aluno de demonstração';q('#profile-email').textContent='aluno@example.invalid';const t=q('#theme');t.disabled=false;t.value=document.documentElement.dataset.theme||'dark';t.addEventListener('change',()=>window.etecTheme.save('preview-local',t.value));}
if(q('#profileName'))q('#profileName').textContent='Aluno de demonstração';
if(q('#welcomeName'))q('#welcomeName').textContent='Olá, estudante!';
if(q('#messageForm')){
const input=q('#messageInput'),form=q('#messageForm'),messages=q('#messages'); input.disabled=false;form.querySelector('button[type=submit]').disabled=false;
document.querySelectorAll('[data-message]').forEach(b=>{b.disabled=false;b.addEventListener('click',()=>{input.value=b.dataset.message;form.requestSubmit();});});
q('#chatStatus').textContent='Pronto para conversar.';
function add(text,role){const row=document.createElement('article');row.className='message-row '+role;if(role==='bot'){const avatar=document.createElement('div');avatar.className='bot-avatar';const img=document.createElement('img');img.src='/Logado/Home/Logo s_fundo.png';img.alt='';avatar.append(img);row.append(avatar);}const bubble=document.createElement('div');bubble.className='bubble';bubble.sylvinhoOriginalText=text;bubble.textContent=text;row.append(bubble);messages.append(row);}
let generation=0,busy=false;
form.addEventListener('submit',event=>{event.preventDefault();if(busy||!input.value.trim())return;busy=true;const current=generation;const text=input.value.trim();input.value='';q('#homeScreen')?.classList.add('hidden');q('#chatScreen')?.classList.remove('hidden');if(q('#welcome'))q('#welcome').hidden=true;messages.hidden=false;add(text,'user');window.sylvinhoUI?.setBusy(true);form.querySelector('button[type=submit]').disabled=true;q('#chatStatus').textContent='Preparando uma resposta fictícia…';setTimeout(()=>{if(current!==generation)return;add('Resposta de demonstração local. Esta mensagem permite avaliar a leitura e o botão de copiar. Para informações oficiais, consulte a secretaria.','bot');busy=false;window.sylvinhoUI?.setBusy(false);form.querySelector('button[type=submit]').disabled=false;q('#chatStatus').textContent='Resposta fictícia recebida. Nenhum dado foi enviado ou salvo.';input.focus();},700);});
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
q('#newChat')?.addEventListener('click',()=>{generation++;busy=false;messages.replaceChildren();window.sylvinhoUI?.setBusy(false);form.querySelector('button[type=submit]').disabled=false;input.value='';q('#homeScreen')?.classList.remove('hidden');q('#chatScreen')?.classList.add('hidden');if(q('#welcome'))q('#welcome').hidden=false;q('#chatStatus').textContent='Nova conversa fictícia.';});
}
if(q('#conversationList')){const list=q('#conversationList');['Documentos para matrícula','Calendário acadêmico','Horários de atendimento'].forEach(title=>{const li=document.createElement('li');li.className='conversation-card';const a=document.createElement('a');a.className='conversation-link';a.href='../Home/home.html';const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent='Conversa fictícia para prévia do layout';a.append(h,p);li.append(a);list.append(li);});q('#historyStatus').textContent='3 conversas fictícias';q('#historySearch').addEventListener('input',e=>{let n=0;for(const li of list.children){li.hidden=!li.textContent.toLocaleLowerCase().includes(e.target.value.toLocaleLowerCase());if(!li.hidden)n++;}q('#historyStatus').textContent=n+' conversa(s) encontrada(s)';});}
if(q('#noticeList')){const list=q('#noticeList');for(const [title,category] of [['Encontro de demonstração','evento'],['Matrícula fictícia','matricula']]){const card=q('#noticeTemplate').content.cloneNode(true);card.querySelector('h2').textContent=title;card.querySelector('.notice-copy p').textContent='Dado fictício. Não representa comunicado da escola.';card.querySelector('li').dataset.category=category;list.append(card);}q('#status').hidden=true;list.setAttribute('aria-busy','false');q('#noticeCategory').addEventListener('change',e=>{let n=0;for(const li of list.children){li.hidden=!!e.target.value&&li.dataset.category!==e.target.value;if(!li.hidden)n++;}q('#filterSummary').textContent=n+' aviso(s) nesta categoria.';});}
document.querySelectorAll('.login-form').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();location.href='/Logado/Home/home.html';}));
});`;
const excluded=new Set(['home.js','chat.js','login.js','cadastro.js','conversas.js','avisos.js','configAl.js','admin.js','servicos.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
res.setHeader('Cache-Control','no-store');
res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-src 'none'; base-uri 'self'");
if(req.url==='/__preview__/fixtures.js'){res.setHeader('Content-Type',types['.js']);res.end(fixtures);return;}
let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
try {let content=fs.readFileSync(file);if(file.endsWith('.html')){
content=content.toString().replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(tag,src)=>src.startsWith('https:')||excluded.has(src.split('/').at(-1))?'':tag);
content=content.replace('</head>','<script defer src="/__preview__/fixtures.js"></script></head>');
}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(content);
}catch{res.writeHead(404);res.end('Arquivo não encontrado');}
});
server.listen(port,'127.0.0.1',()=>console.log('Prévia visual isolada: http://127.0.0.1:'+port));
