import { observarSessao } from './sessao.js';
import { configuracaoVisitante, perguntarVisitante } from './cliente.js';

const messages = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const form = document.querySelector('#messageForm');
const input = document.querySelector('#messageInput');
const status = document.querySelector('#chatStatus');
const retry = document.querySelector('#retrySession');
const suggestions = document.querySelectorAll('[data-message]');
let ready = false;
let activeRequest = null;
let unsubscribe;
let sessionVersion = 0;

function lock(locked) {
    input.disabled = locked;
    form.querySelector('[type="submit"]').disabled = locked;
    suggestions.forEach(button => { button.disabled = locked; });
}

function clearChat() {
    activeRequest?.abort();
    activeRequest = null;
    messages.replaceChildren();
    messages.hidden = true;
    welcome.hidden = false;
    input.value = '';
    status.textContent = ready ? 'Converse à vontade. Este chat é temporário.' : 'Verificando sua sessão...';
    lock(!ready);
}

function addMessage(text, role) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    if (role === 'bot') {
        const avatar = document.createElement('div');
        avatar.className = 'bot-avatar';
        avatar.textContent = 'IA';
        avatar.setAttribute('aria-hidden', 'true');
        row.append(avatar);
    }
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (role === 'bot' && window.apresentacaoDocumental)
        window.apresentacaoDocumental.renderizar(bubble, text);
    else bubble.textContent = text;
    row.append(bubble);
    messages.append(row);
    messages.hidden = false;
    welcome.hidden = true;
    return row;
}

async function sendMessage(text) {
    if (!ready || activeRequest) return;
    const pergunta = text.trim();
    if (!pergunta || pergunta.length > 700) return;
    let config;
    try {
        config = configuracaoVisitante();
        if (!config.endpoint) throw new Error('INDISPONIVEL');
    } catch {
        input.value = pergunta;
        status.textContent = 'O chat está indisponível neste ambiente. Tente novamente mais tarde.';
        return;
    }
    const controller = new AbortController();
    activeRequest = controller;
    lock(true);
    const row = addMessage(pergunta, 'user');
    input.value = '';
    status.textContent = 'Aguardando o Sylvinho… O primeiro acesso pode levar até dois minutos.';
    try {
        const answer = await perguntarVisitante({ pergunta, ...config, signal: controller.signal });
        if (controller.signal.aborted || activeRequest !== controller) return;
        addMessage(answer, 'bot');
        status.textContent = 'Resposta recebida. Esta conversa não é salva.';
    } catch (error) {
        if (controller.signal.aborted || activeRequest !== controller) return;
        // Devolve a pergunta ao campo para uma tentativa explícita, sem duplicá-la.
        row.remove();
        input.value = pergunta;
        if (!messages.children.length) { messages.hidden = true; welcome.hidden = false; }
        status.textContent = error.message === 'HTTP_429'
            ? 'Há muitas perguntas no momento. Aguarde um minuto e tente novamente.'
            : error.message === 'TIMEOUT'
                ? 'O assistente demorou para responder. Sua pergunta está no campo para tentar novamente.'
                : 'Não foi possível receber a resposta. Verifique sua conexão e tente novamente.';
    } finally {
        if (activeRequest === controller) {
            activeRequest = null;
            lock(!ready);
            input.focus();
        }
    }
}

async function startSession() {
    const version = ++sessionVersion;
    unsubscribe?.();
    ready = false;
    lock(true);
    retry.hidden = true;
    status.textContent = 'Verificando sua sessão...';
    const failure = () => {
        if (version !== sessionVersion) return;
        ready = false;
        activeRequest?.abort();
        activeRequest = null;
        lock(true);
        retry.hidden = false;
        status.textContent = 'Não foi possível verificar sua sessão. Confira a conexão e tente novamente.';
    };
    try {
        const stop = await observarSessao(user => {
            if (version !== sessionVersion) return;
            if (user && !user.isAnonymous) {
                ready = false;
                clearChat();
                window.location.replace(new URL('../Logado/Home/home.html', import.meta.url).href);
                return;
            }
            ready = true;
            retry.hidden = true;
            lock(Boolean(activeRequest));
            status.textContent = 'Converse à vontade. Este chat é temporário.';
        }, failure);
        if (version !== sessionVersion) stop();
        else unsubscribe = stop;
    } catch { failure(); }
}

form.addEventListener('submit', event => { event.preventDefault(); void sendMessage(input.value); });
suggestions.forEach(button => button.addEventListener('click', () => void sendMessage(button.dataset.message)));
document.querySelector('#newChat').addEventListener('click', () => { clearChat(); input.focus(); });
retry.addEventListener('click', () => void startSession());
// Limpa também antes do cache de navegação (voltar/avançar do navegador).
window.addEventListener('pagehide', () => {
    ++sessionVersion;
    unsubscribe?.();
    ready = false;
    clearChat();
});
window.addEventListener('pageshow', event => { if (event.persisted) void startSession(); });
void startSession();
