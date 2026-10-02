import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const stage = resolve(root, '.cache/local-e2e');
export function prepare() {
    mkdirSync(stage, { recursive: true });
    cpSync(resolve(root, 'public'), resolve(stage, 'public'), { recursive: true });
    const home = resolve(stage, 'public/Logado/Home');
    const html = readFileSync(resolve(home, 'home.html'), 'utf8');
    if (!html.includes('<script src="home.js"></script>')) throw new Error('HOME_SCRIPT_NOT_FOUND');
    writeFileSync(resolve(home, 'home.html'), html.replace('<script src="home.js"></script>',
        '<script type="module" src="local-bootstrap.js"></script>'));
    cpSync(resolve(root, 'local-e2e/bootstrap.js'), resolve(home, 'local-bootstrap.js'));
    mkdirSync(resolve(stage, 'functions'), { recursive: true });
    cpSync(resolve(root, 'local-e2e/function.cjs'), resolve(stage, 'functions/index.cjs'));
    // O CLI usa uma whitelist de ambiente durante descoberta. Este arquivo e
    // gerado somente no staging ignorado e nao contem segredo.
    writeFileSync(resolve(stage, 'functions/.env.local'),
        `SYLVINHO_LOCAL_E2E=1\nNODE_OPTIONS=--require "${resolve(root, 'local-e2e/network-guard.cjs').replaceAll('\\', '/')}"\n`);
    if (!existsSync(resolve(stage, 'functions/node_modules')))
        symlinkSync(resolve(root, 'functions/node_modules'), resolve(stage, 'functions/node_modules'), 'junction');
    const dependencies = JSON.parse(readFileSync(resolve(root, 'functions/package.json'), 'utf8')).dependencies;
    writeFileSync(resolve(stage, 'functions/package.json'), JSON.stringify({
        name: 'sylvinho-local-e2e-only', private: true, main: 'index.cjs', engines: { node: '24' },
        dependencies: { 'firebase-admin': dependencies['firebase-admin'], 'firebase-functions': dependencies['firebase-functions'] },
    }, null, 2));
    const production = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
    writeFileSync(resolve(stage, 'firebase.json'), JSON.stringify({
        firestore: { ...production.firestore, rules: resolve(root, 'firestore.rules'), indexes: resolve(root, 'firestore.indexes.json') },
        functions: [{ source: 'functions', codebase: 'local-e2e' }],
        hosting: { public: 'public', headers: [{ source: '**', headers: [{ key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:5001; font-src 'self'; frame-src 'none'" }] }] },
        emulators: {
            auth: { host: '127.0.0.1', port: 9099 }, firestore: { host: '127.0.0.1', port: 8080 },
            functions: { host: '127.0.0.1', port: 5001 }, hosting: { host: '127.0.0.1', port: 5000 },
            ui: { enabled: true, host: '127.0.0.1', port: 4000 }, singleProjectMode: true,
        },
    }, null, 2));
    return stage;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    prepare();
    console.log('Staging local gerado; producao inalterada.');
}
