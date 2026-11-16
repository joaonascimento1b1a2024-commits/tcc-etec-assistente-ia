/* Atualiza somente o estado do menu; os links continuam funcionando sem JS. */
(() => {
 'use strict';
 const links = [...document.querySelectorAll('.landing-header .nav-link[href^="#"]')];
 const sections = links.map(link => ({link, section:document.getElementById(link.hash.slice(1))})).filter(item => item.section);
 if (!sections.length) return;
 let pending = false;
 function update() {
  pending = false;
  // A faixa superior da leitura determina a seção atual, inclusive ao voltar.
  const threshold = Math.min(120, innerHeight * .2);
  let active = sections[0];
  for (const item of sections) {
   if (item.section.getBoundingClientRect().top <= threshold) active = item;
  }
  for (const item of sections) {
   const current = item === active;
   item.link.classList.toggle('active', current);
   if (current) item.link.setAttribute('aria-current', 'location');
   else item.link.removeAttribute('aria-current');
  }
 }
 function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(update);
 }
 addEventListener('scroll', schedule, {passive:true});
 addEventListener('resize', schedule);
 addEventListener('hashchange', schedule);
 addEventListener('pageshow', schedule);
 document.fonts?.ready.then(schedule);
 update();
})();
