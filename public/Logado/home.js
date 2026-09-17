const homeScreen = document.querySelector('#homeScreen');
const chatScreen = document.querySelector('#chatScreen');
const messages = document.querySelector('#messages');
const messageForm = document.querySelector('#messageForm');
const messageInput = document.querySelector('#messageInput');
const newChat = document.querySelector('#newChat');
const profileImage = document.querySelector('#profileImage');
const googleProfile = window.googleUserProfile || JSON.parse(localStorage.getItem('googleUserProfile') || 'null');
if (googleProfile?.picture) profileImage.src = googleProfile.picture;
if (googleProfile?.name) document.querySelector('#profileName').textContent = googleProfile.name;
function showChat() { homeScreen.classList.add('hidden'); chatScreen.classList.remove('hidden'); document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.page === 'chat')); }
function addMessage(text, sender) { const row = document.createElement('article'); row.className = `message-row ${sender}`; if (sender === 'bot') { const avatar = document.createElement('div'); avatar.className = 'bot-avatar'; avatar.textContent = '🤖'; row.append(avatar); } const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text; row.append(bubble); messages.append(row); messages.scrollTop = messages.scrollHeight; }
function demoReply() { window.setTimeout(() => addMessage('Recebi sua mensagem! A conexão com a IA será adicionada em breve. Enquanto isso, você pode escolher uma das opções abaixo ou iniciar um novo chat.', 'bot'), 350); }
function sendMessage(text) { const cleanText = text.trim(); if (!cleanText) return; showChat(); addMessage(cleanText, 'user'); messageInput.value = ''; demoReply(); }
messageForm.addEventListener('submit', event => { event.preventDefault(); sendMessage(messageInput.value); });
document.querySelectorAll('[data-message]').forEach(button => button.addEventListener('click', () => sendMessage(button.dataset.message)));
newChat.addEventListener('click', () => { messages.replaceChildren(); homeScreen.classList.remove('hidden'); chatScreen.classList.add('hidden'); document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.page === 'home')); messageInput.focus(); });
