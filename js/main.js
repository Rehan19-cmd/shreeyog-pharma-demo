import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initEnquiry } from './enquiry.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
root.classList.add('js');
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = window.matchMedia('(max-width: 960px)').matches || navigator.maxTouchPoints > 1 && window.innerWidth < 1100;
if (reducedMotion) root.classList.add('reduced-motion');

// ------------------------------------------------------------------ data
let data;
try { data = JSON.parse($('#site-data')?.textContent || 'null'); } catch { data = null; }
if (!data) data = await fetch('api/site').then((r) => r.json());
// Static preview (e.g. GitHub Pages): enquiries and admin edits live in this browser only.
let demo = null;
if (data.demo) {
  const { createDemoStore } = await import('./demo-store.js');
  demo = await createDemoStore({ seed: data });
  data = demo.siteData();
}
const C = data.content;
const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), C);

/** Plain text with *accent* segments (admin-friendly highlight syntax). */
function setRich(el, value) {
  el.textContent = '';
  String(value ?? '').split('*').forEach((part, i) => {
    if (!part) return;
    if (i % 2) { const em = document.createElement('em'); em.className = 'accent'; em.textContent = part; el.append(em); }
    else el.append(part);
  });
}
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v; // only used with static markup below
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.filter((c) => c != null));
  return el;
};
const icon = (name, cls = 'ic') => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
};

const phoneDigits = String(C.contact.phone || '').replace(/[^\d+]/g, '');
const links = {
  tel: `tel:${phoneDigits}`,
  mailto: `mailto:${C.contact.email}`,
  whatsapp: `https://wa.me/${String(C.contact.whatsapp || phoneDigits).replace(/\D/g, '')}`,
};

// ------------------------------------------------------------------ bind static copy
$$('[data-bind]').forEach((el) => setRich(el, get(el.dataset.bind)));
$$('[data-bind-src]').forEach((el) => { const v = get(el.dataset.bindSrc); if (v) el.src = v; });
$$('[data-bind-href]').forEach((el) => { el.href = links[el.dataset.bindHref] || '#'; });
$('#cc-address').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(C.contact.address)}`;
$('#map').src = `https://www.google.com/maps?q=${encodeURIComponent(C.contact.mapQuery || C.contact.address)}&output=embed`;
if (C.contact.hours) $('#contact-hours').hidden = false;
$('#year').textContent = new Date().getFullYear();

// ------------------------------------------------------------------ render lists
const SERVICE_ICONS = ['fabrication', 'cleanroom', 'passbox', 'tank', 'piping', 'epoxy', 'partition', 'railing'];

// hero stats
$('#hero-stats').append(...(C.hero.stats || []).map((s) => {
  const numeric = /^\d+$/.test(String(s.value));
  return h('li', {},
    h('strong', {}, h('span', { 'data-count': numeric ? s.value : null, text: numeric ? '0' : s.value }), h('em', { text: s.suffix || '' })),
    h('span', { text: s.label }));
}));

// services marquee (two copies for a seamless loop)
const marqueeItems = (C.services.items || []).map((s) => s.title);
for (let copy = 0; copy < 2; copy++) marqueeItems.forEach((t) => $('#service-marquee').append(h('span', {}, t, h('i'))));

$('#about-points').append(...(C.about.points || []).map((p) => h('li', {}, icon('check'), p)));
$('#founder-skills').append(...(C.founder.skills || []).map((s) => h('li', { text: s })));

// showcase steps
const steps = C.showcase.steps || [];
setRich($('[data-bind="showcase.title"]'), C.showcase.title);
$('#showcase-steps').append(...steps.map((s, i) => h('article', { class: `step-card glass${i === 0 ? ' is-active' : ''}` },
  h('span', { class: 'step-card__num', text: `${String(i + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}` }),
  h('h3', { text: s.title }), h('p', { text: s.text }))));
$('#showcase-progress').append(...steps.map(() => h('span', {}, h('i'))));

// services
$('#services-grid').append(...(C.services.items || []).map((s, i) => h('article', { class: 'svc', 'data-reveal': true },
  h('span', { class: 'svc__num', text: String(i + 1).padStart(2, '0') }),
  h('span', { class: 'svc__icon' }, icon(SERVICE_ICONS.includes(s.icon) ? s.icon : SERVICE_ICONS[i % SERVICE_ICONS.length])),
  h('h3', { text: s.title }), h('p', { text: s.text }))));

