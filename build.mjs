// Static site generator: src/ + src/i18n/*.json -> docs/ (served by GitHub Pages from /docs).
// pt-BR lives at the root, en at /en/, es at /es/. No runtime deps besides esbuild (scene bundle).
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';

const SITE = process.env.SITE_URL || 'https://fab2295.github.io/mare-alta-site/';
const EMAIL = 'mare-alta@gmail.com'; // same as Support.email in the game
const OUT = 'docs';
const langs = ['pt', 'en', 'es'].map((k) => ({ key: k, ...JSON.parse(readFileSync(`src/i18n/${k}.json`, 'utf8')) }));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/assets/fonts`, { recursive: true });

// ---- assets
for (const f of readdirSync('src/assets')) cpSync(`src/assets/${f}`, `${OUT}/assets/${f}`);
for (const f of readdirSync('src/fonts')) cpSync(`src/fonts/${f}`, `${OUT}/assets/fonts/${f}`);
await build({ entryPoints: { site: 'src/site.js' }, outdir: `${OUT}/assets`, minify: true, bundle: false, target: 'es2020' });
await build({ entryPoints: { scene: 'src/scene.js' }, outdir: `${OUT}/assets`, bundle: true, minify: true, format: 'esm', target: 'es2020', legalComments: 'none' });
await build({ entryPoints: { site: 'src/site.css' }, outdir: `${OUT}/assets`, minify: true });
writeFileSync(`${OUT}/.nojekyll`, '');

// ---- helpers
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pageUrl = (l, kind) => l.dir + (kind === 'home' ? '' : `${l.slugs[kind]}/`);
const depth = (l, kind) => (l.dir ? 1 : 0) + (kind === 'home' ? 0 : 1);

const STAR_LAYERS = ['l1', 'l2', 'l3'];
function scene({ rel, mode, night, eager }) {
  const a = `${rel}assets/`;
  const img = (n, cls = '') => `<img ${cls ? `class="${cls}" ` : ''}src="${a}${n}.webp" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  return `<div class="scene" data-scene data-mode="${mode}" data-night="${night}" data-assets="${a}" aria-hidden="true">
    <div class="scene-static"><div class="stage">${STAR_LAYERS.map((n) => img(n)).join('')}${img('jangada', 'boat')}${img('l4')}</div>${night ? `<div class="scene-night" style="opacity:${(night * 0.82).toFixed(3)}"></div>` : ''}</div>
  </div>`;
}

const icon = (rel) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="#2B2340" aria-hidden="true"><path d="M6 3.5v17l14-8.5z"/></svg>`;
const mailIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2B2340" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>`;
const plus = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2B2340" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;

function nav(l, kind, rel) {
  const to = (k) => rel + pageUrl(l, k);
  const cur = (k) => (kind === k ? ' aria-current="page"' : '');
  const langItems = langs.map((o) => `<li><a href="${rel + pageUrl(o, kind)}" hreflang="${o.code}" lang="${o.code}" data-lang="${o.code}"${o.code === l.code ? ' aria-current="true"' : ''}>${o.name}<small>${o.short}</small></a></li>`).join('');
  const switcher = `<details class="lang"><summary aria-label="${esc(l.nav.language)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B2340" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>${l.short}</summary><ul>${langItems}</ul></details>`;
  const links = kind === 'home'
    ? `<div class="links-wide"><a class="pill" href="#jogo">${l.nav.game}</a><a class="pill" href="#litoral">${l.nav.coast}</a><a class="pill" href="#colecao">${l.nav.collection}</a><a class="pill" href="${to('support')}">${l.nav.support}</a></div>`
    : `<div class="links-wide"><a class="pill" href="${to('support')}"${cur('support')}>${l.nav.support}</a><a class="pill" href="${to('privacy')}"${cur('privacy')}>${l.nav.privacy}</a></div>`;
  const cta = kind === 'home' ? `<a class="pill cta" href="#baixar">${l.nav.download}</a>` : `<a class="pill cta" href="${to('home')}">${l.nav.home}</a>`;
  return `<nav class="nav" aria-label="Maré Alta"><div class="nav-bar">
    <a class="brand" href="${to('home')}"><img src="${rel}assets/icon-96.webp" width="40" height="40" alt=""><span>Maré Alta</span></a>
    <div class="nav-links">${links}${switcher}${cta}</div>
  </div></nav>`;
}

