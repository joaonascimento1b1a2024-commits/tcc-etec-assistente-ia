// Apenas mocks locais; nao importa index.ts, SDK inicializado, secrets ou Gemini.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import test from "node:test";
import {
    perguntarAssistenteHandler, montarPromptSistema,
    MAX_PERGUNTA_LENGTH, MAX_MENSAGENS,
} from "../functions/lib/assistente/handler.js";
import {formatarDocumentoContexto, selecionarDocumentosRelevantes}
    from "../functions/lib/rag/recuperacao.js";

const ID = "AbCdEfGhIjKlMnOpQrSt";
const caminho = (uid = "alice", id = ID) => `users/${uid}/conversas/${id}`;
const userMessage = (texto = "matricula", enviadoEm = 1) =>
    ({texto, remetente: "user", enviadoEm});
const conversa = (mensagens = [userMessage()]) => ({
    titulo: "Titulo manual", tituloOrigem: "manual",
    criadoEm: {seconds: 1}, atualizadoEm: {seconds: 2}, mensagens,
});
const chunksPadrao = [
    {id: "ativo", titulo: "Matrícula", categoria: "procedimento",
        secao: "B1", documentoId: "doc", conteudo: "Documento oficial",
        paginaInicial: 2, paginaFinal: 3, ativo: true},
    {id: "inativo", titulo: "Matrícula", conteudo: "NAO USAR", ativo: false},
];

function deferred() {
    let resolve;
    const promise = new Promise((r) => {resolve = r;});
    return {promise, resolve};
}

function setup({initial = conversa(), chunks = chunksPadrao} = {}) {
    const rows = new Map(initial === null ? [] : [[caminho(), structuredClone(initial)]]);
    const calls = {auth: [], reads: [], rag: [], generator: [], transactions: 0, updates: [], commits: 0};
    const state = {rejectCommit: false, repeatTransaction: false, onRetry: null};
    const snapshot = (path) => {
        const value = rows.has(path) ? structuredClone(rows.get(path)) : undefined;
        return {exists: value !== undefined, data: () => value};
    };
    const ref = (path) => ({path, async get() {
        calls.reads.push(path);
        return snapshot(path);
    }});
    let tail = Promise.resolve();
    const firestore = {
        collection(name) {
            if (name === "conhecimento") {
                return {where(...args) {
                    calls.rag.push([name, ...args]);
                    assert.deepEqual(args, ["ativo", "==", true]);
                    return {async get() {
                        return {forEach(callback) {
                            for (const d of chunks) callback({id: d.id, data: () => d});
                        }};
                    }};
                }};
            }
            assert.equal(name, "users", "Colecao fora do contrato");
            return {doc(uid) {
                return {collection(sub) {
                    assert.equal(sub, "conversas");
                    return {doc(id) {return ref(caminho(uid, id));}};
                }};
            }};
        },
        runTransaction(callback) {
            calls.transactions++;
            const result = tail.then(async () => {
                let pending;
                const attempt = async () => {
                    pending = [];
                    return callback({
                        async get(reference) {
                            calls.reads.push(reference.path);
                            return snapshot(reference.path);
                        },
                        update(reference, data) {
                            calls.updates.push({path: reference.path, data: structuredClone(data)});
                            pending.push({path: reference.path, data: structuredClone(data)});
                        },
                    });
                };
                if (state.repeatTransaction) {
                    await attempt();
                    if (state.onRetry) state.onRetry();
                }
                const value = await attempt();
                if (state.rejectCommit) throw new Error("commit falhou");
                for (const {path, data} of pending) {
                    assert.ok(rows.has(path), "Update nao cria conversa");
                    rows.set(path, {...rows.get(path), ...data});
                }
                calls.commits++;
                return value;
            });
            tail = result.catch(() => {});
            return result;
        },
    };
    const deps = {
        firestore,
        auth: {async verifyIdToken(token) {
            calls.auth.push(token);
            if (token === "tokenA") return {uid: "alice"};
            if (token === "tokenB") return {uid: "bob"};
            throw new Error("token invalido");
        }},
        serverTimestamp: () => ({serverTimestamp: true}),
        agora: () => 12345,
        async gerarResposta(prompt, pergunta) {
            calls.generator.push({prompt, pergunta});
            return "Resposta controlada";
        },
    };
    async function run({method = "POST", authorization = "Bearer tokenA",
        body = {pergunta: "matricula", conversationId: ID}} = {}) {
        const res = {
            code: null, body: null, headers: {},
            set(name, value) {this.headers[name] = value; return this;},
            status(code) {this.code = code; return this;},
            json(payload) {this.body = payload; return this;},
        };
        await perguntarAssistenteHandler({
            method, body, get(name) {
                assert.equal(name, "Authorization");
                return authorization;
            },
        }, res, deps);
        return res;
    }
    return {rows, calls, state, deps, run};
}

