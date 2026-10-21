// ============================================================
// 1. Elementos da interface
// ============================================================

// Guarda as referências às telas, à lista de mensagens e ao formulário.
const homeScreen = document.querySelector('#homeScreen');
const chatScreen = document.querySelector('#chatScreen');
const messages = document.querySelector('#messages');
const messageForm = document.querySelector('#messageForm');
const messageInput = document.querySelector('#messageInput');
const newChat = document.querySelector('#newChat');
const profileImage = document.querySelector('#profileImage');

// A conversa só aceita envios após restaurar a sessão e abrir o histórico solicitado.
let conversationStore = null;
let authenticatedUser = null;
let activeRequest = null;
let conversationId = new URLSearchParams(window.location.search).get('conversa');
let sending = false;
let sessionVersion = 0;
const chatStatus = document.querySelector('#chatStatus');
function lockComposer(locked) {
    messageInput.disabled = locked;
    messageForm.querySelector('[type="submit"]').disabled = locked;
    document.querySelectorAll('[data-message]').forEach((button) => (button.disabled = locked));
}
lockComposer(true);

// ============================================================
// 2. Perfil do usuário
// ============================================================

// Usa a sessão real do Firebase, evitando mostrar um perfil antigo do localStorage.
const profileName = document.querySelector('#profileName');
const profileLink = document.querySelector('#profileLink');
const welcomeName = document.querySelector('#welcomeName');

// Avatar local para contas sem foto ou quando a imagem do Google não carregar.
const defaultAvatar =
    'data:image/svg+xml,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#292929"/><circle cx="20" cy="14" r="7" fill="#ccc"/><path d="M7 38v-4a13 13 0 0 1 26 0v4" fill="#ccc"/></svg>',
    );
profileImage.src = defaultAvatar;
profileImage.hidden = false;
profileImage.addEventListener('error', () => {
    // Evita repetir a troca se o próprio avatar local for bloqueado pelo navegador.
    if (profileImage.src !== defaultAvatar) profileImage.src = defaultAvatar;
});

// Prioriza os dados do Google vinculado e usa o perfil Firebase como alternativa.
function renderProfile(user) {
    const google = user.providerData.find((provider) => provider.providerId === 'google.com');
    const name = (google?.displayName || user.displayName || '').trim();
    const photo = google?.photoURL || user.photoURL;
    profileName.textContent = name || 'Minha conta';
    profileLink.title = name ? `Configurações de ${name}` : 'Configurações da conta';
    profileLink.setAttribute('aria-label', profileLink.title);
    welcomeName.textContent = name ? `Olá, ${name.split(/\s+/)[0]}!` : 'Olá!';
    // Aceita somente endereços HTTPS para fotos externas.
    profileImage.src = photo?.startsWith('https://') ? photo : defaultAvatar;
}

