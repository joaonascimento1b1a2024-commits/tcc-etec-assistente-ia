// Cadastro: cria a identidade no Authentication e guarda apenas o perfil no Firestore.
// Os provedores de acesso e as regras precisam estar habilitados no console Firebase.
// 1. Dependências de autenticação, perfil e encaminhamento da área logada.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { entrarNaAreaLogada } from '../Logado/acesso.js';
import {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

// 2. Conexão: estes dados identificam o projeto, mas não concedem permissão administrativa.
const firebaseConfig = {
    apiKey: 'AIzaSyCjKDPXTG8PUp8T4aY5qSQ8KbWut5EdZKU',
    authDomain: 'tcc-ia-d8891.firebaseapp.com',
    projectId: 'tcc-ia-d8891',
    storageBucket: 'tcc-ia-d8891.firebasestorage.app',
    messagingSenderId: '767501525275',
    appId: '1:767501525275:web:9153a051a817504f64b3be',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 3. Controles do formulário e feedback de erro/sucesso.
const form = document.querySelector('.login-form');
const googleButton = document.querySelector('.google-button');
const message = document.querySelector('#form-message');
const submitButton = form.querySelector('button[type="submit"]');

function showMessage(text, type = 'error') {
    message.textContent = text;
    message.className = `form-message ${type}`;
    message.hidden = false;
}

function firebaseErrorMessage(error) {
    const messages = {
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/invalid-email': 'Informe um e-mail válido.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/popup-closed-by-user': 'A janela do Google foi fechada.',
        'auth/popup-blocked': 'O navegador bloqueou a janela do Google.',
        'auth/operation-not-allowed': 'Ative este método de login no Firebase Console.',
    };
    return messages[error.code] || 'Não foi possível concluir o cadastro. Tente novamente.';
}

// 4. Cadastro por senha: confere a confirmação, cria a conta e salva os dados do perfil.
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = form.nome.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const confirmPassword = form['confirm-password'].value;

    if (password !== confirmPassword) {
        showMessage('As senhas não coincidem.');
        form['confirm-password'].focus();
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Criando conta...';
    message.hidden = true;

    try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });

        // A senha fica somente no Firebase Authentication; nunca a grave no Firestore.
        await setDoc(doc(db, 'users', credential.user.uid), {
            uid: credential.user.uid,
            nome: name,
            email,
            createdAt: serverTimestamp(),
        });

        showMessage('Conta criada com sucesso!', 'success');
        form.reset();
        // Após o cadastro por senha, encaminha para a tela de login existente.
        window.location.href = '../Login/login.html';
    } catch (error) {
        console.error(error);
        showMessage(firebaseErrorMessage(error));
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Criar conta';
    }
});

// 5. Cadastro Google: merge preserva preferências de uma conta já conhecida.
googleButton.addEventListener('click', async () => {
    googleButton.disabled = true;
    try {
        const credential = await signInWithPopup(auth, new GoogleAuthProvider());
        await setDoc(
            doc(db, 'users', credential.user.uid),
            {
                uid: credential.user.uid,
                nome: credential.user.displayName || '',
                email: credential.user.email || '',
                updatedAt: serverTimestamp(),
            },
            { merge: true },
        );
        showMessage('Cadastro com Google concluído!', 'success');
        await entrarNaAreaLogada(credential.user);
    } catch (error) {
        console.error(error);
        showMessage(firebaseErrorMessage(error));
    } finally {
        googleButton.disabled = false;
    }
});