function assertSemTrabalho(s, {auth = 1} = {}) {
    assert.equal(s.calls.auth.length, auth);
    assert.equal(s.calls.reads.length, 0);
    assert.equal(s.calls.generator.length, 0);
    assert.equal(s.calls.transactions, 0);
}

test("POST valido integra RAG V1 e acrescenta exclusivamente bot", async () => {
    const initial = conversa();
    const s = setup({initial});
    const r = await s.run({body: {pergunta: "  MATRÍCULA  ", conversationId: ID}});
    assert.equal(r.code, 200);
    assert.deepEqual(r.body, {resposta: "Resposta controlada"});
    assert.deepEqual(s.calls.auth, ["tokenA"]);
    assert.deepEqual(s.calls.rag, [["conhecimento", "ativo", "==", true]]);
    assert.equal(s.calls.generator[0].pergunta, "MATRÍCULA");
    const contexto = selecionarDocumentosRelevantes(chunksPadrao, "MATRÍCULA")
        .map(formatarDocumentoContexto).join("\n\n");
    assert.ok(s.calls.generator[0].prompt.includes(contexto));
    assert.ok(!s.calls.generator[0].prompt.includes("NAO USAR"));
    const saved = s.rows.get(caminho());
    assert.deepEqual(saved.mensagens, [...initial.mensagens, {
        texto: "Resposta controlada", remetente: "bot", enviadoEm: 12345,
    }]);
    for (const key of ["titulo", "tituloOrigem", "criadoEm"]) {
        assert.deepEqual(saved[key], initial[key]);
    }
    assert.deepEqual(saved.atualizadoEm, {serverTimestamp: true});
    assert.deepEqual(Object.keys(s.calls.updates[0].data).sort(), ["atualizadoEm", "mensagens"]);
    assert.equal(s.calls.commits, 1);
});

test("metodos diferentes de POST retornam405 e Allow sem autenticar", async () => {
    for (const method of ["GET", "PUT", "DELETE", "OPTIONS"]) {
        const s = setup();
        const r = await s.run({method});
        assert.equal(r.code, 405);
        assert.equal(r.headers.Allow, "POST");
        assertSemTrabalho(s, {auth: 0});
    }
});

test("Authorization ausente ou vazio retorna401", async () => {
    for (const authorization of [null, ""]) {
        const s = setup();
        assert.equal((await s.run({authorization})).code, 401);
        assertSemTrabalho(s, {auth: 0});
    }
});

test("Bearer malformado nao valida token nem consulta conversa", async () => {
    for (const authorization of ["Bearer", "bearer tokenA", "Basic tokenA",
        "Bearer tokenA extra", "tokenA", "   "]) {
        const s = setup();
        assert.equal((await s.run({authorization})).code, 401);
        assertSemTrabalho(s, {auth: 0});
    }
});

test("token invalido retorna401 antes de leitura", async () => {
    const s = setup();
    assert.equal((await s.run({authorization: "Bearer invalido"})).code, 401);
    assertSemTrabalho(s);
});

test("body invalido e rejeitado depois da autenticacao", async () => {
    for (const body of [null, [], "texto", 42]) {
        const s = setup();
        assert.equal((await s.run({body})).code, 400);
        assertSemTrabalho(s);
    }
});

test("pergunta ausente ou nao textual retorna400", async () => {
    for (const pergunta of [undefined, null, 42, {}, []]) {
        const s = setup();
        assert.equal((await s.run({body: {pergunta, conversationId: ID}})).code, 400);
        assertSemTrabalho(s);
    }
});

test("pergunta vazia ou somente espacos retorna400", async () => {
    for (const pergunta of ["", "   ", "\n\t"]) {
        const s = setup();
        assert.equal((await s.run({body: {pergunta, conversationId: ID}})).code, 400);
        assertSemTrabalho(s);
    }
});

test("limite1000 e aplicado depois de trim sem reduzir limite para700", async () => {
    assert.equal(MAX_PERGUNTA_LENGTH, 1000);
    const s = setup();
    assert.equal((await s.run({body: {
        pergunta: "x".repeat(1001), conversationId: ID,
    }})).code, 400);
    assertSemTrabalho(s);
    const valido = setup();
    assert.equal((await valido.run({body: {
        pergunta: "  " + "x".repeat(1000) + "  ", conversationId: ID,
    }})).code, 200);
    assert.equal(valido.calls.generator[0].pergunta.length, 1000);
});

