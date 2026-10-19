import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {criarGeradorGemini, MODELO_GEMINI}
    from "../functions/lib/assistente/gemini.js";
import {criarEndpointAssistente, origensPermitidas}
    from "../functions/lib/assistente/http.js";

const require = createRequire(import.meta.url);
const raiz = new URL("../functions/lib/", import.meta.url);
const dados = (v) => JSON.parse(JSON.stringify(v));

// Conteudo efemero sintetico; nenhuma chave real e lida ou armazenada.
function gateway(options = {}) {
    const {error, readError} = options;
    const text = Object.hasOwn(options, "text") ? options.text : "resposta";
    const calls = {read: 0, client: 0, params: []};
    const ephemeral = randomUUID();
    const gerar = criarGeradorGemini(() => {
        calls.read++;
        if (readError) throw readError;
        return ephemeral;
    }, () => {
        calls.client++;
        return {models: {async generateContent(params) {
            calls.params.push(params);
            if (error) throw error;
            return {text};
        }}};
    });
    return {gerar, calls};
}

test("gateway lazy nao le secret nem cria cliente na declaracao", () => {
    const g = gateway();
    assert.equal(g.calls.read, 0);
    assert.equal(g.calls.client, 0);
});

test("gateway preserva modelo prompt formato e texto sem temperatura nova", async () => {
    const g = gateway({text: " resposta intacta "});
    assert.equal(await g.gerar("prompt", "pergunta"), " resposta intacta ");
    assert.equal(MODELO_GEMINI, "gemini-2.5-flash");
    assert.deepEqual(g.calls.params, [{
        model: "gemini-2.5-flash",
        contents: [{role: "user", parts: [{
            text: "prompt\n\nPergunta do Usuário: pergunta",
        }]}],
    }]);
});

test("gateway rejeita chave ausente antes de criar SDK", async () => {
    for (const valor of ["", "   "]) {
        let client = 0;
        const gerar = criarGeradorGemini(() => valor, () => {client++;});
        await assert.rejects(gerar("p", "q"), {message: "GEMINI_UNAVAILABLE"});
        assert.equal(client, 0);
    }
});

test("gateway rejeita texto vazio ou invalido sem vazar resposta SDK", async () => {
    for (const text of ["", "   ", undefined, null, 42, {}]) {
        await assert.rejects(gateway({text}).gerar("p", "q"),
            {message: "GEMINI_UNAVAILABLE"});
    }
});

test("gateway sanitiza falha do SDK e leitura do secret sem causa", async () => {
    for (const opts of [{error: new Error("interno privado")},
        {readError: new Error("detalhes internos")}]) {
        const g = gateway(opts);
        await assert.rejects(g.gerar("p", "q"), (e) => {
            assert.equal(e.message, "GEMINI_UNAVAILABLE");
            assert.equal(e.cause, undefined);
            return true;
        });
    }
});

test("gateway sanitiza erro no construtor", async () => {
    const gerar = criarGeradorGemini(() => randomUUID(),
        () => {throw new Error("erro interno SDK");});
    await assert.rejects(gerar("p", "q"), {message: "GEMINI_UNAVAILABLE"});
});

test("carregador SDK padrao usa somente construtor e generateContent mockados", async () => {
    const exports = {};
    let loaded = 0, constructed = 0, generated = 0;
    const SDK = {GoogleGenAI: class {
        constructor(options) {constructed++; assert.equal(typeof options.apiKey, "string");}
        models = {async generateContent(params) {
            generated++;
            assert.equal(params.model, "gemini-2.5-flash");
            return {text: "mock"};
        }};
    }};
    vm.runInNewContext(readFileSync(new URL("assistente/gemini.js", raiz), "utf8"), {
        exports, __filename: "gateway-mock.js", require(spec) {
            assert.equal(spec, "node:module");
            return {createRequire: () => (name) => {
                assert.equal(name, "@google/genai");
                loaded++; return SDK;
            }};
        },
    });
    const gerar = exports.criarGeradorGemini(() => randomUUID());
    assert.equal(loaded, 0);
    assert.equal(await gerar("p", "q"), "mock");
    assert.equal(loaded, 1);
    assert.equal(constructed, 1);
    assert.equal(generated, 1);
});

