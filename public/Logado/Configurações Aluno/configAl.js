// Lógica compartilhada por configAl.html e configAdmin.html.
// data-role identifica a versão visual; o cargo real sempre é consultado no Firestore.

// ============================================================
// 1. Firebase e contrato de preferências
// ============================================================
// Usa o mesmo projeto do login. A configuração web é pública, não é uma
// credencial administrativa. As regras permitem acessar apenas users/{uid}.
const firebaseConfig = {
    apiKey: 'AIzaSyCjKDPXTG8PUp8T4aY5qSQ8KbWut5EdZKU',
    authDomain: 'tcc-ia-d8891.firebaseapp.com',
    projectId: 'tcc-ia-d8891',
    storageBucket: 'tcc-ia-d8891.firebasestorage.app',
    messagingSenderId: '767501525275',
    appId: '1:767501525275:web:9153a051a817504f64b3be',
};

// Dados gravados em users/{uid}.preferencias:
// tema: 'dark' ou 'light'; avisosEmail: boolean; atualizadoEm: Timestamp.
// O futuro serviço de e-mails deve verificar avisosEmail === true antes de
// enviar cada aviso e obter o endereço verificado pelo Firebase Authentication.
// Esta tela salva consentimento; não dispara campanhas nem configura SMTP.
// Ausência de administradores/{UID}.ativo == true significa acesso de aluno.
// A verificação vem do servidor; não se concede cargo por campos do perfil.

const ui = Object.fromEntries(
    [
        'page-status',
        'retry',
        'account-settings',
        'profile-name',
        'profile-email',
        'reset-password',
        'password-help',
        'password-status',
        'theme',
        'email-notifications',
        'preference-status',
        'logout',
    ].map((id) => [id, document.getElementById(id)]),
);
let authSDK, firestoreSDK, auth, db, currentUser;
let stopAuth;
let stopRole;
let adminController;
let sessionVersion = 0;
let savedPreferences = { tema: 'dark', avisosEmail: false };
let resetCooldown;

// Exibe feedback sem interpretar conteúdo como HTML.
function message(id, text, error = false) {
    ui[id].textContent = text;
    ui[id].hidden = !text;
    ui[id].dataset.error = String(error);
}

// Preferências ausentes não significam consentimento para e-mails.
function normalizePreferences(data = {}) {
    return {
        tema: data?.tema === 'light' ? 'light' : 'dark',
        avisosEmail: data?.avisosEmail === true,
    };
}

// O nome e e-mail do provedor Google têm prioridade quando ele está vinculado.
function profileFor(user) {
    const google = user.providerData.find((provider) => provider.providerId === 'google.com');
    return {
        name: google?.displayName || user.displayName || 'Nome não informado',
        email: google?.email || user.email || 'E-mail não informado',
        hasPassword: user.providerData.some((provider) => provider.providerId === 'password'),
    };
}

// ============================================================
// 2. Tema desta página e leitura das configurações
// ============================================================
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

// Cache separado por conta; indisponibilidade do armazenamento não bloqueia a página.
function cacheTheme(uid, theme) {
    try {
        localStorage.setItem(`etec:theme:${uid}`, theme);
    } catch {
        /* O Firestore continua sendo a fonte principal. */
    }
}

function syncControls() {
    ui.theme.value = savedPreferences.tema;
    ui['email-notifications'].value = String(savedPreferences.avisosEmail);
    applyTheme(savedPreferences.tema);
}

function lockPreferences(locked) {
    ui.theme.disabled = locked;
    ui['email-notifications'].disabled = locked;
}

async function loadPreferences(user, version) {
    lockPreferences(true);
    message('page-status', 'Carregando preferências...');
    try {
        // Leitura do servidor evita tratar um cache vazio como preferências inexistentes.
        const snapshot = await firestoreSDK.getDocFromServer(
            firestoreSDK.doc(db, 'users', user.uid),
        );
        if (version !== sessionVersion) return;
        savedPreferences = normalizePreferences(snapshot.data()?.preferencias);
        syncControls();
        cacheTheme(user.uid, savedPreferences.tema);
        lockPreferences(false);
        message('page-status', '');
    } catch (error) {
        if (version !== sessionVersion) return;
        message(
            'page-status',
            'Não foi possível carregar suas preferências. Verifique a conexão e tente novamente.',
            true,
        );
        ui.retry.hidden = false;
        console.error('Leitura das preferências:', error.code);
    }
}

