import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('frontend ativa somente a URL confirmada na origem autorizada', async () => {
    const source = read('public/Logado/Home/assistente-config.js');
    const config = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    assert.equal(config.endpointRenderPreparado, 'https://sylvinho-backend-poc.onrender.com/perguntarAssistente');
    assert.equal(config.validarEndpointPublicado(config.endpointRenderPreparado), config.endpointRenderPreparado);
    for (const origin of ['https://tcc-ia-d8891.web.app', 'https://tcc-ia-d8891.firebaseapp.com'])
        assert.equal(config.resolverAssistenteConfig({origin, local: undefined}).endpoint, config.endpointRenderPreparado);
    assert.equal(config.assistenteConfig.timeoutMs, 120000);
    for (const origin of ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://[::1]:5000', 'https://site.example.invalid'])
        assert.equal(config.resolverAssistenteConfig({origin, local: undefined}).endpoint, '');
});

test('avisos do prototipo nao mostram fixture nem consultam dados institucionais', async () => {
    const elements = new Map(); const get = id => {
        if (!elements.has(id)) elements.set(id, {hidden: false, textContent: '', addEventListener() {}, setAttribute() {},
            replaceChildren(...children) {this.textContent = children.map(c => c.textContent).join('');}});
        return elements.get(id);
    };
    vm.runInNewContext(read('public/Logado/Avisos/avisos.js').replaceAll('import(', 'blocked('), {
        document: {documentElement: {dataset: {demoAcademica: 'prototipo'}}, querySelector: get, createElement: () => ({textContent: ''})},
        window: {}, console, blocked() {assert.fail('SDK/Firestore nao deve carregar');},
    });
    await new Promise(done => setImmediate(done));
    assert.match(get('#noticeList').textContent, /não estão disponíveis neste protótipo/);
    assert.doesNotMatch(get('#noticeList').textContent, /Fixture|Cometa/);
    assert.equal(get('#retry').hidden, true);
});

test('dados de regressao nao pertencem a selecao de publicacao', () => {
    assert.match(read('.gitignore'), /\/tests\/dados\/rag-original\.json/);
    const entry = read('render-poc/documental.cjs');
    assert.doesNotMatch(entry, /demonstracao\.cjs|fixtures\.json|rag-original\.json|\.cache/);
    assert.match(entry, /criarFluxoPerguntaLivre\(\{ fonte: firestore/);
    assert.match(entry, /recuperarConhecimento: fluxo\.recuperarConhecimento/);
    assert.match(read('functions/src/assistente/pergunta-livre/busca.ts'), /recuperarConhecimentoRelevante\(fonte, texto\)/);
    assert.match(entry, /DOCUMENTAL_ORIGINAL_SOURCES_REQUIRED/);
});