test("origens sao exatas, sem wildcard caminhos ou HTTP externo", () => {
    assert.deepEqual(origensPermitidas(""), []);
    assert.deepEqual(origensPermitidas(" https://permitido.example, http://localhost:5000 "),
        ["https://permitido.example", "http://localhost:5000"]);
    for (const origin of ["*", "null", "https://*.example", "https://example/path",
        "https://example/", "https://u:p@example", "http://example", "arquivo"]) {
        assert.throws(() => origensPermitidas(origin));
    }
});

function fixture({origins = "https://permitido.example", sdkError,
    sdkText = "resposta mock", apps = []} = {}) {
    const calls = {init: 0, authFactory: 0, dbFactory: 0, auth: [],
        reads: [], rag: [], updates: [], sdk: [], secret: 0, options: null, globals: null};
    const secret = {value() {calls.secret++; return randomUUID();}};
    const saved = {titulo: "manual", tituloOrigem: "manual", criadoEm: 1,
        atualizadoEm: 2, mensagens: [{texto: "matricula", remetente: "user", enviadoEm: 1}]};
    const snapshot = () => ({exists: true, data: () => structuredClone(saved)});
    const reference = {path: "users/alice/conversas/AbCdEfGhIjKlMnOpQrSt",
        async get() {calls.reads.push(this.path); return snapshot();}};
    const db = {
        collection(name) {
            if (name === "conhecimento") return {where(...args) {
                calls.rag.push(args);
                return {async get() {return {forEach(callback) {
                    callback({id: "c", data: () => ({
                        ativo: true, titulo: "matricula", conteudo: "trecho oficial",
                    })});
                }}}};
            }};
            assert.equal(name, "users");
            return {doc(uid) {
                assert.equal(uid, "alice");
                return {collection(sub) {
                    assert.equal(sub, "conversas");
                    return {doc(id) {
                        assert.equal(id, "AbCdEfGhIjKlMnOpQrSt");
                        return reference;
                    }};
                }};
            }};
        },
        async runTransaction(callback) {
            await callback({
                get: async () => snapshot(),
                update(ref, update) {
                    assert.equal(ref, reference);
                    calls.updates.push(update); Object.assign(saved, update);
                },
            });
        },
    };
    const auth = {async verifyIdToken(token) {
        calls.auth.push(token);
        if (token !== "simulado") throw new Error("token interno");
        return {uid: "alice"};
    }};
    const params = {
        defineSecret(name) {
            if (name === "RESEND_API_KEY") return {value() {throw new Error("Envio inesperado");}};
            assert.equal(name, "GEMINI_API_KEY"); return secret;
        },
        defineString(name, options) {
            if (name.startsWith("AVISOS_")) return {value: () => options.default};
            assert.equal(name, "ASSISTENTE_CORS_ORIGINS");
            assert.equal(options.default, "");
            return {value: () => origins};
        },
    };
    const realGateway = require(fileURLToPath(new URL("assistente/gemini.js", raiz)));
    const http = require(fileURLToPath(new URL("assistente/http.js", raiz)));
    const mocks = {
        "firebase-functions": {setGlobalOptions: (v) => {calls.globals = v;}},
        "firebase-functions/v2/https": {onRequest(options, callback) {
            calls.options = options; return callback;
        }},
        "firebase-functions/v2/firestore": {onDocumentCreated: (_, callback) => callback},
        "firebase-functions/params": params,
        "firebase-admin/app": {getApps: () => apps, initializeApp() {calls.init++;}},
        "firebase-admin/auth": {getAuth() {calls.authFactory++; return auth;}},
        "firebase-admin/firestore": {
            getFirestore() {calls.dbFactory++; return db;},
            FieldValue: {serverTimestamp: () => "timestamp mock"},
        },
        "./assistente/gemini.js": {criarGeradorGemini: (read) =>
            realGateway.criarGeradorGemini(read, () => ({models: {
                async generateContent(input) {
                    calls.sdk.push(input);
                    if (sdkError) throw sdkError;
                    return {text: sdkText};
                },
            }}))},
        "./assistente/http.js": http,
        "./avisos/email.js": require(fileURLToPath(new URL("avisos/email.js", raiz))),
        "./avisos/notificacoes.js": require(fileURLToPath(new URL("avisos/notificacoes.js", raiz))),
    };
    const exports = {};
    vm.runInNewContext(readFileSync(new URL("index.js", raiz), "utf8"),
        {exports, require(name) {
            assert.ok(name in mocks, "Import inesperado");
            return mocks[name];
        }});
    async function request(options = {}) {
        const {method = "POST", origin = "https://permitido.example",
        token = "Bearer simulado", preflight = "POST",
        headers = "authorization,content-type",
        body = {pergunta: "matricula", conversationId: "AbCdEfGhIjKlMnOpQrSt"}} = options;
        const res = {
            code: null, body: null, headers: {}, headersSent: false,
            vary(name) {this.headers.Vary = name; return this;},
            set(name, value) {this.headers[name] = value; return this;},
            status(value) {this.code = value; return this;},
            json(value) {this.body = value; return this;},
            send() {return this;},
        };
        const fields = {Origin: Object.hasOwn(options, "origin") ? options.origin : origin, Authorization: token,
            "Access-Control-Request-Method": preflight,
            "Access-Control-Request-Headers": headers};
        await exports.perguntarAssistente({method, body, get: (name) => fields[name]}, res);
        return res;
    }
    return {calls, saved, secret, exports, request};
}

