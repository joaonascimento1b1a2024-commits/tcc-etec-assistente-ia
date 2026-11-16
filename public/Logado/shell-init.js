// Executado no head: a primeira pintura já usa a largura salva da navegação.
(() => {
    'use strict';
    const root = document.documentElement;
    try {
        root.dataset.sidebarCollapsed = String(localStorage.getItem('sylvinho:sidebar-collapsed') === 'true');
    } catch {
        root.dataset.sidebarCollapsed = 'false';
    }
    root.classList.add('shell-ready');
    // Navegações rápidas podem cancelar a transição nativa. O link continua
    // normalmente; o cancelamento esperado não vira rejeição sem tratamento.
    for (const name of ['pageswap', 'pagereveal']) {
        window.addEventListener(name, event => {
            event.viewTransition?.ready.catch(() => {});
            event.viewTransition?.finished.catch(() => {});
            event.viewTransition?.updateCallbackDone.catch(() => {});
        });
    }
    // Se o aprimoramento principal falhar, devolve a navegação HTML original.
    window.addEventListener('load', () => {
        if (!document.body.classList.contains('shell-ready')) {
            root.classList.remove('shell-ready');
            root.removeAttribute('data-sidebar-collapsed');
        }
    }, {once: true});
})();
