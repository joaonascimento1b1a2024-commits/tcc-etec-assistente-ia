const prefixo = 'sylvinho:pendente:';
const descartadasNestaPagina = new Set();
const idValido = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(id);
const armazenamento = (storage) => storage === undefined ? globalThis.sessionStorage : storage;
const invalida = () => Object.assign(new Error('Pendência inválida.'), { code: 'PENDENCIA_INVALIDA' });

export function carregarEnvioPendente(uid, storage) {
    if (descartadasNestaPagina.has(uid)) return null;
    const raw = armazenamento(storage).getItem(prefixo + uid);
    if (!raw) return null;
    let envio;
    try { envio = JSON.parse(raw); } catch { throw invalida(); }
    if (!envio || typeof envio !== 'object' || envio.version !== 1 ||
        typeof envio.conversationId !== 'string' || !/^[A-Za-z0-9]{20}$/.test(envio.conversationId) ||
        !idValido(envio.messageId) || typeof envio.pergunta !== 'string' ||
        !envio.pergunta.trim() || envio.pergunta.length > 700 ||
        !Number.isSafeInteger(envio.enviadoEm) || envio.enviadoEm < 0 ||
        typeof envio.novaConversa !== 'boolean' ||
        (envio.perguntaId !== undefined && (typeof envio.perguntaId !== 'string' ||
          !/^[a-z0-9-]{1,80}$/.test(envio.perguntaId) ||
          !envio.pergunta.startsWith('Demonstração sintética; não é informação escolar oficial.\n')))) throw invalida();
    return envio;
}

// Inspeção sem apagar dados: erro de leitura nunca equivale a ausência de envio.
export function inspecionarEnvioPendente(uid, storage) {
    try {
        const envio = carregarEnvioPendente(uid, storage);
        return { estado: envio ? 'valido' : 'ausente', envio };
    } catch (error) {
        return { estado: error.code === 'PENDENCIA_INVALIDA' ? 'invalido' : 'indisponivel' };
    }
}

export function guardarEnvioPendente(uid, envio, storage) {
    armazenamento(storage).setItem(prefixo + uid, JSON.stringify(envio));
    descartadasNestaPagina.delete(uid);
}

export function concluirEnvioPendente(uid, storage) {
    armazenamento(storage).removeItem(prefixo + uid);
    descartadasNestaPagina.delete(uid);
}

// Só chamar após confirmação explícita. Sem persistência, não promete apagar o cache.
export function descartarEnvioPendente(uid, storage) {
    try {
        concluirEnvioPendente(uid, storage);
        return { persistente: true };
    } catch {
        descartadasNestaPagina.add(uid);
        return { persistente: false };
    }
}