test("conversationId precisa ter20 caracteres alfanumericos", async () => {
    for (const conversationId of [undefined, null, 42, "", "a".repeat(19),
        "a".repeat(21), "../" + "a".repeat(17), "á".repeat(20), " ".repeat(20)]) {
        const s = setup();
        assert.equal((await s.run({body: {pergunta: "matricula", conversationId}})).code, 400);
        assertSemTrabalho(s);
    }
});

test("conversa inexistente retorna404 sem gerador nem transacao", async () => {
    const s = setup({initial: null});
    assert.equal((await s.run()).code, 404);
    assert.equal(s.calls.generator.length, 0);
    assert.equal(s.calls.transactions, 0);
    assert.equal(s.rows.size, 0);
});

test("usuarioId malicioso e ignorado e nunca lido", async () => {
    const s = setup();
    const outra = conversa([userMessage("privado")]);
    s.rows.set(caminho("mallory"), structuredClone(outra));
    const body = {pergunta: "matricula", conversationId: ID};
    Object.defineProperty(body, "usuarioId", {enumerable: true,
        get() {throw new Error("usuarioId nao pode ser lido");}});
    assert.equal((await s.run({body})).code, 200);
    assert.ok(s.calls.reads.every((path) => path === caminho("alice")));
    assert.deepEqual(s.rows.get(caminho("mallory")), outra);
    const s2 = setup();
    assert.equal((await s2.run({body: {
        pergunta: "matricula", conversationId: ID, usuarioId: "mallory",
    }})).code, 200);
    assert.equal(s2.calls.updates[0].path, caminho("alice"));
});

test("UID do token nao acessa conversa existente de outra conta", async () => {
    const s = setup();
    assert.equal((await s.run({authorization: "Bearer tokenB", body: {
        pergunta: "matricula", conversationId: ID, usuarioId: "alice",
    }})).code, 404);
    assert.deepEqual(s.calls.reads, [caminho("bob")]);
    assert.equal(s.rows.get(caminho()).mensagens.length, 1);
});

test("conversa cheia retorna409 sem gerar resposta", async () => {
    assert.equal(MAX_MENSAGENS, 100);
    const s = setup({initial: conversa(Array.from({length: 100}, (_, i) => userMessage(String(i))))});
    const before = structuredClone(s.rows.get(caminho()));
    assert.equal((await s.run()).code, 409);
    assert.deepEqual(s.rows.get(caminho()), before);
    assert.equal(s.calls.generator.length, 0);
    assert.equal(s.calls.transactions, 0);
});

test("99 mensagens aceita um bot e chega exatamente a100", async () => {
    const s = setup({initial: conversa(Array.from({length: 99}, (_, i) => userMessage(String(i))))});
    assert.equal((await s.run()).code, 200);
    assert.equal(s.rows.get(caminho()).mensagens.length, 100);
});

test("historico e titulo provisorio tambem sao preservados", async () => {
    const initial = {...conversa([userMessage(), {
        texto: "bot anterior", remetente: "bot", enviadoEm: 2,
    }]), tituloOrigem: "provisorio"};
    const s = setup({initial});
    assert.equal((await s.run()).code, 200);
    const saved = s.rows.get(caminho());
    assert.deepEqual(saved.mensagens.slice(0, 2), initial.mensagens);
    assert.equal(saved.tituloOrigem, "provisorio");
    assert.equal(saved.titulo, initial.titulo);
    assert.deepEqual(saved.criadoEm, initial.criadoEm);
});

test("conversa excluida durante geracao nao e recriada na transacao", async () => {
    const s = setup();
    s.deps.gerarResposta = async () => {s.rows.delete(caminho()); return "resposta";};
    assert.equal((await s.run()).code, 404);
    assert.equal(s.calls.transactions, 1);
    assert.equal(s.calls.updates.length, 0);
    assert.equal(s.rows.size, 0);
});

test("corrida para100 mensagens durante geracao retorna409 sem bot", async () => {
    const s = setup();
    s.deps.gerarResposta = async () => {
        s.rows.get(caminho()).mensagens = Array.from({length: 100}, (_, i) => userMessage(String(i)));
        return "resposta";
    };
    assert.equal((await s.run()).code, 409);
    assert.equal(s.calls.transactions, 1);
    assert.equal(s.calls.updates.length, 0);
    assert.equal(s.rows.get(caminho()).mensagens.length, 100);
});

