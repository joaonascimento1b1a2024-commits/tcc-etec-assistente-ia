import { localizarFerramentas, localizarPlaywright } from './environment.mjs';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { prepare, root, stage as authStage } from './prepare-auth.mjs';
import { prepare as prepareHistory, stage as historyStage } from './prepare-history.mjs';
import { validarPendenciasNoNavegador, validarConfiabilidadeNoNavegador } from './pending-regressions.mjs';
import { endpointDocumental, prepararFixturesDocumentais, enviarPerguntaDocumental,
    validarRecuperacaoDocumental, validarFunctionOutroUid, validarAusenciaAcademica } from './documental-scenarios.mjs';
const documental = process.argv.includes('--documental');
const academica = process.argv.includes('--academica');
if (academica && !documental) throw new Error('ACADEMIC_REQUIRES_DOCUMENTAL');
const stage = documental ? historyStage : authStage;


const project = 'demo-sylvinho-render-poc';

const { javaHome, cli } = localizarFerramentas();

const runtimeModules = localizarPlaywright();
const localRequire = createRequire(resolve(runtimeModules, 'package.json'));
const { chromium } = localRequire('playwright');
if (documental) prepareHistory({ authMode: 'password', academica });
else prepare({ authMode: 'password' });
const home = resolve(stage, `isolated-home-auth-${Date.now()}`);
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

