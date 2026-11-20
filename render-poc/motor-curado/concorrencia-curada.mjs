// Fila e limite de perguntas simultâneas do motor curado.
//
// Por quê: o servidor gratuito do Render tem pouca memória e a chave gratuita do Gemini
// limita pedidos por minuto. Sem limite, muitas perguntas ao mesmo tempo derrubariam todas.
// - no máximo `maxConcorrentes` perguntas sendo respondidas ao mesmo tempo;
// - até `maxFila` esperando a vez, cada uma por no máximo `esperaFilaMs`;
// - uma mesma conta não ocupa duas vagas (evita que um usuário trave os outros).
// São limites deste processo (uma instância), não um limitador distribuído.

/** Erro da fila, com código legível pelo servidor (FILA_CHEIA, CONTA_OCUPADA, CANCELADO...). */
export class ErroFilaCurada extends Error {
    constructor(codigo) {
        super(codigo);
        this.name = 'ErroFilaCurada';
        this.codigo = codigo;
    }
}

/**
 * Espera uma operação (promessa), mas desiste assim que o `signal` for abortado
 * (tempo esgotado ou usuário cancelou). Garante que o fluxo não continue depois do abort,
 * mesmo se a operação original ignorar o cancelamento.
 */
export function aguardarComSinal(operacao, signal) {
    if (!signal) return Promise.resolve(operacao);
    return new Promise((resolve, reject) => {
        const abortar = () => {
            signal.removeEventListener('abort', abortar);
            reject(new ErroFilaCurada('CANCELADO'));
        };
        if (signal.aborted) {
            Promise.resolve(operacao).catch(() => {}); // evita erro "não tratado" da operação descartada
            abortar();
            return;
        }
        signal.addEventListener('abort', abortar, {once: true});
        Promise.resolve(operacao).then(
            valor => { signal.removeEventListener('abort', abortar); resolve(valor); },
            erro => { signal.removeEventListener('abort', abortar); reject(erro); },
        );
    });
}

export function criarControleConcorrencia({maxConcorrentes = 2, maxFila = 4, esperaFilaMs = 3000} = {}) {
    if (!Number.isInteger(maxConcorrentes) || maxConcorrentes < 1 || maxConcorrentes > 8 ||
        !Number.isInteger(maxFila) || maxFila < 0 || maxFila > 32 ||
        !Number.isInteger(esperaFilaMs) || esperaFilaMs < 1 || esperaFilaMs > 10000) {
        throw Error('CONCORRENCIA_CONFIG_INVALIDA');
    }
    const contas = new Set(); // contas (chaves) que já têm uma vaga ou um lugar na fila
    const fila = [];
    let ativos = 0;

    // Dá a vaga e devolve a função "liberar", que só tem efeito uma vez.
    const conceder = (chave, resolve) => {
        ativos++;
        contas.add(chave);
        let liberado = false;
        resolve(() => {
            if (liberado) return;
            liberado = true;
            ativos--;
            contas.delete(chave);
            drenar();
        });
    };

    // Sempre que uma vaga abre, atende o próximo da fila (ordem de chegada).
    const drenar = () => {
        while (ativos < maxConcorrentes && fila.length) {
            const item = fila.shift();
            item.limpar();
            conceder(item.chave, item.resolve);
        }
    };

    return {
        estado: () => ({ativos, naFila: fila.length}),

        /** Pede uma vaga. Resolve com a função liberar(); rejeita com ErroFilaCurada. */
        adquirir(chave, {signal} = {}) {
            if (signal?.aborted) return Promise.reject(new ErroFilaCurada('CANCELADO'));
            if (contas.has(chave)) return Promise.reject(new ErroFilaCurada('CONTA_OCUPADA'));
            if (ativos < maxConcorrentes && !fila.length) return new Promise(resolve => conceder(chave, resolve));
            if (fila.length >= maxFila) return Promise.reject(new ErroFilaCurada('FILA_CHEIA'));

            // Entra na fila: sai por vez concedida, por tempo de espera esgotado ou por cancelamento.
            return new Promise((resolve, reject) => {
                contas.add(chave);
                const remover = codigo => {
                    const posicao = fila.indexOf(item);
                    if (posicao < 0) return;
                    fila.splice(posicao, 1);
                    item.limpar();
                    contas.delete(chave);
                    reject(new ErroFilaCurada(codigo));
                    drenar();
                };
                const abortar = () => remover('CANCELADO');
                const timer = setTimeout(() => remover('FILA_ESPERA_EXCEDIDA'), esperaFilaMs);
                const item = {
                    chave,
                    resolve,
                    limpar() { clearTimeout(timer); signal?.removeEventListener('abort', abortar); },
                };
                fila.push(item);
                signal?.addEventListener('abort', abortar, {once: true});
            });
        },
    };
}
