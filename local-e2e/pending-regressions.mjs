import assert from 'node:assert/strict';

export async function validarPendenciasNoNavegador(page, uid, states) {
    const origin = 'http://127.0.0.1:5000';
    assert.equal(new URL(page.url()).origin, origin);
    const home = origin + '/Logado/Home/home.html';
    const ready = () => page.waitForFunction(() => globalThis.__LOCAL_E2E__ &&
        document.querySelector('#chatStatus')?.textContent === 'As mensagens são salvas na sua conta.');
    let requests = 0;
    const count = request => { if (request.method() === 'POST' && new URL(request.url()).port === '5001') requests++; };
    page.on('request', count);
    async function newChat(confirm) {
        const handled = new Promise((resolve, reject) => {
            page.once('dialog', async dialog => {
                try {
                    if (confirm) await dialog.accept(); else await dialog.dismiss();
                    resolve();
                } catch (error) { reject(error); }
            });
        });
        await Promise.all([handled, page.locator('#newChat').click()]);
    }
    try {
        await page.goto(home); await ready();
        await page.evaluate(uid => sessionStorage.setItem('sylvinho:pendente:' + uid, '{'), uid);
        await page.reload();
        await page.locator('#chatStatus').filter({ hasText: 'Não foi possível abrir o histórico' }).waitFor();
        await newChat(false);
        assert.equal(await page.evaluate(uid => sessionStorage.getItem('sylvinho:pendente:' + uid), uid), '{');
        await Promise.all([page.waitForEvent('load'), newChat(true)]);
        await ready();
        assert.equal(await page.evaluate(uid => sessionStorage.getItem('sylvinho:pendente:' + uid), uid), null);
        states.push('pendência inválida: cancelar preserva bytes; confirmar descarte reabre Home sem enviar pergunta');

        await page.evaluate(() => {
            window.__fixtureStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
            Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Fixture: blocked storage', 'SecurityError'); } });
        });
        try {
            await newChat(true);
            await page.locator('#chatStatus').filter({ hasText: 'descarte vale somente nesta página' }).waitFor();
            assert.equal(await page.locator('#homeScreen').isVisible(), true);
        } finally {
            await page.evaluate(() => {
                Object.defineProperty(window, 'sessionStorage', window.__fixtureStorageDescriptor);
                delete window.__fixtureStorageDescriptor;
            });
        }
        await page.reload(); await ready();
        const result = await page.evaluate(async uid => {
            const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
            const sdk = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const { createConversationStore } = await import('/Logado/Conversas/conversation-store.js');
            const store = await createConversationStore(getApp(), uid);
            const id = await store.append(null, 'Pergunta fixture para testar exclusão confirmada.', crypto.randomUUID(), Date.now());
            sessionStorage.setItem('sylvinho:pendente:' + uid, '{');
            await store.remove(id);
            const snapshot = await sdk.getDocFromServer(sdk.doc(sdk.getFirestore(), 'users', uid, 'conversas', id));
            const raw = sessionStorage.getItem('sylvinho:pendente:' + uid);
            sessionStorage.removeItem('sylvinho:pendente:' + uid);
            return { exists: snapshot.exists(), raw };
        }, uid);
        assert.equal(result.exists, false);
        assert.equal(result.raw, '{', 'cache inválido não deve apagar uma pendência sem identificação');
        assert.equal(requests, 0, 'Novo chat e limpeza local não geram IDs/requisições ao backend');
        states.push('storage indisponível não bloqueia Novo chat; exclusão real no Firestore Emulator resolve apesar de cache inválido');
    } finally { page.off('request', count); }
}

