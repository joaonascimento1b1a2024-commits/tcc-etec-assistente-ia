import { localizarFerramentas } from './environment.mjs';
import { prepare, root, stage } from './prepare-auth.mjs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const { javaHome, cli } = localizarFerramentas();
prepare();
const home = resolve(stage, 'importador-home-' + Date.now()); mkdirSync(home, { recursive: true });
const env = { ...process.env, JAVA_HOME: javaHome, PATH: javaHome + '/bin;' + process.env.PATH,
    HOME: home, USERPROFILE: home, APPDATA: resolve(home, 'appdata'), XDG_CONFIG_HOME: resolve(home, 'config'),
    GCLOUD_PROJECT: 'demo-sylvinho-render-poc', GOOGLE_CLOUD_PROJECT: 'demo-sylvinho-render-poc',
    GOOGLE_APPLICATION_CREDENTIALS: resolve(home, 'credencial-inexistente.json'),
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', FIREBASE_EMULATORS_PATH: resolve(stage, 'emulator-artifacts'),
    FIREBASE_CLI_DISABLE_USAGE: '1', NO_UPDATE_NOTIFIER: '1', CI: 'true', SYLVINHO_IMPORT_EMULATOR: '1',
    NODE_OPTIONS: '--require "' + resolve(root, 'local-e2e/network-guard.cjs').replaceAll('\\', '/') + '"' };
for (const name of Object.keys(env)) if (/^(CLOUDSDK_|FIREBASE_TOKEN|GOOGLE_ACCESS_TOKEN|GOOGLE_REFRESH_TOKEN|FIREBASE_SERVICE_ACCOUNT|GEMINI|GOOGLE_API_KEY|GOOGLE_GENERATIVE_AI)/.test(name)) delete env[name];
delete env.SYLVINHO_ARTIFACT_DOWNLOAD;
const child = spawn(process.execPath, [cli, 'emulators:exec', '--only', 'firestore', '--project', 'demo-sylvinho-render-poc',
    '--config', resolve(root, 'render-poc/firebase.emulators.json'), 'node --test tests/importador-fixtures.test.mjs'],
    { cwd: root, env, stdio: 'inherit', windowsHide: true });
child.on('error', () => { console.error('EMULADOR_IMPORTADOR_NAO_INICIOU'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