function head(l, kind, rel, t) {
  const self = SITE + pageUrl(l, kind);
  const alt = langs.map((o) => `<link rel="alternate" hreflang="${o.code}" href="${SITE + pageUrl(o, kind)}">`).join('\n') +
    `\n<link rel="alternate" hreflang="x-default" href="${SITE + pageUrl(langs[0], kind)}">`;
  return `<!doctype html>
<html lang="${l.code}" data-base="${rel}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<meta name="theme-color" content="#FFF6E6">
${kind === 'home' ? '<meta name="ma-home">' : ''}
<link rel="canonical" href="${self}">
${alt}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Maré Alta">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:url" content="${self}">
<meta property="og:locale" content="${l.og}">
<meta property="og:image" content="${SITE}assets/icon-512.png">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/png" sizes="192x192" href="${rel}assets/icon-192.png">
<link rel="apple-touch-icon" href="${rel}assets/apple-touch-icon.png">
<link rel="preload" href="${rel}assets/fonts/Shrikhand-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}assets/fonts/Baloo2.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${rel}assets/site.css">
</head>`;
}

const tail = (rel) => `<script src="${rel}assets/site.js" defer></script>\n</body>\n</html>\n`;
const skip = (l) => `<a class="skip" href="#main">${l.nav.skip}</a>`;

function footerLinks(l, rel, items) {
  return `<span>© 2026 Maré Alta</span><div>${items.map(([k, label]) => `<a href="${rel + pageUrl(l, k)}">${label}</a>`).join('')}</div>`;
}

// ---- pages
function home(l) {
  const rel = '../'.repeat(depth(l, 'home')), h = l.home, a = `${rel}assets/`;
  const shot = (n, alt, cls = '') => `<div class="device ${cls}" data-reveal><img src="${a}${n}.webp" width="924" height="427" alt="${esc(alt)}" loading="lazy" decoding="async"></div>`;
  return head(l, 'home', rel, h) + `
<body>
${skip(l)}
${nav(l, 'home', rel)}
<main id="main">
<section id="topo" class="ride" data-ride>
  <div class="pin">
    ${scene({ rel, mode: 'hero', night: 0, eager: true })}
    <div class="hero-text" data-heroText><div>
      <h1 class="title display">Maré Alta</h1>
      <p class="tagline">${h.tagline}</p>
      <div class="row"><a class="btn" href="#baixar">${icon()}${h.cta}</a><span class="chip">${h.badge}</span></div>
    </div></div>
  </div>
</section>

<section id="jogo" class="sheet sec first"><div class="wrap">
  <div class="copy"><div class="eyebrow">${h.game.eyebrow}</div><h2 class="h xl">${h.game.title}</h2><p class="lead">${h.game.text}</p></div>
  ${shot('partida', h.game.alt, 'lg')}
  <div class="hint"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A8198" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="2.5"/><path d="M18 4.5a8 8 0 0 1 3 3"/></svg>${h.game.hint}</div>
</div></section>

<section class="sheet sec"><div class="wrap">
  <h2 class="h">${h.landing.title}</h2>
  <div class="cards">${h.landing.cards.map((c) => `<div class="card" data-reveal>
    <div class="device"><img src="${a}${c.img}.webp" width="924" height="427" alt="${esc(c.title)}" loading="lazy" decoding="async"></div>
    <div class="card-t"><h3>${c.title}</h3><p>${c.text}</p></div></div>`).join('')}</div>
</div></section>

<section class="sheet sec"><div class="wrap">
  <div class="copy"><div class="eyebrow">${h.sea.eyebrow}</div><h2 class="h">${h.sea.title}</h2></div>
  <div class="feats">${h.sea.items.map((f) => `<div class="feat" data-reveal><h3>${f.t}</h3><p>${f.p}</p></div>`).join('')}</div>
</div></section>

<section id="litoral" class="sheet sec"><div class="wrap split">
  <div class="copy"><div class="eyebrow">${h.coast.eyebrow}</div><h2 class="h">${h.coast.title}</h2><p class="lead">${h.coast.text}</p>
    <ol class="stops">${h.coast.stops.map((s, i) => `<li><span class="dot"${i === 0 || i === h.coast.stops.length - 1 ? ' data-end' : ''}></span>${s}</li>`).join('')}</ol>
    <p class="note">${h.coast.europe}</p></div>
  ${shot('mapa', h.coast.alt)}
</div></section>

<section id="colecao" class="sheet sec"><div class="wrap">
  <div class="copy"><div class="eyebrow">${h.collection.eyebrow}</div><h2 class="h">${h.collection.title}</h2><p class="lead">${h.collection.text}</p></div>
  ${shot('colecao', h.collection.alt)}
  <div class="banner"><div><h3>${h.collection.freeTitle}</h3><p>${h.collection.freeText}</p></div><span class="tag">${h.collection.tag}</span></div>
</div></section>

<section class="sheet sec" style="padding-bottom:clamp(70px,9vw,120px)"><div class="wrap split">
  ${shot('fim', h.end.alt)}
  <div class="copy"><div class="eyebrow">${h.end.eyebrow}</div><h2 class="h">${h.end.title}</h2><p class="lead">${h.end.text}</p></div>
</div></section>
</main>

<footer id="baixar" class="band">
  ${scene({ rel, mode: 'band', night: 0.85, eager: false })}
  <div class="band-top">
    <img src="${a}icon-192.png" width="96" height="96" alt="${esc(h.footer.icon)}" loading="lazy">
    <h2>${h.footer.title}</h2>
    <a class="btn" href="#">${icon()}${h.cta}</a>
  </div>
  <div class="band-bot"><div class="foot">${footerLinks(l, rel, [['support', l.nav.support], ['privacy', l.nav.privacy]])}</div></div>
</footer>` + tail(rel);
}

