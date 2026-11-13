// Ponte temporária para captura oficial do Figma; não faz parte da aplicação.
// A origem continua sendo a prévia isolada com dados fictícios, sem Firebase.
import http from 'node:http';
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url.startsWith('/__figma__/state.js')){
   res.setHeader('Content-Type','text/javascript; charset=utf-8');
   res.end(`document.addEventListener('DOMContentLoaded',()=>{const state=new URL(location.href).searchParams.get('captureState');const titles={collapsed:'Sylvinho — Menu recolhido — Desktop',mobile:'Sylvinho — Chat mobile',drawer:'Sylvinho — Menu mobile aberto',light:'Sylvinho — Chat mobile claro'};document.title=titles[state]||'Sylvinho — Chat desktop';if(state==='collapsed')document.querySelector('.sidebar-collapse')?.click();if(state==='drawer')document.querySelector('.mobile-menu-toggle')?.click();if(state==='light')document.documentElement.dataset.theme='light';});`);return;
  }
  const target=new URL(req.url,'http://127.0.0.1:4173');
  const upstream=await fetch(target);
  res.statusCode=upstream.status;
  res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://mcp.figma.com; connect-src 'self' https://mcp.figma.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; worker-src 'self' blob:; frame-src 'none'; base-uri 'self'");
  if((upstream.headers.get('content-type')||'').includes('text/html')){
   const html=(await upstream.text()).replace('</head>','<script defer src="/__figma__/state.js"></script><script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script></head>');res.end(html);
  }else res.end(Buffer.from(await upstream.arrayBuffer()));
 }catch{res.statusCode=502;res.end('Prévia isolada indisponível.');}
});
server.listen(4174,'127.0.0.1',()=>console.log('Captura Figma local: http://127.0.0.1:4174'));
