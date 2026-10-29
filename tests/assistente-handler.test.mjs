// Apenas mocks locais; nao importa index.ts, SDK inicializado, secrets ou Gemini.
import assert from "node:assert/strict";
import test from "node:test";
import origemSintetica from "./fixtures/matricula-sintetica.cjs";
import {
    perguntarAssistenteHandler, montarPromptSistema,
    MAX_PERGUNTA_LENGTH, MAX_MENSAGENS,
} from "../functions/lib/assistente/handler.js";
import {selecionarDocumentosRelevantes}
    from "../functions/lib/rag/recuperacao.js";

const MID = "message-sylvinho-000001";
const MID2 = "message-sylvinho-000002";
const ID = "AbCdEfGhIjKlMnOpQrSt";
const caminho = (uid = "alice", id = ID) => `users/${uid}/conversas/${id}`;
const userMessage = (texto = "matricula", enviadoEm = 1, messageId = MID) =>
    ({texto, remetente: "user", enviadoEm, messageId});
const conversa = (mensagens = [userMessage()]) => ({
    titulo: "Titulo manual", tituloOrigem: "manual",
    criadoEm: {seconds: 1}, atualizadoEm: {seconds: 2}, mensagens,
});
const chunksPadrao = [{...origemSintetica, id: "ativo"},
    {...origemSintetica, id: "inativo", ativo: false}];

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
        async gerarResposta(pergunta, chunks) {
            calls.generator.push({chunks, pergunta});
            return "Resposta controlada";
        },
    };
    async function run({method = "POST", authorization = "Bearer tokenA",
        body = {pergunta: "matricula", conversationId: ID, messageId: MID}, dependencies = deps} = {}) {
        const res = {
            code: null, body: null, headers: {},
            set(name, value) {this.headers[name] = value; return this;},
            status(code) {this.code = code; return this;},
            json(payload) {this.body = payload; return this;},
        };
        await perguntarAssistenteHandler({
            method, body: body && typeof body === "object" && !Array.isArray(body) ? Object.defineProperties({messageId: MID}, Object.getOwnPropertyDescriptors(body)) : body, get(name) {
                assert.equal(name, "Authorization");
                return authorization;
            },
        }, res, dependencies);
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
    const initial = conversa([userMessage("MATRÍCULA")]);
    const s = setup({initial});
    const r = await s.run({body: {pergunta: "  MATRÍCULA  ", conversationId: ID}});
    assert.equal(r.code, 200);
    assert.deepEqual(r.body, {resposta: "Resposta controlada"});
    assert.deepEqual(s.calls.auth, ["tokenA"]);
    assert.deepEqual(s.calls.rag, [["conhecimento", "ativo", "==", true]]);
    assert.equal(s.calls.generator[0].pergunta, "MATRÍCULA");
    assert.deepEqual(s.calls.generator[0].chunks.map(d => d.id), ["ativo"]);
    const saved = s.rows.get(caminho());
    assert.deepEqual(saved.mensagens, [...initial.mensagens, {
        texto: "Resposta controlada", remetente: "bot", enviadoEm: 12345, messageId: MID,
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
    const valido = setup({initial: conversa([userMessage("matricula " + "x".repeat(990))])});
    assert.equal((await valido.run({body: {
        pergunta: "  " + "matricula " + "x".repeat(990) + "  ", conversationId: ID,
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
    const s = setup({initial: conversa([...Array.from({length: 99}, () => ({texto: "legado", remetente: "user"})), userMessage()])});
    const before = structuredClone(s.rows.get(caminho()));
    assert.equal((await s.run()).code, 409);
    assert.deepEqual(s.rows.get(caminho()), before);
    assert.equal(s.calls.generator.length, 0);
    assert.equal(s.calls.transactions, 0);
});

test("99 mensagens aceita um bot e chega exatamente a100", async () => {
    const s = setup({initial: conversa([...Array.from({length: 98}, () => ({texto: "legado", remetente: "user"})), userMessage()])});
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
        s.rows.get(caminho()).mensagens = [userMessage(), ...Array.from({length: 99}, () => ({texto: "legado", remetente: "user"}))];
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
        s.rows.get(caminho()).mensagens.push(userMessage("outra aba", 2, MID2));
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

test("duas requisicoes iguais sao idempotentes: um bot, nenhum novo user", async () => {
    const s = setup();
    assert.equal((await s.run()).code, 200);
    assert.equal((await s.run()).code, 200);
    const msgs = s.rows.get(caminho()).mensagens;
    assert.equal(msgs.filter((m) => m.remetente === "user").length, 1);
    assert.equal(msgs.filter((m) => m.remetente === "bot").length, 1);
    assert.equal(s.calls.generator.length, 1);
});

test("duas abas podem concluir fora de ordem sem perder mensagens", async () => {
    const s = setup({initial: conversa([userMessage("matricula A"), userMessage("matricula B", 2, MID2)])});
    const a = deferred(), b = deferred(), started = deferred();
    let count = 0;
    s.deps.gerarResposta = async (pergunta) => {
        if (++count === 2) started.resolve();
        await (pergunta === "matricula A" ? a.promise : b.promise);
        return "resposta " + pergunta;
    };
    const ra = s.run({body: {pergunta: "matricula A", conversationId: ID}});
    const rb = s.run({body: {pergunta: "matricula B", conversationId: ID, messageId: MID2}});
    await started.promise;
    b.resolve();
    assert.equal((await rb).code, 200);
    a.resolve();
    assert.equal((await ra).code, 200);
    assert.deepEqual(s.rows.get(caminho()).mensagens.map((m) => m.texto),
        ["matricula A", "matricula B", "resposta matricula B", "resposta matricula A"]);
});

test("duas respostas concorrentes em99 mensagens: uma200 outra409", async () => {
    const s = setup({initial: conversa([...Array.from({length: 97}, () => ({texto: "legado", remetente: "user"})), userMessage(), userMessage("matricula", 2, MID2)])});
    const started = deferred(), release = deferred();
    let count = 0;
    s.deps.gerarResposta = async () => {
        if (++count === 2) started.resolve();
        await release.promise;
        return "resposta";
    };
    const a = s.run(), b = s.run({body: {pergunta: "matricula", conversationId: ID, messageId: MID2}});
    await started.promise;
    release.resolve();
    const results = await Promise.all([a, b]);
    assert.deepEqual(results.map((r) => r.code).sort(), [200, 409]);
    assert.equal(s.rows.get(caminho()).mensagens.length, 100);
});

test("retry do callback transacional nao repete geracao nem perde estado novo", async () => {
    const s = setup();
    s.state.repeatTransaction = true;
    s.state.onRetry = () => s.rows.get(caminho()).mensagens.push(userMessage("aba durante retry", 2, MID2));
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
    const s = setup({initial: conversa([userMessage("matricula xyzxyz")])});
    assert.equal((await s.run({body: {pergunta: "matricula xyzxyz", conversationId: ID}})).code, 200);
    assert.equal(s.calls.generator[0].chunks.length, 0);
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

test("contrato vincula messageId ao texto salvo", async () => {
    const s = setup();
    assert.equal((await s.run({body: {pergunta: "outra pergunta", conversationId: ID}})).code, 409);
    assert.equal(s.calls.generator.length, 0);
});

test("utilitario legado de prompt preserva contexto sem carregar arquivos externos", () => {
    for (const contexto of ["", "Contexto local ficticio"]) {
        const prompt = montarPromptSistema(contexto);
        assert.ok(prompt.includes(contexto));
        assert.match(prompt, /Nunca invente dados/);
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
        method: "POST", body: {pergunta: "matricula", conversationId: ID, messageId: MID},
        get: () => "Bearer tokenA",
    }, res, s.deps);
    assert.equal(res.code, 500);
    assert.equal(s.calls.commits, 1);
    assert.equal(s.rows.get(caminho()).mensagens.at(-1).remetente, "bot");
    assert.equal((await s.run()).code, 200);
    assert.equal(s.rows.get(caminho()).mensagens.filter((m) => m.remetente === "bot").length, 1);
});

test("retry transacional revalida limite e descarta update da tentativa anterior", async () => {
    const s = setup();
    s.state.repeatTransaction = true;
    s.state.onRetry = () => {
        s.rows.get(caminho()).mensagens = [userMessage(), ...Array.from({length: 99}, () => ({texto: "legado", remetente: "user"}))];
    };
    assert.equal((await s.run()).code, 409);
    assert.equal(s.calls.generator.length, 1);
    assert.equal(s.calls.commits, 0);
    assert.equal(s.rows.get(caminho()).mensagens.length, 100);
    assert.ok(s.rows.get(caminho()).mensagens.every((m) => m.remetente === "user"));
});

const body = (messageId = MID, pergunta = 'matricula') => ({pergunta, conversationId: ID, messageId});
const bots = (s) => s.rows.get(caminho()).mensagens.filter((m) => m.remetente === 'bot');

test('primeira resposta e replay persistem somente um bot com messageId', async () => {
 const s=setup(); const a=await s.run(), b=await s.run();
 assert.equal(a.code,200); assert.deepEqual(a.body,b.body);
 assert.equal(bots(s).length,1); assert.equal(bots(s)[0].messageId,MID);
 assert.equal(s.calls.generator.length,1); assert.equal(s.calls.commits,1);
 assert.equal(s.rows.get(caminho()).titulo,'Titulo manual');
});
test('oito requisicoes simultaneas compartilham geracao e resposta', async () => {
 const s=setup(); const results=await Promise.all(Array.from({length:8},()=>s.run()));
 assert.ok(results.every(r=>r.code===200)); assert.equal(bots(s).length,1);
 assert.equal(s.calls.generator.length,1);
});
test('instancias separadas tambem deduplicam a persistencia na transacao', async () => {
 const s=setup(); const dependencies={...s.deps,firestore:{...s.deps.firestore}};
 const [a,b]=await Promise.all([s.run(),s.run({dependencies})]);
 assert.equal(a.code,200); assert.equal(b.code,200); assert.deepEqual(a.body,b.body);
 assert.equal(bots(s).length,1);
});
test('mesmo texto com IDs diferentes representa duas perguntas', async () => {
 const s=setup(); const mid2='message-sylvinho-000002';
 s.rows.get(caminho()).mensagens.push({...userMessage(),messageId:mid2});
 await s.run(); await s.run({body:body(mid2)}); assert.equal(bots(s).length,2);
});
for(const messageId of [undefined,'','x','../outro',42,'x'.repeat(81)]) {
 test('ID invalido '+String(messageId)+' retorna400',async()=>{
 const s=setup(); assert.equal((await s.run({body:{...body(),messageId}})).code,400);
 assert.equal(s.calls.generator.length,0);
 });
}
test('ID de outra pergunta ou texto alterado retorna409',async()=>{
 for(const input of [body('message-sylvinho-000099'),body(MID,'outra pergunta')]) {
 const s=setup(); assert.equal((await s.run({body:input})).code,409);
 assert.equal(s.calls.generator.length,0);
 }
});
test('UID alheio nao acessa conversa e usuarioId do corpo e ignorado',async()=>{
 const s=setup(); assert.equal((await s.run({authorization:'Bearer tokenB'})).code,404);
 assert.equal((await s.run({body:{...body(),usuarioId:'bob'}})).code,200);
});
for(const [options,code] of [[{method:'GET'},405],[{authorization:null},401],
 [{authorization:'Bearer invalido'},401],[{body:[]},400],[{body:{}},400],
 [{body:body(MID,' ')},400],[{body:body(MID,'x'.repeat(1001))},400],
 [{body:{...body(),conversationId:'../outro'}},400]]) {
 test('validacao '+JSON.stringify(options)+' -> '+code,async()=>{
 const s=setup(); assert.equal((await s.run(options)).code,code); assert.equal(bots(s).length,0);
 });
}
test('pergunta duplicada no historico nao recebe resposta ambigua',async()=>{
 const s=setup({initial:conversa([userMessage(),userMessage()])});
 assert.equal((await s.run()).code,409); assert.equal(bots(s).length,0);
});
test('falha de commit seguida de retry preserva user e um unico bot',async()=>{
 const s=setup(); s.state.rejectCommit=true; assert.equal((await s.run()).code,500);
 assert.equal(bots(s).length,0); s.state.rejectCommit=false;
 assert.equal((await s.run()).code,200); assert.equal(bots(s).length,1);
});
test('retry transacional nao repete geracao',async()=>{
 const s=setup(); s.state.repeatTransaction=true;
 assert.equal((await s.run()).code,200); assert.equal(s.calls.generator.length,1); assert.equal(bots(s).length,1);
});
test('historico legado sem IDs permanece intacto',async()=>{
 const legacy=[{texto:'Antiga',remetente:'user'},{texto:'Resposta antiga',remetente:'bot'}];
 const s=setup({initial:conversa([...legacy,userMessage()])}); await s.run();
 assert.deepEqual(s.rows.get(caminho()).mensagens.slice(0,2),legacy);
});
test('limite100 bloqueia nova resposta e permite replay ja persistido',async()=>{
 const filler=Array.from({length:98},()=>({texto:'legado',remetente:'user'}));
 const s=setup({initial:conversa([...filler,userMessage()])});
 assert.equal((await s.run()).code,200); assert.equal((await s.run()).code,200);
 assert.equal(s.rows.get(caminho()).mensagens.length,100);
 const full=setup({initial:conversa([...filler,userMessage(),{texto:'ultimo',remetente:'user'}])});
 assert.equal((await full.run()).code,409);
});
test('conversa excluida durante geracao nao e recriada',async()=>{
 const s=setup(); s.deps.gerarResposta=async()=>{s.rows.delete(caminho());return 'resposta';};
 assert.equal((await s.run()).code,404); assert.equal(s.rows.has(caminho()),false);
});
test('mensagem de outra aba durante geracao nao e perdida',async()=>{
 const s=setup(); s.deps.gerarResposta=async()=>{s.rows.get(caminho()).mensagens.push({texto:'outra',remetente:'user'});return 'resposta';};
 assert.equal((await s.run()).code,200); assert.equal(s.rows.get(caminho()).mensagens.length,3);
});
test('erro do gerador e resposta invalida nao gravam bot',async()=>{
 for(const value of ['',undefined,42]) {
 const s=setup();s.deps.gerarResposta=async()=>value;
 assert.equal((await s.run()).code,500);assert.equal(bots(s).length,0);
 }
 const s=setup();s.deps.gerarResposta=async()=>{throw new Error('detalhe privado');};
 const r=await s.run();assert.equal(r.code,500);assert.deepEqual(r.body,{error:'Erro interno no servidor do assistente.'});
});