export async function validarConfiabilidadeNoNavegador({ page, context, uid, states }) {
    const origin = 'http://127.0.0.1:5000';
    const endpoint = origin.replace(':5000', ':5001') + '/demo-sylvinho-render-poc/southamerica-east1/perguntarAssistente';
    const home = origin + '/Logado/Home/home.html';
    const ready = p => p.waitForFunction(() => globalThis.__LOCAL_E2E__ &&
        document.querySelector('#chatStatus')?.textContent === 'As mensagens são salvas na sua conta.');
    const question = 'Como faço minha matrícula?';
    const readConversation = (p, id) => p.evaluate(async id => {
        const sdk = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
        const snapshot = await sdk.getDocFromServer(sdk.doc(sdk.getFirestore(), 'users', getAuth().currentUser.uid, 'conversas', id));
        return snapshot.exists() ? snapshot.data().mensagens : null;
    }, id);
    const removeConversation = (p, id) => p.evaluate(async id => {
        const sdk = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
        await sdk.deleteDoc(sdk.doc(sdk.getFirestore(), 'users', getAuth().currentUser.uid, 'conversas', id));
    }, id);
    const discard = async () => {
        const handled = new Promise((resolve, reject) => page.once('dialog', async dialog => {
            try { await dialog.accept(); resolve(); } catch (error) { reject(error); }
        }));
        await Promise.all([page.waitForEvent('load'), handled, page.locator('#newChat').click()]);
        await ready(page);
    };
    await page.goto(home); await ready(page);
    await page.evaluate(uid => {
        window.__removeItemFixture = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function(key) {
            if (key === 'sylvinho:pendente:' + uid) throw new DOMException('Fixture: cleanup blocked', 'SecurityError');
            return window.__removeItemFixture.call(this, key);
        };
    }, uid);
    let first;
    try {
        await page.locator('#messageInput').fill(question);
        const posted = page.waitForResponse(r => r.url() === endpoint && r.request().method() === 'POST');
        await page.locator('#messageForm [type=submit]').click();
        const response = await posted;
        assert.equal(response.status(), 200);
        first = response.request().postDataJSON();
        await page.locator('#chatStatus').filter({ hasText: 'Resposta confirmada e salva.' }).waitFor();
        assert.equal(await page.locator('.message-row.bot').count(), 1);
        assert.equal((await readConversation(page, first.conversationId)).length, 2);
        const pending = await page.evaluate(uid => JSON.parse(sessionStorage.getItem('sylvinho:pendente:' + uid)), uid);
        assert.equal(pending.messageId, first.messageId);
    } finally {
        await page.evaluate(() => { Storage.prototype.removeItem = window.__removeItemFixture; delete window.__removeItemFixture; });
    }
    const retry = page.waitForRequest(r => r.url() === endpoint && r.method() === 'POST');
    await page.reload();
    assert.equal((await retry).postDataJSON().messageId, first.messageId);
    await page.locator('#chatStatus').filter({ hasText: 'Conversa atualizada.' }).waitFor();
    assert.equal((await readConversation(page, first.conversationId)).length, 2);
    assert.equal(await page.locator('.message-row.bot').count(), 1);
    assert.equal(await page.evaluate(uid => sessionStorage.getItem('sylvinho:pendente:' + uid), uid), null);
    await removeConversation(page, first.conversationId);
    states.push('limpeza local bloqueada: bot confirmado permanece visível; recarga reutiliza ID e mantém somente uma resposta');

    await page.goto(home); await ready(page);
    // Fixture do estado incerto: a primeira criação ocorreu, mas o cache ainda diz novaConversa=true.
    const uncertain = await page.evaluate(async ({ uid, question }) => {
        const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
        const { createConversationStore } = await import('/Logado/Conversas/conversation-store.js');
        const store = await createConversationStore(getApp(), uid);
        const envio = { version: 1, conversationId: store.reserve(), messageId: crypto.randomUUID(),
            pergunta: question, enviadoEm: Date.now(), novaConversa: true };
        await store.append(envio.conversationId, question, envio.messageId, envio.enviadoEm, { create: true });
        sessionStorage.setItem('sylvinho:pendente:' + uid, JSON.stringify(envio));
        return envio;
    }, { uid, question });
    const other = await context.newPage();
    let requests = 0;
    const count = r => { if (r.url() === endpoint && r.method() === 'POST') requests++; };
    page.on('request', count);
    try {
        await other.goto(home); await ready(other);
        await removeConversation(other, uncertain.conversationId);
        await page.reload();
        await page.locator('#chatStatus').filter({ hasText: 'Conversa excluída.' }).waitFor();
        assert.equal(await readConversation(page, uncertain.conversationId), null);
        assert.equal(requests, 0);
        assert.equal(await page.evaluate(uid => JSON.parse(sessionStorage.getItem('sylvinho:pendente:' + uid)).messageId, uid), uncertain.messageId);
        await discard();
        assert.equal(await readConversation(page, uncertain.conversationId), null);
        states.push('exclusão em outra aba: cache com novaConversa=true não recria documento nem chama Function; descarte exige confirmação');

        // Exclui depois do append da Home, mas antes da Function receber a requisição.
        let deletedId;
        const deleting = async route => {
            if (route.request().method() !== 'POST') return route.continue();
            deletedId = route.request().postDataJSON().conversationId;
            await removeConversation(other, deletedId);
            const response = await route.fetch();
            assert.equal(response.status(), 404);
            await route.fulfill({ response });
        };
        await context.route(endpoint, deleting);
        try {
            await page.locator('#messageInput').fill(question);
            await page.locator('#messageForm [type=submit]').click();
            await page.locator('#chatStatus').filter({ hasText: 'Recarregue para recuperar o envio' }).waitFor();
        } finally { await context.unroute(endpoint, deleting); }
        assert.equal(await readConversation(page, deletedId), null);
        const pendingId = await page.evaluate(uid => JSON.parse(sessionStorage.getItem('sylvinho:pendente:' + uid)).messageId, uid);
        const before = requests;
        await page.goto(home);
        await page.locator('#chatStatus').filter({ hasText: 'Conversa excluída.' }).waitFor();
        assert.equal(await readConversation(page, deletedId), null);
        assert.equal(requests, before);
        assert.equal(await page.evaluate(uid => JSON.parse(sessionStorage.getItem('sylvinho:pendente:' + uid)).messageId, uid), pendingId);
        await discard();
        states.push('exclusão durante envio: Function retorna 404, documento continua ausente e retomada não recria nem troca messageId');
    } finally { page.off('request', count); await other.close(); }
}