test("mensagem de outra aba entre leitura e transacao nao e perdida", async () => {
    const s = setup();
    s.deps.gerarResposta = async () => {
        s.rows.get(caminho()).mensagens.push(userMessage("outra aba", 2));
        return "resposta da primeira pergunta";
    };
    assert.equal((await s.run()).code, 200);
    assert.deepEqual(s.rows.get(caminho()).mensagens.map((m) => m.texto),
        ["matricula", "outra aba", "resposta da primeira pergunta"]);
});

test("falha do gerador depois de user salvo nao adiciona bot nem desfaz user", async () => {
    const s = setup();
    const before = structuredClone(s.rows.get(caminho()));
    s.deps.gerarResposta = async () => {throw new Error("falha gerador");};
    assert.equal((await s.run()).code, 500);
    assert.deepEqual(s.rows.get(caminho()), before);
    assert.equal(s.calls.transactions, 0);
});

test("resposta vazia ou invalida do gerador nao e persistida", async () => {
    for (const resposta of ["", "   ", undefined, 42]) {
        const s = setup();
        s.deps.gerarResposta = async () => resposta;
        assert.equal((await s.run()).code, 500);
        assert.equal(s.calls.transactions, 0);
        assert.equal(s.rows.get(caminho()).mensagens.length, 1);
    }
});

test("falha no commit retorna500 com user preservado", async () => {
    const s = setup();
    const before = structuredClone(s.rows.get(caminho()));
    s.state.rejectCommit = true;
    assert.equal((await s.run()).code, 500);
    assert.deepEqual(s.rows.get(caminho()), before);
    assert.equal(s.calls.commits, 0);
});

test("duas requisicoes iguais nao sao idempotentes: dois bots, nenhum novo user", async () => {
    const s = setup();
    assert.equal((await s.run()).code, 200);
    assert.equal((await s.run()).code, 200);
    const msgs = s.rows.get(caminho()).mensagens;
    assert.equal(msgs.filter((m) => m.remetente === "user").length, 1);
    assert.equal(msgs.filter((m) => m.remetente === "bot").length, 2);
    assert.equal(s.calls.generator.length, 2);
});

test("duas abas podem concluir fora de ordem sem perder mensagens", async () => {
    const s = setup({initial: conversa([userMessage("pergunta A"), userMessage("pergunta B", 2)])});
    const a = deferred(), b = deferred(), started = deferred();
    let count = 0;
    s.deps.gerarResposta = async (_, pergunta) => {
        if (++count === 2) started.resolve();
        await (pergunta === "pergunta A" ? a.promise : b.promise);
        return "resposta " + pergunta;
    };
    const ra = s.run({body: {pergunta: "pergunta A", conversationId: ID}});
    const rb = s.run({body: {pergunta: "pergunta B", conversationId: ID}});
    await started.promise;
    b.resolve();
    assert.equal((await rb).code, 200);
    a.resolve();
    assert.equal((await ra).code, 200);
    assert.deepEqual(s.rows.get(caminho()).mensagens.map((m) => m.texto),
        ["pergunta A", "pergunta B", "resposta pergunta B", "resposta pergunta A"]);
});

test("duas respostas concorrentes em99 mensagens: uma200 outra409", async () => {
    const s = setup({initial: conversa(Array.from({length: 99}, () => userMessage()))});
    const started = deferred(), release = deferred();
    let count = 0;
    s.deps.gerarResposta = async () => {
        if (++count === 2) started.resolve();
        await release.promise;
        return "resposta";
    };
    const a = s.run(), b = s.run();
    await started.promise;
    release.resolve();
    const results = await Promise.all([a, b]);
    assert.deepEqual(results.map((r) => r.code).sort(), [200, 409]);
    assert.equal(s.rows.get(caminho()).mensagens.length, 100);
});

test("retry do callback transacional nao repete geracao nem perde estado novo", async () => {
    const s = setup();
    s.state.repeatTransaction = true;
    s.state.onRetry = () => s.rows.get(caminho()).mensagens.push(userMessage("aba durante retry"));
    assert.equal((await s.run()).code, 200);
    assert.equal(s.calls.generator.length, 1);
    assert.equal(s.calls.updates.length, 2);
    assert.equal(s.calls.commits, 1);
    assert.deepEqual(s.rows.get(caminho()).mensagens.map((m) => m.texto),
        ["matricula", "aba durante retry", "Resposta controlada"]);
});

