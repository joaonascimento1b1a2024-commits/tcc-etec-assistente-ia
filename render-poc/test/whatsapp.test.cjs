'use strict';
// Sylvinho no WhatsApp: webhook da Meta → fluxo do visitante → resposta pela Graph API.
// Nenhum teste fala com a Meta: o envio é trocado por um transporte falso.
const assert = require('node:assert/strict');
const test = require('node:test');
const { createHmac } = require('node:crypto');
const { criarServidor, lerConfiguracao, DEMO_PROJECT } = require('../server.cjs');
const {
    lerConfiguracaoWhatsApp, formatarParaWhatsApp, assinaturaValida, comNonoDigito, TEXTOS,
} = require('../whatsapp.cjs');

// Valores fictícios, só para os testes.
const ENV = Object.freeze({
    WHATSAPP_TOKEN: 'token-ficticio-de-teste-0123456789',
    WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
    WHATSAPP_VERIFY_TOKEN: 'frase-de-verificacao-ficticia',
    WHATSAPP_APP_SECRET: '0123456789abcdef0123456789abcdef',
});
const CONFIG = lerConfiguracaoWhatsApp(ENV);
const NUMERO = '5516999990000';

function emulador() {
    return lerConfiguracao({ SYLVINHO_POC_MODE: 'emulator', GCLOUD_PROJECT: DEMO_PROJECT,
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180',
        ASSISTENTE_CORS_ORIGINS: 'http://localhost:5000' });
}

