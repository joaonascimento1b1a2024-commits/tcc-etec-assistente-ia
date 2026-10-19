import { existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

// Descoberta local: não instala ferramentas nem altera o PATH permanente.
export function localizarFerramentas(env = process.env) {
    const javaBase = join(env.ProgramFiles || 'C:/Program Files', 'Eclipse Adoptium');
    const candidates = [env.JAVA_HOME,
        ...(existsSync(javaBase) ? readdirSync(javaBase).filter(name => /^jdk-21[.-]/.test(name)).map(name => join(javaBase, name)) : [])];
    const javaHome = candidates.find(path => path && existsSync(join(path, 'bin/java.exe')));
    if (!javaHome) throw new Error('JAVA_21_NAO_LOCALIZADO: configure JAVA_HOME nesta sessão.');
    const cli = env.SYLVINHO_FIREBASE_CLI || resolve(env.APPDATA || join(homedir(), 'AppData/Roaming'), 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
    if (!existsSync(cli)) throw new Error('FIREBASE_CLI_NAO_LOCALIZADO: configure SYLVINHO_FIREBASE_CLI com o caminho do firebase.js instalado.');
    return { javaHome, cli };
}
export function localizarPlaywright(env = process.env) {
    const candidates = [env.SYLVINHO_NODE_MODULES, resolve('node_modules'),
        join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')];
    const found = candidates.find(path => path && existsSync(join(path, 'playwright/package.json')));
    if (!found) throw new Error('PLAYWRIGHT_NAO_LOCALIZADO: E2E requer instalação existente; a demonstração manual não requer Playwright.');
    return found;
}
