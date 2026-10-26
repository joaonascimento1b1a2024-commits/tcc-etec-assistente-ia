import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { montarEmailAviso } from '../functions/lib/avisos/email.js';
import { enfileirarEmailsAviso, enviarEmailAviso } from '../functions/lib/avisos/notificacoes.js';

const criadoEm = '2026-10-19T12:00:00.000Z';
const aviso = {
    titulo: 'Matrículas abertas', descricao: 'Compareça à secretaria.\nLeve os documentos.',
    categoria: 'matricula', publicado: true,
};
const siteUrl = 'https://escola.example.test';

function cenario() {
    const documentos = new Map([['avisos/novo', structuredClone(aviso)]]);
    const contas = new Map();
    const consultas = [];
    let falhaCriacao, falhaTransacao = false, falhaAuth = false, confirmacaoPerdida = false;
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
    });
    let transacao = Promise.resolve();
    const firestore = {
        collection(nome) {
            // Consultas imutáveis, como no SDK Admin.
            const consulta = (limite, cursor = '') => ({
                doc: (id) => referencia(`${nome}/${id}`),
                orderBy(key) { assert.equal(key, '__name__'); return consulta(limite, cursor); },
                limit(n) { return consulta(n, cursor); },
                startAfter(doc) { return consulta(limite, doc.id); },
                async get() {
                    consultas.push(nome);
                    assert.equal(nome, 'users');
                    const docs = [...documentos.keys()].sort()
                        .filter((path) => path.startsWith('users/') && path.split('/').at(-1) > cursor)
                        .slice(0, limite).map(snapshot);
                    return { docs, empty: !docs.length, size: docs.length };
                },
            });
            return consulta();
        },
        runTransaction(callback) {
            const proxima = transacao.then(async () => {
                const gravacoes = [];
                await callback({
                    get: (ref) => ref.get(),
                    create: (ref, data) => {
                        assert.equal(documentos.has(ref.path), false);
                        gravacoes.push(() => documentos.set(ref.path, structuredClone(data)));
                    },
                    update: (ref, data) => gravacoes.push(() => Object.assign(documentos.get(ref.path), structuredClone(data))),
                });
                if (falhaTransacao) throw new Error('Commit indisponível');
                gravacoes.forEach((gravar) => gravar());
                if (confirmacaoPerdida) {
                    confirmacaoPerdida = false;
                    throw new Error('Confirmação perdida');
                }
            });
            transacao = proxima.catch(() => {});
            return proxima;
        },
    };
    const deps = {
        firestore, siteUrl, serverTimestamp: () => 'timestamp',
        auth: {
            async getUser(uid) {
                if (falhaAuth) throw new Error('Auth indisponível');
                if (!contas.has(uid)) throw Object.assign(new Error('Conta ausente'), { code: 'auth/user-not-found' });
                return contas.get(uid);
            },
        },
    };
    return {
        documentos, contas, deps, consultas,
        pessoa(uid, preferencias, conta = {}) {
            documentos.set(`users/${uid}`, { preferencias, email: 'perfil-falso@gmail.com' });
            contas.set(uid, { uid, email: `${uid}@gmail.com`, disabled: false, ...conta });
        },
        fila: () => [...documentos.entries()].filter(([path]) => path.startsWith('avisosEmails/')),
        mail: () => [...documentos.entries()].filter(([path]) => path.startsWith('mail/')),
        enfileirar: (data = aviso, dataCriacao = criadoEm) => enfileirarEmailsAviso('novo', data, dataCriacao, deps),
        enviar: (id) => enviarEmailAviso(id || [...documentos.keys()].find((path) => path.startsWith('avisosEmails/')).split('/')[1], deps),
        set falhaCriacao(value) { falhaCriacao = value; },
        set falhaTransacao(value) { falhaTransacao = value; },
        set falhaAuth(value) { falhaAuth = value; },
        set confirmacaoPerdida(value) { confirmacaoPerdida = value; },
    };
}

