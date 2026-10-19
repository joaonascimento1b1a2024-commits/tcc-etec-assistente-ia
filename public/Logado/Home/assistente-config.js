// Configure somente com a URL verificada do Emulator ou da Function publicada.
// Vazio impede chamadas HTTP; nao existe fallback para producao.
export const assistenteConfig = Object.freeze({
    endpoint: '',
    timeoutMs: 30000,
});

// Configuração explícita do demo: nenhuma URL publicada é inferida.
export const ambienteLocalAssistente = Object.freeze({
    projectId: 'demo-sylvinho-render-poc', region: 'southamerica-east1',
    origin: 'http://127.0.0.1:5000', auth: '127.0.0.1:9099',
    firestore: '127.0.0.1:8080', functions: '127.0.0.1:5001',
});

export function resolverAssistenteConfig({
    origin = globalThis.location?.origin, local = globalThis.__LOCAL_E2E__,
} = {}) {
    const config = ambienteLocalAssistente;
    if (local) {
        if (origin !== config.origin || local.projectId !== config.projectId ||
            local.auth !== config.auth || local.firestore !== config.firestore)
            throw Object.assign(new Error('Ambiente local invalido.'), { code: 'AMBIENTE_LOCAL_INVALIDO' });
        return Object.freeze({
            endpoint: `http://${config.functions}/${config.projectId}/${config.region}/perguntarAssistente`,
            timeoutMs: 30000,
        });
    }
    const loopback = origin && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
    return loopback ? Object.freeze({ endpoint: '', timeoutMs: 30000 }) : assistenteConfig;
}
