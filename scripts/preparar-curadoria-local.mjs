// Preparação isolada: não altera o corpus de 290, servidor ou Firebase.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const sha=b=>createHash('sha256').update(b).digest('hex');
const output=resolve('.cache/curadoria-sylvinho');
const dest=resolve('../Backups/sylvinho-curadoria-'+new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(dest,{recursive:true});mkdirSync(output,{recursive:true});
const files=['.cache/chat-rag/base.json','.cache/chat-rag/fontes.json','local-e2e/busca-local.mjs','local-e2e/rag-gemini-real.mjs','local-e2e/conversa-natural.mjs','scripts/iniciar-rag-gemini-local.mjs','functions/src/assistente/handler.ts','docs/levantamento-base/perguntas-pendentes.json'];
const manifest=[];
for(const file of files){const bytes=readFileSync(file);const to=resolve(dest,file);mkdirSync(dirname(to),{recursive:true});copyFileSync(file,to);manifest.push({arquivo:file,sha256:sha(bytes)});}
const inputs=['SYLVINHO-material-completo-para-codex.md','respostas-200-perguntas-codex.md'];
for(const file of inputs){const bytes=readFileSync(resolve('C:/Users/jvict/Downloads',file));writeFileSync(resolve(dest,file),bytes);manifest.push({arquivoOriginal:resolve('C:/Users/jvict/Downloads',file),sha256:sha(bytes)});}
writeFileSync(resolve(dest,'manifesto.json'),JSON.stringify({criadoEm:new Date().toISOString(),manifest},null,2));
writeFileSync(resolve(output,'backup.json'),JSON.stringify({diretorio:dest,manifest},null,2));
const sources=JSON.parse(readFileSync('.cache/chat-rag/fontes.json','utf8'));
const req=createRequire(resolve('../sylvinho-backend/functions/package.json'));
const {extrairPdf}=req('./ingestao/extrairPdf.js');
for(const source of sources){
 const cached=resolve('.cache/chat-rag',source.arquivo);
 const bytes=existsSync(cached)?readFileSync(cached):execFileSync('git',['show','stash@{0}^3:knowledge-base/'+source.arquivo],{maxBuffer:10*1024*1024,windowsHide:true});
 if(sha(bytes)!==source.sha256)throw Error('HASH_DIVERGENTE '+source.id);
 const to=resolve(output,source.arquivo);mkdirSync(dirname(to),{recursive:true});writeFileSync(to,bytes);
 if(to.endsWith('.pdf'))writeFileSync(to+'.paginas.json',JSON.stringify(await extrairPdf(to),null,2));
}
writeFileSync(resolve(output,'fontes.json'),JSON.stringify(sources,null,2));
console.log(JSON.stringify({backup:dest,fontes:sources.length,base290Inalterada:true,stashAplicado:false}));