// Salva somente o campo alterado, sem substituir nome, e-mail ou outros dados.
async function savePreference(key, value) {
    if (!currentUser || ui.theme.disabled) return;
    const user = currentUser;
    const version = sessionVersion;
    lockPreferences(true);
    if (key === 'tema') applyTheme(value);
    message('preference-status', 'Salvando preferência...');
    try {
        await firestoreSDK.setDoc(
            firestoreSDK.doc(db, 'users', user.uid),
            {
                preferencias: { [key]: value, atualizadoEm: firestoreSDK.serverTimestamp() },
            },
            { merge: true },
        );
        if (version !== sessionVersion) return;
        savedPreferences[key] = value;
        cacheTheme(user.uid, savedPreferences.tema);
        message(
            'preference-status',
            key === 'tema' ? 'Tema salvo.' : 'Preferência de avisos por e-mail salva.',
        );
    } catch (error) {
        if (version !== sessionVersion) return;
        message(
            'preference-status',
            'Não foi possível salvar. A preferência anterior foi mantida. Tente novamente.',
            true,
        );
        console.error('Gravação da preferência:', error.code);
    } finally {
        if (version === sessionVersion) {
            syncControls();
            lockPreferences(false);
        }
    }
}

// ============================================================
// 3. Redefinição de senha pelo próprio Firebase
// ============================================================
async function resetPassword() {
    const user = currentUser;
    if (!user?.email || !profileFor(user).hasPassword || ui['reset-password'].disabled) return;
    const version = sessionVersion;
    ui['reset-password'].disabled = true;
    message('password-status', 'Solicitando o e-mail de recuperação...');
    try {
        // Usa o e-mail da sessão, sem aceitar um destinatário arbitrário da interface.
        await authSDK.sendPasswordResetEmail(auth, user.email);
        if (version !== sessionVersion) return;
        message(
            'password-status',
            `Solicitação concluída para ${user.email}. Confira sua caixa de entrada e o spam.`,
        );
        // Evita cliques repetidos enquanto o usuário aguarda o e-mail.
        resetCooldown = setTimeout(() => {
            if (version === sessionVersion) ui['reset-password'].disabled = false;
        }, 60000);
    } catch (error) {
        if (version !== sessionVersion) return;
        message(
            'password-status',
            error.code === 'auth/too-many-requests'
                ? 'Muitas solicitações. Aguarde alguns minutos antes de tentar novamente.'
                : 'Não foi possível solicitar o e-mail. Verifique sua conexão e tente novamente.',
            true,
        );
        ui['reset-password'].disabled = false;
    }
}

// ============================================================
// 4. Sessão e logout
// ============================================================
async function logout() {
    if (!currentUser || ui.logout.disabled) return;
    ui.logout.disabled = true;
    message('page-status', 'Saindo da conta...');
    try {
        await authSDK.signOut(auth);
        // onAuthStateChanged efetua a limpeza e o redirecionamento após o logout.
    } catch {
        message('page-status', 'Não foi possível sair da conta. Tente novamente.', true);
        ui.logout.disabled = false;
    }
}

