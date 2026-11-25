// ============================================================
// 1. WhatsApp oficial da Secretaria Acadêmica
// ============================================================
// Número publicado pela escola em https://etecmatao.cps.sp.gov.br/contato/
// (o mesmo do fato "whatsapp-secretaria" da base curada do Sylvinho).
// Formato: DDI + DDD + número, somente dígitos. Vazio = botão desativado.
const WHATSAPP_NUMBER = '5516996371226';

// Mensagem sugerida: a pessoa completa com a dúvida e decide se envia.
// Nenhum histórico de conversa, credencial ou dado de perfil é transferido.
const INITIAL_MESSAGE = 'Olá! Vim pelo site do Sylvinho e gostaria de falar com a Secretaria Acadêmica.';

// ============================================================
// 2. Construção e validação do link de conversa
// ============================================================
function buildWhatsAppUrl(number, message) {
    // Aceita de 8 a 15 dígitos e impede URLs ou caracteres extras no destino.
    if (!/^[1-9]\d{7,14}$/.test(number)) return null;

    // encodeURIComponent troca espaços por %20 (com searchParams viraria "+",
    // que o WhatsApp pode mostrar literalmente) e codifica acentos e pontuação.
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

// ============================================================
// 3. Ativação do botão quando o contato estiver configurado
// ============================================================
const whatsappLink = document.querySelector('#whatsapp-link');
const whatsappStatus = document.querySelector('#whatsapp-status');
const whatsappUrl = buildWhatsAppUrl(WHATSAPP_NUMBER, INITIAL_MESSAGE);

if (whatsappUrl) {
    // Link comum: abre o aplicativo ou o WhatsApp Web conforme o dispositivo,
    // em outra aba, para o site continuar aberto.
    whatsappLink.href = whatsappUrl;
    whatsappLink.target = '_blank';
    whatsappLink.rel = 'noopener noreferrer';
    whatsappLink.removeAttribute('aria-disabled');
    whatsappLink.removeAttribute('tabindex');
    whatsappStatus.hidden = true;
} else {
    // Evita redirecionamentos sem destino; não usa um telefone fictício.
    whatsappLink.addEventListener('click', (event) => event.preventDefault());
    whatsappStatus.textContent = 'O atendimento pelo WhatsApp estará disponível em breve.';
}
