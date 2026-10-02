// Apos npm run build, compara o TypeScript compilado ao JS puro, sem index.js/.env.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import test from "node:test";
import * as ts from "../functions/lib/rag/recuperacao.js";

const require = createRequire(import.meta.url);
const origem = process.env.RAG_V1_ORIGEM ||
    "D:/Programação/sylvinho-backend/functions/rag/recuperacao.js";
const bytesOriginais = readFileSync(origem);
const js = require(origem);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const HASH_V1 = "28a1f524bc93bf79c271e3c8fafff13c62bc388450d5bc967c15a00bd2445d07";

function chunk(id, campos = {}) {
    return {id, documentoId: "documento", titulo: "", categoria: "", secao: "",
        conteudo: "", termosBusca: [], ativo: true, ...campos};
}
function comparar(documentos, pergunta, opcoes) {
    const antes = structuredClone(documentos);
    const esperado = js.selecionarDocumentosRelevantes(documentos, pergunta, opcoes);
    const obtido = ts.selecionarDocumentosRelevantes(documentos, pergunta, opcoes);
    assert.deepEqual(obtido, esperado);
    assert.equal(obtido.map(ts.formatarDocumentoContexto).join("\n\n"),
        esperado.map(js.formatarDocumentoContexto).join("\n\n"));
    assert.deepEqual(documentos, antes, "Nao modifica as entradas");
    return obtido;
}

test("origem V1 e constantes/stopwords permanecem exatas", () => {
    assert.equal(hash(bytesOriginais), HASH_V1);
    assert.equal(ts.MAX_DOCUMENTOS_CONTEXTO, js.MAX_DOCUMENTOS_CONTEXTO);
    assert.equal(ts.MAX_CARACTERES_CONTEXTO, js.MAX_CARACTERES_CONTEXTO);
    assert.deepEqual([...ts.PALAVRAS_COMUNS], [...js.PALAVRAS_COMUNS]);
});

test("normalizacao com acentos caixa Unicode pontuacao e tipos invalidos", () => {
    for (const texto of ["  MATRÍCULA! São João?  ", "Ação\tÚNICA\n123",
        "漢字 Português 42 B4 a1 75%", "", null, undefined, 42, {}, ["texto"]]) {
        assert.equal(ts.normalizarTexto(texto), js.normalizarTexto(texto));
    }
});

test("tokenizacao preserva stopwords duplicados termos curtos e numeros", () => {
    for (const texto of ["Como faço minha MATRÍCULA matrícula? B4 123",
        "quero preciso voce sobre eu ao de", "ausências AUSENCIAS limite 75 100",
        "", null, "É álgebra algebras"]) {
        assert.deepEqual(ts.extrairTermosUteis(texto), js.extrairTermosUteis(texto));
    }
});

test("correspondencia clara e ausencia de score positivo", () => {
    const docs = [chunk("b", {titulo: "Biblioteca", conteudo: "livros"}),
        chunk("a", {titulo: "Rematrícula", conteudo: "renovação de matrícula"})];
    assert.deepEqual(comparar(docs, "Como faço minha rematrícula?").map((d) => d.id), ["a"]);
    assert.deepEqual(comparar(docs, "telefone desconhecido"), []);
    assert.deepEqual(comparar(docs, "como de eu"), []);
    assert.deepEqual(comparar(null, "matricula"), []);
});

test("score mantem pesos8/5/3/1 e ocorrencia unica por campo", () => {
    for (const [campo, peso] of [["titulo", 8], ["categoria", 5],
        ["termosBusca", 3], ["conteudo", 1]]) {
        const d = {[campo]: "matricula matricula MATRICULA"};
        for (const termos of ["matrícula", ["matricula"], ["matricula", "matricula"]]) {
            assert.equal(ts.pontuarDocumento(d, termos), js.pontuarDocumento(d, termos));
        }
        assert.equal(ts.pontuarDocumento(d, "matricula"), peso);
    }
    assert.equal(ts.pontuarDocumento({titulo: "matriculas"}, "matricula"), 0);
});

test("ranking de scores diferentes e invariante de normalizacao", () => {
    const docs = [chunk("corpo", {conteudo: "matricula"}),
        chunk("categoria", {categoria: "matricula"}),
        chunk("busca", {secao: "indice", termosBusca: ["matricula"]}),
        chunk("titulo", {titulo: "MATRÍCULA"})];
    assert.deepEqual(comparar(docs, "Matrícula").map((d) => d.id),
        ["titulo", "categoria", "busca", "corpo"]);
});

test("empate por localeCompare de ID e depois indice inclusive ID duplicado", () => {
    const docs = [chunk("z", {titulo: "matricula"}), chunk("a", {titulo: "matricula"}),
        chunk("a", {titulo: "matricula", secao: "segunda parte"}),
        chunk("", {titulo: "matricula"})];
    const r = comparar(docs, "matricula");
    assert.deepEqual(r.map((d) => d.indice), [3, 1, 2, 0]);
});

test("ativo precisa ser estritamente true sem coercao", () => {
    const docs = [false, "true", 1, null, undefined, true].map((ativo, i) =>
        chunk(String(i), {ativo, titulo: "matricula"}));
    assert.deepEqual(comparar(docs, "matricula").map((d) => d.id), ["5"]);
});

test("limite padrao de cinco chunks", () => {
    const docs = Array.from({length: 9}, (_, i) => chunk(String(i), {titulo: "matricula"}));
    assert.equal(comparar(docs, "matricula").length, 5);
    assert.equal(comparar(docs, "matricula", {maxDocumentos: 2}).length, 2);
});

