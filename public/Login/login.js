// login.html — autenticação com Firebase Authentication via CDN
// Use a mesma configuração do Firebase utilizada no script.js do cadastro.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCjKDPXTG8PUp8T4aY5qSQ8KbWut5EdZKU",
    authDomain: "tcc-ia-d8891.firebaseapp.com",
    projectId: "tcc-ia-d8891",
    storageBucket: "tcc-ia-d8891.firebasestorage.app",
    messagingSenderId: "767501525275",
    appId: "1:767501525275:web:9153a051a817504f64b3be",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const form = document.querySelector(".login-form");
const googleButton = document.querySelector(".google-button");
const message = document.querySelector("#form-message");
const submitButton = form.querySelector('button[type="submit"]');
const rememberCheckbox = document.querySelector("#remember");
const forgotPasswordLink = document.querySelector('a[href="#forgot-password"]');

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `form-message ${type}`;
    message.hidden = false;
}

function firebaseErrorMessage(error) {
    const messages = {
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/invalid-email": "Informe um e-mail válido.",
        "auth/user-not-found": "E-mail ou senha incorretos.",
        "auth/wrong-password": "E-mail ou senha incorretos.",
        "auth/user-disabled": "Esta conta foi desativada.",
        "auth/popup-closed-by-user": "A janela do Google foi fechada.",
        "auth/popup-blocked": "O navegador bloqueou a janela do Google.",
        "auth/unauthorized-domain": "Este domínio não está autorizado no Firebase.",
    };
    return messages[error.code] || "Não foi possível fazer login. Tente novamente.";
}

async function redirectAfterLogin() {
    // Troque pelo caminho real da página protegida do seu sistema.
    window.location.href = "../index.html";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = form.identifier.value.trim().toLowerCase();
    const password = form.password.value;

    if (!email.includes("@")) {
        showMessage("Para este login, informe um e-mail válido. CPF ainda não está habilitado.");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Entrando...";
    message.hidden = true;

    try {
        // Com “Lembrar de mim”, a sessão persiste no navegador.
        // Sem a opção, a sessão termina quando a aba/navegador é encerrado.
        await setPersistence(
            auth,
            rememberCheckbox.checked
                ? browserLocalPersistence
                : browserSessionPersistence,
        );

        await signInWithEmailAndPassword(auth, email, password);
        await redirectAfterLogin();
    } catch (error) {
        console.error(error);
        showMessage(firebaseErrorMessage(error));
        submitButton.disabled = false;
        submitButton.textContent = "Entrar";
    }
});

googleButton.addEventListener("click", async () => {
    googleButton.disabled = true;
    message.hidden = true;

    try {
        await setPersistence(
            auth,
            rememberCheckbox.checked
                ? browserLocalPersistence
                : browserSessionPersistence,
        );

        await signInWithPopup(auth, new GoogleAuthProvider());
        await redirectAfterLogin();
    } catch (error) {
        console.error(error);
        showMessage(firebaseErrorMessage(error));
        googleButton.disabled = false;
    }
});

forgotPasswordLink.addEventListener("click", async (event) => {
    event.preventDefault();

    const email = form.identifier.value.trim().toLowerCase();

    if (!email.includes("@")) {
        showMessage("Digite seu e-mail no campo acima para receber o link de recuperação.");
        form.identifier.focus();
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Enviamos um link de recuperação para o seu e-mail.", "success");
    } catch (error) {
        console.error(error);
        showMessage(firebaseErrorMessage(error));
    }
});