// expertise
$('#expertise-list').append(...(C.expertise.items || []).map((it) => h('li', { class: 'exp-item', 'data-reveal': true },
  h('span', { class: 'exp-item__bar' }), h('h3', { text: it.title }), h('p', { text: it.text }))));

// furniture features
const FEAT_ICONS = ['layers', 'shield', 'spark', 'eye', 'grid', 'check', 'award'];
$('#furniture-list').append(...(C.furniture.items || []).map((it, i) => h('li', { class: 'feat', 'data-reveal': true },
  h('span', { class: 'feat__icon' }, icon(FEAT_ICONS[i % FEAT_ICONS.length])), h('h3', { text: it.title }), h('p', { text: it.text }))));

// process
$('#process-steps').append(...(C.process.steps || []).map((s, i) => h('li', { class: 'pstep' },
  h('span', { class: 'pstep__dot', text: String(i + 1).padStart(2, '0') }), h('h3', { text: s.title }), h('p', { text: s.text }))));

// clients (two marquee rows running in opposite directions)
const clients = data.clients || [];
const half = Math.ceil(clients.length / 2);
[clients.slice(0, half), clients.slice(half)].forEach((row, r) => {
  if (!row.length) return;
  const track = h('div', { class: `logo-row${r ? ' logo-row--rev' : ''}` });
  for (let copy = 0; copy < 2; copy++) {
    row.forEach((c) => {
      const tile = h(c.website ? 'a' : 'div', { class: 'logo-tile', href: c.website || null, target: c.website ? '_blank' : null, rel: c.website ? 'noopener' : null, 'aria-hidden': copy ? 'true' : null },
        h('img', { src: c.logo, alt: copy ? '' : c.name, loading: 'lazy' }), h('span', { class: 'logo-tile__name', text: c.name }));
      track.append(tile);
    });
  }
  $('#logo-marquee').append(track);
});
$('#clients-count').textContent = `${clients.length}+ companies`;

// ------------------------------------------------------------------ toast
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

let currentProduct = null; // product open in the quick-view modal

// ------------------------------------------------------------------ enquiry basket (products picked from the catalogue)
const basket = (() => {
  const KEY = 'spe_enquiry_products';
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]').filter((n) => typeof n === 'string'); } catch { items = []; }
  const listeners = new Set();
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
    listeners.forEach((fn) => fn(items));
  };
  return {
    get items() { return [...items]; },
    has: (n) => items.includes(n),
    add(n) { if (!items.includes(n)) { items.push(n); save(); } },
    remove(n) { items = items.filter((x) => x !== n); save(); },
    toggle(n) { this.has(n) ? this.remove(n) : this.add(n); return this.has(n); },
    set(list) { items = [...new Set(list)]; save(); },
    clear() { items = []; save(); },
    subscribe(fn) { listeners.add(fn); fn(items); return () => listeners.delete(fn); },
  };
})();

const basketBtn = $('#basket');
basket.subscribe((items) => {
  basketBtn.hidden = items.length === 0;
  basketBtn.setAttribute('aria-label', `Your enquiry list: ${items.length} product${items.length === 1 ? '' : 's'}`);
  $('#basket-count').textContent = items.length;
  basketBtn.classList.remove('is-bump'); void basketBtn.offsetWidth; basketBtn.classList.add('is-bump');
  $$('.pcard').forEach((card) => syncAddButton(card.querySelector('.pcard__add'), basket.has(card.dataset.name)));
  if (currentProduct) syncModalButton();
});
basketBtn.addEventListener('click', () => scrollToTarget('#enquiry'));

// ------------------------------------------------------------------ product catalogue
const products = data.products || [];
const categories = [...new Set(products.map((p) => p.category))];
const catalog = { cat: 'All', q: '', shown: 0, page: window.innerWidth < 720 ? 8 : 12 };

function syncAddButton(btn, added) {
  if (!btn) return;
  btn.classList.toggle('is-added', added);
  btn.replaceChildren(icon(added ? 'check' : 'plus'), added ? 'Added to enquiry' : 'Add to enquiry');
  btn.setAttribute('aria-pressed', added);
}

