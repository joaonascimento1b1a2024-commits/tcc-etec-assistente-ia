// Embeddings: transformam um texto em um vetor de 768 números que representa o seu significado.
// Dois textos com sentido parecido geram vetores próximos (similaridade de cosseno alta),
// mesmo usando palavras diferentes ("Quantas faltas posso ter?" ~ "Qual a frequência mínima?").
//
// Usos no projeto:
// - indexar(): uma vez por versão da base, gera o vetor de cada entrada aprovada
//   (scripts/indexar-embeddings-curados.mjs grava em knowledge-local/embeddings-curados.json);
// - consulta(): a cada pergunta não exata, gera o vetor da pergunta para comparar com a base.
import {textoIndice, hashIndice} from './curadoria-local.mjs';
import {aguardarComSinal} from './concorrencia-curada.mjs';

export function criarEmbeddings({lerChave, modelo = process.env.SYLVINHO_EMBEDDING_MODEL || 'gemini-embedding-001', transporte = fetch}) {
    // Só aceita modelos de embedding do Gemini (evita configuração errada por variável de ambiente).
    if (!/^gemini-embedding-[a-z0-9.-]+$/.test(modelo)) throw Error('MODELO_INVALIDO');
    const model = 'models/' + modelo;

    /**
     * Gera os vetores de vários textos em um único pedido (batchEmbedContents).
     * tipo: 'RETRIEVAL_DOCUMENT' para as entradas da base; 'RETRIEVAL_QUERY' para a pergunta.
     */
    async function lote(textos, tipo, {signal} = {}) {
        signal?.throwIfAborted();
        if (!Array.isArray(textos) || !textos.length || textos.length > 100 ||
            textos.some(x => typeof x !== 'string' || x.length > 6000)) throw Error('LOTE_INVALIDO');
        const key = lerChave(); // a chave é lida na hora e nunca guardada nem registrada em log
        if (!key) throw Error('CHAVE_AUSENTE');

        // Limite de 6 s por pedido: o embedding é rápido; demora indica problema no provedor.
        const timeout = AbortSignal.timeout(6000);
        const signalProvedor = signal ? AbortSignal.any([signal, timeout]) : timeout;
        const resposta = await aguardarComSinal(transporte(
            'https://generativelanguage.googleapis.com/v1beta/' + model + ':batchEmbedContents', {
                method: 'POST',
                redirect: 'error',
                headers: {'x-goog-api-key': key, 'content-type': 'application/json'},
                body: JSON.stringify({requests: textos.map(text => ({
                    model, content: {parts: [{text}]}, taskType: tipo, outputDimensionality: 768,
                }))}),
                signal: signalProvedor,
            }), signalProvedor);
        if (!resposta.ok) throw Error('HTTP_' + resposta.status);

        // Confere o formato: um vetor de 768 números finitos (e não todos zero) para cada texto.
        const dados = await aguardarComSinal(resposta.json(), signalProvedor);
        const vetores = dados.embeddings?.map(x => x.values);
        if (vetores?.length !== textos.length || vetores.some(v => !Array.isArray(v) || v.length !== 768 ||
            !v.every(Number.isFinite) || !v.some(x => x !== 0))) throw Error('VETOR_INVALIDO');
        return vetores;
    }

    return {
        modelo,
        lote,
        // Índice da base: vetor de cada entrada + hash da base (para detectar base alterada sem reindexar).
        indexar: async registros => {
            const vetores = await lote(registros.map(textoIndice), 'RETRIEVAL_DOCUMENT');
            return {modelo, dimensoes: 768, hash: hashIndice(registros),
                valores: Object.fromEntries(registros.map((r, i) => [r.id, vetores[i]]))};
        },
        // Vetor de uma pergunta.
        consulta: async (pergunta, opcoes) => (await lote([pergunta], 'RETRIEVAL_QUERY', opcoes))[0],
    };
}