// Sobe o servidor com um "Graph" falso que guarda o que seria enviado à Meta.
async function iniciar(t, { responder = async (pergunta) => `Resposta sobre: ${pergunta}`, graph, config = emulador(), whatsapp = CONFIG } = {}) {
    const enviados = [];
    const transporteWhatsApp = async (url, opcoes) => {
        const corpo = JSON.parse(opcoes.body);
        enviados.push({ url, autorizacao: opcoes.headers.Authorization, corpo });
        return graph ? graph(corpo) : new Response('{}', { status: 200 });
    };
    const server = criarServidor({
        config, whatsapp, transporteWhatsApp,
        obterDependencias: () => ({
            responderVisitante: responder,
            recuperarConhecimento: async () => [],
            gerarResposta: async () => 'resposta documental',
        }),
    });
    await new Promise((pronto) => server.listen(0, '127.0.0.1', pronto));
    t.after(() => new Promise((pronto) => { server.close(pronto); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}/whatsapp/webhook`;
    return {
        base, enviados, server,
        textos: () => enviados.filter((e) => e.corpo.type === 'text').map((e) => e.corpo.text.body),
        async postar(dados, { assinatura } = {}) {
            const corpo = JSON.stringify(dados);
            const resposta = await fetch(base, { method: 'POST', body: corpo, headers: {
                'Content-Type': 'application/json',
                'X-Hub-Signature-256': assinatura ?? 'sha256=' + createHmac('sha256', ENV.WHATSAPP_APP_SECRET).update(corpo).digest('hex'),
            } });
            await server.aguardarWhatsApp?.();
            return resposta;
        },
    };
}

let contador = 0;
function lote(mensagem = {}, { numeroId = ENV.WHATSAPP_PHONE_NUMBER_ID } = {}) {
    contador++;
    return {
        object: 'whatsapp_business_account',
        entry: [{ id: 'conta', changes: [{ field: 'messages', value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15550000000', phone_number_id: numeroId },
            messages: [{ from: NUMERO, id: `wamid.teste${contador}`, timestamp: String(Math.floor(Date.now() / 1000)),
                type: 'text', text: { body: 'Quando é a rematrícula?' }, ...mensagem }],
        } }] }],
    };
}

test('whatsapp: sem variáveis fica desligado; configuração errada também desliga, sem derrubar o site', () => {
    assert.equal(lerConfiguracaoWhatsApp({}), null);
    const avisos = [];
    assert.equal(lerConfiguracaoWhatsApp({ ...ENV, WHATSAPP_APP_SECRET: '' }, (c) => avisos.push(c)), null);
    assert.equal(lerConfiguracaoWhatsApp({ ...ENV, WHATSAPP_PHONE_NUMBER_ID: '+55 16' }, (c) => avisos.push(c)), null);
    assert.equal(lerConfiguracaoWhatsApp({ ...ENV, WHATSAPP_VERIFY_TOKEN: 'curta' }, (c) => avisos.push(c)), null);
    assert.deepEqual(avisos, ['WHATSAPP_CONFIG_INVALIDA', 'WHATSAPP_CONFIG_INVALIDA', 'WHATSAPP_CONFIG_INVALIDA']);
    assert.equal(CONFIG.versao, 'v27.0');
});

test('whatsapp: sem configuração a rota não existe', async (t) => {
    const { base } = await iniciar(t, { whatsapp: null });
    assert.equal((await fetch(base)).status, 404);
});

test('whatsapp: modo health (sem chat) não abre a rota, mesmo configurado', async (t) => {
    const { base } = await iniciar(t, { config: lerConfiguracao({}) });
    assert.equal((await fetch(base)).status, 404);
});

test('whatsapp: verificação da Meta devolve o desafio só com a frase certa', async (t) => {
    const { base } = await iniciar(t);
    const url = (token, desafio = '1158201444') =>
        `${base}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=${encodeURIComponent(desafio)}`;
    const certo = await fetch(url(ENV.WHATSAPP_VERIFY_TOKEN));
    assert.equal(certo.status, 200);
    assert.equal(await certo.text(), '1158201444');
    assert.equal((await fetch(url('frase-errada-mas-comprida'))).status, 403);
    assert.equal((await fetch(url(ENV.WHATSAPP_VERIFY_TOKEN, '<script>alert(1)</script>'))).status, 403);
    assert.equal((await fetch(base, { method: 'PUT' })).status, 405);
});

test('whatsapp: mensagem de texto recebe a resposta do Sylvinho', async (t) => {
    const app = await iniciar(t);
    const resposta = await app.postar(lote());
    assert.equal(resposta.status, 200);
    assert.deepEqual(app.textos(), ['Resposta sobre: Quando é a rematrícula?']);
    const envio = app.enviados.find((e) => e.corpo.type === 'text');
    assert.equal(envio.url, `https://graph.facebook.com/v27.0/${ENV.WHATSAPP_PHONE_NUMBER_ID}/messages`);
    assert.equal(envio.autorizacao, `Bearer ${ENV.WHATSAPP_TOKEN}`);
    assert.equal(envio.corpo.to, NUMERO);
    assert.equal(envio.corpo.messaging_product, 'whatsapp');
    // Antes da resposta, marca como lida e mostra "digitando…".
    assert.equal(app.enviados[0].corpo.status, 'read');
    assert.deepEqual(app.enviados[0].corpo.typing_indicator, { type: 'text' });
});

test('whatsapp: assinatura inválida ou ausente é recusada e nada é respondido', async (t) => {
    const app = await iniciar(t);
    assert.equal((await app.postar(lote(), { assinatura: 'sha256=' + '0'.repeat(64) })).status, 401);
    assert.equal((await app.postar(lote(), { assinatura: '' })).status, 401);
    assert.equal(app.enviados.length, 0);
    assert.equal(assinaturaValida(Buffer.from('x'), undefined, ENV.WHATSAPP_APP_SECRET), false);
});

test('whatsapp: a mesma mensagem reenviada pela Meta é respondida uma vez só', async (t) => {
    const app = await iniciar(t);
    const dados = lote();
    await app.postar(dados);
    await app.postar(dados);
    assert.equal(app.textos().length, 1);
});

test('whatsapp: ignora outro número, avisos de entrega e mensagens antigas', async (t) => {
    const app = await iniciar(t);
    await app.postar(lote({}, { numeroId: '999999999999' }));
    await app.postar({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
        metadata: { phone_number_id: ENV.WHATSAPP_PHONE_NUMBER_ID }, statuses: [{ status: 'delivered' }] } }] }] });
    await app.postar(lote({ timestamp: String(Math.floor(Date.now() / 1000) - 3600) }));
    await app.postar({ object: 'page', entry: [] });
    assert.equal(app.enviados.length, 0);
});