function productCard(p) {
  const add = h('button', { class: 'pcard__add', type: 'button', onclick: () => {
    const added = basket.toggle(p.name);
    toast(added ? `“${p.name}” added to your enquiry` : `Removed “${p.name}”`);
  } });
  syncAddButton(add, basket.has(p.name));
  return h('article', { class: 'pcard is-enter', 'data-name': p.name, 'data-tilt-soft': true },
    h('button', { class: 'pcard__img', type: 'button', 'aria-label': `View ${p.name}`, onclick: () => openProduct(p) },
      h('img', { src: p.image || 'assets/img/logo.png', alt: p.name, loading: 'lazy' }),
      p.featured ? h('span', { class: 'pcard__badge', text: 'Popular' }) : null),
    h('div', { class: 'pcard__body' },
      h('span', { class: 'pcard__cat', text: p.category }),
      h('h3', { text: p.name }),
      h('p', { text: p.description || '' }),
      add));
}

function filteredProducts() {
  const q = catalog.q.trim().toLowerCase();
  return products.filter((p) => (catalog.cat === 'All' || p.category === catalog.cat)
    && (!q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q)));
}

function renderCatalog(reset = true) {
  const grid = $('#catalog-grid');
  const list = filteredProducts();
  if (reset) { grid.replaceChildren(); catalog.shown = 0; }
  const next = list.slice(catalog.shown, catalog.shown + catalog.page);
  next.forEach((p, i) => { const card = productCard(p); card.style.animationDelay = `${i * 40}ms`; grid.append(card); });
  catalog.shown += next.length;
  if (!list.length) grid.append(h('p', { class: 'catalog__empty', text: 'No products match your search. Try another word, or send us an enquiry — we fabricate to order.' }));
  $('#catalog-more').hidden = catalog.shown >= list.length;
  $('#catalog-count').textContent = list.length ? `Showing ${catalog.shown} of ${list.length} products` : '';
  bindTilt(grid);
  ScrollTrigger.refresh();
}

