// Referências fixas da tela e estado do diálogo. Conteúdo do banco nunca vira HTML.
const list = document.querySelector('#conversationList');
const status = document.querySelector('#historyStatus');
const dialog = document.querySelector('#conversationDialog');
const form = document.querySelector('#dialogForm');
const titleInput = document.querySelector('#titleInput');
const dialogError = document.querySelector('#dialogError');
let store;
let selected;
let busy = false;
let unsubscribe;
let sessionVersion = 0;

// Configura o diálogo compartilhado, seus textos e o foco conforme a ação escolhida.
function openDialog(item, action) {
    selected = { id: item.id, action };
    dialogError.textContent = '';
    const rename = action === 'rename';
    document.querySelector('#dialogTitle').textContent = rename
        ? 'Renomear conversa'
        : 'Excluir conversa?';
    document.querySelector('#dialogDescription').textContent = rename
        ? 'Escolha um título que facilite encontrar este assunto.'
        : `“${item.titulo}” e todas as suas mensagens serão excluídas. Esta ação não pode ser desfeita.`;
    document.querySelector('#titleLabel').hidden = !rename;
    titleInput.hidden = !rename;
    titleInput.required = rename;
    titleInput.value = item.titulo;
    document.querySelector('#confirmDialog').textContent = rename
        ? 'Salvar título'
        : 'Excluir conversa';
    dialog.showModal();
    (rename ? titleInput : document.querySelector('#cancelDialog')).focus();
}

// A lista é atualizada em tempo real, incluindo mudanças feitas em outra aba.
function render(items) {
    list.replaceChildren();
    status.textContent = items.length
        ? `${items.length} conversa(s) salva(s)`
        : 'Você ainda não tem conversas. Clique em Nova mensagem para começar.';
    for (const item of items) {
        const card = document.createElement('li');
        card.className = 'conversation-card';
        const link = document.createElement('a');
        link.className = 'conversation-link';
        link.href = `../Home/home.html?conversa=${encodeURIComponent(item.id)}`;
        const title = document.createElement('h2');
        title.textContent = item.titulo;
        const preview = document.createElement('p');
        preview.className = 'conversation-preview';
        preview.textContent = (item.mensagens?.at(-1)?.texto || '').slice(0, 160);
        const date = document.createElement('span');
        date.className = 'conversation-date';
        const updated = item.atualizadoEm?.toDate();
        date.textContent = `${updated ? updated.toLocaleString('pt-BR') : 'Sincronizando...'}${item.tituloOrigem === 'provisorio' ? ' · Título provisório' : ''}`;
        link.append(title, preview, date);
        const actions = document.createElement('div');
        actions.className = 'conversation-actions';
        for (const [action, label] of [
            ['rename', 'Renomear'],
            ['delete', 'Excluir'],
        ]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.className = action === 'delete' ? 'delete-action' : '';
            button.setAttribute('aria-label', `${label}: ${item.titulo}`);
            button.addEventListener('click', () => openDialog(item, action));
            actions.append(button);
        }
        card.append(link, actions);
        list.append(card);
    }
}

// A confirmação só fecha após o banco aceitar a alteração; erros mantêm o texto digitado.
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !store || !selected) return;
    busy = true;
    form.querySelectorAll('button').forEach((button) => (button.disabled = true));
    try {
        if (selected.action === 'rename') await store.rename(selected.id, titleInput.value);
        else await store.remove(selected.id);
        dialog.close();
        document.querySelector('.history-heading .primary-action').focus();
    } catch (error) {
        dialogError.textContent =
            'Não foi possível salvar. Verifique sua conexão e tente novamente.';
        console.error('Falha ao alterar conversa:', error.code || error.message);
    } finally {
        busy = false;
        form.querySelectorAll('button').forEach((button) => (button.disabled = false));
    }
});
document.querySelector('#cancelDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', (event) => {
    if (busy) event.preventDefault();
});

// Aguarda a sessão real do Firebase antes de consultar qualquer histórico particular.
async function start() {
    try {
        const [appSDK, authSDK, storage] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
            import('./conversation-store.js'),
        ]);
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
        authSDK.onAuthStateChanged(
            authSDK.getAuth(app),
            async (user) => {
                const version = ++sessionVersion;
                unsubscribe?.();
                store = null;
                list.replaceChildren();
                dialog.close();
                if (!user) {
                    window.location.replace('../../Login/login.html');
                    return;
                }
                try {
                    window.etecTheme?.useAccount(user.uid);
                    const nextStore = await storage.createConversationStore(app, user.uid);
                    if (version !== sessionVersion) return;
                    store = nextStore;
                    unsubscribe = store.watch(render, showError);
                } catch (error) {
                    showError(error);
                }
            },
            showError,
        );
    } catch (error) {
        showError(error);
    }
}
// Limpa o conteúdo para não confundir uma falha de consulta com um histórico atualizado.
function showError(error) {
    list.replaceChildren();
    status.textContent =
        'Não foi possível carregar as conversas. Verifique a conexão e as permissões do Firebase e recarregue a página.';
    console.error('Falha no histórico:', error.code || error.message);
}
start();
