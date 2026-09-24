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

// Prioriza o perfil disponível na janela; caso contrário, lê o perfil salvo
// no navegador. JSON.parse converte o texto armazenado em um objeto.
// Estes dados personalizam a interface, mas não verificam a autenticação.
const googleProfile = window.googleUserProfile || JSON.parse(localStorage.getItem('googleUserProfile') || 'null');

// Atualiza a foto e o nome quando essas informações estiverem disponíveis.
// A saudação da tela inicial continua usando o texto definido no HTML.
if (googleProfile?.picture)
    profileImage.src = googleProfile.picture;

if (googleProfile?.name)
    document.querySelector('#profileName').textContent = googleProfile.name;

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
