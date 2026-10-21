import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
    FONTES_ORIGINAIS, selecionarDocumentosOriginais, recuperarConhecimentoRelevante,
    formatarDocumentoContexto, MAX_CARACTERES_CONTEXTO, MAX_DOCUMENTOS_CONTEXTO,
} from '../functions/lib/rag/recuperacao.js';
import { gerarRespostaDocumental } from '../functions/lib/assistente/resposta-documental.js';

// Copias literais da colecao conhecimento, sem fixtures inventadas ou I/O online.
const amostra = JSON.parse(readFileSync(new URL('./dados/rag-original.json', import.meta.url))).documentos;
const corpus = process.env.RAG_CORPUS_LOCAL
    ? JSON.parse(readFileSync(process.env.RAG_CORPUS_LOCAL, 'utf8')) : amostra;
const selecionar = pergunta => selecionarDocumentosOriginais(corpus, pergunta);
const frequencia = amostra.find(d => d.titulo === 'Regimento Comum - Artigo 83');
const matricula = amostra.find(d => d.titulo === 'Sistema Etec - B1 - Inicial na Etec');

function verificarLimites(docs) {
    assert.ok(docs.length <= MAX_DOCUMENTOS_CONTEXTO);
    assert.ok(docs.map(formatarDocumentoContexto).join('\n\n').length <= MAX_CARACTERES_CONTEXTO);
    assert.ok(docs.every(d => FONTES_ORIGINAIS.includes(d.documentoId)));
}

test('lista fechada contem exatamente as tres fontes originais autorizadas', () => {
    assert.deepEqual([...FONTES_ORIGINAIS], [
        'doc-10d342eed4d6a46a5c6638a29179d80b',
        'doc-3319912252fbc4089c42a062f73d1b58',
        'doc-e7dd9dc45e79430bc34af10b786f6b1d',
    ]);
    assert.equal(Object.isFrozen(FONTES_ORIGINAIS), true);
    assert.equal(new Set(amostra.map(d => d.documentoId)).size, 3);
});

test('frequencia minima para aprovacao recupera a regra quantitativa do artigo 83', () => {
    const docs = selecionar('Qual a frequência mínima para aprovação?');
    assert.ok(docs.length > 0);
    assert.ok(docs.every(d => d.tipoConteudo === 'normativo'));
    assert.equal(docs[0].id, frequencia.id);
    assert.match(docs[0].conteudo, /75%/);
    assert.equal(docs[0].paginaInicial, 26);
    verificarLimites(docs);
});

test('matricula inicial recupera B1 sem trancamento intercambio ou cabecalho vazio', () => {
    const docs = selecionar('Como faço minha matrícula?');
    assert.ok(docs.length > 0);
    assert.ok(docs.every(d => /B1 - Inicial na Etec/.test(d.titulo)));
    assert.ok(docs.every(d => d.tipoConteudo === 'procedimento'));
    verificarLimites(docs);
});

test('rematricula recupera renovacao B4 sem mencoes incidentais do intercambio', () => {
    const docs = selecionar('Como faço minha rematrícula?');
    assert.ok(docs.length > 0);
    assert.ok(docs.every(d => /B4 - Renovação/.test(d.titulo)));
    verificarLimites(docs);
});

test('flexoes e caixa nao eliminam os procedimentos validos', () => {
    for (const pergunta of ['MATRÍCULAS', 'Como fazer minha rematrícula?']) {
        assert.ok(selecionar(pergunta).length > 0, pergunta);
    }
});

test('declaracao informativa retorna norma; pedido de modelo retorna apenas modelos identificados', () => {
    const norma = selecionar('Declaração escolar');
    assert.ok(norma.some(d => d.titulo === 'Regimento Comum - Artigo 94'));
    assert.ok(norma.every(d => d.tipoConteudo !== 'modelo'));
    const modelos = selecionar('Modelo de declaração escolar');
    assert.ok(modelos.length > 0);
    assert.ok(modelos.every(d => d.tipoConteudo === 'modelo'));
    const resposta = gerarRespostaDocumental('declaração', modelos);
    assert.equal(resposta.status, 'informacao_insuficiente');
    assert.equal(resposta.motivo, 'apenas_modelos');
    assert.ok(resposta.citacoes.every(c => c.fonte.natureza === 'modelo'));
});

