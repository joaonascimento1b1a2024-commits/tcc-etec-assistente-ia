// Cache de respostas do motor curado, em memória (RAM) do servidor.
//
// Por quê: a mesma pergunta feita de novo em poucos minutos não precisa gastar outra
// geração e outra revisão no Gemini (cota gratuita limitada e respostas mais lentas).
//
// Regras de segurança:
// - só entram respostas que o Gemini escreveu E que passaram por todas as validações
//   (tipo 'gemini_curado', com os IDs dos fatos usados);
// - a chave inclui a conta (namespace), o histórico usado e a versão da base: uma conta
//   nunca recebe a resposta guardada para outra, e mudar a base invalida o cache;
// - as respostas guardadas expiram (TTL) e o cache tem tamanho máximo.
import {createHash} from 'node:crypto';

export function criarCacheRespostas({ttlMs = 300000, maximo = 128, agora = Date.now} = {}) {
    // TTL de no máximo 15 minutos e até 512 itens: limites fixos para não virar "banco de respostas".
    if (!Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > 900000 ||
        !Number.isInteger(maximo) || maximo < 1 || maximo > 512) throw Error('CACHE_CONFIG_INVALIDA');

    // Map mantém a ordem de inserção: o primeiro item é o usado há mais tempo (política LRU).
    const itens = new Map();

    // A chave é um hash SHA-256 de todos os dados que influenciam a resposta.
    const chave = dados => createHash('sha256').update(JSON.stringify(dados)).digest('hex');

    return {
        chave,

        obter(id) {
            const item = itens.get(id);
            if (!item) return null;
            if (item.ate <= agora()) { // expirou
                itens.delete(id);
                return null;
            }
            // Reinsere para marcar como "usado agora" (fica por último na ordem LRU).
            itens.delete(id);
            itens.set(id, item);
            // structuredClone: quem recebe a resposta não consegue alterar o que está guardado.
            return structuredClone(item.resposta);
        },

        guardar(id, resposta) {
            // Falhas, respostas diretas e respostas sem fatos citados nunca entram no cache.
            if (resposta.tipo !== 'gemini_curado' || !Array.isArray(resposta.ids) ||
                !resposta.ids.length || resposta.retentavel) return;
            itens.delete(id);
            itens.set(id, {ate: agora() + ttlMs, resposta: structuredClone(resposta)});
            // Passou do limite: remove o item usado há mais tempo.
            while (itens.size > maximo) itens.delete(itens.keys().next().value);
        },
    };
}
