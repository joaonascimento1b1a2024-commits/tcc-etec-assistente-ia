function falha(code) {
    return Object.assign(new Error(code), { code });
}

function validarEndpoint(endpoint) {
    try {
        const url = new URL(endpoint);
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (url.username || url.password || url.hash || url.search ||
            !(url.protocol === 'https:' || (local && url.protocol === 'http:')))
            throw new Error();
        return url.href;
    } catch {
        throw falha('ENDPOINT_INVALIDO');
    }
}

// Nao conhece Firestore e nao persiste mensagens. Todo erro encerra sem retry.
export async function perguntarAssistente({
    user, pergunta, conversationId, endpoint, timeoutMs = 30000,
    signal, sessaoAtual = () => true, fetchImpl = globalThis.fetch,
}) {
    if (!user || typeof user.getIdToken !== 'function') throw falha('SESSAO_INVALIDA');
    const url = validarEndpoint(endpoint);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw falha('TIMEOUT_INVALIDO');
    const controller = new AbortController();
    let timer;
    let interromper;
    const interrompido = new Promise((_, reject) => {
        interromper = (code) => {
            reject(falha(code));
            controller.abort();
        };
    });
    const cancelar = () => interromper('SESSAO_INVALIDA');
    signal?.addEventListener('abort', cancelar, { once: true });
    const verificarSessao = () => {
        if (signal?.aborted || !sessaoAtual()) throw falha('SESSAO_INVALIDA');
    };
    try {
        verificarSessao();
        timer = setTimeout(() => interromper('TIMEOUT'), timeoutMs);
        const operacao = async () => {
            const token = await user.getIdToken();
            verificarSessao();
            if (controller.signal.aborted) throw falha('TIMEOUT');
            if (typeof token !== 'string' || !token.trim()) throw falha('TOKEN_INVALIDO');
            const response = await fetchImpl(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ pergunta, conversationId }),
                signal: controller.signal,
                credentials: 'omit',
                redirect: 'error',
            });
            verificarSessao();
            if (!response.ok) throw falha(`HTTP_${response.status}`);
            let data;
            try {
                data = await response.json();
            } catch {
                throw falha('JSON_INVALIDO');
            }
            verificarSessao();
            if (!data || typeof data.resposta !== 'string' || !data.resposta.trim())
                throw falha('RESPOSTA_INVALIDA');
            return { resposta: data.resposta };
        };
        return await Promise.race([operacao(), interrompido]);
    } catch (error) {
        const conhecidos = /^(HTTP_\d+|SESSAO_INVALIDA|TOKEN_INVALIDO|TIMEOUT|JSON_INVALIDO|RESPOSTA_INVALIDA)$/;
        throw falha(conhecidos.test(error?.code) ? error.code : 'REDE_OU_TOKEN');
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancelar);
    }
}