function inner(l, kind) {
  const rel = '../'.repeat(depth(l, kind)), p = l[kind], dusk = kind === 'privacy';
  const other = kind === 'support' ? [['home', l.nav.home], ['privacy', l.nav.privacy]] : [['home', l.nav.home], ['support', l.nav.support]];
  const mail = (subject) => `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`;
  const body = kind === 'support'
    ? `<div style="max-width:880px;gap:36px">
    <div class="faq">${p.faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${f.q}<span class="plus">${plus}</span></summary><div class="ans">${f.a}</div></details>`).join('')}</div>
    <div class="contact"><div><h2>${p.contactTitle}</h2><p>${p.contactText}</p></div><a class="btn sm" href="${mail(p.subject)}">${mailIcon}${p.email}</a></div>
  </div>`
    : `<div class="policy">
    <p class="intro">${p.intro}</p>
    ${p.sections.map((s) => `<section><h2>${s.t}</h2><p>${s.p}</p></section>`).join('')}
    <div class="ask"><span>${p.ask}</span><a class="btn" href="${mail(p.subject)}">${p.email}</a></div>
  </div>`;
  return head(l, kind, rel, p) + `
<body>
${skip(l)}
${nav(l, kind, rel)}
<header class="phead ${dusk ? 'dusk' : 'day'}">
  ${scene({ rel, mode: 'band', night: dusk ? 0.85 : 0, eager: true })}
  <div class="phead-text"><div><h1 class="display">${p.h1}</h1><p>${p.sub}</p></div></div>
</header>
<main id="main" class="pmain">${body}</main>
<footer class="plainfoot"><div class="foot">${footerLinks(l, rel, other)}</div></footer>` + tail(rel);
}

for (const l of langs) {
  for (const kind of ['home', 'support', 'privacy']) {
    const dir = `${OUT}/${pageUrl(l, kind)}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}index.html`, kind === 'home' ? home(l) : inner(l, kind));
  }
}

const urls = langs.flatMap((l) => ['home', 'support', 'privacy'].map((k) => SITE + pageUrl(l, k)));
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
writeFileSync(`${OUT}/404.html`, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maré Alta</title><meta http-equiv="refresh" content="0;url=${SITE}"><a href="${SITE}">Maré Alta</a>`);
console.log('built', urls.length, 'pages');
