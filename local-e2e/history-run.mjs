import { localizarFerramentas, localizarPlaywright } from './environment.mjs';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { prepare, root, stage } from './prepare-history.mjs';
import { validarSegurancaHistorico } from './history-security.mjs';

const project = 'demo-sylvinho-render-poc';
const endpoint = `http://127.0.0.1:5001/${project}/southamerica-east1/perguntarAssistente`;
const { javaHome, cli } = localizarFerramentas();

const runtimeModules = localizarPlaywright();
const localRequire = createRequire(resolve(runtimeModules, 'package.json'));
const { chromium } = localRequire('playwright');
prepare();
const home = resolve(stage, `isolated-home-sprint3-${Date.now()}`);
mkdirSync(home, { recursive: true });
const env = { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}/bin;${process.env.PATH}`,
    HOME: home, USERPROFILE: home, APPDATA: resolve(home, 'appdata'), XDG_CONFIG_HOME: resolve(home, 'config'),
    FIREBASE_CLI_DISABLE_USAGE: '1', NO_UPDATE_NOTIFIER: '1', CI: 'true', SYLVINHO_LOCAL_E2E: '1', GCLOUD_PROJECT: project,
    GOOGLE_CLOUD_PROJECT: project, FIREBASE_EMULATORS_PATH: resolve(stage, 'emulator-artifacts'),
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GOOGLE_APPLICATION_CREDENTIALS: resolve(home, 'no-credentials.json'),
    NODE_OPTIONS: `--require "${resolve(root, 'local-e2e/network-guard.cjs').replaceAll('\\', '/')}"`,
};
delete env.GEMINI_API_KEY;
delete env.FIREBASE_TOKEN;
delete env.GOOGLE_API_KEY;
delete env.GOOGLE_GENERATIVE_AI_API_KEY;
delete env.SYLVINHO_ARTIFACT_DOWNLOAD;
for (const name of Object.keys(env)) {
    if (/^(CLOUDSDK_|GOOGLE_ACCESS_TOKEN|GOOGLE_REFRESH_TOKEN|FIREBASE_SERVICE_ACCOUNT)/.test(name)) delete env[name];
}

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
    assert.ok(project.startsWith('demo-'));
    assert.equal(existsSync(env.GOOGLE_APPLICATION_CREDENTIALS), false);
    const cliVersion = spawnSync(process.execPath, [cli, '--version'], { cwd: stage, env, encoding: 'utf8' });
    assert.equal(cliVersion.status, 0, 'CLI deve funcionar no HOME isolado');
    assert.match(cliVersion.stdout.trim(), /^15\.(33|34)\.\d+$/);
    const java = spawnSync(resolve(javaHome, 'bin/java.exe'), ['-version'], { encoding: 'utf8' });
    assert.equal(java.status, 0);
    assert.match(java.stderr, /version "21\./);
    for (const port of [9099, 8080, 5001, 5000, 4000, 4400, 4500, 9150]) {
        await new Promise((done, reject) => {
            const server = createServer();
            server.once('error', () => reject(new Error(`LOCAL_PORT_UNAVAILABLE_${port}`)));
            server.listen(port, '127.0.0.1', () => server.close(done));
        });
    }
    console.log('Java 21, CLI ' + cliVersion.stdout.trim() + ', portas e isolamento demo confirmados.');
    states.push('artefato Firestore local reutilizado; nenhum download');
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
            if (['auth', 'firestore', 'functions', 'hosting'].every((name) => hub[name])) break;
        } catch { /* Aguarda apenas endpoints loopback. */ }
        await delay(1000);
    }
    for (const [name, port] of Object.entries({ auth: 9099, firestore: 8080, functions: 5001, hosting: 5000 })) {
        assert.equal(hub?.[name]?.port, port, `Porta ${name}`);
    }
    for (let n = 0; n < 60 && !logs.includes(endpoint); n++) {
        if (logs.includes('Failed to load function definition')) throw new Error('LOCAL_FUNCTION_DISCOVERY_FAILED');
        await delay(1000);
    }
    assert.ok(logs.includes(endpoint), 'URL precisa ter sido exibida pelo Functions Emulator');
    states.push('quatro emuladores e URL confirmados pelo Emulator Hub/log');
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
    await page.waitForFunction(() => globalThis.__LOCAL_E2E__ && document.querySelector('#chatStatus')?.textContent === 'As mensagens são salvas na sua conta.' && !document.querySelector('#messageInput').disabled, null, { timeout: 45000 });
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
    assert.deepEqual(Object.keys(response.request().postDataJSON()).sort(), ['conversationId', 'messageId', 'pergunta']);
    assert.ok((await response.request().allHeaders()).authorization?.startsWith('Bearer '));
    await page.waitForFunction(() => document.querySelector('#chatStatus').textContent === 'Conversa atualizada.', null, { timeout: 30000 });
    const conversationId = new URL(page.url()).searchParams.get('conversa');
    assert.match(conversationId, /^[A-Za-z0-9]{20}$/);
    const saved = await localJson(`${documents}/users/${session.uid}/conversas/${conversationId}`, { headers: { Authorization: 'Bearer owner' } });
    let items = saved.fields.mensagens.arrayValue.values.map((item) => ({
        remetente: item.mapValue.fields.remetente.stringValue, texto: item.mapValue.fields.texto.stringValue,
    }));
    assert.equal(items.length, 2);
    assert.deepEqual(items[0], { remetente: 'user', texto: 'Como faço minha matrícula?' });
    assert.equal(items[1].remetente, 'bot');
    assert.match(items[1].texto, /MARCADOR_ATIVO_MATRICULA/);
    assert.match(items[1].texto, /documento-ficticio/);
    assert.doesNotMatch(items[1].texto, /MARCADOR_INATIVO_PROIBIDO/);
    assert.deepEqual(await page.locator('#messages .bubble').allTextContents(), items.map((item) => item.texto));
    states.push('pergunta e resposta documental persistidas uma unica vez e exibidas');
    const token = await page.evaluate(async () => {
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
        return getAuth().currentUser.getIdToken();
    });
    const securityResults = await validarSegurancaHistorico(documents, session.uid, token);
    states.push('regras bloqueiam bots falsos edicao exclusao parcial e UID alheio; legado renomear e excluir aprovados');
    const sendAgain = (body) => localJson(endpoint, { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
    }, body: JSON.stringify(body) });
    const originalBody = response.request().postDataJSON();
    assert.equal((await sendAgain(originalBody)).resposta, items[1].texto);
    const concurrentId = await page.evaluate(async ({ conversationId, uid }) => {
        const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
        const { createConversationStore } = await import('/Logado/Conversas/conversation-store.js');
        const store = await createConversationStore(getApp(), uid);
        const id = crypto.randomUUID(), time = Date.now();
        await Promise.all([store.append(conversationId, 'Como faço minha matrícula?', id, time),
            store.append(conversationId, 'Como faço minha matrícula?', id, time)]);
        return id;
    }, { conversationId, uid: session.uid });
    const concurrentBody = { ...originalBody, messageId: concurrentId };
    const concurrentAnswers = await Promise.all([sendAgain(concurrentBody), sendAgain(concurrentBody)]);
    assert.equal(concurrentAnswers[0].resposta, concurrentAnswers[1].resposta);
    const concurrentSaved = await localJson(`${documents}/users/${session.uid}/conversas/${conversationId}`, { headers: { Authorization: 'Bearer owner' } });
    assert.equal(concurrentSaved.fields.mensagens.arrayValue.values.length, 4);
    items = concurrentSaved.fields.mensagens.arrayValue.values.map((item) => ({
        remetente: item.mapValue.fields.remetente.stringValue, texto: item.mapValue.fields.texto.stringValue,
    }));
    states.push('replay e duas requisicoes simultaneas nao duplicam; texto igual com outro ID recebe nova resposta');
    await page.goto('http://127.0.0.1:5000/Logado/Conversas/conversas.html');
    const conversationLink = page.locator(`.conversation-link[href$="conversa=${conversationId}"]`);
    await conversationLink.waitFor({ state: 'visible', timeout: 30000 });
    await conversationLink.click();
    await page.waitForFunction((count) => !document.querySelector('#messageInput').disabled &&
        document.querySelectorAll('#messages .bubble').length === count, items.length);
    assert.equal((await page.evaluate(() => globalThis.__LOCAL_E2E__)).uid, session.uid);
    assert.deepEqual(await page.locator('#messages .bubble').allTextContents(), items.map((item) => item.texto));
    states.push('conversa reaberta pelo historico com mesmo UID e mesmas mensagens');
    await page.reload();
    await page.waitForFunction((count) => !document.querySelector('#messageInput').disabled &&
        document.querySelectorAll('#messages .bubble').length === count, items.length);
    assert.equal((await page.evaluate(() => globalThis.__LOCAL_E2E__)).uid, session.uid);
    states.push('recarregamento preserva conta demo e conversa');
    await page.locator('#messageInput').fill('Qual o procedimento para transporte interplanetario?');
    const refusalPost = page.waitForResponse((r) => r.url() === endpoint && r.request().method() === 'POST');
    await page.locator('#messageForm [type="submit"]').click();
    const refusalResponse = await refusalPost;
    assert.equal(refusalResponse.status(), 200);
    const refusal = await refusalResponse.json();
    assert.match(refusal.resposta, /Nao ha informacao suficiente/);
    assert.match(refusal.resposta, /secretaria/);
    await page.waitForFunction(() => document.querySelector('#chatStatus').textContent === 'Conversa atualizada.' &&
        document.querySelectorAll('#messages .bubble').length === 6);
    const finalSaved = await localJson(`${documents}/users/${session.uid}/conversas/${conversationId}`, { headers: { Authorization: 'Bearer owner' } });
    let finalItems = finalSaved.fields.mensagens.arrayValue.values.map((item) => ({
        remetente: item.mapValue.fields.remetente.stringValue, texto: item.mapValue.fields.texto.stringValue,
    }));
    assert.equal(finalItems.length, 6);
    assert.deepEqual(finalItems.slice(0, 4), items);
    assert.equal(finalItems[5].texto, refusal.resposta);
    assert.equal(finalItems.filter((item) => item.remetente === 'bot').length, 3);
    assert.deepEqual(await page.locator('#messages .bubble').allTextContents(), finalItems.map((item) => item.texto));
    states.push('pergunta sem evidencia recebe recusa e persiste somente um bot');
    let lostMessageId;
    const loseResponse = async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        lostMessageId = route.request().postDataJSON().messageId;
        const committed = await route.fetch();
        assert.equal(committed.status(), 200);
        await route.abort('failed');
        await context.unroute(endpoint, loseResponse);
    };
    await context.route(endpoint, loseResponse);
    await page.locator('#messageInput').fill('Como faço minha matrícula?');
    await page.locator('#messageForm [type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('#chatStatus').textContent.includes('Recarregue para recuperar'));
    const pendingId = await page.evaluate((uid) => JSON.parse(sessionStorage.getItem(`sylvinho:pendente:${uid}`)).messageId, session.uid);
    assert.equal(pendingId, lostMessageId);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#chatStatus').textContent === 'Conversa atualizada.' &&
        document.querySelectorAll('#messages .bubble').length === 8);
    assert.equal(await page.evaluate((uid) => sessionStorage.getItem(`sylvinho:pendente:${uid}`), session.uid), null);
    const recovered = await localJson(`${documents}/users/${session.uid}/conversas/${conversationId}`, { headers: { Authorization: 'Bearer owner' } });
    const recoveredMessages = recovered.fields.mensagens.arrayValue.values;
    assert.equal(recoveredMessages.length, 8);
    assert.equal(recoveredMessages.filter((m) => m.mapValue.fields.messageId?.stringValue === lostMessageId).length, 2);
    finalItems = recoveredMessages.map((m) => ({ remetente: m.mapValue.fields.remetente.stringValue, texto: m.mapValue.fields.texto.stringValue }));
    assert.deepEqual(await page.locator('#messages .bubble').allTextContents(), finalItems.map((m) => m.texto));
    states.push('resposta HTTP perdida apos commit; recarga recupera mesmo messageId sem duplicar pergunta ou bot');
    const evidence = JSON.parse(readFileSync(resolve(stage, 'function-evidence.json'), 'utf8'));
    assert.equal(evidence.uid, session.uid);
    assert.equal(evidence.tokenValidado, true);
    assert.equal(evidence.geracoes, 4);
    assert.equal(evidence.resultados[0].ativoNoContexto, true);
    assert.equal(evidence.resultados[0].status, 'trechos_encontrados');
    assert.equal(evidence.resultados[2].status, 'informacao_insuficiente');
    assert.equal(evidence.inativoNoContexto, false);
    assert.equal(requests.filter((item) => item.origin === 'http://127.0.0.1:5001' && item.method === 'POST').length, 4);
    assert.equal(pageErrors.length, 0, 'JavaScript da Home sem erros');
    // A Home original solicita Google Fonts. Preservamos HTML/CSS e o bloqueio:
    // somente essa tentativa de asset conhecido pode existir, sem sair da rede.
    assert.ok(blocked.every((url) => url === 'https://fonts.googleapis.com/css2'),
        'Nenhuma tentativa Firebase/Gemini ou destino externo inesperado');
    states.push('user salvo uma vez -> token validado -> RAG ativo -> resposta documental -> bot -> releitura confirmada');
    await page.screenshot({ path: resolve(stage, 'home-e2e.png'), fullPage: true });
    const result = { project, database: '(default)', endpoint, uid: session.uid, conversationId, items: finalItems, evidence, securityResults,
        ports: Object.fromEntries(['auth', 'firestore', 'functions', 'hosting'].map((name) => [name, hub[name].port])),
        states, requests, blocked, pageErrors, productionAccess: false, geminiCalls: 0 };
    writeFileSync(resolve(stage, 'result.json'), JSON.stringify(result, null, 2));
    writeFileSync(resolve(stage, 'emulators-sanitized.log'), logs);
    console.log(JSON.stringify({ success: true, uid: session.uid, conversationId, messages: finalItems.length, evidence, ports: result.ports, states }, null, 2));
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
