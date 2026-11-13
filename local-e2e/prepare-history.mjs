import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepare as prepareAuth, stage as authStage, root } from './prepare-auth.mjs';
export { root };
export const stage = resolve(root, '.cache/local-e2e');
export function prepare({ authMode = 'anonymous', academica = false, original = false, geminiLocal = false } = {}) {
    if (typeof geminiLocal !== 'boolean') throw new Error('LOCAL_GEMINI_FLAG_INVALID');
    if (!['anonymous', 'password'].includes(authMode)) throw new Error('LOCAL_AUTH_MODE_REQUIRED');
    if (typeof original !== 'boolean' || original && academica) throw new Error('LOCAL_ORIGINAL_MODE_INVALID');
    if (typeof academica !== 'boolean') throw new Error('LOCAL_ACADEMIC_MODE_INVALID');
    prepareAuth();
    mkdirSync(stage, { recursive: true });
    cpSync(resolve(authStage, 'public'), resolve(stage, 'public'), { recursive: true });
    cpSync(resolve(root, authMode === 'password' ? 'local-e2e/auth-bootstrap.js' : 'local-e2e/history-bootstrap.js'), resolve(stage, 'public/Logado/Home/local-bootstrap.js'));
    const config = JSON.parse(readFileSync(resolve(authStage, 'firebase.json'), 'utf8'));
    // Somente neste staging: endpoint Functions emulado também pode ser acessado.
    function protect(directory) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = resolve(directory, entry.name);
            if (entry.isDirectory()) protect(path);
            else if (entry.name.endsWith('.html')) writeFileSync(path, readFileSync(path, 'utf8')
                .replace('connect-src http://127.0.0.1:9099 http://127.0.0.1:8080;',
                    'connect-src http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:5001;'));
        }
    }
    protect(resolve(stage, 'public'));
    if (original) {
        function identificar(directory) {
            for (const item of readdirSync(directory, {withFileTypes: true})) {
                const target = resolve(directory, item.name);
                if (item.isDirectory()) identificar(target);
                else if (item.name.endsWith('.html')) writeFileSync(target, readFileSync(target, 'utf8')
                    .replaceAll('Demonstração acadêmica — dados fictícios — não é atendimento oficial da escola.',
                        'Demonstração acadêmica — documentos de referência — não é atendimento oficial da escola.')
                    .replaceAll('somente com documentos fictícios de demonstração', 'com trechos dos documentos de referência'));
            }
        }
        identificar(resolve(stage, 'public'));
    }
    config.hosting.headers[0].headers[0].value = config.hosting.headers[0].headers[0].value
        .replace('connect-src http://127.0.0.1:9099 http://127.0.0.1:8080;',
            'connect-src http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:5001;');
    config.functions = [{ source: 'functions', codebase: 'local-history-lote2' }];
    if (geminiLocal) {
        const from='http://127.0.0.1:5001;';
        const to='http://127.0.0.1:5001 http://127.0.0.1:5002;';
        config.hosting.headers[0].headers[0].value=config.hosting.headers[0].headers[0].value.replace(from,to);
    }
    config.emulators.functions = { host: '127.0.0.1', port: 5001 };
    mkdirSync(resolve(stage, 'functions'), { recursive: true });
    cpSync(resolve(root, 'local-e2e/function.cjs'), resolve(stage, 'functions/index.cjs'));
    const demoEnv = original ? 'SYLVINHO_RAG_ORIGINAL_LOCAL=1\n' : academica ? 'SYLVINHO_DEMO_ACADEMICA=true\n' : '';
    writeFileSync(resolve(stage, 'functions/.env.local'), `SYLVINHO_LOCAL_E2E=1\n${demoEnv}NODE_OPTIONS=--require "${resolve(root, 'local-e2e/network-guard.cjs').replaceAll('\\', '/')}"\n`);
    if (!existsSync(resolve(stage, 'functions/node_modules')))
        symlinkSync(resolve(root, 'functions/node_modules'), resolve(stage, 'functions/node_modules'), 'junction');
    const dependencies = JSON.parse(readFileSync(resolve(root, 'functions/package.json'), 'utf8')).dependencies;
    writeFileSync(resolve(stage, 'functions/package.json'), JSON.stringify({ name: 'sylvinho-local-history-only',
        private: true, main: 'index.cjs', engines: { node: '24' },
        dependencies: { 'firebase-admin': dependencies['firebase-admin'], 'firebase-functions': dependencies['firebase-functions'] } }));
    mkdirSync(resolve(stage, 'emulator-artifacts'), { recursive: true });
    cpSync(resolve(authStage, 'emulator-artifacts/cloud-firestore-emulator-v1.22.0.jar'),
        resolve(stage, 'emulator-artifacts/cloud-firestore-emulator-v1.22.0.jar'));
    writeFileSync(resolve(stage, 'firebase.json'), JSON.stringify(config, null, 2));
    return stage;
}
