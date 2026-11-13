// Executado no <head> para restaurar a preferência antes de desenhar a página.
(() => {
    const themeKey = 'etec:theme';
    const areaLogada = /\/Logado\//i.test(location.pathname);
    const assetBase = new URL('.', document.currentScript.src);
    const logoName = 'etec_ra_central_matao_sylvio_de_mattos_carvalho_';
    const normalize = (theme) => (theme === 'light' ? 'light' : 'dark');

    function read(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function updateLogos() {
        const variant = document.documentElement.dataset.theme === 'light' ? 'pb' : 'br';
        document.querySelectorAll(`img[src*="${logoName}"]`).forEach((logo) => {
            logo.src = new URL(`${logoName}${variant}.png`, assetBase).href;
        });
    }

    // Prévia local: o cache só muda depois da confirmação do salvamento.
    function apply(theme) {
        document.documentElement.dataset.theme = areaLogada ? normalize(theme) : 'dark';
        updateLogos();
    }

    function save(uid, theme) {
        const value = normalize(theme);
        try {
            localStorage.setItem(`etec:theme:${uid}`, value);
            localStorage.setItem(themeKey, value);
        } catch {
            // Armazenamento bloqueado não impede a aplicação na página atual.
        }
        apply(value);
    }

    // Ao trocar de conta, nunca herda a preferência da conta anterior.
    function useAccount(uid) {
        save(uid, read(`etec:theme:${uid}`));
    }

    function restore() {
        apply(read(themeKey));
    }

    window.etecTheme = { apply, save, useAccount };
    restore();
    document.addEventListener('DOMContentLoaded', updateLogos, { once: true });
    window.addEventListener('pageshow', restore);
    window.addEventListener('storage', (event) => {
        if (event.key === themeKey || event.key === null) restore();
    });
})();
