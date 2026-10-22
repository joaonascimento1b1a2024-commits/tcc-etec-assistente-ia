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
async function solicitarAssistente({
    user, pergunta, perguntaId, conversationId, messageId, endpoint, timeoutMs = 30000,
    tipo,
    signal, sessaoAtual = () => true, fetchImpl = globalThis.fetch,
}) {
    if (!user || typeof user.getIdToken !== 'function') throw falha('SESSAO_INVALIDA');
    const catalogo = tipo === 'catalogo';
    const demo = perguntaId !== undefined;
    if (!catalogo && (typeof messageId !== 'string' || !/^[A-Za-z0-9_-]{20,80}$/.test(messageId))) throw falha('MENSAGEM_INVALIDA');
    if (demo && (pergunta !== undefined || typeof perguntaId !== 'string' ||
        !/^[a-z0-9-]{1,80}$/.test(perguntaId))) throw falha('DEMONSTRACAO_INVALIDA');
    const corpo = catalogo ? { acao: 'catalogo_demonstracao' } : demo
        ? { perguntaId, conversationId, messageId } : { pergunta, conversationId, messageId };
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
                body: JSON.stringify(corpo),
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
            if (catalogo) {
                if (!data || !Array.isArray(data.perguntas) || data.perguntas.length < 1 ||
                    data.perguntas.length > 10 || data.perguntas.some(p => !p ||
                    Object.keys(p).length !== 2 || typeof p.perguntaId !== 'string' ||
                    !/^[a-z0-9-]{1,80}$/.test(p.perguntaId) || typeof p.pergunta !== 'string' ||
                    !p.pergunta.startsWith('Demonstração sintética; não é informação escolar oficial.\n') ||
                    p.pergunta.length > 700) ||
                    new Set(data.perguntas.map(p => p.perguntaId)).size !== data.perguntas.length)
                    throw falha('RESPOSTA_INVALIDA');
                return { perguntas: data.perguntas.map(({ perguntaId, pergunta }) => ({ perguntaId, pergunta })) };
            }
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

// O tipo de operacao e fixado aqui, nunca inferido do texto digitado.
export async function perguntarAssistente(opcoes) {
    return solicitarAssistente({ ...opcoes, tipo: 'pergunta' });
}
export async function consultarDemonstracao(opcoes) {
    return solicitarAssistente({ ...opcoes, tipo: 'catalogo', pergunta: undefined, perguntaId: undefined });
}
