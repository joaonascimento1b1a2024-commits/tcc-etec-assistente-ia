import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { montarEmailAviso, criarEnvioResend } from '../functions/lib/avisos/email.js';
import {
    enfileirarEmailsAviso, enviarEmailAviso, JANELA_ENVIO_MS,
} from '../functions/lib/avisos/notificacoes.js';

const criadoEm = '2026-10-19T12:00:00.000Z';
const aviso = {
    titulo: 'Matrículas abertas', descricao: 'Compareça à secretaria.\nLeve os documentos.',
    categoria: 'matricula', publicado: true,
};
const config = { remetente: 'Sylvinho <avisos@example.test>', siteUrl: 'https://escola.example.test' };

function cenario() {
    const documentos = new Map([['avisos/novo', structuredClone(aviso)]]);
    const contas = new Map();
    const enviados = [], consultas = [];
    let falhaCriacao, falhaEnvio, falhaConfirmacao = false, agora = 1000;
    const snapshot = (path) => ({
        id: path.split('/').at(-1), exists: documentos.has(path),
        data: () => structuredClone(documentos.get(path)),
        createTime: documentos.has(path) ? { toDate: () => new Date(criadoEm) } : undefined,
    });
    const referencia = (path) => ({
        path,
        async get() { return snapshot(path); },
        async create(data) {
            if (falhaCriacao === data.uid) throw new Error('Falha temporária');
            if (documentos.has(path)) throw Object.assign(new Error('Existente'), { code: 6 });
            documentos.set(path, structuredClone(data));
        },
        async update(data) {
            if (data.estado === 'enviado' && falhaConfirmacao) {
                falhaConfirmacao = false;
                throw new Error('Confirmação perdida');
            }
            Object.assign(documentos.get(path), structuredClone(data));
        },
    });
    let transacao = Promise.resolve();
    const firestore = {
        collection(nome) {
            let campo, valor, limite, cursor = '';
            const consulta = {
                doc: (id) => referencia(`${nome}/${id}`),
                where(key, op, value) {
                    assert.equal(op, '=='); campo = key; valor = value; return consulta;
                },
                orderBy(key) { assert.equal(key, '__name__'); return consulta; },
                limit(n) { limite = n; return consulta; },
                startAfter(doc) { cursor = doc.id; return consulta; },
                async get() {
                    consultas.push({ nome, campo, valor });
                    assert.equal(nome, 'users');
                    assert.equal(campo, 'preferencias.avisosEmail');
                    const docs = [...documentos.keys()].sort()
                        .filter((path) => path.startsWith('users/') && path.split('/').at(-1) > cursor)
                        .filter((path) => documentos.get(path).preferencias?.avisosEmail === valor)
                        .slice(0, limite).map(snapshot);
                    return { docs, empty: !docs.length, size: docs.length };
                },
            };
            return consulta;
        },
        runTransaction(callback) {
            const proxima = transacao.then(() => callback({
                get: (ref) => ref.get(),
                update: (ref, data) => Object.assign(documentos.get(ref.path), structuredClone(data)),
            }));
            transacao = proxima.catch(() => {});
            return proxima;
        },
    };
    const deps = {
        firestore, ...config, serverTimestamp: () => 'timestamp', agora: () => agora,
        auth: {
            async getUser(uid) {
                if (!contas.has(uid)) throw Object.assign(new Error('Conta ausente'), { code: 'auth/user-not-found' });
                return contas.get(uid);
            },
        },
        async enviar(mensagem, id) {
            enviados.push({ mensagem: structuredClone(mensagem), id });
            if (falhaEnvio) throw new Error('Resend indisponível');
            return `resend-${id}`;
        },
    };
    return {
        documentos, contas, deps, enviados, consultas,
        pessoa(uid, preferencias = { avisosEmail: true }, conta = {}) {
            documentos.set(`users/${uid}`, { preferencias, email: 'perfil-falso@example.test' });
            contas.set(uid, { uid, email: `${uid}@example.test`, disabled: false, ...conta });
        },
        fila: () => [...documentos.entries()].filter(([path]) => path.startsWith('avisosEmails/')),
        enfileirar: (data = aviso) => enfileirarEmailsAviso('novo', data, criadoEm, deps),
        enviar: (id) => enviarEmailAviso(id || [...documentos.keys()].find((path) => path.startsWith('avisosEmails/')).split('/')[1], deps),
        set falhaCriacao(value) { falhaCriacao = value; },
        set falhaEnvio(value) { falhaEnvio = value; },
        set falhaConfirmacao(value) { falhaConfirmacao = value; },
        set agora(value) { agora = value; },
    };
}

