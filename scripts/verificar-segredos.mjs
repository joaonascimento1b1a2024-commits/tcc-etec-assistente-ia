import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Heurística offline: nunca imprime conteúdo, valores, linhas ou trechos encontrados.
export function detectarSegredos(texto) {
    const tipos = new Set();
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----(?:\r?\n|\\n)[\s\S]+?(?:\r?\n|\\n)-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(texto)) tipos.add('CHAVE_PRIVADA');
    try {
        const json = JSON.parse(texto);
        if (json && typeof json === 'object' && json.type === 'service_account' && json.private_key) tipos.add('CREDENCIAL_ADMIN');
        if (json && typeof json === 'object' && (json.refresh_token || json.access_token)) tipos.add('TOKEN_OAUTH');
    } catch { /* Código e documentação não são arquivos JSON de credencial. */ }
    if (/^\s*(?:FIREBASE_TOKEN|GOOGLE_ACCESS_TOKEN|GOOGLE_REFRESH_TOKEN|FIREBASE_PRIVATE_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|FIREBASE_SERVICE_ACCOUNT(?:_JSON)?)\s*=\s*[^\s#]+/m.test(texto)) tipos.add('SEGREDO_ENV');
    if (/Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(texto)) tipos.add('BEARER_JWT');
    return [...tipos];
}

const ignorar = new Set(['.git', '.agents', '.codex', '.cache', '.firebase', 'node_modules', 'lib', 'coverage']);
const extensoes = new Set(['.json', '.js', '.mjs', '.cjs', '.ts', '.html', '.md', '.txt', '.log', '.yml', '.yaml', '.pem', '.key']);
export function verificarSegredos(root) {
    const encontrados = [];
    function visitar(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) continue;
            const path = resolve(dir, entry.name);
            if (entry.isDirectory()) { if (!ignorar.has(entry.name)) visitar(path); continue; }
            if (!entry.isFile() || !(extensoes.has(extname(entry.name)) || entry.name.startsWith('.env'))) continue;
            const tipos = detectarSegredos(readFileSync(path, 'utf8'));
            if (tipos.length) encontrados.push({ arquivo: relative(root, path), tipos });
        }
    }
    visitar(root);
    return encontrados;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const encontrados = verificarSegredos(fileURLToPath(new URL('../', import.meta.url)));
        console.log(JSON.stringify({ verificacao: 'offline-heuristica', encontrados }, null, 2));
        process.exitCode = encontrados.length ? 1 : 0;
    } catch { console.error('VERIFICACAO_SEGREDOS_FALHOU'); process.exitCode = 1; }
}
