import { initEnquiry } from './enquiry.js';

const root = document.documentElement;
root.classList.add('js');
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

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
const pad = (n) => String(n).padStart(2, '0');

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
if (demo) $('.footer__admin').textContent = 'Admin (preview)';

// ------------------------------------------------------------------ render lists
const SERVICE_ICONS = ['fabrication', 'cleanroom', 'passbox', 'tank', 'piping', 'epoxy', 'partition', 'railing'];

$('#hero-stats').append(...(C.hero.stats || []).map((s) => h('li', {},
  h('strong', { text: `${s.value ?? ''}${s.suffix || ''}` }), h('span', { text: s.label }))));

$('#about-points').append(...(C.about.points || []).map((p) => h('li', {}, icon('check'), h('span', { text: p }))));
$('#founder-skills').append(...(C.founder.skills || []).map((s) => h('li', { text: s })));

$('#showcase-steps').append(...(C.showcase?.steps || []).map((s, i) => h('li', {},
  h('span', { class: 'quality__num', text: pad(i + 1) }), h('h3', { text: s.title }), h('p', { text: s.text }))));

$('#services-grid').append(...(C.services.items || []).map((s, i) => h('article', { class: 'card' },
  h('span', { class: 'icon-box' }, icon(SERVICE_ICONS.includes(s.icon) ? s.icon : SERVICE_ICONS[i % SERVICE_ICONS.length])),
  h('h3', { text: s.title }), h('p', { text: s.text }))));

$('#expertise-list').append(...(C.expertise.items || []).map((it, i) => h('li', {},
  h('span', { class: 'expertise__num', text: pad(i + 1) }), h('h3', { text: it.title }), h('p', { text: it.text }))));

$('#furniture-list').append(...(C.furniture.items || []).map((it) => h('li', {},
  icon('check'), h('div', {}, h('strong', { text: it.title }), h('span', { text: it.text })))));

$('#process-steps').append(...(C.process.steps || []).map((s, i) => h('li', {},
  h('span', { class: 'process__num', text: pad(i + 1) }), h('h3', { text: s.title }), h('p', { text: s.text }))));

const clients = data.clients || [];
$('#clients-grid').append(...clients.map((c) => h(c.website ? 'a' : 'div', {
  class: 'client', title: c.name, href: c.website || null, target: c.website ? '_blank' : null, rel: c.website ? 'noopener' : null,
}, c.logo ? h('img', { src: c.logo, alt: c.name, loading: 'lazy' }) : h('span', { text: c.name }))));
$('#clients-count').textContent = `${clients.length}+ companies`;

