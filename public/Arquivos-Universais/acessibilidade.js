// Acessibilidade compartilhada por todas as páginas: alto contraste e tamanho da fonte.
//
// Executado no <head>, antes de a página ser desenhada, para que a primeira pintura
// já saia com a preferência da pessoa (sem "piscar" no visual padrão).
//
// As escolhas ficam no localStorage do navegador, e não na conta do Firebase, por dois motivos:
//   1. valem também nas páginas públicas (início, login, cadastro, chat de visitante);
//   2. acessibilidade é uma necessidade de quem está usando o aparelho, e precisa
//      funcionar antes mesmo do login.
//
// Como funciona: o script só coloca dois atributos na tag <html>:
//   data-contraste="alto"  → acessibilidade.css troca as cores do site inteiro;
//   data-fonte="115…200" → acessibilidade.css aumenta a fonte base (1rem).
// Como as fontes do site usam rem, todo o texto cresce na mesma proporção.
(() => {
    'use strict';

    const CHAVE_CONTRASTE = 'etec:acessibilidade:contraste';
    const CHAVE_FONTE = 'etec:acessibilidade:fonte';
    // Porcentagens da fonte base. 100 é o tamanho original do site; 200 (o dobro)
    // é o máximo que a WCAG 1.4.4 pede que o site suporte sem perder conteúdo.
    const NIVEIS_FONTE = [100, 115, 130, 150, 175, 200];
    const raiz = document.documentElement;
    const ouvintes = new Set();

    // localStorage pode estar bloqueado (modo privado, política do navegador).
    // Nesse caso a preferência vale só para a página atual, sem erro.
    function ler(chave) {
        try {
            return localStorage.getItem(chave);
        } catch {
            return null;
        }
    }

    function gravar(chave, valor) {
        try {
            if (valor === null) localStorage.removeItem(chave);
            else localStorage.setItem(chave, valor);
        } catch {
            // Sem armazenamento, a mudança continua aplicada na página aberta.
        }
    }

    // Valores desconhecidos voltam ao padrão: nada vindo do armazenamento é confiado às cegas.
    function contrasteSalvo() {
        return ler(CHAVE_CONTRASTE) === 'alto';
    }

    function fonteSalva() {
        const nivel = Number(ler(CHAVE_FONTE));
        return NIVEIS_FONTE.includes(nivel) ? nivel : 100;
    }

    // Aplica as duas preferências na tag <html> e avisa quem estiver ouvindo
    // (por exemplo, os botões da página de Configurações).
    function aplicar() {
        const alto = contrasteSalvo();
        const fonte = fonteSalva();

        if (alto) raiz.dataset.contraste = 'alto';
        else delete raiz.dataset.contraste;

        if (fonte === 100) delete raiz.dataset.fonte;
        else raiz.dataset.fonte = String(fonte);

        ouvintes.forEach((ouvinte) => ouvinte(estado()));
    }

    function estado() {
        const fonte = fonteSalva();
        const posicao = NIVEIS_FONTE.indexOf(fonte);
        return {
            contrasteAlto: contrasteSalvo(),
            fonte,
            podeDiminuir: posicao > 0,
            podeAumentar: posicao < NIVEIS_FONTE.length - 1,
        };
    }

    function definirContraste(ligado) {
        gravar(CHAVE_CONTRASTE, ligado ? 'alto' : null);
        aplicar();
    }

    // Anda um nível para cima (+1) ou para baixo (-1), sem passar dos limites.
    function mudarFonte(passo) {
        const atual = NIVEIS_FONTE.indexOf(fonteSalva());
        const proximo = Math.min(Math.max(atual + passo, 0), NIVEIS_FONTE.length - 1);
        const nivel = NIVEIS_FONTE[proximo];
        gravar(CHAVE_FONTE, nivel === 100 ? null : String(nivel));
        aplicar();
    }

    window.etecAcessibilidade = {
        estado,
        definirContraste,
        aumentarFonte: () => mudarFonte(1),
        diminuirFonte: () => mudarFonte(-1),
        restaurarFonte: () => {
            gravar(CHAVE_FONTE, null);
            aplicar();
        },
        // Permite que uma tela atualize seus botões quando a preferência muda.
        aoMudar(ouvinte) {
            ouvintes.add(ouvinte);
            ouvinte(estado());
        },
    };

    aplicar();
    // Voltar pelo histórico (bfcache) e mudanças feitas em outra aba também atualizam a página.
    window.addEventListener('pageshow', aplicar);
    window.addEventListener('storage', (evento) => {
        if (evento.key === null || evento.key === CHAVE_CONTRASTE || evento.key === CHAVE_FONTE) aplicar();
    });
})();
