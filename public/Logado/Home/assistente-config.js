// Configure somente com a URL verificada do Emulator ou da Function publicada.
// Vazio impede chamadas HTTP; nao existe fallback para producao.
export const assistenteConfig = Object.freeze({
    endpoint: '',
    timeoutMs: 30000,
});
