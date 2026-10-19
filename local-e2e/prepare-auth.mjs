import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const stage = resolve(root, '.cache/auth-lote1');
export const AUTH_CSP = "default-src 'self'; script-src 'self' https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src http://127.0.0.1:9099 http://127.0.0.1:8080; font-src 'self'; frame-src 'none'";
export function prepare() {
    mkdirSync(stage, { recursive: true });
    cpSync(resolve(root, 'public'), resolve(stage, 'public'), { recursive: true });
    function protect(directory) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = resolve(directory, entry.name);
            if (entry.isDirectory()) protect(path);
            else if (entry.name.endsWith('.html')) writeFileSync(path,
                readFileSync(path, 'utf8').replace(/<head>/i,
                    `<head>\n<meta http-equiv="Content-Security-Policy" content="${AUTH_CSP}">`));
        }
    }
    protect(resolve(stage, 'public'));
    for (const [path, original, bootstrap] of [
        ['Login/login.html', '<script type="module" src="login.js" defer></script>', '../Logado/Home/local-bootstrap.js'],
        ['Criar-Conta/cadastro.html', '<script type="module" src="cadastro.js" defer></script>', '../Logado/Home/local-bootstrap.js'],
        ['Logado/Home/home.html', '<script src="home.js"></script>', 'local-bootstrap.js'],
        ['Logado/Conversas/conversas.html', '<script type="module" src="conversas.js"></script>', '../Home/local-bootstrap.js'],
        ['Logado/Configurações Aluno/configAl.html', '<script src="configAl.js" type="module"></script>', '../Home/local-bootstrap.js'],
    ]) {
        const target = resolve(stage, 'public', path);
        const content = readFileSync(target, 'utf8');
        if (!content.includes(original)) throw new Error('LOCAL_AUTH_SCRIPT_NOT_FOUND');
        writeFileSync(target, content.replace(original, `<script type="module" src="${bootstrap}"></script>`));
    }
    cpSync(resolve(root, 'local-e2e/auth-bootstrap.js'), resolve(stage, 'public/Logado/Home/local-bootstrap.js'));
    const production = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
    writeFileSync(resolve(stage, 'firebase.json'), JSON.stringify({
        firestore: { rules: resolve(root, production.firestore.rules), indexes: resolve(root, production.firestore.indexes) },
        hosting: { public: 'public', headers: [{ source: '**', headers: [{ key: 'Content-Security-Policy', value: AUTH_CSP }] }] },
        emulators: { auth: { host: '127.0.0.1', port: 9099 }, firestore: { host: '127.0.0.1', port: 8080 },
            hosting: { host: '127.0.0.1', port: 5000 }, ui: { enabled: false }, singleProjectMode: true },
    }, null, 2));
    // Somente artefato já instalado: nunca baixa nem instala dependências.
    const jar = 'cloud-firestore-emulator-v1.22.0.jar';
    const artifact = [process.env.SYLVINHO_EMULATOR_CACHE, resolve(stage, 'emulator-artifacts'), resolve(root, '.cache/local-e2e/emulator-artifacts'),
        resolve(homedir(), '.cache/firebase/emulators')].filter(Boolean).map(path => resolve(path, jar)).find(existsSync);
    const destination = resolve(stage, 'emulator-artifacts');
    mkdirSync(destination, { recursive: true });
    if (!artifact) throw new Error('FIRESTORE_ARTIFACT_LOCAL_REQUIRED');
    if (resolve(artifact) !== resolve(destination, jar)) cpSync(artifact, resolve(destination, jar));
    return stage;
}