test('aluno e administrador recebem no endereço do Auth; preferência precisa ser true', async () => {
    const s = cenario();
    s.pessoa('aluno', { avisosEmail: true }, { emailVerified: false });
    s.pessoa('admin');
    s.documentos.set('administradores/admin', { ativo: true });
    for (const [uid, value] of [['desativado', false], ['texto', 'true'], ['ausente', undefined]]) {
        s.pessoa(uid, { avisosEmail: value });
    }
    await s.enfileirar();
    assert.equal(s.fila().length, 2);
    for (const [path] of s.fila()) await s.enviar(path.split('/')[1]);
    assert.deepEqual(s.enviados.map(({ mensagem }) => mensagem.to).sort(), [
        ['admin@example.test'], ['aluno@example.test'],
    ]);
    assert.ok(s.fila().every(([, entrega]) => entrega.estado === 'enviado'));
});

test('rascunhos e avisos inválidos não geram consulta nem e-mail', async () => {
    const s = cenario();
    s.pessoa('aluno');
    for (const data of [{ ...aviso, publicado: false }, { ...aviso, publicado: 'true' },
        { ...aviso, titulo: '' }, { ...aviso, descricao: null }]) await s.enfileirar(data);
    assert.equal(s.fila().length, 0);
    assert.equal(s.consultas.length, 0);
});

test('paginação inclui todos e repetição do evento preserva entregas já enviadas', async () => {
    const s = cenario();
    for (let i = 0; i < 205; i++) s.pessoa(`p${String(i).padStart(3, '0')}`);
    await s.enfileirar();
    assert.equal(s.fila().length, 205);
    assert.equal(s.consultas.length, 3);
    await s.enviar();
    await s.enfileirar();
    await s.enviar();
    assert.equal(s.fila().length, 205);
    assert.equal(s.enviados.length, 1);
});

test('falha parcial da fila permite retry sem duplicar quem já foi enfileirado', async () => {
    const s = cenario();
    s.pessoa('a'); s.pessoa('b');
    s.falhaCriacao = 'b';
    await assert.rejects(s.enfileirar(), /AVISOS_FILA_INCOMPLETA/);
    assert.equal(s.fila().length, 1);
    s.falhaCriacao = undefined;
    await s.enfileirar();
    assert.equal(s.fila().length, 2);
});

test('desativação, conta removida/desabilitada/sem email e aviso excluído impedem envio', async () => {
    for (const alterar of [
        (s) => { s.documentos.get('users/aluno').preferencias.avisosEmail = false; },
        (s) => { s.documentos.delete('users/aluno'); },
        (s) => { s.contas.delete('aluno'); },
        (s) => { s.contas.get('aluno').disabled = true; },
        (s) => { s.contas.get('aluno').email = undefined; },
        (s) => { s.documentos.delete('avisos/novo'); },
        (s) => { s.documentos.get('avisos/novo').publicado = false; },
    ]) {
        const s = cenario(); s.pessoa('aluno'); await s.enfileirar(); alterar(s);
        await s.enviar();
        assert.equal(s.enviados.length, 0);
        assert.equal(s.fila()[0][1].estado, 'ignorado');
    }
});

test('falha do provedor preserva payload e chave mesmo após alteração do aviso/configuração', async () => {
    const s = cenario(); s.pessoa('aluno'); await s.enfileirar();
    s.falhaEnvio = true;
    await assert.rejects(s.enviar(), /Resend/);
    assert.equal(s.fila()[0][1].estado, 'pendente');
    s.documentos.get('avisos/novo').titulo = 'Título alterado';
    s.deps.remetente = 'Outro <outro@example.test>';
    s.falhaEnvio = false;
    await s.enviar();
    assert.deepEqual(s.enviados[0], s.enviados[1]);
    assert.equal(s.fila()[0][1].estado, 'enviado');
});

test('confirmação perdida e eventos concorrentes reutilizam payload/chave do provedor', async () => {
    const s = cenario(); s.pessoa('aluno'); await s.enfileirar();
    s.falhaConfirmacao = true;
    await assert.rejects(s.enviar(), /Confirmação perdida/);
    await Promise.all([s.enviar(), s.enviar()]);
    assert.ok(s.enviados.length >= 2);
    for (const envio of s.enviados) assert.deepEqual(envio, s.enviados[0]);
    const total = s.enviados.length;
    await s.enviar();
    assert.equal(s.enviados.length, total);
});

test('mudança de email e expiração da idempotência suspendem uma entrega pendente', async () => {
    for (const motivo of ['email_alterado', 'janela_de_retentativas_expirada']) {
        const s = cenario(); s.pessoa('aluno'); await s.enfileirar();
        s.falhaEnvio = true;
        await assert.rejects(s.enviar());
        if (motivo === 'email_alterado') s.contas.get('aluno').email = 'novo@example.test';
        else s.agora = 1000 + JANELA_ENVIO_MS;
        await s.enviar();
        assert.equal(s.enviados.length, 1);
        assert.equal(s.fila()[0][1].motivo, motivo);
    }
});