async function loadAuthenticatedProfile() {
    try {
        if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) &&
            !globalThis.__LOCAL_E2E__) throw new Error('LOCAL_EMULATORS_REQUIRED');
        // Imports dinâmicos permitem tratar falhas de conexão sem interromper o chat.
        const [appSDK, authSDK] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
        ]);
        if (globalThis.__LOCAL_E2E__ && (!appSDK.getApps().length ||
            appSDK.getApp().options.projectId !== 'demo-sylvinho-render-poc'))
            throw new Error('LOCAL_DEMO_REQUIRED');
        const app = appSDK.getApps().length
            ? appSDK.getApp()
            : appSDK.initializeApp({
                  apiKey: 'AIzaSyCjKDPXTG8PUp8T4aY5qSQ8KbWut5EdZKU',
                  authDomain: 'tcc-ia-d8891.firebaseapp.com',
                  projectId: 'tcc-ia-d8891',
                  storageBucket: 'tcc-ia-d8891.firebasestorage.app',
                  messagingSenderId: '767501525275',
                  appId: '1:767501525275:web:9153a051a817504f64b3be',
              });
        // Aguarda a restauração da sessão e acompanha alterações da conta autenticada.
        authSDK.onAuthStateChanged(
            authSDK.getAuth(app),
            async (user) => {
                const version = ++sessionVersion;
                activeRequest?.abort();
                authenticatedUser = user;
                conversationStore = null;
                messages.replaceChildren();
                lockComposer(true);
                if (!user) {
                    profileName.textContent = 'Minha conta';
                    profileImage.src = defaultAvatar;
                    welcomeName.textContent = 'Olá!';
                    window.location.replace('../../Login/login.html');
                    return;
                }
                window.etecTheme?.useAccount(user.uid);
                renderProfile(user);
                try {
                    // O destino do perfil é definido pelo cargo confirmado pelo servidor.
                    const { verificarAdministrador, paginaConfiguracoes } = await import(
                        '../acesso.js'
                    );
                    const admin = await verificarAdministrador(user);
                    if (version !== sessionVersion) return;
                    profileLink.href = paginaConfiguracoes(admin);
                    document.querySelector('#settingsLink').href = paginaConfiguracoes(admin);
                    // Garante um perfil para usuários que entraram diretamente com o Google.
                    // Nenhum campo desse documento pode conceder o cargo de administrador.
                    const dbSDK = await import(
                        'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
                    );
                    await dbSDK.setDoc(
                        dbSDK.doc(dbSDK.getFirestore(app), 'users', user.uid),
                        {
                            uid: user.uid,
                            nome: user.displayName || '',
                            email: user.email || '',
                        },
                        { merge: true },
                    );
                    const { createConversationStore } = await import(
                        '../Conversas/conversation-store.js'
                    );
                    const store = await createConversationStore(app, user.uid);
                    const saved = conversationId ? await store.open(conversationId) : null;
                    if (version !== sessionVersion) return;
                    conversationStore = store;
                    if (saved) {
                        showChat();
                        for (const message of saved.mensagens)
                            addMessage(message.texto, message.remetente === 'bot' ? 'bot' : 'user');
                    }
                    chatStatus.textContent = 'As mensagens são salvas na sua conta.';
                    lockComposer(sending);
                    const { carregarEnvioPendente } = await import('./envio-pendente.js');
                    if (version !== sessionVersion) return;
                    const pendente = carregarEnvioPendente(user.uid);
                    if (pendente) await sendMessage(pendente.pergunta);
                } catch (error) {
                    if (version !== sessionVersion) return;
                    chatStatus.textContent =
                        'Não foi possível abrir o histórico. Verifique a conexão e as permissões ou inicie um novo chat.';
                    console.error('Falha ao abrir conversa:', error.code || error.message);
                }
            },
            handleProfileError,
        );
    } catch (error) {
        handleProfileError(error);
    }
}

// Mantém o acesso às configurações mesmo se houver falha ao consultar a sessão.
function handleProfileError(error) {
    sessionVersion++;
    activeRequest?.abort();
    authenticatedUser = null;
    conversationStore = null;
    lockComposer(true);
    chatStatus.textContent =
        'Não foi possível conectar à conta. Recarregue a página para tentar novamente.';
    profileName.textContent = 'Minha conta';
    profileImage.src = defaultAvatar;
    profileLink.title =
        'Não foi possível carregar o perfil. Abra as configurações ou recarregue a página.';
    console.error('Falha ao carregar o perfil:', error.code || error.message);
}

loadAuthenticatedProfile();

// ============================================================
// 3. Exibição da conversa
// ============================================================

// Oculta a tela inicial, mostra a conversa e destaca Conversas no menu.
function showChat() {
    homeScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');

    document
        .querySelectorAll('.nav-link')
        .forEach((link) => link.classList.toggle('active', link.dataset.page === 'chat'));
}

// Cria uma mensagem. O parâmetro sender identifica o remetente:
// 'user' representa o usuário; 'bot' representa o assistente.
function addMessage(text, sender) {
    const row = document.createElement('article');
    row.className = `message-row ${sender}`;

    // Adiciona o avatar somente nas mensagens do assistente.
    if (sender === 'bot') {
        const avatar = document.createElement('div');
        avatar.className = 'bot-avatar';
        avatar.textContent = '🤖';
        row.append(avatar);
    }

    // textContent exibe a mensagem como texto, sem interpretar HTML.
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    row.append(bubble);
    messages.append(row);

    // Leva a rolagem da lista até a mensagem mais recente.
    messages.scrollTop = messages.scrollHeight;
}