test('orientacao de declaracao recupera D5; sem D5 nao usa norma ou modelo como procedimento', () => {
    const disponiveis = selecionar('Como solicitar declaração escolar?');
    assert.ok(disponiveis.length > 0);
    assert.ok(disponiveis.every(d => d.tipoConteudo === 'procedimento' && /D5 - Atestados/.test(d.titulo)));
    const docs = selecionarDocumentosOriginais(corpus.filter(d => !/D5 - Atestados/.test(d.titulo)),
        'Como solicitar declaração escolar?');
    assert.deepEqual(docs, []);
    assert.equal(gerarRespostaDocumental('Como solicitar declaração escolar?', docs).status,
        'informacao_insuficiente');
});

for (const pergunta of [
    'Qual o telefone da secretaria da unidade?',
    'Qual o telefone da secretaria?',
    'Qual o procedimento para transporte interplanetário?',
    'Existe estacionamento para naves interplanetárias?',
    'procedimento',
]) {
    test(`insuficiencia nao vira evidencia: ${pergunta}`, () => {
        const docs = selecionar(pergunta);
        assert.deepEqual(docs, []);
        const resposta = gerarRespostaDocumental(pergunta, docs);
        assert.equal(resposta.status, 'informacao_insuficiente');
        assert.equal(resposta.citacoes.length, 0);
        assert.match(resposta.resposta, /secretaria/i);
    });
}

test('fonte desconhecida e IDs de demo nunca entram mesmo com texto original relevante', () => {
    const contaminados = [
        {...frequencia, documentoId: 'demo-academica-v1-matricula'},
        {...frequencia, documentoId: 'fonte-nao-autorizada'},
        {...frequencia, documentoId: ''},
    ];
    assert.deepEqual(selecionarDocumentosOriginais(contaminados, 'frequência mínima'), []);
    const docs = selecionarDocumentosOriginais([...contaminados, frequencia], 'frequência mínima');
    assert.equal(docs.length, 1);
    assert.equal(docs[0].documentoId, frequencia.documentoId);
});

test('titulo e termosBusca sem evidencia no corpo nao bastam', () => {
    // Metadados relevantes com outro conteudo real; nao fabrica texto documental.
    assert.deepEqual(selecionarDocumentosOriginais([
        {...frequencia, conteudo: matricula.conteudo},
    ], 'frequência mínima'), []);
});

test('inativo vazio sem origem ou entrada invalida recusam sem modificar os dados', () => {
    for (const docs of [null, {}, [], [{...frequencia, ativo: false}],
        [{...frequencia, conteudo: ''}], [{...frequencia, id: ''}]]) {
        assert.deepEqual(selecionarDocumentosOriginais(docs, 'frequência mínima'), []);
    }
    const antes = structuredClone(amostra);
    selecionarDocumentosOriginais(amostra, 'matrícula');
    assert.deepEqual(amostra, antes);
});

test('contexto mantem fontes paginas e tetos mesmo com opcoes maiores', () => {
    const docs = selecionarDocumentosOriginais(corpus, 'matrícula',
        {maxDocumentos: 999, maxCaracteres: 999999});
    verificarLimites(docs);
    const texto = docs.map(formatarDocumentoContexto).join('\n\n');
    assert.match(texto, /Documento ID: doc-/);
    assert.match(texto, /Páginas?:/);
    assert.deepEqual(selecionarDocumentosOriginais(corpus, 'matrícula', {maxCaracteres: 1}), []);
});

test('recuperacao integrada consulta apenas conhecimento ativo e filtra antes do gerador', async () => {
    const chamadas = [];
    const fonte = {collection(nome) {
        chamadas.push(nome);
        return {where(...args) {
            chamadas.push(args);
            return {async get() {
                return {forEach(cb) {
                    for (const doc of [frequencia, {...frequencia, documentoId: 'nao-autorizada'}]) {
                        cb({id: doc.id, data: () => doc});
                    }
                }};
            }};
        }};
    }};
    const docs = await recuperarConhecimentoRelevante(fonte, 'frequência mínima');
    assert.deepEqual(chamadas, ['conhecimento', ['ativo', '==', true]]);
    assert.equal(docs.length, 1);
    assert.equal(docs[0].documentoId, frequencia.documentoId);
});
