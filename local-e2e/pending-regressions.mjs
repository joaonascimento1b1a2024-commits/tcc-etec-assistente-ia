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
