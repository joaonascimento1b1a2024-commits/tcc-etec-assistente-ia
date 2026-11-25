import { resolverAssistenteConfig } from '../Logado/Home/assistente-config.js';

// CLIENTE DO CHAT DE VISITANTE: descobre o endereço do servidor e envia a pergunta.
// O endereço do visitante é o mesmo do chat com login, trocando o final para /perguntarVisitante.
export function configuracaoVisitante() {
    const config = resolverAssistenteConfig();
    return { ...config, endpoint: config.endpoint
        ? config.endpoint.replace(/\/perguntarAssistente$/, '/perguntarVisitante') : '' };
}

// A pergunta é enviada sem token, cookies, identificador de conta ou histórico.
export async function perguntarVisitante({ pergunta, signal, endpoint, timeoutMs = 120000,
    fetchImpl = globalThis.fetch }) {
    if (!endpoint) throw new Error('INDISPONIVEL');
    // Cancela o pedido se a pessoa sair da página (signal) ou depois de 2 minutos (timeoutMs).
    const controller = new AbortController();
    const cancelar = () => controller.abort();
    signal?.addEventListener('abort', cancelar, { once: true });
    if (signal?.aborted) controller.abort();
    let expirou = false;
    const timer = setTimeout(() => { expirou = true; controller.abort(); }, timeoutMs);
    try {
        // credentials: 'omit' = sem cookies; redirect: 'error' = não segue redirecionamentos.
        const response = await fetchImpl(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pergunta }), signal: controller.signal,
            credentials: 'omit', cache: 'no-store', redirect: 'error',
        });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const data = await response.json();
        // Só aceita resposta em texto não vazio.
        if (typeof data?.resposta !== 'string' || !data.resposta.trim())
            throw new Error('RESPOSTA_INVALIDA');
        return data.resposta;
    } catch (error) {
        if (expirou) throw new Error('TIMEOUT');
        throw error;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancelar);
    }
}
