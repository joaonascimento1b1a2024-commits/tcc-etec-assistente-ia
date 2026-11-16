/* Aprimoramento progressivo. Nunca aplica estado oculto persistente ao DOM. */
(() => {
 'use strict';
 if (!document.body.classList.contains('landing-page')) return;
 const preference = matchMedia('(prefers-reduced-motion: reduce)');
 if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;
 const running = new Set();
 const seen = new WeakSet();
 const groups = [...document.querySelectorAll('.benefit-panel, .resource-grid')];
 const tokens = {duration:350, stagger:100, distance:8, iconScale:.96};
 const easing = getComputedStyle(document.body).getPropertyValue('--landing-motion-easing').trim() || 'ease-out';
 function animate(element, frames, delay) {
  const animation = element.animate(frames, {duration:tokens.duration, delay, easing, fill:'backwards'});
  running.add(animation);
  animation.finished.then(() => running.delete(animation), () => running.delete(animation));
 }
 const observer = new IntersectionObserver(entries => {
  const ready = entries.filter(entry => entry.isIntersecting).map(entry => entry.target);
  for (const group of groups) {
   let sequence = 0;
   for (const card of group.querySelectorAll('article')) {
    if (!ready.includes(card)) continue;
    observer.unobserve(card);
    if (seen.has(card)) continue;
    seen.add(card);
    if (preference.matches) continue;
    try {
     const delay = sequence++ * tokens.stagger;
     animate(card, [{opacity:0, transform:`translateY(${tokens.distance}px)`}, {opacity:1, transform:'translateY(0)'}], delay);
     const icon = card.querySelector('.service-icon');
     if (icon) animate(icon, [{transform:`scale(${tokens.iconScale})`}, {transform:'scale(1)'}], delay);
    } catch {
     // Qualquer falha restaura imediatamente a apresentação estática.
     for (const animation of running) animation.cancel();
     running.clear();
     observer.disconnect();
     return;
    }
   }
  }
 }, {threshold:.12});
 for (const group of groups) for (const card of group.querySelectorAll('article')) observer.observe(card);
 preference.addEventListener('change', () => {
  if (!preference.matches) return;
  for (const animation of running) animation.cancel();
  running.clear();
 });
})();
