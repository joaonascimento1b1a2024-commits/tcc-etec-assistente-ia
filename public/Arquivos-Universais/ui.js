(() => {
  'use strict';
  const paths = {
    home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
    chat: 'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z M8 10h8 M8 14h5',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
    folder: 'M3 7V5h6l2 2h10v13H3Z',
    settings: 'm9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 3 3 3-2v-3l3-2-1-4-3-1-1-3z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    calendar: 'M4 5h16v16H4Z M8 2v6 M16 2v6 M4 10h16 M8 14h2 M14 14h2',
    bookmark: 'M6 3h12v19l-6-4-6 4Z',
    send: 'm3 3 19 9-19 9 4-9z M7 12h15',
    plus: 'M12 5v14 M5 12h14',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    collapse: 'm14 6-6 6 6 6',
    close: 'm6 6 12 12 M18 6 6 18',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  };
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
    svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','1.8'); svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
    const p = document.createElementNS(svg.namespaceURI,'path'); p.setAttribute('d',paths[name]); svg.append(p); return svg;
  }
  document.querySelectorAll('.sidebar nav a').forEach(link => {
    const label=link.textContent.trim();
    const name=label.includes('Início')?'home':label.includes('Conversas')?'chat':label.includes('Avisos')?'bell':label.includes('Serviços')?'folder':'settings';
    const span=link.querySelector('span'); if(span) {span.replaceChildren(icon(name)); span.classList.add('nav-icon'); span.setAttribute('aria-hidden','true');}
    const labelText=label.replace(/^[^\p{L}]+/u,'');
    const caption=link.querySelector('.nav-label')||document.createElement('span');caption.className='nav-label';caption.textContent=labelText;
    [...link.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>node.remove());
    link.append(caption);link.setAttribute('aria-label',labelText);link.title=labelText;
    if(link.classList.contains('active')) link.setAttribute('aria-current','page');
  });
  document.querySelectorAll('.card-icon').forEach((el,i)=>el.replaceChildren(icon(['folder','calendar','bookmark'][i%3])));
  document.querySelectorAll('.guest-suggestions button > span:first-child').forEach((el,i)=>el.replaceChildren(icon(['folder','calendar','bookmark'][i%3])));
  document.querySelectorAll('.send').forEach(el=>el.replaceChildren(icon('send')));
  const composer=document.querySelector('#messageInput');
  if(composer?.tagName==='TEXTAREA'){
    composer.addEventListener('input',()=>{composer.style.height='auto';composer.style.height=Math.min(composer.scrollHeight,160)+'px';});
  }
  // O teclado móvel pode reduzir apenas a janela visual, especialmente no Safari.
  // Durante pinch zoom, preserva o reflow e o deslocamento nativos do navegador.
  if(composer && window.visualViewport){
    const compactViewport=window.matchMedia('(max-width: 720px), (hover: none) and (pointer: coarse)');
    let viewportFrame;
    const syncViewport=()=>{
      cancelAnimationFrame(viewportFrame);
      viewportFrame=requestAnimationFrame(()=>{
        const viewport=window.visualViewport;
        if(compactViewport.matches && Math.abs(viewport.scale-1)<0.01){
          document.body.style.setProperty('--chat-viewport-height',`${Math.round(viewport.height)}px`);
          document.body.toggleAttribute('data-chat-compact-height',viewport.height<360);
        }else {
          document.body.style.removeProperty('--chat-viewport-height');
          document.body.removeAttribute('data-chat-compact-height');
        }
      });
    };
    window.visualViewport.addEventListener('resize',syncViewport,{passive:true});
    compactViewport.addEventListener('change',syncViewport);syncViewport();
  }
  const sidebar=document.querySelector('.sidebar');
  if(sidebar && sidebar.querySelector('nav')){
    const main=document.querySelector('main');
    const mobile=window.matchMedia('(max-width: 720px)');
    const nav=sidebar.querySelector('nav');nav.id=nav.id||'mainNavigation';
    const syncCurrentPage=()=>nav.querySelectorAll('a').forEach(link=>{
      if(link.classList.contains('active'))link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    new MutationObserver(syncCurrentPage).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
    syncCurrentPage();
    sidebar.id=sidebar.id||'appSidebar';
    const newChat=sidebar.querySelector('.new-chat');
    if(newChat){
      const symbol=document.createElement('span');symbol.className='new-chat-icon';symbol.append(icon('plus'));
      const caption=document.createElement('span');caption.className='new-chat-label';caption.textContent='Novo chat';
      newChat.replaceChildren(symbol,caption);newChat.setAttribute('aria-label','Novo chat');newChat.title='Novo chat';
    }
    const toggle=document.createElement('button');toggle.type='button';toggle.className='mobile-menu-toggle';
    toggle.append(icon('menu'));toggle.setAttribute('aria-label','Abrir menu de navegação');
    toggle.setAttribute('aria-controls',sidebar.id);toggle.setAttribute('aria-expanded','false');
    let toolbar=main?.querySelector('.topbar');
    if(!toolbar && main){toolbar=document.createElement('div');toolbar.className='shell-mobile-bar';const title=document.createElement('span');title.textContent='Sylvinho';title.className='shell-mobile-title';toolbar.append(title);main.prepend(toolbar);}
    toolbar?.prepend(toggle);
    const collapse=document.createElement('button');collapse.type='button';collapse.className='sidebar-collapse';
    collapse.setAttribute('aria-controls',nav.id);
    const collapseLabel=document.createElement('span');collapseLabel.className='sidebar-collapse-label';
    collapse.append(icon('collapse'),collapseLabel);sidebar.append(collapse);
    const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='sidebar-backdrop';
    backdrop.setAttribute('aria-label','Fechar menu de navegação');backdrop.tabIndex=-1;backdrop.hidden=true;document.body.append(backdrop);
    let collapsed=false;
    try{collapsed=localStorage.getItem('sylvinho:sidebar-collapsed')==='true';}catch{/* A navegação funciona também sem armazenamento. */}
    function updateCollapse(){
      document.body.dataset.sidebarCollapsed=String(collapsed);
      document.documentElement.dataset.sidebarCollapsed=String(collapsed);
      const label=mobile.matches?'Fechar menu':collapsed?'Expandir menu':'Recolher menu';
      collapseLabel.textContent=label;collapse.setAttribute('aria-label',label);collapse.title=label;
      if(mobile.matches)collapse.removeAttribute('aria-expanded');
      else collapse.setAttribute('aria-expanded',String(!collapsed));
    }
    function setDrawer(open,restoreFocus=true){
      const isOpen=Boolean(open&&mobile.matches);
      sidebar.dataset.menuOpen=String(isOpen);toggle.setAttribute('aria-expanded',String(isOpen));
      toggle.setAttribute('aria-label',isOpen?'Fechar menu de navegação':'Abrir menu de navegação');
      backdrop.hidden=!isOpen;document.body.classList.toggle('sidebar-drawer-open',isOpen);
      sidebar.inert=mobile.matches&&!isOpen;
      if(main)main.inert=isOpen;
      if(mobile.matches){sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-label','Navegação principal');sidebar.setAttribute('aria-modal',String(isOpen));}
      else{sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');sidebar.removeAttribute('aria-label');}
      if(isOpen)sidebar.querySelector('a[href],button:not(:disabled)')?.focus({preventScroll:true});
      else if(restoreFocus&&mobile.matches)toggle.focus({preventScroll:true});
    }
    toggle.addEventListener('click',()=>setDrawer(sidebar.dataset.menuOpen!=='true'));
    backdrop.addEventListener('click',()=>setDrawer(false));
    collapse.addEventListener('click',()=>{
      if(mobile.matches){setDrawer(false);return;}
      document.body.classList.add('shell-resizing');
      collapsed=!collapsed;updateCollapse();
      try{localStorage.setItem('sylvinho:sidebar-collapsed',String(collapsed));}catch{/* Preferência apenas nesta página. */}
    });
    document.addEventListener('keydown',event=>{
      if(!mobile.matches||sidebar.dataset.menuOpen!=='true')return;
      if(event.key==='Escape'){event.preventDefault();setDrawer(false);return;}
      if(event.key!=='Tab')return;
      const stops=[...sidebar.querySelectorAll('a[href],button:not(:disabled)')].filter(el=>!el.hidden&&el.getClientRects().length);
      const first=stops[0],last=stops.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    sidebar.addEventListener('click',event=>{if(mobile.matches&&event.target.closest('a[href],.new-chat'))setDrawer(false);});
    mobile.addEventListener('change',()=>{setDrawer(false,false);updateCollapse();});
    updateCollapse();setDrawer(false,false);document.body.classList.add('shell-ready');
    // O documento restaurado pelo Voltar pode ter uma preferência antiga em memória.
    window.addEventListener('pageshow',()=>{
      try{collapsed=localStorage.getItem('sylvinho:sidebar-collapsed')==='true';}catch{/* Mantém o estado local. */}
      document.body.classList.remove('shell-resizing');
      updateCollapse();setDrawer(false,false);
    });
  }
  const profileName=document.querySelector('#profileName');
  const profileLink=document.querySelector('#profileLink');
  if(profileName&&profileLink){
    const fallback=document.createElement('span');fallback.className='profile-fallback';fallback.setAttribute('aria-hidden','true');fallback.append(icon('user'));profileLink.prepend(fallback);
  }
  document.querySelectorAll('.field-group input[type="password"]').forEach(input=>{
    const wrap=document.createElement('div'); wrap.className='password-field'; input.before(wrap); wrap.append(input);
    const button=document.createElement('button'); button.type='button'; button.className='password-toggle';
    button.textContent='Mostrar'; button.setAttribute('aria-controls',input.id); button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-label','Mostrar '+(input.id.includes('confirm')?'confirmação de senha':'senha'));
    button.addEventListener('click',()=>{const show=input.type==='password'; input.type=show?'text':'password'; button.textContent=show?'Ocultar':'Mostrar'; button.setAttribute('aria-pressed',String(show)); button.setAttribute('aria-label',(show?'Ocultar':'Mostrar')+' senha');});
    wrap.append(button);
  });
  const feedback=document.createElement('p'); feedback.className='sr-only'; feedback.setAttribute('role','status'); document.body.append(feedback);
  function decorateMessages() {
    document.querySelectorAll('.message-row.bot').forEach(row=>{
      const bubble=row.querySelector('.bubble'); if(!bubble||row.querySelector('.copy-response'))return;
      const button=document.createElement('button'); button.type='button'; button.className='copy-response'; button.textContent='Copiar resposta';
      button.addEventListener('click',async()=>{
        button.disabled=true;
        try {
          await navigator.clipboard.writeText(bubble.sylvinhoOriginalText ?? bubble.textContent);
          button.textContent='Copiada'; feedback.textContent='Resposta copiada com suas referências.';
        } catch {button.textContent='Não foi possível copiar'; feedback.textContent='A cópia não foi permitida. Selecione o texto da resposta para copiar.';}
        finally {button.disabled=false; setTimeout(()=>{if(button.isConnected)button.textContent='Copiar resposta';},2500);}
      });
      bubble.after(button);
    });
  }
  const messages=document.querySelector('#messages');
  if(messages){new MutationObserver(decorateMessages).observe(messages,{childList:true,subtree:true}); decorateMessages();}
  window.sylvinhoUI={setBusy(busy){const form=document.querySelector('#messageForm'); if(form)form.setAttribute('aria-busy',String(Boolean(busy))); const status=document.querySelector('#chatStatus'); if(status)status.classList.toggle('is-processing',Boolean(busy));}};
})();
