import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepare, root, stage } from './prepare.mjs';

const project = 'tcc-ia-d8891';
const endpoint = `http://127.0.0.1:5001/${project}/southamerica-east1/perguntarAssistente`;
const javaHome = 'C:/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot';
const cli = 'C:/Users/jvict/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js';
const runtimeModules = 'C:/Users/jvict/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const localRequire = createRequire(resolve(runtimeModules, 'package.json'));
const { chromium } = localRequire('playwright');
prepare();
const home = resolve(stage, 'isolated-home');
mkdirSync(home, { recursive: true });
const env = { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}/bin;${process.env.PATH}`,
    HOME: home, USERPROFILE: home, APPDATA: resolve(home, 'appdata'), XDG_CONFIG_HOME: resolve(home, 'config'),
    FIREBASE_CLI_DISABLE_USAGE: '1', CI: 'true', SYLVINHO_LOCAL_E2E: '1', GCLOUD_PROJECT: project,
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GOOGLE_APPLICATION_CREDENTIALS: resolve(home, 'no-credentials.json'),
    NODE_OPTIONS: `--require "${resolve(root, 'local-e2e/network-guard.cjs').replaceAll('\\', '/')}"`,
};
delete env.GEMINI_API_KEY;
delete env.FIREBASE_TOKEN;
delete env.GOOGLE_API_KEY;
delete env.GOOGLE_GENERATIVE_AI_API_KEY;
delete env.SYLVINHO_ARTIFACT_DOWNLOAD;

const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const states = [];
let browser;
let child;
let logs = '';
const requests = [];
const blocked = [];
const pageErrors = [];
function safeLog(data) {
    const text = String(data).replace(/\?[^\s"']+/g, '?[redacted]');
    const safe = text.split('\n').filter((line) => !/api.?key|bearer|idtoken|refresh.?token|password/i.test(line)).join('\n');
    logs = (logs + safe).slice(-60000);
}
async function localJson(url, options) {
    assert.equal(new URL(url).hostname, '127.0.0.1');
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`LOCAL_HTTP_${response.status}`);
    return response.json();
}
function encode(value) {
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') return { integerValue: String(value) };
    if (typeof value === 'string') return { stringValue: value };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}
try {
    const java = spawnSync(resolve(javaHome, 'bin/java.exe'), ['-version'], { encoding: 'utf8' });
    assert.equal(java.status, 0);
    assert.match(java.stderr, /version "21\./);
    // Downloader separado: permite somente binarios oficiais, nunca APIs Firebase.
    for (const kind of ['firestore', 'ui']) {
        execFileSync(process.execPath, [cli, `setup:emulators:${kind}`], {
            cwd: stage, env: { ...env, SYLVINHO_ARTIFACT_DOWNLOAD: '1' }, timeout: 240000, stdio: ['ignore', 'pipe', 'pipe'],
        });
    }
    states.push('artefatos locais disponiveis');
    child = spawn(process.execPath, [cli, 'emulators:start', '--only', 'auth,firestore,functions,hosting',
        '--project', project, '--config', resolve(stage, 'firebase.json')], { cwd: stage, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', safeLog);
    child.stderr.on('data', safeLog);
    console.log('CLI local iniciado; aguardando Hub e Function.');
    let hub;
    for (let n = 0; n < 180; n++) {
        if (child.exitCode !== null) throw new Error('EMULATORS_EXITED');
        try {
            hub = await localJson('http://127.0.0.1:4400/emulators');
            if (['auth', 'firestore', 'functions', 'hosting', 'ui'].every((name) => hub[name])) break;
        } catch { /* Aguarda apenas endpoints loopback. */ }
        await delay(1000);
    }
    for (const [name, port] of Object.entries({ auth: 9099, firestore: 8080, functions: 5001, hosting: 5000, ui: 4000 })) {
        assert.equal(hub?.[name]?.port, port, `Porta ${name}`);
    }
    for (let n = 0; n < 60 && !logs.includes(endpoint); n++) {
        if (logs.includes('Failed to load function definition')) throw new Error('LOCAL_FUNCTION_DISCOVERY_FAILED');
        await delay(1000);
    }
    assert.ok(logs.includes(endpoint), 'URL precisa ter sido exibida pelo Functions Emulator');
    writeFileSync(resolve(stage, 'public/Logado/Home/assistente-config.js'),
        `export const assistenteConfig = Object.freeze({ endpoint: '${endpoint}', timeoutMs: 30000 });\n`);
    states.push('cinco portas e URL confirmadas pelo Emulator Hub/log');
    console.log('Portas e URL confirmadas; executando Home isolada.');
    const documents = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
    const fixture = (ativo) => ({ documentoId: 'documento-ficticio', versaoDocumento: 'teste-local',
        ativo, tipoConteudo: 'procedimento', titulo: 'Matricula local ficticia', categoria: 'matricula',
        termosBusca: ['matricula'], secao: 'Teste local', paginaInicial: 1, paginaFinal: 1,
        conteudo: ativo ? 'MARCADOR_ATIVO_MATRICULA: matricula na secretaria simulada.' :
            'MARCADOR_INATIVO_PROIBIDO: matricula que nao pode participar do contexto.' });
    await localJson(`${documents}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({ writes: [true, false].map((ativo) => ({ update: {
            name: `projects/${project}/databases/(default)/documents/conhecimento/teste-${ativo ? 'ativo' : 'inativo'}`,
            fields: encode(fixture(ativo)).mapValue.fields,
        } })) }) });
    states.push('dois chunks ficticios gravados exclusivamente no emulador');
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        const allowed = ['127.0.0.1', 'localhost'].includes(url.hostname) ||
            (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/10.12.5/'));
        if (!allowed) { blocked.push(url.origin + url.pathname); return route.abort(); }
        return route.continue();
    });
    context.on('request', (request) => {
        const url = new URL(request.url());
        requests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message.split('\n')[0].replace(/\?\S+/g, '?[redacted]').slice(0, 300)));
    await page.goto('http://127.0.0.1:5000/Logado/Home/home.html');
    await page.waitForFunction(() => globalThis.__LOCAL_E2E__ && !document.querySelector('#messageInput').disabled, null, { timeout: 45000 });
    const session = await page.evaluate(() => globalThis.__LOCAL_E2E__);
    assert.equal(session.projectId, project);
    assert.equal(session.auth, '127.0.0.1:9099');
    assert.equal(session.firestore, '127.0.0.1:8080');
    states.push('conta anonima ficticia autenticada; Auth/Firestore explicitamente conectados antes da Home');
    await page.locator('#messageInput').fill('Como faço minha matrícula?');
    const post = page.waitForResponse((response) => response.url() === endpoint && response.request().method() === 'POST');
    await page.locator('#messageForm [type="submit"]').click();
    const response = await post;
    assert.equal(response.status(), 200);
    assert.deepEqual(Object.keys(response.request().postDataJSON()).sort(), ['conversationId', 'pergunta']);
    assert.ok((await response.request().allHeaders()).authorization?.startsWith('Bearer '));
    await page.waitForFunction(() => document.querySelector('#chatStatus').textContent === 'Conversa atualizada.', null, { timeout: 30000 });
    const conversationId = new URL(page.url()).searchParams.get('conversa');
    assert.match(conversationId, /^[A-Za-z0-9]{20}$/);
    const saved = await localJson(`${documents}/users/${session.uid}/conversas/${conversationId}`, { headers: { Authorization: 'Bearer owner' } });
    const items = saved.fields.mensagens.arrayValue.values.map((item) => ({
        remetente: item.mapValue.fields.remetente.stringValue, texto: item.mapValue.fields.texto.stringValue,
    }));
    assert.deepEqual(items, [
        { remetente: 'user', texto: 'Como faço minha matrícula?' },
        { remetente: 'bot', texto: 'Resposta local de teste baseada no contexto recuperado.' },
    ]);
    assert.deepEqual(await page.locator('#messages .bubble').allTextContents(), items.map((item) => item.texto));
    const evidence = JSON.parse(readFileSync(resolve(stage, 'function-evidence.json'), 'utf8'));
    assert.equal(evidence.uid, session.uid);
    assert.equal(evidence.tokenValidado, true);
    assert.equal(evidence.geracoes, 1);
    assert.equal(evidence.ativoNoContexto, true);
    assert.equal(evidence.inativoNoContexto, false);
    assert.equal(requests.filter((item) => item.origin === 'http://127.0.0.1:5001' && item.method === 'POST').length, 1);
    assert.equal(pageErrors.length, 0, 'JavaScript da Home sem erros');
    // A Home original solicita Google Fonts. Preservamos HTML/CSS e o bloqueio:
    // somente essa tentativa de asset conhecido pode existir, sem sair da rede.
    assert.ok(blocked.every((url) => url === 'https://fonts.googleapis.com/css2'),
        'Nenhuma tentativa Firebase/Gemini ou destino externo inesperado');
    states.push('user salvo uma vez -> token validado -> RAG ativo -> mock uma vez -> bot -> releitura confirmada');
    await page.screenshot({ path: resolve(stage, 'home-e2e.png'), fullPage: true });
    const result = { project, database: '(default)', endpoint, uid: session.uid, conversationId, items, evidence,
        ports: Object.fromEntries(['auth', 'firestore', 'functions', 'hosting', 'ui'].map((name) => [name, hub[name].port])),
        states, requests, blocked, pageErrors, productionAccess: false, geminiCalls: 0 };
    writeFileSync(resolve(stage, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ success: true, uid: session.uid, conversationId, messages: items.length, evidence, ports: result.ports, states }, null, 2));
} catch (error) {
    writeFileSync(resolve(stage, 'failure.json'), JSON.stringify({ error: error.code || error.message, reason: error.message, states, pageErrors, blocked }, null, 2));
    writeFileSync(resolve(stage, 'emulators-sanitized.log'), logs);
    console.error('LOCAL_E2E_FAILED:', error.code || error.message);
    process.exitCode = 1;
} finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) {
        try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { child.kill(); }
    }
}
