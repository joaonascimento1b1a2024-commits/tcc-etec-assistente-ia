import assert from 'node:assert/strict';

const project = 'demo-sylvinho-render-poc';
export const endpointDocumental = `http://127.0.0.1:5001/${project}/southamerica-east1/perguntarAssistente`;
export const documentsDocumentais = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;

async function local(url, options) {
    assert.ok(url === endpointDocumental || url.startsWith(documentsDocumentais + '/users/') || url === documentsDocumentais + ':commit');
    return fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
}
function encode(value) {
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') return { integerValue: String(value) };
    if (typeof value === 'string') return { stringValue: value };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, data]) => [key, encode(data)])) } };
}
export async function prepararFixturesDocumentais() {
    const fixture = ativo => ({ documentoId: 'documento-ficticio', versaoDocumento: 'teste-local', ativo,
        tipoConteudo: 'procedimento', titulo: 'Matricula local ficticia', categoria: 'matricula',
        termosBusca: ['matricula'], secao: 'Teste local', paginaInicial: 1, paginaFinal: 1,
        conteudo: ativo ? 'MARCADOR_ATIVO_MATRICULA: matricula na secretaria simulada.' :
            'MARCADOR_INATIVO_PROIBIDO: matricula que nao pode participar do contexto.' });
    const response = await local(documentsDocumentais + ':commit', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({ writes: [true, false].map(ativo => ({ update: {
            name: `projects/${project}/databases/(default)/documents/conhecimento/fixture-${ativo ? 'ativo' : 'inativo'}`,
            fields: encode(fixture(ativo)).mapValue.fields,
        } })) }) });
    assert.equal(response.status, 200);
}
export async function enviarPerguntaDocumental(page, pergunta = 'Como faço minha matrícula?', insuficiente = false) {
    await page.locator('#messageInput').fill(pergunta);
    const waiting = page.waitForResponse(r => r.url() === endpointDocumental && r.request().method() === 'POST');
    await page.locator('#messageForm button[type=submit]').click();
    const response = await waiting;
    assert.equal(response.status(), 200);
    const body = response.request().postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), ['conversationId', 'messageId', 'pergunta']);
    assert.match(body.messageId, /^[A-Za-z0-9_-]{20,80}$/);
    assert.ok((await response.request().allHeaders()).authorization?.startsWith('Bearer '));
    const data = await response.json();
    assert.deepEqual(Object.keys(data), ['resposta']);
    if (insuficiente) assert.match(data.resposta, /Nao ha informacao suficiente/);
    else { assert.match(data.resposta, /MARCADOR_ATIVO_MATRICULA/); assert.match(data.resposta, /documento-ficticio/); }
    assert.doesNotMatch(data.resposta, /MARCADOR_INATIVO_PROIBIDO/);
    await page.waitForFunction(() => document.querySelector('#chatStatus')?.textContent === 'Conversa atualizada.');
    assert.equal(await page.locator('.message-row.bot').count(), 1);
    assert.equal(await page.locator('.message-row.bot .bubble').innerText(), data.resposta);
    assert.equal(new URL(page.url()).searchParams.get('conversa'), body.conversationId);
    return { body, resposta: data.resposta };
}
export async function validarRecuperacaoDocumental({ page, context, envio, uid, states }) {
    const token = await page.evaluate(async () => (await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js')).getAuth().currentUser.getIdToken());
    const post = (authorization, body = envio.body) => local(endpointDocumental, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) });
    assert.equal((await post(null)).status, 401);
    assert.equal((await post('Bearer token-emulado-invalido')).status, 401);
    const replay = await post('Bearer ' + token);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).resposta, envio.resposta);
    states.push('Function emulada: token ausente/inválido rejeitado; replay autenticado retorna resposta persistida');
    let lostId;
    const lose = async route => {
        if (route.request().method() !== 'POST') return route.continue();
        lostId = route.request().postDataJSON().messageId;
        const committed = await route.fetch();
        assert.equal(committed.status(), 200);
        await route.abort('failed');
        await context.unroute(endpointDocumental, lose);
    };
    await context.route(endpointDocumental, lose);
    await page.locator('#messageInput').fill('Como faço minha matrícula?');
    await page.locator('#messageForm button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#chatStatus')?.textContent.includes('Recarregue para recuperar'));
    const pending = await page.evaluate(uid => JSON.parse(sessionStorage.getItem('sylvinho:pendente:' + uid)), uid);
    assert.equal(pending.messageId, lostId);
    assert.equal(pending.conversationId, envio.body.conversationId);
    const retry = page.waitForRequest(r => r.url() === endpointDocumental && r.method() === 'POST');
    await page.reload();
    assert.equal((await retry).postDataJSON().messageId, lostId);
    await page.waitForFunction(() => document.querySelector('#chatStatus')?.textContent === 'Conversa atualizada.');
    assert.equal(await page.locator('.message-row').count(), 4);
    assert.equal(await page.evaluate(uid => sessionStorage.getItem('sylvinho:pendente:' + uid), uid), null);
    const saved = await local(`${documentsDocumentais}/users/${uid}/conversas/${envio.body.conversationId}`, { headers: { Authorization: 'Bearer owner' } });
    assert.equal(saved.status, 200);
    const messages = (await saved.json()).fields.mensagens.arrayValue.values;
    assert.equal(messages.length, 4);
    for (const id of [envio.body.messageId, lostId]) {
        const matching = messages.filter(m => m.mapValue.fields.messageId.stringValue === id);
        assert.equal(matching.length, 2);
        assert.deepEqual(matching.map(m => m.mapValue.fields.remetente.stringValue).sort(), ['bot', 'user']);
    }
    states.push('Usuário de email/senha: resposta perdida após commit recuperada com mesmo ID, quatro mensagens confirmadas sem duplicação');
}
export async function validarFunctionOutroUid(page, conversationId) {
    const token = await page.evaluate(async () => (await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js')).getAuth().currentUser.getIdToken());
    const response = await local(endpointDocumental, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ conversationId, messageId: 'message-outro-uid-000001', pergunta: 'Como faço minha matrícula?' }) });
    assert.equal(response.status, 404);
}