// ------------------------------------------------------------------ helpers: scrolling, toast, overlays
function scrollToTarget(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (el.id === 'top') window.scrollTo(0, 0);
  else el.scrollIntoView({ block: 'start' });
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

let lastFocus = null;
function openOverlay(el, focusEl) {
  lastFocus = document.activeElement;
  el.hidden = false;
  root.classList.add('is-locked');
  focusEl?.focus();
}
function closeOverlay(el) {
  el.hidden = true;
  root.classList.remove('is-locked');
  lastFocus?.focus?.();
  lastFocus = null;
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
  return h('article', { class: 'pcard', 'data-name': p.name },
    h('button', { class: 'pcard__img', type: 'button', 'aria-label': `View ${p.name}`, onclick: () => openProduct(p) },
      h('img', { src: p.image || 'assets/img/logo.png', alt: p.name, loading: 'lazy' }),
      p.featured ? h('span', { class: 'pcard__badge', text: 'Popular' }) : null),
    h('div', { class: 'pcard__body' },
      h('span', { class: 'pcard__cat', text: p.category }),
      h('h3', {}, h('button', { type: 'button', class: 'pcard__name', text: p.name, onclick: () => openProduct(p) })),
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
  grid.append(...next.map(productCard));
  catalog.shown += next.length;
  if (!list.length) grid.append(h('p', { class: 'catalog__empty', text: 'No products match your search. Try another word, or send us an enquiry: we fabricate to order.' }));
  $('#catalog-more').hidden = catalog.shown >= list.length;
  $('#catalog-count').textContent = list.length ? `Showing ${catalog.shown} of ${list.length} products` : '';
}

function renderTabs() {
  $('#catalog-tabs').replaceChildren(...['All', ...categories].map((c) => h('button', {
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
  $('#pm-add').replaceChildren(icon(added ? 'check' : 'plus'), added ? 'Added to enquiry' : 'Add to enquiry');
}
function openProduct(p) {
  currentProduct = p;
  $('#pm-img').src = p.image || 'assets/img/logo.png'; $('#pm-img').alt = p.name;
  $('#pm-cat').textContent = p.category;
  $('#pm-name').textContent = p.name;
  $('#pm-desc').textContent = p.description || '';
  syncModalButton();
  openOverlay(modal, $('.modal__close', modal));
}
function closeModal() { currentProduct = null; closeOverlay(modal); }
modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
$('#pm-add').addEventListener('click', () => { basket.toggle(currentProduct.name); });
$('#pm-quote').addEventListener('click', () => { basket.add(currentProduct.name); closeModal(); scrollToTarget('#enquiry'); });

// ------------------------------------------------------------------ project gallery + lightbox
const gallery = data.gallery || [];
const gCats = ['All', ...new Set(gallery.map((g) => g.category).filter(Boolean))];
let gCat = 'All';
let lbIndex = 0;
let lbList = gallery;

$('#gallery').append(...gallery.map((g) => h('button', {
  class: 'gitem', type: 'button', 'data-cat': g.category || '',
  onclick: () => { lbList = gallery.filter((x) => gCat === 'All' || x.category === gCat); openLightbox(lbList.indexOf(g)); },
}, h('span', { class: 'gitem__img' }, h('img', { src: g.image, alt: g.title, loading: 'lazy' })),
  h('span', { class: 'gitem__cap' }, h('strong', { text: g.title }), h('small', { text: g.category || 'Project' })))));

if (gCats.length > 2) {
  $('#gallery-filters').append(...gCats.map((c) => h('button', {
    class: `chip${c === gCat ? ' is-active' : ''}`, type: 'button', 'aria-pressed': String(c === gCat),
    onclick: (e) => {
      gCat = c;
      $$('#gallery-filters .chip').forEach((b) => { const on = b === e.currentTarget; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
      $$('.gitem').forEach((it) => { it.hidden = c !== 'All' && it.dataset.cat !== c; });
    },
  }, c)));
}

const lightbox = $('#lightbox');
function showLightboxImage(i) {
  lbIndex = (i + lbList.length) % lbList.length;
  const g = lbList[lbIndex];
  $('#lb-img').src = g.image; $('#lb-img').alt = g.title;
  $('#lb-title').textContent = g.title;
  $('#lb-caption').textContent = g.caption || '';
}
function openLightbox(i) {
  showLightboxImage(i);
  if (lightbox.hidden) openOverlay(lightbox, $('.lightbox__close', lightbox));
}
lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.closest('[data-close]')) closeOverlay(lightbox); });
$('#lb-prev').addEventListener('click', () => showLightboxImage(lbIndex - 1));
$('#lb-next').addEventListener('click', () => showLightboxImage(lbIndex + 1));

// ------------------------------------------------------------------ mobile menu
const burger = $('#burger');
const menu = $('#mobile-menu');
function toggleMenu(open = burger.getAttribute('aria-expanded') !== 'true') {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menu.hidden = !open;
}
burger.addEventListener('click', () => toggleMenu());
menu.addEventListener('click', (e) => { if (e.target.closest('a')) toggleMenu(false); });
window.matchMedia('(min-width: 1101px)').addEventListener('change', (e) => { if (e.matches) toggleMenu(false); });

document.addEventListener('keydown', (e) => {
  if (!lightbox.hidden) {
    if (e.key === 'Escape') closeOverlay(lightbox);
    if (e.key === 'ArrowLeft') showLightboxImage(lbIndex - 1);
    if (e.key === 'ArrowRight') showLightboxImage(lbIndex + 1);
  } else if (!modal.hidden && e.key === 'Escape') closeModal();
  else if (e.key === 'Escape' && !menu.hidden) { toggleMenu(false); burger.focus(); }
});

// ------------------------------------------------------------------ enquiry form
initEnquiry({ data, demo, basket, toast, scrollTo: scrollToTarget });

// Content is rendered by script, so re-apply a #section link from the address bar once it exists.
if (location.hash.length > 1) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