test("orcamento exato de8000 inclui rotulos e separador sem truncar", () => {
    const a = chunk("a", {titulo: "matricula", conteudo: "x"});
    const b = chunk("b", {titulo: "matricula", conteudo: "y"});
    const base = js.selecionarDocumentosRelevantes([a, b], "matricula");
    const extra = 8000 - base.map(js.formatarDocumentoContexto).join("\n\n").length;
    b.conteudo += "y".repeat(extra);
    const exato = comparar([a, b], "matricula");
    assert.equal(exato.length, 2);
    assert.equal(exato.map(ts.formatarDocumentoContexto).join("\n\n").length, 8000);
    b.conteudo += "y";
    assert.equal(comparar([a, b], "matricula").length, 1);
});

test("chunk grande e pulado e candidato menor continua elegivel", () => {
    const docs = [chunk("a", {titulo: "matricula", conteudo: "x".repeat(8000)}),
        chunk("b", {conteudo: "matricula"})];
    assert.deepEqual(comparar(docs, "matricula").map((d) => d.id), ["b"]);
    assert.deepEqual(comparar(docs, "matricula", {maxCaracteres: 0}), []);
});

test("campos ausentes invalidos array termosBusca e paginas opcionais", () => {
    const entradas = [null, undefined, 7, "texto", {}, [],
        {ativo: true}, {ativo: true, termosBusca: ["matricula"]},
        {ativo: true, secao: "matricula", titulo: 42},
        chunk("a", {titulo: " matrícula ", termosBusca: [" x ", 42, null, "", " matrícula "]})];
    for (const paginaInicial of [undefined, null, 0, -1, 1.5, "2", 2, Infinity, NaN]) {
        entradas.push(chunk("pagina", {titulo: "matricula", paginaInicial, paginaFinal: 3}));
    }
    entradas.forEach((d, i) => assert.deepEqual(
        ts.prepararDocumento(d, i), js.prepararDocumento(d, i)));
    comparar(entradas, "matricula");
});

test("snapshot usa data() e preserva ID externo e fallback interno", () => {
    for (const id of ["externo", "", undefined]) {
        const d = {id, data() {
            assert.equal(this, d);
            return chunk("interno", {titulo: "matricula"});
        }};
        assert.deepEqual(ts.prepararDocumento(d, 4), js.prepararDocumento(d, 4));
        assert.deepEqual(ts.selecionarDocumentosRelevantes([d], "matricula"),
            js.selecionarDocumentosRelevantes([d], "matricula"));
    }
});

test("formato completo do contexto e variantes das paginas sao identicos", () => {
    for (const d of [{}, {paginaInicial: 2}, {paginaFinal: 3},
        {paginaInicial: 2, paginaFinal: 2}, {paginaInicial: 2, paginaFinal: 4},
        chunk("ID", {titulo: "Título", categoria: "Norma", secao: "Art. 1",
            conteudo: "Linha 1\nLinha 2", paginaInicial: 1, paginaFinal: 2})]) {
        assert.equal(ts.formatarDocumentoContexto(d), js.formatarDocumentoContexto(d));
    }
});

test("consulta Firestore simulada usa somente conhecimento/ativo==true", async () => {
    const docs = [chunk("a", {titulo: "matricula"}),
        chunk("b", {titulo: "matricula", ativo: false})].map((d) =>
        ({id: d.id, data: () => d}));
    const chamadas = [];
    const fonte = {collection(nome) {
        chamadas.push(["collection", nome]);
        return {where(...args) {
            chamadas.push(["where", ...args]);
            return {async get() {
                chamadas.push(["get"]);
                return {forEach: (callback) => docs.forEach(callback)};
            }};
        }};
    }};
    const esperado = await js.recuperarConhecimentoRelevante(fonte, "matricula");
    const chamadasJS = chamadas.splice(0);
    const obtido = await ts.recuperarConhecimentoRelevante(fonte, "matricula");
    assert.deepEqual(obtido, esperado);
    assert.deepEqual(chamadas, chamadasJS);
    assert.deepEqual(chamadas, [["collection", "conhecimento"],
        ["where", "ativo", "==", true], ["get"]]);
});

test("falha de leitura nao e mascarada e snapshot vazio retorna vazio", async () => {
    const erro = new Error("leitura simulada");
    const fonte = {collection: () => ({where: () => ({
        get: async () => {throw erro;},
    })})};
    for (const v1 of [js, ts]) {
        await assert.rejects(v1.recuperarConhecimentoRelevante(fonte, "matricula"),
            (e) => e === erro);
        assert.deepEqual(await v1.recuperarConhecimentoRelevante({
            collection: () => ({where: () => ({
                get: async () => ({forEach() {}}),
            })}),
        }, "matricula"), []);
    }
});

test("matriz deterministica de250 corpus compara selecao e contexto", () => {
    let estado = 72;
    const random = () => {estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
        return estado / 4294967296;};
    const textos = ["", "matricula", "MATRÍCULA frequência", "histórico diploma",
        "como eu", "matriculas", "100 B4 renovação", "direitos dados"];
    for (let caso = 0; caso < 250; caso++) {
        const escolher = () => textos[Math.floor(random() * textos.length)];
        const docs = Array.from({length: 12}, (_, i) => chunk(String(Math.floor(random() * 8)), {
            ativo: random() > 0.2,
            titulo: escolher(), categoria: escolher(), secao: escolher(),
            termosBusca: [escolher(), escolher()], conteudo: escolher().repeat(i * 25 + 1),
            paginaInicial: i % 3 ? i + 1 : undefined,
        }));
        comparar(docs, escolher(), {maxCaracteres: caso % 2 ? 8000 : 500});
    }
    assert.equal(hash(readFileSync(origem)), HASH_V1, "Origem permaneceu intacta");
});
