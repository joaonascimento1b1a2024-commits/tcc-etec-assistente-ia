import { observarSessao } from './sessao.js';
import { configuracaoVisitante, perguntarVisitante } from './cliente.js';
import { acordarAssistente } from '../Logado/Home/assistente-config.js';

// Começa a acordar o servidor do assistente assim que a tela abre.
acordarAssistente();

// CHAT DE VISITANTE (página Chat/chat.html): tela, envio das perguntas e sessão. Nada é salvo: recarregar a
// página apaga a conversa.
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

// Trava o campo e os botões enquanto uma resposta está chegando.
function lock(locked) {
    input.disabled = locked;
    form.querySelector('[type="submit"]').disabled = locked;
    suggestions.forEach(button => { button.disabled = locked; });
}

// "+ Novo chat": limpa a conversa e volta para a tela de boas-vindas.
function clearChat() {
    activeRequest?.abort();
    activeRequest = null;
    window.sylvinhoUI?.setBusy(false);
    messages.replaceChildren();
    messages.hidden = true;
    welcome.hidden = false;
    input.value = '';
    status.textContent = ready ? 'Converse à vontade. Este chat é temporário.' : 'Verificando sua sessão...';
    lock(!ready);
}

// Desenha uma mensagem (da pessoa ou do Sylvinho). As respostas do Sylvinho passam pelo
// resposta-documental-view.js, que mostra as fontes no "Fonte ▾".
function addMessage(text, role) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    if (role === 'bot') {
        const avatar = document.createElement('div');
        avatar.className = 'bot-avatar';
        const logo = document.createElement('img');
        logo.src = '../Logado/Home/Logo s_fundo.png';
        logo.alt = '';
        avatar.append(logo);
        avatar.setAttribute('aria-hidden', 'true');
        row.append(avatar);
    }
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.sylvinhoOriginalText = text;
    if (role === 'bot' && window.apresentacaoDocumental)
        window.apresentacaoDocumental.renderizar(bubble, text);
    else bubble.textContent = text;
    row.append(bubble);
    messages.append(row);
    messages.hidden = false;
    welcome.hidden = true;
    return row;
}

// Envia a pergunta: valida o texto, mostra "digitando", chama o servidor e trata os erros (servidor dormindo,
// limite, sem internet) com mensagens amigáveis.
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
    window.sylvinhoUI?.setBusy(true);
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
            window.sylvinhoUI?.setBusy(false);
            lock(!ready);
            input.focus();
        }
    }
}

// Prepara o chat: confere a sessão (quem está logado é mandado para o chat com histórico) e libera o envio.
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
        window.sylvinhoUI?.setBusy(false);
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

// Eventos: enviar, sugestões prontas, novo chat e tentar de novo.
form.addEventListener('submit', event => { event.preventDefault(); void sendMessage(input.value); });
suggestions.forEach(button => button.addEventListener('click', () => void sendMessage(button.dataset.message)));
document.querySelector('#newChat').addEventListener('click', () => { clearChat(); input.focus(); });
retry.addEventListener('click', () => void startSession());
// Limpa também antes do cache de navegação (voltar/avançar do navegador).
// Ao sair da página, cancela o pedido em andamento e a observação da sessão.
window.addEventListener('pagehide', () => {
    ++sessionVersion;
    unsubscribe?.();
    ready = false;
    clearChat();
});
window.addEventListener('pageshow', event => { if (event.persisted) void startSession(); });
void startSession();

// Enter envia; Shift+Enter mantém uma quebra de linha; composição não envia.
// Enter envia; Shift+Enter quebra a linha.
const composerField=document.querySelector('#messageInput');
composerField.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault(); document.querySelector('#messageForm').requestSubmit();}});