test('todos os perfis recebem: aluno, admin, contas antigas e preferências false ou ausentes', async () => {
    const s = cenario();
    s.pessoa('aluno', { avisosEmail: true }, { emailVerified: false });
    s.pessoa('admin', { avisosEmail: false });
    s.documentos.set('administradores/admin', { ativo: true });
    s.pessoa('antigo');
    s.pessoa('texto', { avisosEmail: 'true' });
    await s.enfileirar();
    assert.equal(s.fila().length, 4);
    for (const [path] of s.fila()) await s.enviar(path.split('/')[1]);
    assert.deepEqual(s.mail().map(([, mail]) => mail.to).sort(), [
        ['admin@gmail.com'], ['aluno@gmail.com'], ['antigo@gmail.com'], ['texto@gmail.com'],
    ]);
    assert.ok(s.fila().every(([, entrega]) => entrega.estado === 'enfileirado'));
    for (const [, mail] of s.mail()) {
        assert.equal(mail.message.subject, '[Sylvinho] Novo aviso: Matrículas abertas');
        assert.equal(mail.delivery, undefined); // Só a extensão confirma entrega SMTP.
        assert.equal(mail.cc, undefined);
        assert.equal(mail.bcc, undefined);
        assert.equal(mail.from, undefined); // Remetente vem da configuração da extensão.
    }
});

test('rascunhos e avisos inválidos não geram consulta nem e-mail', async () => {
    const s = cenario(); s.pessoa('aluno');
    for (const data of [{ ...aviso, publicado: false }, { ...aviso, publicado: 'true' },
        { ...aviso, titulo: '' }, { ...aviso, descricao: null }]) await s.enfileirar(data);
    assert.equal(s.fila().length, 0);
    assert.equal(s.consultas.length, 0);
});

test('paginação inclui mais de 100 contas; eventos repetidos e concorrentes não duplicam mail', async () => {
    const s = cenario();
    for (let i = 0; i < 205; i++) s.pessoa(`p${String(i).padStart(3, '0')}`);
    await s.enfileirar();
    assert.equal(s.fila().length, 205);
    assert.equal(s.consultas.length, 3);
    await Promise.all([s.enviar(), s.enviar()]);
    const original = structuredClone(s.mail());
    await s.enfileirar(); await s.enviar();
    assert.equal(s.fila().length, 205);
    assert.deepEqual(s.mail(), original);
});

test('fila vazia ou página exata de 100 termina sem perder contas', async () => {
    for (const total of [0, 100]) {
        const s = cenario();
        for (let i = 0; i < total; i++) s.pessoa(`u${i}`);
        await s.enfileirar();
        assert.equal(s.fila().length, total);
        assert.equal(s.consultas.length, total ? 2 : 1);
    }
});

test('falha parcial da fila permite retry sem duplicar entregas', async () => {
    const s = cenario(); s.pessoa('a'); s.pessoa('b');
    s.falhaCriacao = 'b';
    await assert.rejects(s.enfileirar(), /AVISOS_FILA_INCOMPLETA/);
    assert.equal(s.fila().length, 1);
    s.falhaCriacao = undefined;
    await s.enfileirar(); assert.equal(s.fila().length, 2);
});

test('perfil removido, conta removida/desabilitada/sem email e aviso excluído impedem envio', async () => {
    for (const alterar of [
        (s) => s.documentos.delete('users/aluno'),
        (s) => s.contas.delete('aluno'),
        (s) => { s.contas.get('aluno').disabled = true; },
        (s) => { s.contas.get('aluno').email = undefined; },
        (s) => s.documentos.delete('avisos/novo'),
        (s) => { s.documentos.get('avisos/novo').publicado = false; },
    ]) {
        const s = cenario(); s.pessoa('aluno'); await s.enfileirar(); alterar(s);
        await s.enviar();
        assert.equal(s.mail().length, 0);
        assert.equal(s.fila()[0][1].estado, 'ignorado');
    }
});

test('falhas transitórias do Auth ou do commit não confirmam nem perdem entrega', async () => {
    for (const falha of ['falhaAuth', 'falhaTransacao']) {
        const s = cenario(); s.pessoa('aluno'); await s.enfileirar();
        s[falha] = true;
        await assert.rejects(s.enviar());
        assert.equal(s.fila()[0][1].estado, 'pendente');
        assert.equal(s.mail().length, 0);
        s[falha] = false;
        await s.enviar(); assert.equal(s.mail().length, 1);
    }
});

