import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:5000';
const home = origin + '/Logado/Home/home.html';
const endpoint = origin.replace(':5000', ':5001') + '/demo-sylvinho-render-poc/southamerica-east1/perguntarAssistente';
const pronto = page => page.waitForFunction(() => globalThis.__LOCAL_E2E__ &&
    document.querySelector('#chatStatus')?.textContent === 'As mensagens são salvas na sua conta.' &&
    !document.querySelector('#messageInput').disabled);
export async function enviarPerguntaOriginal(page, pergunta = 'Como faço minha matrícula?', insuficiente = false) {
    assert.equal(new URL(page.url()).origin, origin);
    await page.locator('#messageInput').fill(pergunta);
    const waiting = page.waitForResponse(r => r.url() === endpoint && r.request().method() === 'POST');
    await page.locator('#messageForm button[type=submit]').click();
    const response = await waiting;
    assert.equal(response.status(), 200);
    const body = response.request().postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), ['conversationId', 'messageId', 'pergunta']);
    assert.match(body.messageId, /^[A-Za-z0-9_-]{20,80}$/);
    assert.ok((await response.request().allHeaders()).authorization?.startsWith('Bearer '));
    const data = await response.json();
    if (insuficiente) assert.match(data.resposta, /Nao ha informacao suficiente/);
    else assert.match(data.resposta, /Fonte: (Sistema Etec|Regimento Comum)/);
    assert.doesNotMatch(data.resposta, /AZUL-42|MARCADOR_|Gemini/);
    await page.waitForFunction(() => document.querySelector('#chatStatus')?.textContent === 'Conversa atualizada.');
    assert.equal(await page.locator('.message-row.bot').count(), 1);
    assert.equal(await page.locator('.message-row.bot .bubble').innerText(), data.resposta);
    assert.doesNotMatch(await page.locator('.academic-demo-banner').innerText(), /fict[ií]ci/i);
    return {body, resposta: data.resposta};
}
export async function validarMatrizOriginal(page, states) {
    for (const [pergunta, expected, insuficiente] of [
        ['Qual a frequência mínima para aprovação?', /75%[\s\S]*conjunto[\s\S]*componentes curriculares/, false],
        ['Como faço minha matrícula?', /Receber os requerimentos e documentação de matrícula/, false],
        ['Como faço minha rematrícula?', /Calendário Escolar/, false],
        ['Como solicitar uma declaração escolar?', /Disponibilizar no balcão da Secretaria/, false],
        ['Existe modelo de declaração escolar?', /DECLARAÇÃO DE TRANSFERÊNCIA/, false],
        ['Qual o telefone da secretaria da ETEC Sylvio de Mattos Carvalho?', /Nao ha informacao suficiente/, true],
        ['Qual o procedimento para transporte interplanetário?', /Nao ha informacao suficiente/, true],
    ]) {
        await page.goto(home); await pronto(page);
        const envio = await enviarPerguntaOriginal(page, pergunta, insuficiente);
        assert.match(envio.resposta, expected);
        await page.reload();
        await page.waitForFunction(() => document.querySelectorAll('.message-row.bot').length === 1);
        assert.equal(await page.locator('.message-row.bot .bubble').innerText(), envio.resposta);
        assert.equal(await page.locator('.message-row.user').count(), 1);
        states.push('RAG original no navegador, resposta e reload sem duplicacao: ' + pergunta);
    }
}
export async function validarBackendIndisponivel(page, context, uid, states) {
    await page.goto(home); await pronto(page);
    let messageId;
    const falhar = async route => {
        if (route.request().method() !== 'POST') return route.continue();
        messageId = route.request().postDataJSON().messageId;
        await route.abort('connectionrefused');
    };
    await context.route(endpoint, falhar);
    try {
        await page.locator('#messageInput').fill('Qual a frequência mínima para aprovação?');
        await page.locator('#messageForm button[type=submit]').click();
        await page.locator('#chatStatus').filter({hasText: 'Recarregue para recuperar'}).waitFor();
        assert.equal(await page.locator('.message-row.bot').count(), 0);
        const pending = await page.evaluate(uid => JSON.parse(sessionStorage.getItem('sylvinho:pendente:' + uid)), uid);
        assert.equal(pending.messageId, messageId);
    } finally { await context.unroute(endpoint, falhar); }
    const retry = page.waitForRequest(r => r.url() === endpoint && r.method() === 'POST');
    await page.reload();
    assert.equal((await retry).postDataJSON().messageId, messageId);
    await page.locator('#chatStatus').filter({hasText: 'Conversa atualizada.'}).waitFor();
    assert.equal(await page.locator('.message-row.bot').count(), 1);
    assert.match(await page.locator('.message-row.bot .bubble').innerText(), /75%/);
    states.push('Backend indisponivel: erro compreensivel, nenhum bot artificial; reload recupera com mesmo messageId');
}
