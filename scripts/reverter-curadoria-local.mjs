// Sem --aplicar, apenas confere e mostra o plano. Nunca usa reset/clean ou remove diretórios.
import {readFileSync,existsSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=resolve(root,'docs/curadoria-local/manifesto-entrega.json');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const target=p=>{const abs=resolve(root,p);if(!abs.startsWith(root+sep)||abs===root)throw Error('CAMINHO_FORA_DO_PROJETO');return abs;};
// Verifica o plano inteiro antes de qualquer escrita ou exclusão.
for(const f of manifest.novos){const p=target(f.arquivo);if(existsSync(p)&&hash(readFileSync(p))!==f.sha256)throw Error('ARQUIVO_ALTERADO_DESDE_A_ENTREGA: '+f.arquivo);}
for(const f of manifest.restaurar){
 if(f.arquivo!=='functions/src/assistente/handler.ts')throw Error('RESTAURACAO_NAO_AUTORIZADA');
 if(hash(readFileSync(target(f.arquivo)))!==f.sha256Atual)throw Error('ARQUIVO_EXISTENTE_ALTERADO_DESDE_A_ENTREGA');
 if(hash(readFileSync(resolve(manifest.backup,f.arquivo)))!==f.sha256Original)throw Error('BACKUP_DIVERGENTE');
}
console.log(JSON.stringify({modo:process.argv.includes('--aplicar')?'aplicar':'somente_conferencia',removerSomenteArquivosNovos:manifest.novos.length,restaurar:manifest.restaurar.map(f=>f.arquivo),backupPreservado:manifest.backup}));
if(process.argv.includes('--aplicar')){
 for(const f of manifest.restaurar)writeFileSync(target(f.arquivo),readFileSync(resolve(manifest.backup,f.arquivo)));
 for(const f of manifest.novos){const p=target(f.arquivo);if(existsSync(p))unlinkSync(p);}
 unlinkSync(manifestPath);
 console.log('Reversão desta rodada concluída. Backup preservado. Diretórios não foram removidos.');
}
