// Configure somente com a URL verificada do Emulator ou da Function publicada.
// Vazio impede chamadas HTTP; nao existe fallback para producao.
// URL informada pelo responsavel; ativar somente apos validar o backend autenticado.
export const endpointRenderPreparado =
    'https://sylvinho-backend-poc.onrender.com/perguntarAssistente';
export const assistenteConfig = Object.freeze({
    endpoint: '',
    timeoutMs: 120000,
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
    if (loopback) return Object.freeze({ endpoint: '', timeoutMs: 30000 });
    if (assistenteConfig.endpoint) validarEndpointPublicado(assistenteConfig.endpoint);
    return assistenteConfig;
}


// Só configurar após confirmar a URL real do serviço. Vazio mantém o acesso online desligado.
export function validarEndpointPublicado(endpoint) {
    let url;
    try { url = new URL(endpoint); } catch { throw new Error('ENDPOINT_PUBLICADO_INVALIDO'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        url.pathname !== '/perguntarAssistente' || url.hostname.includes('*') ||
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
        throw new Error('ENDPOINT_PUBLICADO_INVALIDO');
    return url.href;
}
