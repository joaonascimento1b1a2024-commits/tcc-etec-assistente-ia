/* Apresentação somente: não modifica a resposta original nem a persistência. */
(() => {
    'use strict';
    // EXIBIÇÃO DAS RESPOSTAS do Sylvinho: separa o texto da resposta do bloco de fontes oficiais ([[FONTES]]
    // do motor curado ou a lista de citações do fluxo documental) e desenha tudo com segurança (textContent,
    // nunca HTML vindo do servidor). As fontes aparecem recolhidas em "Fonte ▾".
    // Introduções fixas do fluxo documental, reconhecidas para formatar a resposta.
    const introducoes = new Set([
        'Trechos documentais relacionados a pergunta (citacoes, nao uma interpretacao ou garantia de regra vigente):',
        'Modelos/exemplos documentais encontrados (nao comprovam regras, prazos ou procedimentos):',
        'Nao ha informacao suficiente na base consultada para o Sylvinho responder com seguranca. Procure a secretaria academica para obter a informacao oficial.\nModelos/exemplos relacionados nao comprovam uma regra ou procedimento:',
    ]);
    // Transforma a referência técnica de uma fonte num título legível.
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
    // Interpreta a resposta do fluxo documental (introdução + citações numeradas).
    function analisarDocumental(original) {
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
    // Decide o formato da resposta: texto simples, fluxo documental ou motor curado com fontes.
    function analisar(original) {
        const documental = analisarDocumental(original);
        if (documental) return documental;
        if (typeof original !== 'string' || original.length > 2400) return null;
        const avisos = [
            'Resposta gerada por IA; confira as fontes oficiais.',
            'Resposta gerada por IA; parte das fontes não pôde ser utilizada. Confira as fontes oficiais.',
        ];
        const separador = original.match(/\r?\n\r?\n/u);
        if (!separador) return null;
        const aviso = original.slice(0, separador.index);
        if (!avisos.includes(aviso)) return null;
        const corpo = original.slice(separador.index + separador[0].length);
        // So recolhe fontes se todo o sufixo corresponder ao formato conhecido.
        // Prefixos inesperados, truncamento ou ambiguidade preservam texto puro.
        const candidatos = [];
        for (const quebra of corpo.matchAll(/\r?\n\r?\n/gu)) {
            const resposta = corpo.slice(0, quebra.index);
            const fontes = analisarDocumental(corpo.slice(quebra.index + quebra[0].length));
            if (resposta.trim() && fontes) candidatos.push({aviso, resposta, ...fontes});
        }
        return candidatos.length === 1 ? candidatos[0] : null;
    }
    // Respostas da base curada (modo híbrido) chegam com as fontes oficiais no fim do texto,
    // depois deste marcador, em JSON: [{titulo, url, trecho?}] (render-poc/motor-curado.cjs).
    const MARCADOR_FONTES = '\n\n[[FONTES]]';
    // Separa o texto do bloco JSON depois do marcador [[FONTES]]; JSON inválido é ignorado.
    function separarFontes(original) {
        if (typeof original !== 'string') return null;
        const posicao = original.lastIndexOf(MARCADOR_FONTES);
        if (posicao < 1) return null;
        let fontes;
        try { fontes = JSON.parse(original.slice(posicao + MARCADOR_FONTES.length)); } catch { return null; }
        // Só aceita o formato esperado; qualquer outra coisa é mostrada como texto puro.
        const valida = f => f && typeof f === 'object' && typeof f.titulo === 'string' && f.titulo.trim() &&
            typeof f.url === 'string' && /^https:\/\/[^\s"<>]+$/u.test(f.url) && (f.trecho === undefined || typeof f.trecho === 'string');
        if (!Array.isArray(fontes) || !fontes.length || fontes.length > 4 || !fontes.every(valida)) return null;
        return {resposta: original.slice(0, posicao), fontes};
    }
    // Monta os elementos na tela: parágrafos, listas e o botão "Fonte ▾" com nome, link e trecho de cada
    // fonte.
    function renderizar(container, original) {
        const doc = container.ownerDocument;
        const criar = (tag, classe, texto) => {
            const element = doc.createElement(tag);
            if (classe) element.className = classe;
            if (texto !== undefined) element.textContent = texto;
            return element;
        };
        // Resposta da base curada: texto da resposta e, embaixo, "Fonte ▾" recolhido com nome, link e trecho.
        const curada = separarFontes(original);
        if (curada) {
            container.classList.add('documental');
            container.append(criar('div', 'documental-resposta-ia', curada.resposta));
            const detalhes = criar('details', 'documental-detalhes fontes-curadas');
            detalhes.append(criar('summary', '', 'Fonte'));
            for (const fonte of curada.fontes) {
                const bloco = criar('figure', 'documental-citacao');
                const legenda = criar('figcaption', 'documental-natureza');
                const link = criar('a', '', fonte.titulo);
                link.href = fonte.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                legenda.append(link);
                bloco.append(legenda);
                if (fonte.trecho) bloco.append(criar('blockquote', '', fonte.trecho));
                detalhes.append(bloco);
            }
            container.append(detalhes);
            // O botão de copiar leva a resposta e as fontes em texto limpo (sem o bloco técnico).
            container.sylvinhoOriginalText = curada.resposta + '\n\nFonte: ' +
                curada.fontes.map(f => f.titulo + ' — ' + f.url).join('\n');
            return true;
        }
        const dados = analisar(original);
        if (!dados) { container.textContent = original; return false; }
        const citacao = (item) => {
            const bloco = criar('figure', 'documental-citacao');
            bloco.append(criar('p', 'documental-natureza', item.tipo));
            bloco.append(criar('blockquote', '', item.texto));
            bloco.append(criar('figcaption', 'documental-fonte', 'Fonte: ' + item.fonte));
            return bloco;
        };
        container.classList.add('documental');
        if (dados.resposta) {
            container.append(criar('div', 'documental-resposta-ia', dados.resposta));
            container.append(criar('p', 'documental-introducao', dados.aviso));
            const fontes = criar('details', 'documental-detalhes');
            fontes.append(criar('summary', '', 'Ver fontes'));
            fontes.append(criar('p', 'documental-introducao', dados.introducao));
            dados.citacoes.forEach(item => fontes.append(citacao(item)));
            const originalCompleto = criar('details', 'documental-detalhes documental-original');
            originalCompleto.append(criar('summary', '', 'Ver resposta e referências completas'));
            originalCompleto.append(criar('div', 'documental-texto-original', original));
            fontes.append(originalCompleto);
            container.append(fontes);
            return true;
        }
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
    globalThis.apresentacaoDocumental = Object.freeze({analisar, renderizar, separarFontes});
})();
