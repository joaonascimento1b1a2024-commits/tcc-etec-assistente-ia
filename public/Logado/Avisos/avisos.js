// ============================================================
// 1. Contrato dos documentos da coleção Firestore "avisos"
// ============================================================
// Cada aviso deve conter:
// titulo: string (1 a 150 caracteres)
// descricao: string (1 a 5000 caracteres; aceita quebras de linha)
// categoria: "matricula", "provas", "feriado", "evento" ou "geral"
// publicado: boolean (somente true aparece para os alunos)
// criadoEm: Timestamp do Firestore (usar serverTimestamp() ao criar)
// atualizadoEm: Timestamp opcional
// A criação pertence ao painel administrativo. Esta página somente lê.
// A permissão admin deve ser atribuída via Firebase Admin SDK em ambiente
// confiável (custom claim admin: true), nunca pelo navegador ou perfil /users.

// Configuração pública do mesmo projeto utilizado no login e cadastro.
const firebaseConfig = {
    apiKey: "AIzaSyCjKDPXTG8PUp8T4aY5qSQ8KbWut5EdZKU",
    authDomain: "tcc-ia-d8891.firebaseapp.com",
    projectId: "tcc-ia-d8891",
    storageBucket: "tcc-ia-d8891.firebasestorage.app",
    messagingSenderId: "767501525275",
    appId: "1:767501525275:web:9153a051a817504f64b3be",
};

// Referências à lista, ao modelo de cartão e às ações de recuperação.
const list = document.querySelector('#noticeList');
const template = document.querySelector('#noticeTemplate');
const status = document.querySelector('#status');
const retry = document.querySelector('#retry');
const login = document.querySelector('#login');
let unsubscribeNotices;
let unsubscribeAuth;

// Ícones locais: nenhum HTML recebido do banco é interpretado.
const icons = {
    matricula: 'M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3 M9 2h6v4H9z',
    provas: 'M12 5v16 M12 5C9 2 5 2 2 3v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-3-1-7-1-10 2',
    feriado: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M7 2v5 M17 2v5 M3 10h18',
    evento: 'M12 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M8 15l-1 7 5-3 5 3-1-7',
    geral: 'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',
};

// Atualiza o estado acessível de carregamento e a mensagem apresentada.
function showStatus(text, { loading = false, canRetry = false } = {}) {
    status.textContent = text;
    status.hidden = !text;
    list.setAttribute('aria-busy', String(loading));
    retry.hidden = !canRetry;
}

// Monta um cartão preservando quebras de linha e tratando textos como texto puro.
function createCard(data) {
    const card = template.content.cloneNode(true);
    card.querySelector('h2').textContent = data.titulo;
    card.querySelector('.notice-copy p').textContent = data.descricao;
    const category = Object.hasOwn(icons, data.categoria) ? data.categoria : 'geral';
    const icon = card.querySelector('.notice-icon');
    icon.classList.add(`category-${category}`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', icons[category]);
    svg.append(path);
    icon.append(svg);
    return card;
}

// Desliga escutas anteriores para evitar consultas duplicadas e dados de outra sessão.
function stopListeners() {
    unsubscribeNotices?.();
    unsubscribeAuth?.();
    unsubscribeNotices = undefined;
    unsubscribeAuth = undefined;
}

// Carrega os módulos sob demanda para também tratar falhas no carregamento do SDK.
async function start() {
    stopListeners();
    list.replaceChildren();
    login.hidden = true;
    showStatus('Carregando avisos...', { loading: true });

    try {
        const [appSDK, authSDK, dbSDK] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'),
        ]);
        const app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(firebaseConfig);
        const db = dbSDK.getFirestore(app);

        // Aguarda a sessão real do Firebase; dados do localStorage não autenticam a consulta.
        unsubscribeAuth = authSDK.onAuthStateChanged(authSDK.getAuth(app), (user) => {
            unsubscribeNotices?.();
            unsubscribeNotices = undefined;
            list.replaceChildren();
            login.hidden = Boolean(user);
            if (!user) {
                showStatus('Entre na sua conta para acompanhar os avisos da escola.');
                return;
            }

            showStatus('Carregando avisos...', { loading: true });
            // O filtro corresponde às regras: alunos não recebem rascunhos administrativos.
            const noticesQuery = dbSDK.query(
                dbSDK.collection(db, 'avisos'),
                dbSDK.where('publicado', '==', true),
            );
            unsubscribeNotices = dbSDK.onSnapshot(noticesQuery, { includeMetadataChanges: true }, (snapshot) => {
                // Ordena no navegador para dispensar índice composto: mais recentes primeiro.
                const notices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(data => typeof data.titulo === 'string' && typeof data.descricao === 'string')
                    .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
                const fragment = document.createDocumentFragment();
                notices.forEach(data => fragment.append(createCard(data)));
                list.replaceChildren(fragment);

                // Não confunde cache vazio com confirmação de que o banco está vazio.
                if (snapshot.metadata.fromCache) {
                    showStatus(notices.length
                        ? 'Exibindo avisos salvos. Aguardando atualização da conexão.'
                        : 'Aguardando conexão para consultar os avisos.', { canRetry: true });
                } else {
                    showStatus(notices.length ? '' : 'Nenhum aviso publicado no momento.');
                }
            }, (error) => {
                list.replaceChildren();
                console.error('Falha ao consultar avisos:', error.code);
                showStatus(error.code === 'permission-denied'
                    ? 'Não foi possível acessar os avisos. Entre novamente ou procure a administração.'
                    : 'Não foi possível carregar os avisos. Verifique a conexão e tente novamente.', { canRetry: true });
            });
        }, () => showStatus('Não foi possível verificar sua sessão.', { canRetry: true }));
    } catch (error) {
        console.error('Falha ao iniciar a página de avisos:', error.code || error.message);
        showStatus('Não foi possível conectar. Verifique sua conexão e tente novamente.', { canRetry: true });
    }
}

// Reabre a conexão quando solicitado; a página não escreve nem cria avisos de exemplo.
retry.addEventListener('click', start);
start();