test('confirmação perdida e retry preservam mensagem e delivery da extensão', async () => {
    const s = cenario(); s.pessoa('aluno'); await s.enfileirar();
    s.confirmacaoPerdida = true;
    await assert.rejects(s.enviar(), /Confirmação perdida/);
    const [path, mail] = s.mail()[0];
    mail.delivery = { state: 'SUCCESS' };
    const original = structuredClone(mail);
    await s.enviar();
    // Inclusive uma fila restaurada por operação administrativa não reenvia mail existente.
    s.fila()[0][1].estado = 'pendente';
    await s.enviar();
    assert.equal(s.mail().length, 1);
    assert.deepEqual(s.documentos.get(path), original);
});

test('usa conteúdo da criação e endereço atual do Auth, ignorando e-mail editável do perfil', async () => {
    const s = cenario(); s.pessoa('aluno'); await s.enfileirar();
    s.documentos.get('avisos/novo').titulo = 'Título editado';
    s.contas.get('aluno').email = 'atual@gmail.com';
    await s.enviar();
    assert.deepEqual(s.mail()[0][1].to, ['atual@gmail.com']);
    assert.equal(s.mail()[0][1].message.subject, '[Sylvinho] Novo aviso: Matrículas abertas');
});

test('recriação do mesmo ID tem fila própria; evento antigo não envia aviso recriado', async () => {
    const s = cenario(); s.pessoa('aluno');
    await s.enfileirar(aviso, '2026-10-18T12:00:00.000Z');
    await s.enviar();
    assert.equal(s.fila()[0][1].motivo, 'aviso_indisponivel');
    await s.enfileirar();
    assert.equal(s.fila().length, 2);
    await s.enviar(s.fila()[1][0].split('/')[1]);
    assert.equal(s.mail().length, 1);
});

test('formato Trigger Email escapa HTML, preserva linhas e inclui link para mural', () => {
    const { message, to } = montarEmailAviso({ ...aviso, titulo: '<img src=x>\r\nBcc: x',
        descricao: 'Olá & todos\n<script>alert(1)</script>' }, 'aluno@gmail.com', siteUrl);
    assert.doesNotMatch(message.html, /<img|<script>/);
    assert.match(message.html, /&lt;script&gt;/);
    assert.match(message.html, /Olá &amp; todos<br>/);
    assert.doesNotMatch(message.subject, /[\r\n]/);
    assert.match(message.text, /possui uma conta/);
    assert.doesNotMatch(message.text, /ativou|Desativadas/);
    assert.match(message.html, /https:\/\/escola.example.test\/Logado\/Avisos\/avisos.html/);
    assert.deepEqual(to, ['aluno@gmail.com']);
    assert.throws(() => montarEmailAviso(aviso, 'a@gmail.com', 'javascript:alert(1)'));
});

test('entrypoint registra apenas criação com retry; SMTP fica exclusivamente na extensão', () => {
    const registros = [], exports = {};
    const proibido = () => { throw new Error('Efeito durante declaração'); };
    const mocks = {
        'firebase-functions': { setGlobalOptions() {} },
        'firebase-functions/v2/https': { onRequest: () => ({}) },
        'firebase-functions/v2/firestore': { onDocumentCreated(options, callback) {
            registros.push(options); return callback;
        } },
        'firebase-functions/params': { defineString: () => ({ value: proibido }) },
        'firebase-admin/app': { getApps: () => [{ name: '[DEFAULT]' }] },
        'firebase-admin/auth': { getAuth: proibido },
        'firebase-admin/firestore': { getFirestore: proibido },
        './assistente/resposta-documental.js': {}, './assistente/http.js': { criarEndpointAssistente: () => ({}) },
        './assistente/visitante.js': { criarEndpointVisitante: () => ({}) },
        './assistente/pergunta-livre/busca.js': { criarBuscaDocumental: proibido },
        './avisos/notificacoes.js': { enfileirarEmailsAviso: proibido, enviarEmailAviso: proibido },
    };
    vm.runInNewContext(readFileSync(new URL('../functions/lib/index.js', import.meta.url), 'utf8'), {
        exports, require: (name) => { assert.ok(name in mocks, name); return mocks[name]; },
    });
    assert.deepEqual(registros.map((v) => v.document), ['avisos/{avisoId}', 'avisosEmails/{entregaId}']);
    assert.ok(registros.every((v) => v.retry && v.region === 'southamerica-east1'));
    assert.ok(registros.every((v) => v.secrets === undefined));
});