test("troca de sessao nao muda UID de requisicao ja autenticada", async () => {
    const s = setup();
    s.rows.set(caminho("bob"), conversa([userMessage("bob")]));
    const started = deferred(), release = deferred();
    let clienteAtual = "alice";
    s.deps.gerarResposta = async () => {started.resolve(); await release.promise; return "resposta alice";};
    const pending = s.run();
    await started.promise;
    clienteAtual = "bob";
    release.resolve();
    assert.equal((await pending).code, 200);
    assert.equal(clienteAtual, "bob");
    assert.equal(s.rows.get(caminho("bob")).mensagens.length, 1);
    assert.equal(s.calls.updates[0].path, caminho("alice"));
});

test("sem score positivo contexto vazio nao inclui base inteira", async () => {
    const s = setup();
    assert.equal((await s.run({body: {pergunta: "xyzxyz", conversationId: ID}})).code, 200);
    assert.ok(s.calls.generator[0].prompt.includes("--- INÍCIO DO CONTEXTO OFICIAL ---\n\n--- FIM"));
    assert.ok(!s.calls.generator[0].prompt.includes("Documento oficial"));
});

test("falha na leitura RAG nao gera resposta nem bot", async () => {
    const s = setup();
    const collection = s.deps.firestore.collection;
    s.deps.firestore.collection = (name) => {
        if (name === "conhecimento") throw new Error("falha leitura");
        return collection(name);
    };
    assert.equal((await s.run()).code, 500);
    assert.equal(s.calls.generator.length, 0);
    assert.equal(s.calls.transactions, 0);
});

test("contrato nao garante correspondencia entre body e ultima mensagem user", async () => {
    const s = setup();
    assert.equal((await s.run({body: {pergunta: "outra pergunta", conversationId: ID}})).code, 200);
    assert.equal(s.calls.generator[0].pergunta, "outra pergunta");
    assert.equal(s.rows.get(caminho()).mensagens[0].texto, "matricula");
});

test("prompt e identico ao template do JS original sem executar index.js", () => {
    const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
    const compiler = requireFunctions("typescript");
    const codigo = readFileSync(
        "D:/Programação/sylvinho-backend/functions/index.js", "utf8");
    const ast = compiler.createSourceFile("index.js", codigo,
        compiler.ScriptTarget.Latest, true, compiler.ScriptKind.JS);
    let template;
    function procurar(node) {
        if (compiler.isVariableDeclaration(node) && compiler.isIdentifier(node.name) &&
            node.name.text === "promptSistema") template = node.initializer;
        compiler.forEachChild(node, procurar);
    }
    procurar(ast);
    assert.ok(compiler.isTemplateExpression(template));
    assert.equal(template.templateSpans.length, 1);
    const span = template.templateSpans[0];
    assert.equal(span.expression.getText(ast), "contextoSecretaria");
    for (const contexto of ["", "Contexto\ncom duas linhas", "Art.83 e matrícula"]) {
        assert.equal(montarPromptSistema(contexto),
            template.head.text + contexto + span.literal.text);
    }
});

test("erro ao devolver HTTP depois do commit nao desfaz bot", async () => {
    const s = setup();
    const res = {
        code: null, body: null,
        set() {return this;},
        status(code) {this.code = code; return this;},
        json(body) {
            if (this.code === 200) throw new Error("falha entrega HTTP simulada");
            this.body = body;
            return this;
        },
    };
    await perguntarAssistenteHandler({
        method: "POST", body: {pergunta: "matricula", conversationId: ID},
        get: () => "Bearer tokenA",
    }, res, s.deps);
    assert.equal(res.code, 500);
    assert.equal(s.calls.commits, 1);
    assert.equal(s.rows.get(caminho()).mensagens.at(-1).remetente, "bot");
    assert.equal((await s.run()).code, 200);
    assert.equal(s.rows.get(caminho()).mensagens.filter((m) => m.remetente === "bot").length, 2);
});

test("retry transacional revalida limite e descarta update da tentativa anterior", async () => {
    const s = setup();
    s.state.repeatTransaction = true;
    s.state.onRetry = () => {
        s.rows.get(caminho()).mensagens = Array.from({length: 100}, () => userMessage());
    };
    assert.equal((await s.run()).code, 409);
    assert.equal(s.calls.generator.length, 1);
    assert.equal(s.calls.commits, 0);
    assert.equal(s.rows.get(caminho()).mensagens.length, 100);
    assert.ok(s.rows.get(caminho()).mensagens.every((m) => m.remetente === "user"));
});