test('whatsapp: falha de entrega avisada pela Meta vai para o log só com o código', async (t) => {
    const linhas = [];
    const original = console.info;
    console.info = (...args) => linhas.push(args.join(' '));
    t.after(() => { console.info = original; });
    const app = await iniciar(t);
    await app.postar({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
        metadata: { phone_number_id: ENV.WHATSAPP_PHONE_NUMBER_ID },
        statuses: [{ status: 'failed', recipient_id: NUMERO, errors: [{ code: 131026, title: 'Message undeliverable' }] }] } }] }] });
    console.info = original;
    assert.equal(app.enviados.length, 0);
    assert.ok(linhas.some((l) => l.includes('WHATSAPP_ENTREGA_FALHOU') && l.includes('131026')));
    assert.ok(!linhas.join('\n').includes(NUMERO));
});

test('whatsapp: áudio, imagem e textos longos recebem orientação', async (t) => {
    const app = await iniciar(t);
    await app.postar(lote({ type: 'audio', text: undefined, audio: { id: 'midia' } }));
    await app.postar(lote({ text: { body: 'a'.repeat(701) } }));
    assert.deepEqual(app.textos(), [TEXTOS.soTexto, TEXTOS.longa]);
});

test('whatsapp: limite por número evita abuso (8 por minuto)', async (t) => {
    const app = await iniciar(t);
    for (let i = 0; i < 10; i++) await app.postar(lote());
    assert.equal(app.textos().length, 8);
});

test('whatsapp: falha do motor vira mensagem amigável, sem detalhes internos', async (t) => {
    const app = await iniciar(t, { responder: async () => { throw new Error('SEGREDO_INTERNO'); } });
    await app.postar(lote());
    assert.deepEqual(app.textos(), [TEXTOS.falha]);
});

test('whatsapp: número de teste sem o nono dígito tenta de novo com o 9', async (t) => {
    const app = await iniciar(t, {
        graph: (corpo) => corpo.type === 'text' && corpo.to === '551699990000'
            ? new Response(JSON.stringify({ error: { code: 131030 } }), { status: 400 })
            : new Response('{}', { status: 200 }),
    });
    await app.postar(lote({ from: '551699990000' }));
    const destinos = app.enviados.filter((e) => e.corpo.type === 'text').map((e) => e.corpo.to);
    assert.deepEqual(destinos, ['551699990000', '5516999990000']);
    assert.equal(comNonoDigito('5516999990000'), null, 'já tem o 9');
    assert.equal(comNonoDigito('551633330000'), null, 'telefone fixo');
});

test('whatsapp: fontes do site viram links e o texto respeita o limite do WhatsApp', () => {
    const fontes = [{ titulo: 'Site oficial da ETEC', url: 'https://etecmatao.cps.sp.gov.br/' }, { titulo: 'X', url: 'javascript:alert(1)' }];
    const texto = formatarParaWhatsApp('A matrícula é **presencial**.\n\n[[FONTES]]' + JSON.stringify(fontes));
    assert.equal(texto, 'A matrícula é *presencial*.\n\n*Fontes:*\n• Site oficial da ETEC: https://etecmatao.cps.sp.gov.br/');
    assert.equal(formatarParaWhatsApp('Texto.\n\n[[FONTES]]{quebrado').trim(), 'Texto.');
    assert.equal(formatarParaWhatsApp('a'.repeat(5000)).length, 4096);
});

test('whatsapp: nenhum log contém telefone, pergunta ou token', async (t) => {
    const linhas = [];
    const original = console.info;
    console.info = (...args) => linhas.push(args.join(' '));
    t.after(() => { console.info = original; });
    const app = await iniciar(t);
    await app.postar(lote({ text: { body: 'pergunta-marcador-unico' } }));
    console.info = original;
    const tudo = linhas.join('\n');
    for (const proibido of [NUMERO, 'pergunta-marcador-unico', ENV.WHATSAPP_TOKEN, ENV.WHATSAPP_APP_SECRET])
        assert.ok(!tudo.includes(proibido), proibido);
    assert.match(tudo, /WHATSAPP_RESPOSTA_ENVIADA/);
});
