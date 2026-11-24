// Acessibilidade: alto contraste e tamanho da fonte (public/Arquivos-Universais/acessibilidade.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const publico = path.resolve('public');
const codigo = fs.readFileSync(path.join(publico, 'Arquivos-Universais/acessibilidade.js'), 'utf8');

// Executa o script como no navegador, com <html>, localStorage e window falsos.
function carregar(armazenado = {}) {
    const dados = new Map(Object.entries(armazenado));
    const html = { dataset: {} };
    const janela = { addEventListener() {} };
    const contexto = {
        document: { documentElement: html },
        localStorage: {
            getItem: (chave) => (dados.has(chave) ? dados.get(chave) : null),
            setItem: (chave, valor) => dados.set(chave, String(valor)),
            removeItem: (chave) => dados.delete(chave),
        },
        window: janela,
    };
    vm.runInNewContext(codigo, contexto);
    return { a11y: janela.etecAcessibilidade, html, dados };
}

test('acessibilidade: sem preferência salva, o site abre no visual padrão', () => {
    const { html, a11y } = carregar();
    assert.equal(html.dataset.contraste, undefined);
    assert.equal(html.dataset.fonte, undefined);
    assert.equal(a11y.estado().fonte, 100);
});

test('acessibilidade: preferência salva é aplicada antes de desenhar a página', () => {
    const { html } = carregar({
        'etec:acessibilidade:contraste': 'alto',
        'etec:acessibilidade:fonte': '130',
    });
    assert.equal(html.dataset.contraste, 'alto');
    assert.equal(html.dataset.fonte, '130');
});

test('acessibilidade: valor desconhecido no armazenamento volta ao padrão', () => {
    const { html } = carregar({
        'etec:acessibilidade:contraste': '<script>',
        'etec:acessibilidade:fonte': '999',
    });
    assert.equal(html.dataset.contraste, undefined);
    assert.equal(html.dataset.fonte, undefined);
});

test('acessibilidade: liga e desliga o alto contraste e grava a escolha', () => {
    const { a11y, html, dados } = carregar();
    a11y.definirContraste(true);
    assert.equal(html.dataset.contraste, 'alto');
    assert.equal(dados.get('etec:acessibilidade:contraste'), 'alto');
    a11y.definirContraste(false);
    assert.equal(html.dataset.contraste, undefined);
    assert.equal(dados.has('etec:acessibilidade:contraste'), false);
});

test('acessibilidade: fonte sobe e desce em níveis, sem passar dos limites', () => {
    const { a11y, html } = carregar();
    a11y.diminuirFonte();
    assert.equal(a11y.estado().fonte, 100, 'não diminui abaixo do tamanho original');
    const vistos = [];
    for (let i = 0; i < 7; i++) {
        a11y.aumentarFonte();
        vistos.push(a11y.estado().fonte);
    }
    assert.deepEqual(vistos, [115, 130, 150, 175, 200, 200, 200]);
    assert.equal(html.dataset.fonte, '200');
    assert.equal(a11y.estado().podeAumentar, false);
    a11y.restaurarFonte();
    assert.equal(html.dataset.fonte, undefined);
    assert.equal(a11y.estado().podeDiminuir, false);
});

test('acessibilidade: telas de configuração são avisadas a cada mudança', () => {
    const { a11y } = carregar();
    const estados = [];
    a11y.aoMudar((estado) => estados.push(estado));
    a11y.aumentarFonte();
    a11y.definirContraste(true);
    assert.deepEqual(
        estados.map((e) => [e.fonte, e.contrasteAlto]),
        [[100, false], [115, false], [115, true]],
    );
});

test('acessibilidade: localStorage bloqueado não quebra a página', () => {
    const html = { dataset: {} };
    const janela = { addEventListener() {} };
    const bloqueado = () => {
        throw new Error('SecurityError');
    };
    vm.runInNewContext(codigo, {
        document: { documentElement: html },
        localStorage: { getItem: bloqueado, setItem: bloqueado, removeItem: bloqueado },
        window: janela,
    });
    assert.doesNotThrow(() => janela.etecAcessibilidade.aumentarFonte());
});

// Garante que nenhuma página nova fique sem os recursos de acessibilidade.
function paginas(dir = publico) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
        const caminho = path.join(dir, item.name);
        if (item.isDirectory()) return paginas(caminho);
        return item.name.endsWith('.html') ? [caminho] : [];
    });
}

test('acessibilidade: todas as páginas carregam o CSS e o script, depois do tema', () => {
    const lista = paginas();
    assert.ok(lista.length >= 13);
    for (const pagina of lista) {
        const html = fs.readFileSync(pagina, 'utf8');
        const nome = path.relative(publico, pagina);
        const tema = html.indexOf('theme.js"');
        const script = html.indexOf('acessibilidade.js"');
        const estilo = html.indexOf('acessibilidade.css"');
        assert.ok(script > tema && tema !== -1, `${nome}: acessibilidade.js depois de theme.js`);
        assert.ok(estilo !== -1, `${nome}: acessibilidade.css`);
        assert.ok(script < html.indexOf('</head>'), `${nome}: script no <head>, antes da pintura`);
    }
});

// Fonte em px não cresce com o botão "A+"; o site inteiro precisa usar rem/em.
test('acessibilidade: nenhum CSS define font-size em px', () => {
    const arquivos = (function css(dir) {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
            const caminho = path.join(dir, item.name);
            if (item.isDirectory()) return css(caminho);
            return item.name.endsWith('.css') ? [caminho] : [];
        });
    })(publico);
    for (const arquivo of arquivos) {
        const css = fs.readFileSync(arquivo, 'utf8');
        const emPx = css.match(/font-size:[^;}]*\dpx/g) || [];
        assert.deepEqual(emPx, [], path.relative(publico, arquivo));
    }
});
