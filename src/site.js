(() => {
  const self = document.currentScript && document.currentScript.src;
  const d = document, root = d.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // language: first visit to the pt home follows the browser language, afterwards the user's choice wins
  const page = root.lang;
  const pref = store.get('ma-lang');
  const home = d.querySelector('meta[name=ma-home]');
  if (!pref && home && page === 'pt-BR') {
    const nav = (navigator.language || '').toLowerCase();
    const to = nav.startsWith('es') ? 'es' : nav.startsWith('en') ? 'en' : null;
    const a = to && d.querySelector(`link[rel=alternate][hreflang=${to}]`);
    store.set('ma-lang', to || 'pt-BR');
    if (a) { location.replace(a.href); return; }
  } else if (!pref) store.set('ma-lang', page);
  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-lang]');
    if (a) store.set('ma-lang', a.dataset.lang);
    const m = d.querySelector('.lang[open]');
    if (m && !m.contains(e.target)) m.removeAttribute('open');
  });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') d.querySelector('.lang[open]')?.removeAttribute('open'); });

  root.classList.add('js');

  // reveal on scroll (one observer, each node released after it shows)
  const items = d.querySelectorAll('[data-reveal]');
  if (items.length) {
    if (!('IntersectionObserver' in window) || reduce) items.forEach((n) => n.classList.add('in'));
    else {
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }), { threshold: 0.15 });
      items.forEach((n) => io.observe(n));
    }
  }

  // hero: the scene stays pinned (fixed) while the sheet slides over it; text fades out with the scroll
  const ride = d.querySelector('[data-ride]');
  const pin = ride && ride.querySelector('.pin');
  const ht = d.querySelector('[data-heroText]');
  if (ride) {
    let tick = false;
    const upd = () => {
      tick = false;
      const v = ride.getBoundingClientRect().bottom > 0 ? 'visible' : 'hidden';
      if (pin && pin.style.visibility !== v) pin.style.visibility = v;
      if (ht && !reduce) {
        const q = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.9)));
        ht.style.transform = `translate3d(0,${-q * 60}px,0)`;
        ht.style.opacity = String(1 - q);
      }
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    addEventListener('resize', upd);
    upd();
  }

  // WebGL scenes: mounted only while near the viewport, fully released shortly after leaving
  const scenes = d.querySelectorAll('[data-scene]');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (scenes.length && 'IntersectionObserver' in window && !saveData) {
    let mod;
    const load = () => mod || (mod = import(new URL('scene.js', self).href));
    scenes.forEach((el) => {
      let inst = null, busy = false, timer = 0, want = false;
      const opts = () => ({ container: el, base: el.dataset.assets, mode: el.dataset.mode, night: +el.dataset.night || 0 });
      const up = async () => {
        if (inst || busy) return;
        busy = true;
        try {
          const m = await load();
          if (!want) return;
          inst = await m.mount(opts());
          if (inst && !want) { inst.destroy(); inst = null; }
          if (inst) {
            inst.onLost = () => { inst.destroy(); inst = null; el.classList.remove('gl', 'gl-done'); };
            requestAnimationFrame(() => el.classList.add('gl'));
            // drop the static <img> layers (and their decoded pixels) once the canvas has faded in
            setTimeout(() => { if (inst) el.classList.add('gl-done'); }, 700);
          }
        } catch (e) { /* static layers stay as the fallback */ } finally { busy = false; }
      };
      const down = () => {
        if (!inst) return;
        inst.destroy(); inst = null;
        el.classList.remove('gl', 'gl-done');
      };
      new IntersectionObserver((es) => {
        want = es[es.length - 1].isIntersecting;
        clearTimeout(timer);
        if (want) up(); else timer = setTimeout(down, 4000);
      }, { rootMargin: '25% 0px' }).observe(el.closest('[data-ride]') || el);
    });
  }
})();