async function start() {
    stopAuth?.();
    stopRole?.();
    adminController?.dispose();
    const version = ++sessionVersion;
    currentUser = null;
    clearTimeout(resetCooldown);
    ui['account-settings'].hidden = true;
    ui.retry.hidden = true;
    message('page-status', 'Verificando sua conta...');
    try {
        // Imports dinâmicos permitem mostrar um erro se o SDK não carregar.
        const [appSDK, authModule, dbModule] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'),
        ]);
        if (version !== sessionVersion) return;
        authSDK = authModule;
        firestoreSDK = dbModule;
        const app = appSDK.getApps().length
            ? appSDK.getApp()
            : appSDK.initializeApp(firebaseConfig);
        auth = authSDK.getAuth(app);
        auth.languageCode = 'pt-BR';
        db = firestoreSDK.getFirestore(app);

        stopAuth = authSDK.onAuthStateChanged(
            auth,
            async (user) => {
                const activeVersion = ++sessionVersion;
                stopRole?.();
                adminController?.dispose();
                currentUser = user;
                clearTimeout(resetCooldown);
                ui['account-settings'].hidden = true;
                ui['profile-name'].textContent = '';
                ui['profile-email'].textContent = '';
                message('password-status', '');
                message('preference-status', '');
                if (!user) {
                    // Remove o perfil legado usado pela Home para não mostrar a conta anterior.
                    try {
                        localStorage.removeItem('googleUserProfile');
                    } catch {
                        /* A sessão já está encerrada. */
                    }
                    delete window.googleUserProfile;
                    window.location.replace('../../Login/login.html');
                    return;
                }

                // A URL não concede acesso: abrir a página errada redireciona pelo cargo real.
                try {
                    const { verificarAdministrador, paginaConfiguracoes } = await import(
                        '../acesso.js'
                    );
                    const admin = await verificarAdministrador(user, db);
                    if (activeVersion !== sessionVersion) return;
                    const adminPage = document.body.dataset.role === 'admin';
                    if (admin !== adminPage) {
                        window.location.replace(paginaConfiguracoes(admin));
                        return;
                    }
                    if (admin) {
                        const { iniciarAdministracao } = await import(
                            '../Configurações Administrador/admin.js'
                        );
                        if (activeVersion !== sessionVersion) return;
                        adminController = iniciarAdministracao({ user, db, sdk: firestoreSDK });
                    }
                    // Promoções e revogações feitas em outra aba atualizam a tela aberta.
                    stopRole = firestoreSDK.onSnapshot(
                        firestoreSDK.doc(db, 'administradores', user.uid),
                        { includeMetadataChanges: true },
                        (snapshot) => {
                            if (activeVersion !== sessionVersion || snapshot.metadata.fromCache)
                                return;
                            const newAdmin = snapshot.exists() && snapshot.data().ativo === true;
                            if (newAdmin !== adminPage) {
                                adminController?.dispose();
                                ui['account-settings'].hidden = true;
                                window.location.replace(paginaConfiguracoes(newAdmin));
                            }
                        },
                        () => {
                            if (activeVersion !== sessionVersion) return;
                            adminController?.dispose();
                            ui['account-settings'].hidden = true;
                            message(
                                'page-status',
                                'Não foi possível confirmar seu acesso. Tente novamente.',
                                true,
                            );
                            ui.retry.hidden = false;
                        },
                    );
                } catch (error) {
                    if (activeVersion !== sessionVersion) return;
                    message(
                        'page-status',
                        'Não foi possível verificar seu cargo. Confira a conexão e as regras do Firebase.',
                        true,
                    );
                    ui.retry.hidden = false;
                    return;
                }

                const profile = profileFor(user);
                ui['profile-name'].textContent = profile.name;
                ui['profile-email'].textContent = profile.email;
                ui['reset-password'].disabled = !profile.hasPassword || !user.email;
                // Login somente Google não tem uma senha Firebase para alterar.
                // Não enviamos um e-mail que pareça alterar a senha da conta Google.
                ui['password-help'].textContent = profile.hasPassword
                    ? 'Receba por e-mail um link para alterar a senha de acesso ao site.'
                    : 'Você entra com o Google e não possui uma senha de acesso ao site. A senha do Google é gerenciada na sua Conta Google.';
                ui.logout.disabled = false;
                ui['account-settings'].hidden = false;
                applyTheme('dark');
                try {
                    applyTheme(localStorage.getItem(`etec:theme:${user.uid}`));
                } catch {
                    /* Usa o tema padrão até consultar o banco. */
                }
                loadPreferences(user, activeVersion);
            },
            () => {
                message(
                    'page-status',
                    'Não foi possível verificar sua conta. Tente novamente.',
                    true,
                );
                ui.retry.hidden = false;
            },
        );
    } catch (error) {
        if (version !== sessionVersion) return;
        message(
            'page-status',
            'Não foi possível conectar. Verifique sua conexão e tente novamente.',
            true,
        );
        ui.retry.hidden = false;
        console.error('Inicialização das configurações:', error.code || error.message);
    }
}

// Eventos registrados uma única vez; alterações nas preferências são salvas automaticamente.
ui.theme.addEventListener('change', () => savePreference('tema', ui.theme.value));
ui['email-notifications'].addEventListener('change', () =>
    savePreference('avisosEmail', ui['email-notifications'].value === 'true'),
);
ui['reset-password'].addEventListener('click', resetPassword);
ui.logout.addEventListener('click', logout);
ui.retry.addEventListener('click', start);
start();
