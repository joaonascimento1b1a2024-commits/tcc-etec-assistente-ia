// Restaura somente a interface desta entrega, sem resetar outras alterações locais.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const backup=path.join(root,'.cache/interface-shell-before-2026-11-12');
const manifest=JSON.parse(fs.readFileSync(path.join(backup,'reverter.json'),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const operations=[...manifest.restore.map(file=>({file,restore:true})),...manifest.remove.map(file=>({file,restore:false}))];
for(const {file,restore}of operations){
 const target=path.resolve(root,file);
 if(!target.startsWith(root+path.sep)||!file.startsWith('public/'))throw Error('Caminho fora da interface: '+file);
 if(!fs.existsSync(target)||hash(target)!==manifest.afterHashes[file])throw Error('Arquivo mudou após esta entrega; revisão manual necessária: '+file);
 if(restore&&!fs.existsSync(path.join(backup,file)))throw Error('Backup ausente: '+file);
}
if(!process.argv.includes('--aplicar')){
 console.log('Prévia de reversão: '+JSON.stringify(operations));console.log('Para restaurar a interface: node scripts/reverter-shell-local.mjs --aplicar');
}else{
 for(const {file,restore}of operations){const target=path.resolve(root,file);if(restore)fs.copyFileSync(path.join(backup,file),target);else fs.unlinkSync(target);}
 console.log('Interface anterior restaurada. Figma, testes, documentação e outros arquivos não foram alterados.');
}
