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

// ============================================================
// 2. Perfil do usuário
// ============================================================

// Usa a sessão real do Firebase, evitando mostrar um perfil antigo do localStorage.
const profileName = document.querySelector('#profileName');
const profileLink = document.querySelector('#profileLink');
const welcomeName = document.querySelector('#welcomeName');

// Avatar local para contas sem foto ou quando a imagem do Google não carregar.
const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#292929"/><circle cx="20" cy="14" r="7" fill="#ccc"/><path d="M7 38v-4a13 13 0 0 1 26 0v4" fill="#ccc"/></svg>'
);
profileImage.src = defaultAvatar;
profileImage.hidden = false;
profileImage.addEventListener('error', () => {
    // Evita repetir a troca se o próprio avatar local for bloqueado pelo navegador.
    if (profileImage.src !== defaultAvatar) profileImage.src = defaultAvatar;
});

// Prioriza os dados do Google vinculado e usa o perfil Firebase como alternativa.
function renderProfile(user) {
    const google = user.providerData.find(provider => provider.providerId === 'google.com');
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
        // Imports dinâmicos permitem tratar falhas de conexão sem interromper o chat.
        const [appSDK, authSDK] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
        ]);
        const app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp({
            apiKey: 'AIzaSyCjKDPXTG8PUp8T4aY5qSQ8KbWut5EdZKU',
            authDomain: 'tcc-ia-d8891.firebaseapp.com',
            projectId: 'tcc-ia-d8891',
            storageBucket: 'tcc-ia-d8891.firebasestorage.app',
            messagingSenderId: '767501525275',
            appId: '1:767501525275:web:9153a051a817504f64b3be',
        });
        // Aguarda a restauração da sessão e acompanha alterações da conta autenticada.
        authSDK.onAuthStateChanged(authSDK.getAuth(app), user => {
            if (!user) {
                profileName.textContent = 'Minha conta';
                profileImage.src = defaultAvatar;
                welcomeName.textContent = 'Olá!';
                window.location.replace('../../Login/login.html');
                return;
            }
            renderProfile(user);
        }, handleProfileError);
    } catch (error) {
        handleProfileError(error);
    }
}

// Mantém o acesso às configurações mesmo se houver falha ao consultar a sessão.
function handleProfileError(error) {
    profileName.textContent = 'Minha conta';
    profileImage.src = defaultAvatar;
    profileLink.title = 'Não foi possível carregar o perfil. Abra as configurações ou recarregue a página.';
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

    document.querySelectorAll('.nav-link').forEach(link =>
        link.classList.toggle('active', link.dataset.page === 'chat')
    );
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
// 4. Envio de mensagens e resposta demonstrativa
// ============================================================

// Simula uma resposta após 350 milissegundos.
// Ainda não há chamada a um serviço de inteligência artificial.
function demoReply() {
    window.setTimeout(() =>
        addMessage('Recebi sua mensagem! A conexão com a IA será adicionada em breve. Enquanto isso, você pode escolher uma das opções abaixo ou iniciar um novo chat.', 'bot'),
        350
    );
}

// Remove espaços nas extremidades e ignora mensagens vazias.
// Depois, abre a conversa, exibe o texto, limpa o campo e agenda a resposta.
function sendMessage(text) {
    const cleanText = text.trim();
    if (!cleanText) return;

    showChat();
    addMessage(cleanText, 'user');
    messageInput.value = '';
    demoReply();
}

// ============================================================
// 5. Eventos do formulário e dos atalhos
// ============================================================

// Intercepta o envio para evitar o recarregamento da página.
// Funciona tanto pelo botão de envio quanto pela tecla Enter no campo.
messageForm.addEventListener('submit', event => {
    event.preventDefault();
    sendMessage(messageInput.value);
});

// Usa o texto do atributo data-message dos cartões e sugestões como mensagem.
document.querySelectorAll('[data-message]').forEach(button =>
    button.addEventListener('click', () => sendMessage(button.dataset.message))
);

// Limpa as mensagens exibidas, retorna à tela inicial, destaca Início
// no menu e coloca o cursor no campo para começar outra conversa.
newChat.addEventListener('click', () => {
    messages.replaceChildren();
    homeScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');

    document.querySelectorAll('.nav-link').forEach(link =>
        link.classList.toggle('active', link.dataset.page === 'home')
    );

    messageInput.focus();
});
