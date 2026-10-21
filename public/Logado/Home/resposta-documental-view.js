/* Apresentação somente: não modifica a resposta original nem a persistência. */
(() => {
    'use strict';
    const introducoes = new Set([
        'Trechos documentais relacionados a pergunta (citacoes, nao uma interpretacao ou garantia de regra vigente):',
        'Modelos/exemplos documentais encontrados (nao comprovam regras, prazos ou procedimentos):',
        'Nao ha informacao suficiente na base consultada para o Sylvinho responder com seguranca. Procure a secretaria academica para obter a informacao oficial.\nModelos/exemplos relacionados nao comprovam uma regra ou procedimento:',
    ]);
    function fonteLegivel(original) {
        const partes = original.split('; ');
        const titulo = partes.shift();
        if (!titulo || titulo.includes(';') || /^(?:documento|trecho|secao):/u.test(titulo)) return null;
        const visiveis = [titulo];
        let ordem = 0;
        const vistos = new Set();
        for (const parte of partes) {
            let categoria;
            if (/^documento: [^;\r\n]+$/u.test(parte)) categoria = 1;
            else if (/^trecho: [^;\r\n]+$/u.test(parte)) categoria = 2;
            else if (/^secao: [^;\r\n]+$/u.test(parte)) categoria = 3;
            else if (/^(?:pagina [1-9]\d*|paginas [1-9]\d*-[1-9]\d* \(intervalo do chunk\)|pagina (?:inicial|final) [1-9]\d*)$/u.test(parte)) categoria = 4;
            else return null;
            if (categoria < ordem || vistos.has(categoria)) return null;
            vistos.add(categoria);
            ordem = categoria;
            if (categoria === 3) {
                const secao = parte.slice(7);
                // Hierarquias extensas continuam completas nos detalhes originais.
                if (secao.length <= 80 && !titulo.toLocaleLowerCase('pt-BR').includes(secao.toLocaleLowerCase('pt-BR')))
                    visiveis.push(secao);
            }
            if (categoria === 4) visiveis.push(parte.replace(/^paginas/u, 'páginas').replace(/^pagina/u, 'página'));
        }
        // Sem metadados reconhecidos, não tentar interpretar uma linha ambígua.
        if (!vistos.size) return null;
        return visiveis.join(' — ');
    }
    function analisar(original) {
        if (typeof original !== 'string' || original.length > 2400) return null;
        const texto = original;
        const inicio = texto.search(/\r?\n\r?\n1\. /u);
        if (inicio < 0) return null;
        const introducao = texto.slice(0, inicio);
        if (!introducoes.has(introducao.replace(/\r\n/gu, '\n'))) return null;
        const resto = texto.slice(inicio);
        const padrao = /\r?\n\r?\n([1-3])\. (Trecho documental|Modelo\/exemplo, nao normativo): "([\s\S]*?)"\r?\nFonte: ([^\r\n]+)\.(?=\r?\n\r?\n[1-3]\. |$)/gu;
        const citacoes = [];
        let reconstruido = '';
        for (const bloco of resto.matchAll(padrao)) {
            if (Number(bloco[1]) !== citacoes.length + 1 || !bloco[3] || bloco[3].length > 480) return null;
            const fonte = fonteLegivel(bloco[4]);
            if (!fonte) return null;
            citacoes.push({tipo: bloco[2], texto: bloco[3], fonte});
            reconstruido += bloco[0];
        }
        if (!citacoes.length || citacoes.length > 3 || reconstruido !== resto) return null;
        return {introducao, citacoes};
    }
    function renderizar(container, original) {
        const dados = analisar(original);
        if (!dados) { container.textContent = original; return false; }
        const doc = container.ownerDocument;
        const criar = (tag, classe, texto) => {
            const element = doc.createElement(tag);
            if (classe) element.className = classe;
            if (texto !== undefined) element.textContent = texto;
            return element;
        };
        const citacao = (item) => {
            const bloco = criar('figure', 'documental-citacao');
            bloco.append(criar('p', 'documental-natureza', item.tipo));
            bloco.append(criar('blockquote', '', item.texto));
            bloco.append(criar('figcaption', 'documental-fonte', 'Fonte: ' + item.fonte));
            return bloco;
        };
        container.classList.add('documental');
        container.append(criar('p', 'documental-introducao', dados.introducao));
        container.append(citacao(dados.citacoes[0]));
        if (dados.citacoes.length > 1) {
            const outras = criar('details', 'documental-detalhes');
            outras.append(criar('summary', '', dados.citacoes.length === 2 ? 'Ver mais 1 citação completa' : 'Ver mais 2 citações completas'));
            dados.citacoes.slice(1).forEach(item => outras.append(citacao(item)));
            container.append(outras);
        }
        const completas = criar('details', 'documental-detalhes documental-original');
        completas.append(criar('summary', '', 'Ver resposta e referências completas'));
        completas.append(criar('div', 'documental-texto-original', original));
        container.append(completas);
        return true;
    }
    globalThis.apresentacaoDocumental = Object.freeze({analisar, renderizar});
})();
