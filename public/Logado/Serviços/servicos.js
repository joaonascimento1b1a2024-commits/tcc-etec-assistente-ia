// ============================================================
// 1. Configuração do atendimento da IA no WhatsApp
// ============================================================
// Informe o número real com DDI + DDD + número, somente dígitos.
// Enquanto estiver vazio, o botão permanece sem destino e desabilitado.
// Este número precisa estar conectado ao atendimento da IA no WhatsApp.
const WHATSAPP_NUMBER = '';

// Mensagem sugerida: o usuário ainda precisa enviá-la no WhatsApp.
// Nenhum histórico de conversa, credencial ou dado de perfil é transferido.
const INITIAL_MESSAGE = 'Olá! Gostaria de conversar com a IA da secretaria da ETEC.';

// ============================================================
// 2. Construção e validação do link de conversa
// ============================================================
function buildWhatsAppUrl(number, message) {
    // Aceita de 8 a 15 dígitos e impede URLs ou caracteres extras no destino.
    if (!/^[1-9]\d{7,14}$/.test(number)) return null;

    const url = new URL(`https://wa.me/${number}`);
    // Codifica espaços, acentos e pontuação com segurança na mensagem sugerida.
    url.searchParams.set('text', message);
    return url.href;
}

// ============================================================
// 3. Ativação do botão quando o contato estiver configurado
// ============================================================
const whatsappLink = document.querySelector('#whatsapp-link');
const whatsappStatus = document.querySelector('#whatsapp-status');
const whatsappUrl = buildWhatsAppUrl(WHATSAPP_NUMBER, INITIAL_MESSAGE);

if (whatsappUrl) {
    // Link comum: abre o aplicativo ou o WhatsApp Web conforme o dispositivo.
    whatsappLink.href = whatsappUrl;
    whatsappLink.removeAttribute('aria-disabled');
    whatsappLink.removeAttribute('tabindex');
    whatsappStatus.hidden = true;
} else {
    // Evita redirecionamentos sem destino; não usa um telefone fictício.
    whatsappLink.addEventListener('click', (event) => event.preventDefault());
    whatsappStatus.textContent = 'O atendimento pelo WhatsApp estará disponível em breve.';
}