test("entrypoint preserva endpoint e seus secret/regiao/maxInstances junto aos avisos", () => {
    const s = fixture();
    assert.deepEqual(Object.keys(s.exports).sort(), [
        "enfileirarNotificacoesAviso", "enviarNotificacaoAviso", "perguntarAssistente",
    ]);
    assert.deepEqual(dados(s.calls.globals), {maxInstances: 10});
    assert.equal(s.calls.options.region, "southamerica-east1");
    assert.equal(s.calls.options.cors, false);
    assert.equal(s.calls.options.secrets.length, 1);
    assert.equal(s.calls.options.secrets[0], s.secret);
    assert.equal(s.calls.init, 1);
    assert.equal(s.calls.secret, 0);
    assert.equal(s.calls.dbFactory, 0);
    assert.equal(s.calls.sdk.length, 0);
});

test("Admin inicializacao nao e repetida quando app ja existe", () => {
    assert.equal(fixture({apps: [{name: "[DEFAULT]"}]}).calls.init, 0);
});

test("app Admin nomeado nao impede inicializacao do app default", () => {
    assert.equal(fixture({apps: [{name: "outro"}]}).calls.init, 1);
});

test("secret ausente no endpoint nao chama SDK nem salva bot", async () => {
    const s = fixture();
    s.secret.value = () => "";
    const r = await s.request();
    assert.equal(r.code, 500);
    assert.deepEqual(r.body, {error: "Erro interno no servidor do assistente."});
    assert.equal(s.calls.sdk.length, 0);
    assert.equal(s.calls.updates.length, 0);
});

test("POST atraves dos adapters reais mockados preserva contrato e somente bot", async () => {
    const s = fixture();
    const r = await s.request();
    assert.equal(r.code, 200);
    assert.deepEqual(r.body, {resposta: "resposta mock"});
    assert.equal(r.headers["Access-Control-Allow-Origin"], "https://permitido.example");
    assert.equal(r.headers.Vary, "Origin");
    assert.equal(r.headers["Access-Control-Allow-Credentials"], undefined);
    assert.deepEqual(s.calls.auth, ["simulado"]);
    assert.deepEqual(s.calls.rag, [["ativo", "==", true]]);
    assert.equal(s.calls.sdk.length, 1);
    assert.equal(s.calls.sdk[0].model, "gemini-2.5-flash");
    assert.ok(s.calls.sdk[0].contents[0].parts[0].text.includes("trecho oficial"));
    assert.equal(s.saved.mensagens.length, 2);
    assert.equal(s.saved.mensagens[1].remetente, "bot");
    assert.equal(s.saved.titulo, "manual");
    assert.deepEqual(Object.keys(s.calls.updates[0]).sort(), ["atualizadoEm", "mensagens"]);
});

