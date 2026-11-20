// Somente endpoint HTTP do backend Render; modelo e chaves ficam no servidor.
// Endpoint explicito; ambientes locais continuam isolados.
// Backend documental autenticado validado; publicacao depende de revisao separada.
export const endpointRenderPreparado =
    'https://sylvinho-backend-poc.onrender.com/perguntarAssistente';
// Sites de Hosting novo e legado pertencem ao mesmo projeto Firebase.
// Manter alinhado com OFFICIAL_ORIGINS do backend e com seu CORS.
export const origensPublicadasAssistente = Object.freeze([
    'https://sylvinho.web.app',
    'https://sylvinho.firebaseapp.com',
    'https://tcc-ia-d8891.web.app',
    'https://tcc-ia-d8891.firebaseapp.com',
]);
export const assistenteConfig = Object.freeze({
    endpoint: endpointRenderPreparado,
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
    if (!origensPublicadasAssistente.includes(origin))
        return Object.freeze({ endpoint: '', timeoutMs: 120000 });
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

// O Render gratuito desliga o servidor depois de alguns minutos sem uso, e a primeira
// pergunta espera ele acordar. Ao abrir a tela do chat, um GET simples em /health
// começa a acordar o servidor enquanto a pessoa digita. Sem dados, token ou pergunta.
let servidorAcordado = false;
export function acordarAssistente({ fetchImpl = globalThis.fetch } = {}) {
    if (servidorAcordado || typeof fetchImpl !== 'function') return;
    let endpoint;
    try { endpoint = resolverAssistenteConfig().endpoint; } catch { return; }
    if (!endpoint) return;
    servidorAcordado = true;
    const health = new URL('/health', endpoint).href;
    fetchImpl(health, { method: 'GET', mode: 'no-cors', credentials: 'omit', cache: 'no-store' }).catch(() => {});
}