// ============================================================
// 4. Persistência das mensagens do usuário
// ============================================================

// Só apresenta o envio como salvo após a confirmação do banco. Em caso de erro,
// mantém o texto para uma nova tentativa e não fabrica respostas da IA.
async function sendMessage(text) {
    const cleanText = text.trim();
    if (!cleanText || sending || !conversationStore || !authenticatedUser) return;
    if (cleanText.length > 700) {
        chatStatus.textContent = 'Escreva entre 1 e 700 caracteres.';
        return;
    }
    const version = sessionVersion;
    const store = conversationStore;
    const user = authenticatedUser;
    const request = new AbortController();
    activeRequest = request;
    let userSaved = false;
    sending = true;
    lockComposer(true);
    newChat.disabled = true;
    messageInput.value = cleanText;
    chatStatus.textContent = 'Salvando mensagem...';
    try {
        const [{ perguntarAssistente }, { resolverAssistenteConfig }, pendencias] = await Promise.all([
            import('./assistente-client.js'),
            import('./assistente-config.js'),
            import('./envio-pendente.js'),
        ]);
        const config = resolverAssistenteConfig();
        if (!config.endpoint) throw Object.assign(new Error('Assistente ainda não configurado.'), { code: 'ENDPOINT_NAO_CONFIGURADO' });
        if (version !== sessionVersion) return;
        let envio = pendencias.carregarEnvioPendente(user.uid);
        const primeiraTentativa = !envio;
        if (envio && envio.pergunta !== cleanText) {
            chatStatus.textContent = 'Existe uma pergunta pendente. Recarregue para recuperá-la antes de enviar outra.';
            return;
        }
        if (!envio) {
            envio = { version: 1, conversationId: conversationId || store.reserve(),
                messageId: crypto.randomUUID(), pergunta: cleanText, enviadoEm: Date.now(),
                novaConversa: !conversationId };
            // Persistir antes de qualquer escrita evita trocar o ID apos recarga.
            pendencias.guardarEnvioPendente(user.uid, envio);
        }
        const id = await store.append(envio.conversationId, envio.pergunta, envio.messageId,
            envio.enviadoEm, { create: primeiraTentativa && envio.novaConversa });
        userSaved = true;
        envio.novaConversa = false;
        pendencias.guardarEnvioPendente(user.uid, envio);
        if (version !== sessionVersion) return;
        conversationId = id;
        window.history.replaceState(null, '', `?conversa=${encodeURIComponent(id)}`);
        // O banco já confirmou o envio: uma falha de releitura não deve duplicá-lo.
        messageInput.value = '';
        // Reconsulta o documento para incluir mensagens enviadas por outras abas.
        const saved = await store.open(id);
        if (version !== sessionVersion) return;
        messages.replaceChildren();
        showChat();
        for (const message of saved.mensagens)
            addMessage(message.texto, message.remetente === 'bot' ? 'bot' : 'user');
        chatStatus.textContent = config.timeoutMs > 30000
            ? 'Mensagem salva. Aguardando resposta... O servidor pode levar até dois minutos para iniciar.'
            : 'Mensagem salva. Aguardando resposta...';
        await perguntarAssistente({
            user, pergunta: cleanText, conversationId: id,
            messageId: envio.messageId,
            ...config, signal: request.signal,
            sessaoAtual: () => version === sessionVersion && authenticatedUser === user,
        });
        if (version !== sessionVersion) return;
        const confirmed = await store.open(id);
        if (version !== sessionVersion) return;
        if (!confirmed.mensagens.some((message) => message.remetente === 'bot' && message.messageId === envio.messageId))
            throw new Error('Resposta ainda não confirmada no histórico.');
        messages.replaceChildren();
        for (const message of confirmed.mensagens)
            addMessage(message.texto, message.remetente === 'bot' ? 'bot' : 'user');
        chatStatus.textContent = 'Conversa atualizada.';
        try {
            pendencias.concluirEnvioPendente(user.uid);
        } catch {
            // A resposta já foi confirmada e exibida; cache não muda esse resultado.
            chatStatus.textContent = 'Resposta confirmada e salva. Não foi possível limpar a pendência local. Recarregar reutilizará o mesmo identificador, sem duplicar a resposta.';
        }
    } catch (error) {
        if (version !== sessionVersion) return;
        chatStatus.textContent = error.code === 'ENDPOINT_NAO_CONFIGURADO' || error.code === 'AMBIENTE_LOCAL_INVALIDO'
            ? 'O assistente não está configurado para este ambiente. Nenhuma pergunta foi salva.'
            : userSaved && ['HTTP_401', 'SESSAO_INVALIDA', 'TOKEN_INVALIDO'].includes(error.code)
            ? 'Sua sessão expirou ou não pôde ser validada. A pergunta foi salva. Entre novamente e recarregue para recuperar o envio com o mesmo identificador.'
            : userSaved && ['HTTP_502', 'HTTP_503', 'HTTP_504'].includes(error.code)
            ? 'O assistente está temporariamente indisponível. A pergunta foi salva. Aguarde e recarregue para recuperar o envio com o mesmo identificador, sem duplicar a mensagem.'
            : userSaved && error.code === 'REDE_OU_TOKEN'
            ? 'Não foi possível conectar ao assistente ou obter a sessão. A pergunta foi salva. Confira a conexão e o login e recarregue para recuperar o envio com o mesmo identificador.'
            : userSaved && error.code === 'TIMEOUT'
            ? 'O servidor demorou para responder. Sua pergunta está salva. Recarregue para recuperar o envio com o mesmo identificador, sem duplicar a mensagem.'
            : userSaved
            ? 'A pergunta foi salva, mas não foi possível confirmar a resposta. Recarregue para recuperar o envio com o mesmo identificador; se a conversa foi excluída, cancele a pendência.'
            : error.code
            ? 'Falha de conexão ou permissão. Confira o histórico antes de reenviar.'
            : error.message;
    } finally {
        sending = false;
        if (activeRequest === request) activeRequest = null;
        newChat.disabled = false;
        lockComposer(!conversationStore || !authenticatedUser);
        if (version === sessionVersion) {
            messageInput.focus();
        }
    }
}

