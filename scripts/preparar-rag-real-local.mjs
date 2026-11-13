import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('.cache/chat-rag');
mkdirSync(root,{recursive:true});
function read(name){return execFileSync('git',['show','stash@{0}^3:knowledge-base/'+name],{maxBuffer:20*1024*1024,windowsHide:true});}
const base=JSON.parse(read('base-inicial.json'));
const sources=JSON.parse(read('fontes.json'));
const selected=base.filter(d=>d.ativo===true);
for(const doc of selected){
 const source=sources.find(s=>s.arquivo===doc.fonteArquivo);
 if(!source||source.sha256!==doc.fonteSha256)throw Error('FONTE_NAO_VERIFICADA');
 const bytes=read(source.arquivo);
 if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error('HASH_DIVERGENTE');
 const file=resolve(root,source.arquivo);
 if(!file.startsWith(root+ '\\'))throw Error('CAMINHO_INVALIDO');
 mkdirSync(dirname(file),{recursive:true});writeFileSync(file,bytes);
}
writeFileSync(resolve(root,'base.json'),JSON.stringify(selected,null,2));
writeFileSync(resolve(root,'fontes.json'),JSON.stringify(sources,null,2));
writeFileSync(resolve(root,'ORIGEM.md'),read('README.md'));
console.log(JSON.stringify({chunksReais:selected.length,hashesVerificados:true,stashAplicado:false,destino:root}));