test('email escapa HTML, preserva linhas e contém links para mural e preferências', () => {
    const mensagem = montarEmailAviso({ ...aviso, titulo: '<img src=x>\r\nBcc: x',
        descricao: 'Olá & todos\n<script>alert(1)</script>' }, 'a@example.test', config.remetente, config.siteUrl);
    assert.doesNotMatch(mensagem.html, /<img|<script>/);
    assert.match(mensagem.html, /&lt;script&gt;/);
    assert.match(mensagem.html, /Olá &amp; todos<br>/);
    assert.doesNotMatch(mensagem.subject, /[\r\n]/);
    assert.match(mensagem.text, /Notificações > Desativadas/);
    assert.match(mensagem.html, /https:\/\/escola.example.test\/Logado\/Avisos\/avisos.html/);
    assert.deepEqual(mensagem.to, ['a@example.test']);
    assert.throws(() => montarEmailAviso(aviso, 'a@example.test', '', config.siteUrl));
    assert.throws(() => montarEmailAviso(aviso, 'a@example.test', config.remetente, 'javascript:alert(1)'));
});

test('cliente Resend usa secret lazy, destinatário individual, timeout e idempotência', async () => {
    let leituras = 0, esperas = 0;
    const pedidos = [];
    const enviar = criarEnvioResend(() => { leituras++; return 'chave-simulada'; }, async (url, options) => {
        pedidos.push({ url, options }); return new Response(JSON.stringify({ id: 'email-1' }));
    }, async () => { esperas++; });
    assert.equal(leituras, 0);
    const mensagem = montarEmailAviso(aviso, 'a@example.test', config.remetente, config.siteUrl);
    assert.equal(await enviar(mensagem, 'entrega-1'), 'email-1');
    assert.equal(leituras, 1); assert.equal(esperas, 1);
    assert.equal(pedidos[0].url, 'https://api.resend.com/emails');
    assert.equal(pedidos[0].options.headers['Idempotency-Key'], 'aviso/entrega-1');
    assert.equal(pedidos[0].options.headers.Authorization, 'Bearer chave-simulada');
    assert.deepEqual(JSON.parse(pedidos[0].options.body), mensagem);
    assert.ok(pedidos[0].options.signal instanceof AbortSignal);
});

test('erros, rate limit, timeout e resposta inválida do Resend não são marcados como sucesso', async () => {
    const mensagem = montarEmailAviso(aviso, 'a@example.test', config.remetente, config.siteUrl);
    for (const requisitar of [
        async () => new Response('informação privada', { status: 429 }),
        async () => new Response('informação privada', { status: 500 }),
        async () => { throw new Error('credencial privada'); },
        async () => new Response('{}'), async () => new Response('JSON inválido'),
    ]) {
        const enviar = criarEnvioResend(() => 'simulada', requisitar, async () => {});
        await assert.rejects(enviar(mensagem, 'entrega'), (erro) => {
            assert.match(erro.message, /^RESEND_/);
            assert.doesNotMatch(erro.message, /privada|simulada/);
            return true;
        });
    }
    await assert.rejects(criarEnvioResend(() => '')(mensagem, 'id'), /RESEND_API_KEY_AUSENTE/);
});

test('entrypoint registra apenas criação, retry e secrets no worker; declaração não envia', () => {
    const registros = [], exports = {}, secrets = new Map();
    const proibido = () => { throw new Error('Efeito durante declaração'); };
    const mocks = {
        'firebase-functions': { setGlobalOptions() {} },
        'firebase-functions/v2/https': { onRequest: () => ({}) },
        'firebase-functions/v2/firestore': { onDocumentCreated(options, callback) {
            registros.push(options); return callback;
        } },
        'firebase-functions/params': {
            defineSecret(name) { const secret = { value: proibido }; secrets.set(name, secret); return secret; },
            defineString: () => ({ value: proibido }),
        },
        'firebase-admin/app': { getApps: () => [{ name: '[DEFAULT]' }] },
        'firebase-admin/auth': { getAuth: proibido },
        'firebase-admin/firestore': { getFirestore: proibido },
        './assistente/gemini.js': {}, './assistente/http.js': { criarEndpointAssistente: () => ({}) },
        './avisos/email.js': { criarEnvioResend: proibido },
        './avisos/notificacoes.js': { enfileirarEmailsAviso: proibido, enviarEmailAviso: proibido },
    };
    vm.runInNewContext(readFileSync(new URL('../functions/lib/index.js', import.meta.url), 'utf8'), {
        exports, require: (name) => { assert.ok(name in mocks, name); return mocks[name]; },
    });
    assert.deepEqual(registros.map((v) => v.document), ['avisos/{avisoId}', 'avisosEmails/{entregaId}']);
    assert.ok(registros.every((v) => v.retry && v.region === 'southamerica-east1'));
    assert.equal(registros[0].secrets, undefined);
    assert.equal(registros[1].secrets[0], secrets.get('RESEND_API_KEY'));
    assert.equal(registros[1].maxInstances, 1);
    assert.equal(registros[1].concurrency, 1);
});