// ============================================================
// 5. Eventos do formulário e dos atalhos
// ============================================================

// Intercepta o envio para evitar o recarregamento da página.
// Funciona tanto pelo botão de envio quanto pela tecla Enter no campo.
messageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(messageInput.value);
});

// Usa o texto do atributo data-message dos cartões e sugestões como mensagem.
document
    .querySelectorAll('[data-message]')
    .forEach((button) =>
        button.addEventListener('click', () => sendMessage(button.dataset.message)),
    );

// Abre uma conversa nova sem apagar nenhuma conversa anterior.
newChat.addEventListener('click', async () => {
    const pendencias = await import('./envio-pendente.js');
    if (authenticatedUser) {
        const estado = pendencias.inspecionarEnvioPendente(authenticatedUser.uid);
        if (estado.estado !== 'ausente') {
            const aviso = estado.estado === 'valido'
                ? 'Existe um envio pendente. Cancelar a recuperação e abrir uma nova conversa?'
                : 'Não foi possível ler a pendência local. Descartar sua recuperação e abrir uma nova conversa? Nenhuma conversa salva será apagada.';
            if (!window.confirm(aviso)) return;
            const descarte = pendencias.descartarEnvioPendente(authenticatedUser.uid);
            if (!descarte.persistente) {
                // Sem armazenamento, manter o descarte explícito nesta página evita
                // recarregar e recuperar novamente o envio que a pessoa cancelou.
                conversationId = null;
                window.history.replaceState(null, '', 'home.html');
                messages.replaceChildren();
                messageInput.value = '';
                homeScreen.classList.remove('hidden');
                chatScreen.classList.add('hidden');
                document.querySelectorAll('.nav-link').forEach((link) =>
                    link.classList.toggle('active', link.dataset.page === 'home'));
                chatStatus.textContent = 'Novo chat aberto. O armazenamento local não pôde ser limpo; o descarte vale somente nesta página. Recarregar pode recuperar a pendência anterior. Nenhuma pergunta foi enviada.';
                lockComposer(!conversationStore || !authenticatedUser);
                return;
            }
        }
    }
    // A navegação limpa apenas a seleção; o histórico já salvo não é apagado.
    window.location.assign('home.html');
});