try {
    assert.ok(project.startsWith('demo-'));
    assert.equal(existsSync(env.GOOGLE_APPLICATION_CREDENTIALS), false);
    const cliVersion = spawnSync(process.execPath, [cli, '--version'], { cwd: stage, env, encoding: 'utf8' });
    assert.equal(cliVersion.status, 0, 'CLI deve funcionar no HOME isolado');
    assert.match(cliVersion.stdout.trim(), /^15\.(33|34)\.\d+$/);
    const java = spawnSync(resolve(javaHome, 'bin/java.exe'), ['-version'], { encoding: 'utf8' });
    assert.equal(java.status, 0);
    assert.match(java.stderr, /version "21\./);
    for (const port of [9099, 8080, 5000, 4400, 4500, 9150, ...(documental ? [5001] : [])]) {
        await new Promise((done, reject) => {
            const server = createServer();
            server.once('error', () => reject(new Error(`LOCAL_PORT_UNAVAILABLE_${port}`)));
            server.listen(port, '127.0.0.1', () => server.close(done));
        });
    }
    console.log('Java 21, CLI ' + cliVersion.stdout.trim() + ', portas e isolamento demo confirmados.');
    assert.ok(existsSync(resolve(env.FIREBASE_EMULATORS_PATH, 'cloud-firestore-emulator-v1.22.0.jar')), 'Artefato local necessário');
    states.push('artefato Firestore existente, sem download');
    child = spawn(process.execPath, [cli, 'emulators:start', '--only', documental ? 'auth,firestore,functions,hosting' : 'auth,firestore,hosting',
        '--project', project, '--config', resolve(stage, 'firebase.json')], { cwd: stage, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', safeLog);
    child.stderr.on('data', safeLog);
    console.log('CLI local iniciado; aguardando Auth, Firestore e Hosting.');
    let hub;
    for (let n = 0; n < 180; n++) {
        if (child.exitCode !== null) throw new Error('EMULATORS_EXITED');
        try {
            hub = await localJson('http://127.0.0.1:4400/emulators');
            if (['auth', 'firestore', 'hosting', ...(documental ? ['functions'] : [])].every((name) => hub[name])) break;
        } catch { /* Aguarda apenas endpoints loopback. */ }
        await delay(1000);
    }
    for (const [name, port] of Object.entries({ auth: 9099, firestore: 8080, hosting: 5000, ...(documental ? { functions: 5001 } : {}) })) {
        assert.equal(hub?.[name]?.port, port, `Porta ${name}`);
    }
    states.push('Auth, Firestore e Hosting confirmados pelo Emulator Hub');
    const documents = 'http://127.0.0.1:8080/v1/projects/' + project + '/databases/(default)/documents';
    if (documental) {
        for (let n = 0; n < 60 && !logs.includes(endpointDocumental); n++) {
            if (child.exitCode !== null || logs.includes('Failed to load function definition')) throw new Error('LOCAL_FUNCTION_DISCOVERY_FAILED');
            await delay(1000);
        }
        assert.ok(logs.includes(endpointDocumental), 'Function demo deve estar pronta');
        await prepararFixturesDocumentais(academica);
        states.push('Function documental pronta; fixtures ativa/inativa gravadas somente no Firestore Emulator');
    }
    let primeiroEnvio;
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'] });
    async function newContext(options = {}) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
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
        return context;
    }
    const context = await newContext();
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message.split('\n')[0].replace(/\?\S+/g, '?[redacted]')));
    const origin = 'http://127.0.0.1:5000';
    async function goLogin(p = page) {
        await p.goto(`${origin}/Login/login.html`);
        await p.waitForFunction(() => globalThis.__LOCAL_E2E__);
    }
    async function session(p = page) {
        return p.evaluate(async () => {
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
            const auth = getAuth(); await auth.authStateReady();
            return { uid: auth.currentUser?.uid || null, anonymous: auth.currentUser?.isAnonymous || false };
        });
    }
    async function homeReady(p = page) {
        await p.waitForURL('**/Logado/Home/home.html*');
        await p.waitForFunction(() => globalThis.__LOCAL_E2E__ && document.querySelector('#chatStatus')?.textContent === 'As mensagens são salvas na sua conta.' && !document.querySelector('#messageInput').disabled, null, { timeout: 30000 });
    }
    async function login(email, password, remember = true, p = page) {
        await p.locator('[name=identifier]').fill(email);
        await p.locator('[name=password]').fill(password);
        await p.locator('#remember').setChecked(remember);
        await p.locator('button[type=submit]').click();
        await homeReady(p);
        return (await session(p)).uid;
    }
    async function signup(email, name) {
        await page.goto(`${origin}/Criar-Conta/cadastro.html`);
        await page.waitForFunction(() => globalThis.__LOCAL_E2E__);
        await page.locator('[name=nome]').fill(name);
        await page.locator('[name=email]').fill(email);
        await page.locator('[name=password]').fill('Fixture-Only-2026!');
        await page.locator('[name="confirm-password"]').fill('Fixture-Only-2026!');
        const before = requests.filter(r => r.path.endsWith('accounts:signUp')).length;
        await page.locator('button[type=submit]').click();
        await page.locator('#form-message').filter({ hasText: 'termos' }).waitFor();
        assert.equal(requests.filter(r => r.path.endsWith('accounts:signUp')).length, before);
        await page.locator('[name=terms]').check();
        await page.locator('[name="confirm-password"]').fill('Different-Fixture-Only!');
        await page.locator('button[type=submit]').click();
        await page.locator('#form-message').filter({ hasText: 'não coincidem' }).waitFor();
        await page.locator('[name="confirm-password"]').fill('Fixture-Only-2026!');
        await page.locator('button[type=submit]').click();
        await page.waitForURL('**/Login/login.html');
        await page.waitForFunction(() => globalThis.__LOCAL_E2E__);
        assert.equal((await session()).uid, null, 'cadastro direcionado ao Login encerra sessão');
        const profiles = await localJson(`${documents}/users`, { headers: { Authorization: 'Bearer owner' } });
        const profile = profiles.documents.find(d => d.fields.email.stringValue === email);
        assert.ok(profile);
        const uid = profile.fields.uid.stringValue;
        assert.equal(profile.fields.nome.stringValue, name);
        assert.deepEqual(Object.keys(profile.fields).sort(), ['createdAt', 'email', 'nome', 'uid']);
        assert.equal((await fetch(`${documents}/administradores/${uid}`, { headers: { Authorization: 'Bearer owner' } })).status, 404);
        return uid;
    }
    async function logout() {
        await page.goto(`${origin}/Logado/Configura%C3%A7%C3%B5es%20Aluno/configAl.html`);
        await page.waitForFunction(() => { const control = document.querySelector('#logout'); return control && !control.disabled; });
        await page.locator('#logout').click();
        await page.waitForURL('**/Login/login.html');
        await page.waitForFunction(() => globalThis.__LOCAL_E2E__);
        assert.equal((await session()).uid, null);
    }
    // Cria somente pergunta própria pelo store real, sem Function, bot ou conteúdo institucional.
    async function sendQuestion(insuficiente = false) {
        if (documental) {
            const envio = await enviarPerguntaDocumental(page,
                insuficiente ? 'Qual procedimento para transporte interplanetario?' : 'Como faço minha matrícula?', insuficiente, academica);
            if (!primeiroEnvio) primeiroEnvio = envio;
            return envio.body.conversationId;
        }
        const id = await page.evaluate(async () => {
            const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
            const { createConversationStore } = await import('/Logado/Conversas/conversation-store.js');
            const store = await createConversationStore(getApp(), getAuth().currentUser.uid);
            return store.append(null, 'Pergunta fictícia para validar histórico por UID.', crypto.randomUUID(), Date.now());
        });
        return id;
    }
    for (const path of ['Logado/Home/home.html', 'Logado/Conversas/conversas.html']) {
        await page.goto(`${origin}/${path}`);
        await page.waitForURL('**/Login/login.html');
        await page.waitForFunction(() => globalThis.__LOCAL_E2E__);
        assert.equal((await session()).uid, null);
    }
    states.push('visitante sem sessão redirecionado da Home e Conversas para Login');
    const uidA = await signup('aluno-a@fixture.invalid', 'Aluno Fictício A');
    states.push('cadastro A: campos/termos e confirmação validados; perfil sem cargo; sessão encerrada');
    await page.locator('[name=identifier]').fill('aluno-a@fixture.invalid');
    await page.locator('[name=password]').fill('Incorrect-Fixture-Only!');
    await page.locator('button[type=submit]').click();
    await page.locator('#form-message').filter({ hasText: 'incorretos' }).waitFor();
    assert.equal((await session()).uid, null);
    assert.equal(await login('aluno-a@fixture.invalid', 'Fixture-Only-2026!'), uidA);
    assert.equal((await session()).anonymous, false);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    const conversationA = await sendQuestion();
    await page.goto(`${origin}/Logado/Conversas/conversas.html`);
    const linkA = page.locator(`.conversation-link[href$="conversa=${conversationA}"]`);
    await linkA.waitFor(); assert.equal((await session()).uid, uidA);
    await linkA.click(); await homeReady();
    await page.waitForFunction(count => document.querySelectorAll('.message-row').length === count, documental ? 2 : 1);
    assert.equal(await page.locator('.message-row').count(), documental ? 2 : 1);
    await page.reload(); await homeReady(); assert.equal((await session()).uid, uidA);
    await page.waitForFunction(count => document.querySelectorAll('.message-row').length === count, documental ? 2 : 1);
    assert.equal(await page.locator('.message-row').count(), documental ? 2 : 1);
    const restoredTab = await context.newPage();
    await restoredTab.goto(`${origin}/Logado/Home/home.html`); await homeReady(restoredTab);
    assert.equal((await session(restoredTab)).uid, uidA);
    await restoredTab.close();
    // Recria um contexto com o armazenamento persistente, sem sessão em memória.
    const restartedContext = await newContext({ storageState: await context.storageState({ indexedDB: true }) });
    const restartedPage = await restartedContext.newPage();
    await restartedPage.goto(`${origin}/Logado/Home/home.html`); await homeReady(restartedPage);
    assert.equal((await session(restartedPage)).uid, uidA);
    await restartedContext.close();
    states.push('login A: senha inválida rejeitada; UID consistente; histórico reaberto; sessão restaurada em reload, nova aba e contexto recriado com IndexedDB');
    if (documental) await validarRecuperacaoDocumental({ page, context, envio: primeiroEnvio, uid: uidA, states });
    if (documental) await validarConfiabilidadeNoNavegador({ page, context, uid: uidA, states });
    if (academica) await validarAusenciaAcademica(page, uidA, states);
    // Conteúdo acadêmico: página raiz e Avisos/Serviços não oferecem atendimento real.
    const demoTab = await context.newPage();
    const demoRequests = [];
    demoTab.on('request', request => demoRequests.push(request.url()));
    await demoTab.goto(origin + '/Logado/Avisos/avisos.html');
    await demoTab.locator('#noticeList').filter({ hasText: 'Fixture de demonstração' }).waitFor();
    assert.equal(demoRequests.some(url => url.includes(':8080/') || url.includes('firestore.googleapis.com')), false);
    await demoTab.goto(origin + '/Logado/Servi%C3%A7os/servicos.html');
    assert.equal(await demoTab.locator('#whatsapp-link').getAttribute('href'), '../Home/home.html');
    await demoTab.goto(origin + '/');
    assert.equal(await demoTab.locator('.academic-demo-banner').isVisible(), true);
    for (const width of [1280, 390]) {
        await demoTab.setViewportSize({ width, height: 900 });
        for (const path of ['/', '/Logado/Avisos/avisos.html', '/Logado/Servi%C3%A7os/servicos.html']) {
            await demoTab.goto(origin + path);
            assert.equal(await demoTab.locator('.academic-demo-banner').isVisible(), true);
            assert.equal(await demoTab.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Layout demo: ' + path);
        }
    }
    await demoTab.close();
    states.push('raiz identificada; Avisos fictícios sem consultas ao Firestore; Serviços aponta apenas ao chat web');
    // Navegação real pelos links, tema persistido e layout desktop/mobile.
    await page.locator('#settingsLink').click();
    await page.waitForFunction(() => { const control = document.querySelector('#theme'); return control && !control.disabled; });
    await page.locator('#theme').selectOption('light');
    await page.locator('#preference-status').filter({ hasText: 'Tema salvo.' }).waitFor();
    for (const path of ['../Home/home.html', '../Conversas/conversas.html']) {
        const destination = new URL(path, page.url()).href;
        await page.locator('nav a[href="' + path + '"]').click();
        await page.waitForURL(destination);
        await page.waitForFunction(() => globalThis.__LOCAL_E2E__);
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        assert.equal((await session()).uid, uidA);
    }
    const layouts = [];
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ['Logado/Home/home.html', 'Logado/Conversas/conversas.html', 'Logado/Configura%C3%A7%C3%B5es%20Aluno/configAl.html']) {
            await page.goto(origin + '/' + path);
            await page.waitForFunction(() => globalThis.__LOCAL_E2E__);
            if (path.includes('configAl')) await page.waitForFunction(() => { const control = document.querySelector('#theme'); return control && !control.disabled; });
            else if (path.includes('home.html')) await homeReady();
            else await page.locator('.conversation-link').first().waitFor();
            assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
            assert.equal(await page.locator('.academic-demo-banner').isVisible(), true);
            assert.match(await page.locator('.academic-demo-banner').innerText(), /não é atendimento oficial da escola/);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
            assert.equal(overflow, false, 'Overflow horizontal: ' + path + ' @ ' + width);
            assert.ok(await page.locator('nav a').count() > 0);
            layouts.push({ width, path, horizontalOverflow: overflow });
            await page.screenshot({ path: resolve(stage, 'layout-' + width + '-' + path.split('/').at(-1).replace('.html', '') + '.png'), fullPage: true });
        }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    states.push('links Home/Conversas/Configurações clicados; tema claro salvo/restaurado; layouts 1280/390 sem overflow horizontal');
    await logout();
    await page.goto(`${origin}/Logado/Home/home.html`); await page.waitForURL('**/Login/login.html');
    states.push('logout A: Auth sem usuário; acesso posterior redirecionado');
    const uidB = await signup('aluno-b@fixture.invalid', 'Aluno Fictício B');
    assert.notEqual(uidA, uidB);
    assert.equal(await login('aluno-b@fixture.invalid', 'Fixture-Only-2026!', false), uidB);
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    const conversationB = await sendQuestion(documental);
    if (documental) {
        await validarFunctionOutroUid(page, conversationA);
        states.push('B: recusa sem evidência persistida; Function rejeita conversa do UID A');
    }
    await page.reload(); await homeReady(); assert.equal((await session()).uid, uidB);
    await page.goto(`${origin}/Logado/Conversas/conversas.html`);
    await page.locator(`.conversation-link[href$="conversa=${conversationB}"]`).waitFor();
    assert.equal(await page.locator(`.conversation-link[href$="conversa=${conversationA}"]`).count(), 0);
    const isolation = await page.evaluate(async ({ otherUid, conversationId }) => {
        const sdk = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
        const db = sdk.getFirestore();
        const ref = sdk.doc(db, 'users', otherUid, 'conversas', conversationId);
        const code = async action => { try { await action(); return 'ALLOWED'; } catch (e) { return e.code; } };
        return {
            read: await code(() => sdk.getDocFromServer(ref)),
            edit: await code(() => sdk.updateDoc(ref, { titulo: 'Tentativa fixture' })),
            remove: await code(() => sdk.deleteDoc(ref)),
            promote: await code(() => sdk.setDoc(sdk.doc(db, 'administradores', getAuth().currentUser.uid), {
                ativo: true, promovidoPor: getAuth().currentUser.uid, criadoEm: sdk.serverTimestamp(),
            })),
        };
    }, { otherUid: uidA, conversationId: conversationA });
    for (const value of Object.values(isolation)) assert.equal(value, 'permission-denied');
    // Com persistência de sessão, uma nova aba não herda a conta B.
    const sessionTab = await context.newPage();
    await sessionTab.goto(`${origin}/Logado/Home/home.html`);
    await sessionTab.waitForURL('**/Login/login.html');
    await sessionTab.waitForFunction(() => globalThis.__LOCAL_E2E__);
    assert.equal((await session(sessionTab)).uid, null); await sessionTab.close();
    states.push('cadastro/login B: UID diferente; sessionPersistence restaura reload, nova aba permanece sem sessão; leitura/edição/exclusão de A e autopromoção negadas');
    await logout();
    await page.locator('[name=identifier]').fill('aluno-a@fixture.invalid');
    await page.locator('a[href="#forgot-password"]').click();
    await page.locator('#form-message.success').waitFor();
    const actions = await localJson(`http://127.0.0.1:9099/emulator/v1/projects/${project}/oobCodes`);
    const action = actions.oobCodes.find(a => a.email === 'aluno-a@fixture.invalid' && a.requestType === 'PASSWORD_RESET');
    assert.ok(action?.oobCode, 'código disponível apenas no emulador');
    await localJson('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=local-emulator-only', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode: action.oobCode, newPassword: 'Updated-Fixture-Only-2026!' }),
    });
    assert.equal(await login('aluno-a@fixture.invalid', 'Updated-Fixture-Only-2026!'), uidA);
    states.push('recuperação de senha: UI solicita OOB local; código consumido no emulador; nova senha autentica com mesmo UID; nenhum e-mail real');
    await page.goto(`${origin}/Logado/Conversas/conversas.html`);
    await page.locator(`.conversation-link[href$="conversa=${conversationA}"]`).waitFor();
    assert.equal((await session()).uid, uidA);
    assert.equal(await page.locator(`.conversation-link[href$="conversa=${conversationB}"]`).count(), 0);
    const reverseIsolation = await page.evaluate(async ({ otherUid, conversationId }) => {
        const sdk = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
        const ref = sdk.doc(sdk.getFirestore(), 'users', otherUid, 'conversas', conversationId);
        const code = async action => { try { await action(); return 'ALLOWED'; } catch (e) { return e.code; } };
        return {
            read: await code(() => sdk.getDocFromServer(ref)),
            edit: await code(() => sdk.updateDoc(ref, { titulo: 'Tentativa fixture inversa' })),
            remove: await code(() => sdk.deleteDoc(ref)),
        };
    }, { otherUid: uidB, conversationId: conversationB });
    for (const value of Object.values(reverseIsolation)) assert.equal(value, 'permission-denied');
    states.push('isolamento inverso: A vê somente sua conversa; leitura/edição/exclusão da conversa de B negadas');
    if (documental) await validarPendenciasNoNavegador(page, uidA, states);
    await logout();
    const profileA = await localJson(`${documents}/users/${uidA}/conversas/${conversationA}`, { headers: { Authorization: 'Bearer owner' } });
    assert.equal(profileA.fields.mensagens.arrayValue.values.length, documental ? 4 : 1);
    const profileB = await localJson(`${documents}/users/${uidB}/conversas/${conversationB}`, { headers: { Authorization: 'Bearer owner' } });
    assert.equal(profileB.fields.mensagens.arrayValue.values.length, documental ? 2 : 1);
    if (documental) {
        const evidence = JSON.parse(readFileSync(resolve(stage, 'function-evidence.json'), 'utf8'));
        assert.equal(evidence.tokenValidado, true);
        assert.equal(evidence.uid, uidB);
        assert.equal(evidence.geracoes, academica ? 5 : 4); // Inclui a resposta da regressão de limpeza local.
        assert.equal(evidence.inativoNoContexto, false);
        assert.equal(evidence.resultados.at(-1).status, 'informacao_insuficiente');
    }
    assert.ok(blocked.every(url => url === 'https://fonts.googleapis.com/css2'));
    assert.equal(pageErrors.length, 0, 'sem erros JavaScript nas telas');
    await page.screenshot({ path: resolve(stage, 'auth-e2e.png'), fullPage: true });
    const result = { success: true, documental, layouts, project, browser: 'Microsoft Edge', uidA, uidB, conversationA, conversationB,
        states, isolation, reverseIsolation, pageErrors, requests, blocked, productionAccess: false, geminiCalls: 0,
        google: 'Código existente; OAuth real não validado. Não foi utilizado popup Google.' };
    writeFileSync(resolve(stage, 'auth-result.json'), JSON.stringify(result, null, 2));
    writeFileSync(resolve(stage, 'auth-emulators-sanitized.log'), logs);
    console.log(JSON.stringify({ success: true, states, isolation, reverseIsolation, pageErrors }, null, 2));
} catch (error) {
    writeFileSync(resolve(stage, 'auth-failure.json'), JSON.stringify({ error: error.code || error.message, reason: error.message, stack: error.stack, states, pageErrors, blocked }, null, 2));
    writeFileSync(resolve(stage, 'auth-emulators-sanitized.log'), logs);
    console.error('LOCAL_AUTH_E2E_FAILED:', error.code || error.message);
    process.exitCode = 1;
} finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) {
        try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { child.kill(); }
    }
}