test("OPTIONS permitido retorna204 sem auth firestore secret ou SDK", async () => {
    const s = fixture();
    const r = await s.request({method: "OPTIONS", token: undefined});
    assert.equal(r.code, 204);
    assert.equal(r.headers["Access-Control-Allow-Methods"], "POST");
    assert.equal(r.headers["Access-Control-Allow-Headers"], "Authorization, Content-Type");
    assert.equal(s.calls.authFactory, 0);
    assert.equal(s.calls.dbFactory, 0);
    assert.equal(s.calls.secret, 0);
    assert.equal(s.calls.sdk.length, 0);
});

test("origem nao permitida e rejeitada antes das dependencias", async () => {
    for (const method of ["POST", "OPTIONS"]) {
        const s = fixture();
        const r = await s.request({method, origin: "https://nao-permitido.example"});
        assert.equal(r.code, 403);
        assert.equal(r.headers["Access-Control-Allow-Origin"], undefined);
        assert.equal(s.calls.dbFactory, 0);
        assert.equal(s.calls.secret, 0);
    }
});

test("configuracao vazia bloqueia browser mas nao substitui auth de cliente sem Origin", async () => {
    const s = fixture({origins: ""});
    assert.equal((await s.request()).code, 403);
    assert.equal((await s.request({origin: undefined, token: null})).code, 401);
    assert.equal((await s.request({origin: undefined})).code, 200);
});

test("origem mal configurada resulta500 generico sem criar dependencias", async () => {
    const s = fixture({origins: "*"});
    const r = await s.request();
    assert.equal(r.code, 500);
    assert.deepEqual(r.body, {error: "Erro interno no servidor do assistente."});
    assert.equal(s.calls.dbFactory, 0);
});

test("preflight invalido retorna400 sem autenticacao", async () => {
    for (const opts of [{preflight: "GET"}, {headers: "x-unexpected"},
        {origin: undefined}]) {
        const s = fixture();
        assert.equal((await s.request({method: "OPTIONS", ...opts})).code, 400);
        assert.equal(s.calls.authFactory, 0);
    }
});

test("codigos405 401 400 e contrato de erro permanecem genericos", async () => {
    for (const [opts, code] of [[{method: "GET"}, 405], [{token: null}, 401],
        [{token: "Bearer invalido"}, 401], [{body: {}}, 400]]) {
        const s = fixture();
        const r = await s.request(opts);
        assert.equal(r.code, code);
        assert.deepEqual(Object.keys(r.body), ["error"]);
        assert.equal(s.calls.sdk.length, 0);
    }
});

test("falha SDK retorna500 sem contexto stack detalhes internos ou bot", async () => {
    const s = fixture({sdkError: new Error("detalhe privado do SDK")});
    const r = await s.request();
    assert.equal(r.code, 500);
    assert.deepEqual(r.body, {error: "Erro interno no servidor do assistente."});
    assert.equal(s.calls.updates.length, 0);
    assert.equal(s.saved.mensagens.length, 1);
});

test("resposta invalida no SDK retorna500 sem escrita", async () => {
    const s = fixture({sdkText: ""});
    assert.equal((await s.request()).code, 500);
    assert.equal(s.calls.updates.length, 0);
});

test("erro da fabrica de dependencias e sanitizado pelo adapter", async () => {
    const callback = criarEndpointAssistente(
        () => {throw new Error("infra privada");}, () => "");
    const res = {headersSent: false, vary() {},
        status(c) {this.code = c; return this;}, json(b) {this.body = b;}};
    await callback({method: "POST", get: () => undefined}, res);
    assert.equal(res.code, 500);
    assert.deepEqual(res.body, {error: "Erro interno no servidor do assistente."});
});