function renderTabs() {
  const tabs = $('#catalog-tabs');
  tabs.replaceChildren(...['All', ...categories].map((c) => h('button', {
    class: `tab${catalog.cat === c ? ' is-active' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(catalog.cat === c),
    onclick: () => { catalog.cat = c; renderTabs(); renderCatalog(); },
  }, c, h('em', { text: String(c === 'All' ? products.length : products.filter((p) => p.category === c).length) }))));
}
renderTabs();
renderCatalog();
$('#catalog-more').addEventListener('click', () => renderCatalog(false));
let searchTimer;
$('#catalog-search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { catalog.q = e.target.value; renderCatalog(); }, 160);
});

$('#footer-cats').append(...categories.map((c) => h('li', {}, h('a', { href: '#products', text: c, onclick: (e) => {
  e.preventDefault(); catalog.cat = c; renderTabs(); renderCatalog(); scrollToTarget('#products');
} }))));

// product quick view
const modal = $('#product-modal');
function syncModalButton() {
  const added = basket.has(currentProduct.name);
  $('#pm-add').replaceChildren(h('span', { text: added ? 'Added to enquiry' : 'Add to enquiry' }), icon(added ? 'check' : 'plus'));
}
function openProduct(p) {
  currentProduct = p;
  $('#pm-img').src = p.image; $('#pm-img').alt = p.name;
  $('#pm-cat').textContent = p.category;
  $('#pm-name').textContent = p.name;
  $('#pm-desc').textContent = p.description || '';
  syncModalButton();
  modal.hidden = false;
  lenis?.stop();
  $('.modal__close', modal).focus();
}
function closeModal() { modal.hidden = true; currentProduct = null; lenis?.start(); }
modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
$('#pm-add').addEventListener('click', () => { basket.toggle(currentProduct.name); });
$('#pm-quote').addEventListener('click', () => { basket.add(currentProduct.name); closeModal(); scrollToTarget('#enquiry'); });

// ------------------------------------------------------------------ gallery + lightbox
const gallery = data.gallery || [];
const gCats = ['All', ...new Set(gallery.map((g) => g.category).filter(Boolean))];
let lbIndex = 0;
let lbList = gallery;
$('#gallery').append(...gallery.map((g, i) => h('button', {
  class: `gitem${i % 3 === 0 ? ' gitem--tall' : ''}`, type: 'button', 'data-cat': g.category || '', 'data-reveal': true,
  onclick: () => { lbList = gallery.filter((x) => !$('#gallery').dataset.cat || $('#gallery').dataset.cat === 'All' || x.category === $('#gallery').dataset.cat); openLightbox(lbList.indexOf(g)); },
}, h('img', { src: g.image, alt: g.title, loading: 'lazy' }), h('span', { class: 'gitem__cap' }, h('small', { text: g.category || 'Project' }), h('strong', { text: g.title })))));
$('#gallery-filters').append(...gCats.map((c, i) => h('button', { class: `gchip${i === 0 ? ' is-active' : ''}`, type: 'button', onclick: (e) => {
  $$('.gchip').forEach((b) => b.classList.toggle('is-active', b === e.currentTarget));
  $('#gallery').dataset.cat = c;
  $$('.gitem').forEach((it) => it.classList.toggle('is-hidden', c !== 'All' && it.dataset.cat !== c));
  ScrollTrigger.refresh();
} }, c)));

const lightbox = $('#lightbox');
function openLightbox(i) {
  lbIndex = (i + lbList.length) % lbList.length;
  const g = lbList[lbIndex];
  $('#lb-img').src = g.image; $('#lb-img').alt = g.title;
  $('#lb-title').textContent = g.title;
  $('#lb-caption').textContent = g.caption || '';
  lightbox.hidden = false;
  lenis?.stop();
}
function closeLightbox() { lightbox.hidden = true; lenis?.start(); }
lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.closest('[data-close]')) closeLightbox(); });
$('#lb-prev').addEventListener('click', () => openLightbox(lbIndex - 1));
$('#lb-next').addEventListener('click', () => openLightbox(lbIndex + 1));
document.addEventListener('keydown', (e) => {
  if (!lightbox.hidden) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') openLightbox(lbIndex - 1);
    if (e.key === 'ArrowRight') openLightbox(lbIndex + 1);
  } else if (!modal.hidden && e.key === 'Escape') closeModal();
  else if (e.key === 'Escape' && !$('#mobile-menu').hidden) toggleMenu(false);
});

// ------------------------------------------------------------------ smooth scroll
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
function scrollToTarget(sel) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) return;
  const offset = el.id === 'top' ? 0 : -70;
  if (lenis) lenis.scrollTo(el.id === 'top' ? 0 : el, { offset, duration: 1.5 });
  else window.scrollTo({ top: el.id === 'top' ? 0 : el.getBoundingClientRect().top + window.scrollY + offset, behavior: reducedMotion ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-scroll]');
  if (!a) return;
  const hash = a.getAttribute('href');
  if (!hash?.startsWith('#')) return;
  e.preventDefault();
  toggleMenu(false);
  scrollToTarget(hash);
});

// ------------------------------------------------------------------ nav
const nav = $('#nav');
const burger = $('#burger');
function toggleMenu(open = burger.getAttribute('aria-expanded') !== 'true') {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  $('#mobile-menu').hidden = !open;
  if (open) { lenis?.stop(); nav.classList.remove('is-hidden'); } else lenis?.start();
}
burger.addEventListener('click', () => toggleMenu());

let lastY = 0;
function onScroll() {
  const y = window.scrollY;
  nav.classList.toggle('is-scrolled', y > 30);
  const menuOpen = burger.getAttribute('aria-expanded') === 'true';
  if (!menuOpen) nav.classList.toggle('is-hidden', y > 700 && y > lastY + 4);
  if (y < lastY - 4) nav.classList.remove('is-hidden');
  lastY = y;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  $('.scroll-progress span').style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  updateStage();
}
window.addEventListener('scroll', onScroll, { passive: true });

$$('.nav__links a').forEach((a) => {
  const target = $(a.getAttribute('href'));
  if (!target) return;
  ScrollTrigger.create({
    trigger: target, start: 'top 45%', end: 'bottom 45%',
    onToggle: (self) => { if (self.isActive) $$('.nav__links a').forEach((x) => x.classList.toggle('is-active', x === a)); },
  });
});

// ------------------------------------------------------------------ text effects
function splitWords(el) {
  const out = [];
  const nodes = [...el.childNodes];
  el.textContent = '';
  nodes.forEach((node) => {
    const accent = node.nodeType === 1 && node.classList.contains('accent');
    const words = node.textContent.split(/(\s+)/);
    words.forEach((w) => {
      if (!w) return;
      if (/^\s+$/.test(w)) { el.append(' '); return; }
      const inner = h('span', { class: `split-word${accent ? ' accent' : ''}`, text: w });
      el.append(h('span', { class: 'split-line' }, inner));
      out.push(inner);
    });
  });
  return out;
}

const heroWords = splitWords($('.hero__title'));
$$('[data-split]:not(.hero__title)').forEach((el) => {
  const words = splitWords(el);
  if (reducedMotion) return;
  gsap.from(words, { yPercent: 115, rotate: 4, duration: 1.2, ease: 'expo.out', stagger: 0.035, scrollTrigger: { trigger: el, start: 'top 88%' } });
});

$$('[data-scrub-words]').forEach((el) => {
  const words = el.textContent.split(/\s+/).filter(Boolean);
  el.replaceChildren(...words.flatMap((w, i) => [h('span', { class: 'w', text: w }), i < words.length - 1 ? ' ' : null].filter(Boolean)));
  if (reducedMotion) { $$('.w', el).forEach((w) => { w.style.opacity = 1; }); return; }
  gsap.to($$('.w', el), { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: true } });
});

// ------------------------------------------------------------------ scroll animations
function setupScrollAnimations() {
  if (reducedMotion) return;
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });

  $$('[data-parallax]').forEach((el) => {
    gsap.to(el, { y: Number(el.dataset.parallax), ease: 'none', scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('[data-parallax-img]').forEach((img) => {
    gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  $$('.exp-item').forEach((it) => {
    gsap.to($('.exp-item__bar', it), { scaleX: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: it, start: 'top 80%' } });
  });

  const pSteps = $$('.pstep');
  const fill = $('#process-fill');
  ScrollTrigger.create({
    trigger: '.process__track', start: 'top 75%', end: 'bottom 55%', scrub: true,
    onUpdate: (self) => {
      fill.style.setProperty('--p', self.progress.toFixed(4));
      pSteps.forEach((s, i) => s.classList.toggle('is-on', self.progress >= i / Math.max(1, pSteps.length - 1) - 0.02));
    },
  });

  gsap.fromTo('.marquee', { xPercent: 0 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });
}

function layoutProcessLine() {
  const line = $('.process__line');
  const dots = $$('.pstep__dot');
  if (!line || dots.length < 2) return;
  if (window.innerWidth > 960) { line.style.top = ''; line.style.height = ''; return; }
  const track = $('.process__track').getBoundingClientRect();
  const first = dots[0].getBoundingClientRect(), last = dots[dots.length - 1].getBoundingClientRect();
  line.style.top = `${first.top + first.height / 2 - track.top}px`;
  line.style.height = `${last.top - first.top}px`;
}

function countUp() {
  $$('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    if (reducedMotion) { el.textContent = end; return; }
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 2, ease: 'power3.out', delay: 0.4, onUpdate: () => { el.textContent = Math.round(o.v); } });
  });
}

// ------------------------------------------------------------------ tilt + cursor
function bindTilt(scope = document) {
  if (!finePointer || reducedMotion) return;
  $$('[data-tilt], .svc, [data-tilt-soft]', scope).forEach((el) => {
    if (el.dataset.tiltBound) return;
    el.dataset.tiltBound = '1';
    const max = el.hasAttribute('data-tilt-soft') ? 4 : 7;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}
bindTilt();

if (finePointer && !reducedMotion) {
  root.classList.add('has-cursor');
  const cursor = $('.cursor');
  const dot = $('.cursor__dot'), ring = $('.cursor__ring');
  const p = { x: -100, y: -100, rx: -100, ry: -100 };
  window.addEventListener('pointermove', (e) => {
    p.x = e.clientX; p.y = e.clientY;
    const t = e.target;
    cursor.classList.toggle('is-hover', !!t.closest?.('a, button, input, select, textarea, label, [data-tilt], .pcard'));
    cursor.classList.toggle('is-light', !!t.closest?.('.section--light, .modal__card'));
  }, { passive: true });
  gsap.ticker.add(() => {
    p.rx += (p.x - p.rx) * 0.18; p.ry += (p.y - p.ry) * 0.18;
    dot.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    ring.style.transform = `translate(${p.rx}px, ${p.ry}px) translate(-50%, -50%)`;
  });
}

// ------------------------------------------------------------------ 3D scene + scroll choreography
let scene = null;
let stageAnchors = [];
const stepCards = $$('.step-card');
const progressBars = $$('#showcase-progress i');
const hotspot = $('#hotspot');
const line = $('#showcase-line');
const HOTSPOT_ANCHORS = ['nameplate', 'seam', 'fitting', 'motor'];
let activeStep = 0;

function computeAnchors() {
  const top = (el) => el.getBoundingClientRect().top + window.scrollY;
  const vh = window.innerHeight;
  const hero = $('#top'), show = $('#showcase'), svc = $('#services'), enq = $('#enquiry');
  const sTop = top(show);
  const L = Math.max(1, show.offsetHeight - vh);
  stageAnchors = [
    [0, 0],
    [hero.offsetHeight * 0.55, 0],
    [sTop - vh * 0.05, 1],
    [sTop + L * 0.33, 2],
    [sTop + L * 0.66, 3],
    [sTop + L * 0.97, 4],
    [top(svc) + svc.offsetHeight / 2 - vh / 2, 5],
    [top(enq) + Math.max(0, (enq.offsetHeight - vh) / 2), 6],
  ];
}

const ease = (t) => { const x = Math.min(1, Math.max(0, (t - 0.1) / 0.8)); return x * x * (3 - 2 * x); };
function stageAt(y) {
  const A = stageAnchors;
  if (!A.length) return 0;
  if (y <= A[0][0]) return A[0][1];
  for (let i = 0; i < A.length - 1; i++) {
    const [y0, k0] = A[i], [y1, k1] = A[i + 1];
    if (y <= y1) return k0 + (k1 - k0) * ease((y - y0) / Math.max(1, y1 - y0));
  }
  return A[A.length - 1][1];
}

function updateStage() {
  if (!stageAnchors.length) return;
  const s = stageAt(window.scrollY);
  scene?.setStage(s);
  // showcase step cards
  const idx = Math.max(0, Math.min(stepCards.length - 1, Math.round(s - 1)));
  if (idx !== activeStep) {
    stepCards[activeStep]?.classList.remove('is-active');
    stepCards[idx]?.classList.add('is-active');
    activeStep = idx;
  }
  progressBars.forEach((b, i) => { b.style.setProperty('--p', Math.max(0, Math.min(1, s - i))); });
}

function trackHotspot() {
  if (!scene) return;
  const show = $('#showcase');
  const r = show.getBoundingClientRect();
  const pinned = r.top <= 1 && r.bottom >= window.innerHeight - 1;
  const settled = Math.abs(scene.stage - (activeStep + 1)) < 0.2;
  const pt = pinned && settled ? scene.project(HOTSPOT_ANCHORS[activeStep] || 'motor') : null;
  if (!pt || !pt.visible) { hotspot.classList.add('is-hidden'); line.classList.add('is-hidden'); return; }
  hotspot.classList.remove('is-hidden');
  line.classList.remove('is-hidden');
  hotspot.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
  const card = stepCards[activeStep].getBoundingClientRect();
  const mobile = window.innerWidth <= 960;
  const x1 = mobile ? card.left + card.width / 2 : card.right;
  const y1 = mobile ? card.top : card.top + card.height / 2;
  const [ln, dot] = [$('line', line), $('circle', line)];
  ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', pt.x); ln.setAttribute('y2', pt.y);
  dot.setAttribute('cx', x1); dot.setAttribute('cy', y1);
}

async function initScene() {
  const canvas = $('#scene');
  try {
    const test = document.createElement('canvas');
    if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('WebGL unavailable');
    const { createScene } = await import('./scene.js');
    scene = createScene(canvas, { mobile: isMobile, reducedMotion });
    // Render only while a transparent "3D" section is on screen.
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? visible.add(en.target) : visible.delete(en.target)));
      scene.setActive(visible.size > 0);
    }, { rootMargin: '10% 0px' });
    $$('[data-3d]').forEach((s) => io.observe(s));
    scene.onFrame(trackHotspot);
    const phoneLayout = window.matchMedia('(max-width: 960px)');
    const boxEls = Object.fromEntries(['hero', 'showcase', 'services', 'enquiry'].map((k) => [k, document.getElementById(`${k}-stage`)]));
    const heroContent = $('.hero__content'), heroStats = $('#hero-stats'), showHead = $('.showcase__head .h2'), deskStage = $('.enquiry__stage');
    const region = (left, top, right, bottom) => ({ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
    scene.setBoxProvider(() => {
      if (phoneLayout.matches) {
        return { phone: true, ...Object.fromEntries(Object.entries(boxEls).map(([k, el]) => [k, el.getBoundingClientRect()])) };
      }
      // Laptops: the space to the right of the text column (kept where it is at the top of the page).
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      const top = 84;
      const statsTop = heroStats.getBoundingClientRect().top + window.scrollY;
      const card = stepCards[activeStep].getBoundingClientRect();
      return {
        phone: false,
        hero: region(heroContent.getBoundingClientRect().right + 24, top, vw - 16, Math.min(vh - 12, statsTop - 14)),
        showcase: region(Math.max(card.right, showHead.getBoundingClientRect().right) + 24, top, vw - 56, vh - 12),
        enquiry: deskStage.getBoundingClientRect(),
      };
    });
    computeAnchors();
    scene.jumpTo(stageAt(window.scrollY));
    await Promise.race([scene.ready, new Promise((r) => setTimeout(r, 4000))]);
  } catch (err) {
    console.warn('3D scene disabled:', err);
    root.classList.add('no-webgl');
    scene = null;
  }
}

// ------------------------------------------------------------------ enquiry form
if (demo) $('.footer__admin').textContent = 'Admin (preview)';

initEnquiry({
  data,
  demo,
  basket,
  toast,
  scrollTo: scrollToTarget,
  onSent: () => scene?.pulse(),
});

// ------------------------------------------------------------------ preloader → intro
const loaderPct = $('#loader-pct'), loaderBar = $('#loader-bar');
const progress = { v: 0 };
const loaderTween = gsap.to(progress, { v: 88, duration: 2.4, ease: 'power2.out', onUpdate: () => {
  loaderPct.textContent = Math.round(progress.v);
  loaderBar.style.width = `${progress.v}%`;
} });

async function boot() {
  try {
    await Promise.all([
      initScene(),
      document.fonts?.ready.catch(() => {}),
      new Promise((r) => setTimeout(r, reducedMotion ? 0 : 900)),
    ]);
  } finally {
    loaderTween.kill();
    await new Promise((r) => gsap.to(progress, { v: 100, duration: 0.35, onUpdate: () => {
      loaderPct.textContent = Math.round(progress.v);
      loaderBar.style.width = `${progress.v}%`;
    }, onComplete: r }));
    $('#loader').classList.add('is-done');
    root.classList.remove('is-loading');
    lenis?.start();
    intro();
    ScrollTrigger.addEventListener('refresh', () => { computeAnchors(); updateStage(); layoutProcessLine(); });
    ScrollTrigger.refresh();
    computeAnchors();
    onScroll();
    new ResizeObserver(() => ScrollTrigger.refresh()).observe(document.body);
    if (location.hash && $(location.hash)) setTimeout(() => scrollToTarget(location.hash), 300);
  }
}

function intro() {
  const heroReveals = $$('.hero [data-reveal]');
  if (reducedMotion) {
    gsap.set([...heroReveals, '.hero__stats li'], { opacity: 1, y: 0 });
    countUp();
    setupScrollAnimations();
    return;
  }
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.nav', { y: -30, opacity: 0, duration: 1 }, 0)
    .from('.hero__eyebrow', { y: 20, opacity: 0, duration: 1 }, 0.1)
    .from(heroWords, { yPercent: 115, rotate: 5, duration: 1.4, stagger: 0.05 }, 0.15)
    .to(heroReveals, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, 0.5)
    .from('.hero__stats li', { y: 30, opacity: 0, duration: 1.1, stagger: 0.08 }, 0.7)
    .from('.scroll-cue', { opacity: 0, duration: 1 }, 1.1);
  countUp();
  setupScrollAnimations();
}

boot();
