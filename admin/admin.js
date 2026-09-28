// =====================================================================
// Shreeyog Pharma Equipments — admin panel (vanilla ES module SPA)
// =====================================================================
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = !!v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c);
  return node;
}
function icon(name, cls = 'ic') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// ------------------------------------------------------------------ API
const API = '../api/admin';
class ApiError extends Error {}
// Static preview (GitHub Pages): the API runs in this browser instead of on a server.
const demo = document.querySelector('meta[name="spe-demo"]')
  ? await import('../js/demo-store.js').then((m) => m.createDemoStore({ seedUrl: '../demo-data.json' }))
  : null;
async function api(path, { method = 'GET', body, form } = {}) {
  if (demo) {
    try { return await demo.request(method, path, { body, form }); }
    catch (err) {
      if (err.status === 401 && path !== '/login' && path !== '/me') { showLogin('Your session has ended. Please sign in again.'); throw new ApiError('Signed out'); }
      throw new ApiError(err.message);
    }
  }
  const opts = { method, headers: { 'x-requested-with': 'spe-admin' }, credentials: 'same-origin' };
  if (form) opts.body = form;
  else if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(`${API}${path}`, opts); } catch { throw new ApiError('Cannot reach the server. Check your connection.'); }
  const isJSON = res.headers.get('content-type')?.includes('json');
  const data = isJSON ? await res.json() : await res.text();
  if (res.status === 401 && path !== '/login' && path !== '/me') { showLogin('Your session has ended. Please sign in again.'); throw new ApiError('Signed out'); }
  if (!res.ok) throw new ApiError(data?.error || 'Something went wrong.');
  return data;
}

// ------------------------------------------------------------------ formatting
const TZ = 'Asia/Kolkata';
const fmtDate = (iso) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso));
const fmtDateTime = (iso) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
const fmtDay = (ymd) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));
const fmtDayLong = (ymd) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));
const fmtNum = (n) => new Intl.NumberFormat('en-IN').format(n);
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
}
const STATUS = { new: 'New', contacted: 'Contacted', site_visit: 'Site visit', quoted: 'Quoted', won: 'Won', lost: 'Lost', spam: 'Spam' };
const badge = (s) => h('span', { class: `badge badge--${s}`, text: STATUS[s] || s });
const prio = (p) => (p === 'normal' ? null : h('span', { class: `prio prio--${p}`, text: p === 'high' ? '▲ High' : '▼ Low' }));
const phoneForWa = (phone) => { let d = String(phone || '').replace(/\D/g, ''); if (d.length === 10) d = `91${d}`; return d; };

// ------------------------------------------------------------------ toasts & dialogs
function toast(msg, type = 'ok') {
  const t = h('div', { class: `toast${type === 'error' ? ' toast--error' : ''}` }, icon(type === 'error' ? 'alert' : 'check'), h('span', { text: msg }));
  $('#toasts').append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
}

function openModal({ title, body, footer = [], small = false, onClose }) {
  const errorEl = h('p', { class: 'modal__error', role: 'alert', hidden: true });
  const close = () => { root.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const root = h('div', { class: 'modal' },
    h('div', { class: 'modal__bg', onclick: close }),
    h('div', { class: `modal__card${small ? ' modal__card--sm' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal__head' }, h('h3', { text: title }), h('button', { class: 'btn btn--ghost btn--icon', type: 'button', 'aria-label': 'Close', onclick: close }, icon('close'))),
      h('div', { class: 'modal__body' }, body, errorEl),
      footer.length ? h('div', { class: 'modal__foot' }, ...footer) : null));
  $('#modal-root').append(root);
  document.addEventListener('keydown', onKey);
  setTimeout(() => $('input, textarea, select, button.btn--primary', root)?.focus(), 30);
  return { close, root, showError: (m) => { errorEl.textContent = m; errorEl.hidden = !m; } };
}

function confirmDialog({ title, text, confirmText = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); m.close(); } };
    const m = openModal({
      title, small: true,
      body: h('p', { text }),
      footer: [
        h('button', { class: 'btn', type: 'button', onclick: () => finish(false) }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, type: 'button', onclick: () => finish(true) }, confirmText),
      ],
      onClose: () => { if (!done) { done = true; resolve(false); } },
    });
  });
}

async function withBusy(btn, fn) {
  btn?.classList.add('is-busy');
  try { return await fn(); } finally { btn?.classList.remove('is-busy'); }
}

// ------------------------------------------------------------------ app state, auth
const state = { me: null, dirty: false, lastNew: null };

function showLogin(message) {
  state.me = null;
  $('#app').hidden = true;
  $('#login').hidden = false;
  const err = $('#login-error');
  err.textContent = message || '';
  err.hidden = !message;
  $('#login-form [name="username"]').focus();
}

function showApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  renderUser();
  route();
  pollNew();
}

function renderUser() {
  const me = state.me;
  const initials = (me.name || me.username).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  $('#user-chip').replaceChildren(h('span', { class: 'avatar', text: initials }), h('div', {}, h('strong', { text: me.name || me.username }), h('small', { text: `@${me.username}` })));
  $('#pw-banner').hidden = !me.mustChange;
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const btn = $('button[type="submit"]', f);
  $('#login-error').hidden = true;
  try {
    const { admin } = await withBusy(btn, () => api('/login', { method: 'POST', body: { username: f.username.value, password: f.password.value } }));
    state.me = admin;
    f.password.value = '';
    showApp();
  } catch (err) {
    $('#login-error').textContent = err.message;
    $('#login-error').hidden = false;
  }
});
$('.pw__toggle').addEventListener('click', (e) => {
  const input = e.currentTarget.previousElementSibling;
  input.type = input.type === 'password' ? 'text' : 'password';
  e.currentTarget.replaceChildren(icon(input.type === 'password' ? 'eye' : 'eye-off'));
});
$('#logout').addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); } catch { /* ignore */ }
  location.hash = '#/';
  showLogin();
});
$('#menu').addEventListener('click', () => $('#app').classList.add('menu-open'));
if (demo) {
  $('#login-form .muted').textContent = 'Preview version — sign in with demo / demo1234. Changes are saved only in this browser.';
  // exports are generated in the browser in the preview
  document.addEventListener('click', (e) => {
    const a = e.target.closest(`a[href^="${API}"]`);
    if (!a) return;
    e.preventDefault();
    try { demo.download(a.getAttribute('href').slice(API.length)); } catch (err) { toast(err.message, 'error'); }
  });
}
$('#scrim').addEventListener('click', () => $('#app').classList.remove('menu-open'));

// New-enquiry badge + notification (polls once a minute)
let pollTimer;
async function pollNew() {
  clearTimeout(pollTimer);
  try {
    const { counts } = await api('/enquiries?per=5&status=new');
    const n = counts.new || 0;
    const b = $('#new-badge');
    b.textContent = n;
    b.hidden = n === 0;
    document.title = `${n ? `(${n}) ` : ''}Admin · Shreeyog Pharma Equipments`;
    if (state.lastNew !== null && n > state.lastNew) toast(`${n - state.lastNew} new enquir${n - state.lastNew > 1 ? 'ies' : 'y'} received`);
    state.lastNew = n;
  } catch { /* offline or signed out */ }
  if (state.me) pollTimer = setTimeout(pollNew, 60000);
}

// ------------------------------------------------------------------ router
const view = $('#view');
function setPage(title, crumb = '', actions = []) {
  $('#page-title').textContent = title;
  $('#crumb').textContent = crumb;
  $('#page-actions').replaceChildren(...actions);
  document.querySelector('.top h1').title = title;
}
const ROUTES = [
  [/^#?\/?$/, () => dashboardView(), 'dashboard'],
  [/^#\/enquiries\/(\d+)$/, (m) => enquiryDetailView(Number(m[1])), 'enquiries'],
  [/^#\/enquiries(?:\?(.*))?$/, (m) => enquiryListView(new URLSearchParams(m[1] || '')), 'enquiries'],
  [/^#\/(products|clients|gallery)$/, (m) => catalogView(m[1]), null],
  [/^#\/content(?:\/(\w+))?$/, (m) => contentView(m[1]), 'content'],
  [/^#\/settings$/, () => settingsView(), 'settings'],
];
let currentHash = location.hash;
let skipHash = false;

async function route() {
  const hash = location.hash || '#/';
  const match = ROUTES.map(([re, fn, nav]) => [hash.match(re), fn, nav]).find(([m]) => m);
  const [m, fn, nav] = match || [[], () => notFound(), null];
  const navKey = nav || m[1];
  $$('.side__nav a').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === navKey));
  $('#app').classList.remove('menu-open');
  view.replaceChildren(h('div', { class: 'loading' }));
  window.scrollTo(0, 0);
  try { await fn(m); }
  catch (err) {
    if (err.message === 'Signed out') return;
    view.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'empty' }, icon('alert'), h('strong', { text: 'Could not load this page' }), h('span', { text: err.message }),
      h('button', { class: 'btn', type: 'button', onclick: route }, 'Try again'))));
  }
}
function notFound() {
  setPage('Not found');
  view.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'empty' }, h('strong', { text: 'This page does not exist.' }), h('a', { href: '#/', class: 'btn' }, 'Go to dashboard'))));
}
window.addEventListener('hashchange', () => {
  if (skipHash) { skipHash = false; return; }
  if (state.dirty && !window.confirm('You have unsaved changes. Leave this page without saving?')) {
    skipHash = true;
    location.hash = currentHash;
    return;
  }
  state.dirty = false;
  currentHash = location.hash;
  if (state.me) route();
});
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

// ------------------------------------------------------------------ charts
function niceStep(v) {
  if (v <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
function barPath(x, y, w, hgt, r) {
  const rr = Math.min(r, w / 2, hgt);
  return `M${x},${y + hgt}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + hgt}Z`;
}

/** Single-series column chart (enquiries per day) with hover/focus tooltip. */
function columnChart(days) {
  const wrap = h('div', { class: 'chart' });
  const tip = h('div', { class: 'tip', hidden: true });
  wrap.append(tip);
  let svg;
  const draw = () => {
    const W = Math.max(300, Math.round(wrap.clientWidth || 640));
    const H = 230;
    const m = { l: 34, r: 6, t: 22, b: 28 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const max = Math.max(0, ...days.map((d) => d.count));
    const step = niceStep(Math.max(1, max) / 4);
    const top = Math.max(step * 4, Math.ceil(max / step) * step);
    const y = (v) => m.t + ph - (v / top) * ph;
    const band = pw / days.length;
    const bw = Math.max(2, Math.min(24, band - 2));
    svg?.remove();
    svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Enquiries per day for the last ${days.length} days. Peak ${max}.` });
    for (let v = 0; v <= top; v += step) {
      svg.append(svgEl('line', { class: 'grid-line', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      const t = svgEl('text', { class: 'axis-text', x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' });
      t.textContent = fmtNum(v);
      svg.append(t);
    }
    const labelEvery = Math.ceil(days.length / Math.max(2, Math.floor(pw / 70)));
    let peakDone = false;
    days.forEach((d, i) => {
      const x = m.l + i * band + (band - bw) / 2;
      const bh = (d.count / top) * ph;
      let bar = null;
      if (d.count > 0) {
        bar = svgEl('path', { class: 'bar', d: barPath(x, y(d.count), bw, bh, 4) });
        svg.append(bar);
      }
      if (d.count === max && max > 0 && !peakDone) {
        peakDone = true;
        const cap = svgEl('text', { class: 'cap-label', x: x + bw / 2, y: y(d.count) - 6 });
        cap.textContent = d.count;
        svg.append(cap);
      }
      if ((days.length - 1 - i) % labelEvery === 0) {
        const t = svgEl('text', { class: 'axis-text', x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' });
        t.textContent = fmtDay(d.date);
        svg.append(t);
      }
      const hit = svgEl('rect', { class: 'hit', x: m.l + i * band, y: m.t, width: band, height: ph, tabindex: 0, 'aria-label': `${fmtDayLong(d.date)}: ${d.count} enquir${d.count === 1 ? 'y' : 'ies'}` });
      const show = () => {
        wrap.classList.add('is-hovering');
        bar?.classList.add('is-on');
        tip.replaceChildren(h('strong', { text: `${d.count} enquir${d.count === 1 ? 'y' : 'ies'}` }), ` · ${fmtDayLong(d.date)}`);
        tip.hidden = false;
        const half = tip.offsetWidth / 2;
        tip.style.left = `${Math.min(W - half, Math.max(half, x + bw / 2))}px`;
        tip.style.top = `${y(d.count)}px`;
      };
      const hide = () => { wrap.classList.remove('is-hovering'); bar?.classList.remove('is-on'); tip.hidden = true; };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('focus', show);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('blur', hide);
      svg.append(hit);
    });
    wrap.prepend(svg);
  };
  let raf;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(wrap);
  return wrap;
}

function dayTable(days) {
  return h('div', { class: 'table-scroll' }, h('table', { class: 'mini-table' },
    h('thead', {}, h('tr', {}, h('th', { text: 'Date' }), h('th', { text: 'Enquiries' }))),
    h('tbody', {}, [...days].reverse().map((d) => h('tr', {}, h('td', { text: fmtDayLong(d.date) }), h('td', { text: d.count }))))));
}

/** Ranked single-series horizontal bars; the value sits at each bar's tip. */
function hbars(rows, emptyText) {
  if (!rows.length) return h('p', { class: 'muted', text: emptyText });
  const max = Math.max(...rows.map((r) => r.count));
  return h('div', { class: 'hbars' }, rows.map((r) => h('div', { class: 'hbar', title: `${r.label}: ${r.count}` },
    h('span', { class: 'hbar__label', text: r.label }),
    h('span', { class: 'hbar__track' }, h('span', { class: 'hbar__bar', style: `width:${Math.max(2, (r.count / max) * 100)}%` })),
    h('span', { class: 'hbar__val', text: fmtNum(r.count) }))));
}

// ------------------------------------------------------------------ dashboard
async function dashboardView() {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: TZ }).format(new Date()));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  setPage('Dashboard', `${greet}, ${state.me.name || state.me.username}`, [
    h('a', { class: 'btn', href: '#/enquiries' }, icon('inbox'), h('span', { text: 'All enquiries' })),
  ]);
  const s = await api('/stats');
  const won = s.byStatus.won, lost = s.byStatus.lost;
  const winRate = won + lost ? `${Math.round((won / (won + lost)) * 100)}% win rate on closed enquiries` : 'No closed enquiries yet';

  const stat = (label, value, sub, cls = '') => h('div', { class: `card stat ${cls}` },
    h('span', { class: 'stat__label', text: label }), h('span', { class: 'stat__value', text: value }), sub ? h('span', { class: 'stat__sub', text: sub }) : null);

  const chartBody = h('div', { class: 'card__body' });
  let mode = 'chart';
  const renderChart = () => chartBody.replaceChildren(mode === 'chart' ? columnChart(s.days) : dayTable(s.days));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'View as' },
    h('button', { type: 'button', class: 'is-on', onclick: (e) => { mode = 'chart'; setSeg(e); } }, icon('chart'), 'Chart'),
    h('button', { type: 'button', onclick: (e) => { mode = 'table'; setSeg(e); } }, icon('table'), 'Table'));
  function setSeg(e) { $$('button', seg).forEach((b) => b.classList.toggle('is-on', b === e.currentTarget)); renderChart(); }
  renderChart();

  const recent = s.recent.length
    ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', {}, s.recent.map((e) => h('tr', { class: e.status === 'new' ? 'is-new' : null, onclick: () => { location.hash = `#/enquiries/${e.id}`; } },
      h('td', {}, h('div', { class: 'cell-main', text: e.name }), h('div', { class: 'cell-sub', text: e.company || '—' })),
      h('td', {}, h('div', { class: 'chips' }, e.services.slice(0, 2).map((x) => h('span', { class: 'chip', text: x })), e.services.length > 2 ? h('span', { class: 'chip', text: `+${e.services.length - 2}` }) : null)),
      h('td', {}, badge(e.status)),
      h('td', { class: 'cell-sub', text: timeAgo(e.created_at) }))))))
    : h('div', { class: 'empty' }, icon('inbox'), h('strong', { text: 'No enquiries yet' }), h('span', { text: 'Enquiries sent from the website form will appear here.' }));

  view.replaceChildren(h('div', { class: 'stack' },
    h('div', { class: 'grid grid--stats' },
      stat('Open enquiries', fmtNum(s.open), `${s.byStatus.new} new, awaiting a reply`, 'stat--hero'),
      stat('Received in last 7 days', fmtNum(s.last7), `${fmtNum(s.last30)} in the last 30 days`),
      stat('Total enquiries', fmtNum(s.total), `${fmtNum(s.byStatus.spam)} marked as spam`),
      stat('Won', fmtNum(won), winRate)),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('div', {}, h('h2', { text: 'Enquiries received' }), h('p', { text: 'Per day, last 30 days (India time)' })), seg),
      chartBody),
    h('div', { class: 'grid grid--2' },
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('div', {}, h('h2', { text: 'Services requested' }), h('p', { text: 'Times each service was selected' }))),
        h('div', { class: 'card__body' }, hbars(s.services, 'No data yet.'))),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('div', {}, h('h2', { text: 'Enquiries by industry' }), h('p', { text: 'Excluding spam' }))),
        h('div', { class: 'card__body' }, hbars(s.industries, 'No data yet.')))),
    h('div', { class: 'grid grid--main' },
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Latest enquiries' }), h('a', { class: 'btn btn--sm', href: '#/enquiries' }, 'View all')), recent),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Website catalogue' })),
        h('div', { class: 'card__body stack' },
          ...[['products', 'Products', 'box', s.catalog.products], ['clients', 'Client logos', 'users', s.catalog.clients], ['gallery', 'Project photos', 'image', s.catalog.gallery]].map(([k, label, ic, n]) =>
            h('a', { class: 'file', href: `#/${k}` }, icon(ic), h('span', { text: label }), h('small', { text: `${n} items` }))),
          h('a', { class: 'file', href: '#/content' }, icon('edit'), h('span', { text: 'Edit website text & images' }), h('small', { text: 'Site content' })))))));
}

// ------------------------------------------------------------------ enquiries: list
const STATUS_TABS = [['', 'All'], ['open', 'Open'], ['new', 'New'], ['contacted', 'Contacted'], ['site_visit', 'Site visit'], ['quoted', 'Quoted'], ['won', 'Won'], ['lost', 'Lost'], ['spam', 'Spam']];

async function enquiryListView(params) {
  const q = { status: params.get('status') || '', q: params.get('q') || '', from: params.get('from') || '', to: params.get('to') || '', page: Number(params.get('page')) || 1 };
  const exportBtn = h('a', { class: 'btn', href: '#' }, icon('download'), h('span', { text: 'Export CSV' }));
  setPage('Enquiries', 'Everything sent through the website form', [exportBtn]);

  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search name, company, phone, ref…', value: q.q, 'aria-label': 'Search enquiries' });
  const from = h('input', { type: 'date', value: q.from, 'aria-label': 'From date' });
  const to = h('input', { type: 'date', value: q.to, 'aria-label': 'To date' });
  const card = h('section', { class: 'card' });
  view.replaceChildren(
    h('div', { class: 'toolbar' }, tabs),
    h('div', { class: 'toolbar' },
      h('label', { class: 'search' }, icon('search'), search),
      h('div', { class: 'date-range' }, h('span', { text: 'From' }), from, h('span', { text: 'to' }), to),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => { search.value = ''; from.value = ''; to.value = ''; q.q = q.from = q.to = ''; q.page = 1; load(); } }, 'Clear filters')),
    card);

  const qs = (extra = {}) => {
    const p = new URLSearchParams();
    const all = { ...q, ...extra };
    for (const [k, v] of Object.entries(all)) if (v && !(k === 'page' && v === 1)) p.set(k, v);
    return p.toString();
  };

  async function load() {
    card.classList.add('is-stale');
    history.replaceState(null, '', `#/enquiries${qs() ? `?${qs()}` : ''}`);
    currentHash = location.hash;
    const apiQs = new URLSearchParams(qs());
    apiQs.set('per', '20');
    if (!q.status) apiQs.set('status', '');
    const data = await api(`/enquiries?${apiQs}`);
    exportBtn.href = `${API}/enquiries.csv?${new URLSearchParams(qs({ page: 1 }))}`;
    const c = data.counts;
    const allCount = Object.entries(c).filter(([k]) => k !== 'spam').reduce((a, [, v]) => a + v, 0);
    const openCount = c.new + c.contacted + c.site_visit + c.quoted;
    tabs.replaceChildren(...STATUS_TABS.map(([key, label]) => h('button', {
      type: 'button', role: 'tab', class: q.status === key ? 'is-on' : null, 'aria-selected': String(q.status === key),
      onclick: () => { q.status = key; q.page = 1; load(); },
    }, label, h('em', { text: key === '' ? allCount : key === 'open' ? openCount : c[key] ?? 0 }))));

    const pages = Math.max(1, Math.ceil(data.total / data.per));
    card.classList.remove('is-stale');
    if (!data.items.length) {
      card.replaceChildren(h('div', { class: 'empty' }, icon('inbox'), h('strong', { text: q.q || q.from || q.to || q.status ? 'No enquiries match these filters' : 'No enquiries yet' }),
        h('span', { text: q.q || q.from || q.to || q.status ? 'Try a different status or clear the filters.' : 'When someone submits the website form, it will show up here.' })));
      return;
    }
    card.replaceChildren(
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, ['Received', 'Contact', 'Requirement', 'Phone', 'Timeline', 'Status'].map((t) => h('th', { text: t })))),
        h('tbody', {}, data.items.map((e) => h('tr', { class: e.status === 'new' ? 'is-new' : null, tabindex: 0,
          onclick: () => { location.hash = `#/enquiries/${e.id}`; },
          onkeydown: (ev) => { if (ev.key === 'Enter') location.hash = `#/enquiries/${e.id}`; } },
          h('td', {}, h('div', { class: 'cell-main mono', text: e.ref }), h('div', { class: 'cell-sub', text: fmtDateTime(e.created_at) })),
          h('td', {}, h('div', { class: 'cell-main', text: e.name }), h('div', { class: 'cell-sub', text: [e.company, e.city].filter(Boolean).join(' · ') || '—' })),
          h('td', {}, h('div', { class: 'chips' },
            e.services.slice(0, 2).map((x) => h('span', { class: 'chip', text: x })),
            e.services.length > 2 ? h('span', { class: 'chip', text: `+${e.services.length - 2} more` }) : null,
            e.products.length ? h('span', { class: 'chip', text: `${e.products.length} product${e.products.length > 1 ? 's' : ''}` }) : null,
            e.attachments.length ? h('span', { class: 'chip', title: 'Has attachments' }, icon('clip')) : null)),
          h('td', { class: 'num', text: e.phone }),
          h('td', { class: 'cell-sub', text: e.timeline || '—' }),
          h('td', {}, h('div', { class: 'chips' }, badge(e.status), prio(e.priority)))))))),
      h('div', { class: 'pager' },
        h('span', { text: `${fmtNum(data.total)} enquir${data.total === 1 ? 'y' : 'ies'} · page ${data.page} of ${pages}` }),
        h('div', {},
          h('button', { class: 'btn btn--sm', type: 'button', disabled: data.page <= 1, onclick: () => { q.page -= 1; load(); } }, icon('left'), 'Previous'),
          h('button', { class: 'btn btn--sm', type: 'button', disabled: data.page >= pages, onclick: () => { q.page += 1; load(); } }, 'Next', icon('right')))));
  }

  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q.q = search.value.trim(); q.page = 1; load(); }, 300); });
  from.addEventListener('change', () => { q.from = from.value; q.page = 1; load(); });
  to.addEventListener('change', () => { q.to = to.value; q.page = 1; load(); });
  await load();
}

// ------------------------------------------------------------------ enquiries: detail
async function enquiryDetailView(id) {
  let { enquiry: e, activity, siblings } = await api(`/enquiries/${id}`);
  setPage(e.ref, `Enquiry received ${fmtDateTime(e.created_at)}`, [
    h('a', { class: 'btn btn--icon', href: siblings.prev ? `#/enquiries/${siblings.prev}` : '#/enquiries', title: 'Newer enquiry', 'aria-label': 'Newer enquiry', disabled: !siblings.prev }, icon('left')),
    h('a', { class: 'btn btn--icon', href: siblings.next ? `#/enquiries/${siblings.next}` : '#/enquiries', title: 'Older enquiry', 'aria-label': 'Older enquiry', disabled: !siblings.next }, icon('right')),
  ]);

  const kv = (rows) => h('dl', { class: 'kv' }, rows.filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length)).flatMap(([k, v]) => [h('dt', { text: k }), h('dd', {}, v)]));
  const chips = (list) => h('div', { class: 'chips' }, list.map((x) => h('span', { class: 'chip', text: x })));
  const waText = encodeURIComponent(`Hello ${e.name}, this is Shreeyog Pharma Equipments regarding your enquiry ${e.ref}.`);

  const timeline = h('div', { class: 'timeline' });
  const renderTimeline = () => timeline.replaceChildren(...activity.map((a) => h('div', { class: `tl tl--${a.kind}` },
    h('div', { class: 'tl__meta', text: `${a.author || 'System'} · ${fmtDateTime(a.created_at)}` }),
    h('div', { class: 'tl__body', text: a.body }))));
  renderTimeline();

  const headChips = h('div', { class: 'chips', style: 'margin-left:auto' });
  const renderHeadChips = () => headChips.replaceChildren(badge(e.status), prio(e.priority) || '');
  renderHeadChips();
  const statusPick = h('div', { class: 'status-pick' });
  const renderStatus = () => statusPick.replaceChildren(...Object.entries(STATUS).map(([k, label]) => h('button', {
    type: 'button', class: e.status === k ? 'is-on' : null, 'aria-pressed': String(e.status === k),
    onclick: async (ev) => {
      if (e.status === k) return;
      try {
        const r = await withBusy(ev.currentTarget, () => api(`/enquiries/${e.id}`, { method: 'PATCH', body: { status: k } }));
        e = r.enquiry; activity = r.activity;
        renderStatus(); renderTimeline(); renderHeadChips(); pollNew();
        toast(`Marked as ${label}`);
      } catch (err) { toast(err.message, 'error'); }
    },
  }, h('span', { class: `badge badge--${k}`, style: 'background:none;padding:0;height:auto' }), label)));
  renderStatus();

  const prioSeg = h('div', { class: 'seg' });
  const renderPrio = () => prioSeg.replaceChildren(...['low', 'normal', 'high'].map((p) => h('button', {
    type: 'button', class: e.priority === p ? 'is-on' : null,
    onclick: async () => {
      try {
        const r = await api(`/enquiries/${e.id}`, { method: 'PATCH', body: { priority: p } });
        e = r.enquiry; activity = r.activity; renderPrio(); renderTimeline(); renderHeadChips();
      } catch (err) { toast(err.message, 'error'); }
    },
  }, p[0].toUpperCase() + p.slice(1))));
  renderPrio();

  const note = h('textarea', { class: 'input', rows: 3, placeholder: 'Add an internal note (e.g. “Called, site visit fixed for Monday”)' });
  const addNote = h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: async (ev) => {
    if (!note.value.trim()) { note.focus(); return; }
    try {
      const r = await withBusy(ev.currentTarget, () => api(`/enquiries/${e.id}/notes`, { method: 'POST', body: { body: note.value } }));
      activity = r.activity; note.value = ''; renderTimeline(); toast('Note added');
    } catch (err) { toast(err.message, 'error'); }
  } }, icon('note'), 'Add note');

  const del = h('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
    if (!(await confirmDialog({ title: 'Delete this enquiry?', text: `${e.ref} from ${e.name} and its attachments will be permanently deleted.` }))) return;
    try { await api(`/enquiries/${e.id}`, { method: 'DELETE' }); toast('Enquiry deleted'); pollNew(); location.hash = '#/enquiries'; }
    catch (err) { toast(err.message, 'error'); }
  } }, icon('trash'), 'Delete enquiry');

  view.replaceChildren(h('div', { class: 'grid grid--main' },
    h('div', { class: 'stack' },
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('div', {}, h('h2', { text: e.name }), h('p', { text: [e.designation, e.company].filter(Boolean).join(', ') || 'Contact details' })), headChips),
        h('div', { class: 'card__body' }, kv([
          ['Email', h('a', { href: `mailto:${e.email}`, text: e.email })],
          ['Phone', h('a', { href: `tel:${e.phone.replace(/[^\d+]/g, '')}`, text: e.phone })],
          ['Company', e.company], ['Designation', e.designation],
          ['Location', [e.city, e.state].filter(Boolean).join(', ')], ['Industry', e.industry],
        ]))),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h2', { text: 'Requirement' })),
        h('div', { class: 'card__body' }, kv([
          ['Services', e.services.length ? chips(e.services) : ''], ['Products', e.products.length ? chips(e.products) : ''],
          ['Type', e.requirement_type], ['Material', e.material], ['Quantity / scope', e.quantity], ['Area', e.area],
          ['Timeline', e.timeline], ['Budget', e.budget],
          ['Site visit', e.site_visit ? `Requested${e.site_location ? ` — ${e.site_location}` : ''}` : 'Not requested'],
          ['Preferred contact', [e.contact_method, e.contact_time].filter(Boolean).join(' · ')], ['Heard about us via', e.source],
        ]))),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h2', { text: 'Message' })),
        h('div', { class: 'card__body stack' },
          e.message ? h('div', { class: 'message', text: e.message }) : h('p', { class: 'muted', text: 'No message.' }),
          e.attachments.length ? h('div', { class: 'files' }, e.attachments.map((f) => h('a', { class: 'file', href: `${API}/enquiries/${e.id}/files/${encodeURIComponent(f.stored)}` },
            icon('file'), h('span', { text: f.name }), h('small', { text: fmtSize(f.size) }), icon('download')))) : null)),
      h('p', { class: 'muted', style: 'font-size:12.5px', text: `Submitted from IP ${e.ip || 'unknown'} · ${e.user_agent ? e.user_agent.slice(0, 90) : ''}` })),
    h('div', { class: 'stack' },
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Reply' })),
        h('div', { class: 'card__body' }, h('div', { class: 'quick' },
          h('a', { href: `tel:${e.phone.replace(/[^\d+]/g, '')}` }, icon('phone'), 'Call'),
          h('a', { href: `https://wa.me/${phoneForWa(e.phone)}?text=${waText}`, target: '_blank', rel: 'noopener' }, icon('whatsapp'), 'WhatsApp'),
          h('a', { href: `mailto:${e.email}?subject=${encodeURIComponent(`Your enquiry ${e.ref} – Shreeyog Pharma Equipments`)}` }, icon('mail'), 'Email')))),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Status' }), prioSeg), h('div', { class: 'card__body' }, statusPick)),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Notes & activity' })),
        h('div', { class: 'card__body stack' }, h('div', { class: 'stack', style: 'gap:8px' }, note, h('div', {}, addNote)), timeline)),
      h('div', {}, del))));
}

// ------------------------------------------------------------------ catalogue managers
const CATALOG = {
  products: {
    title: 'Products', singular: 'product', imageKey: 'image', nameKey: 'name', filterKey: 'category',
    sub: (it) => it.category,
    fields: [
      { key: 'name', label: 'Product name', required: true },
      { key: 'category', label: 'Category', required: true, suggest: true },
      { key: 'description', label: 'Short description', type: 'textarea', hint: 'One or two sentences shown on the product card.' },
      { key: 'featured', label: 'Show a “Popular” badge', type: 'bool' },
      { key: 'visible', label: 'Visible on the website', type: 'bool', default: 1 },
    ],
  },
  clients: {
    title: 'Clients', singular: 'client', imageKey: 'logo', nameKey: 'name',
    sub: (it) => it.website || 'Logo shown in “Companies we work with”',
    fields: [
      { key: 'name', label: 'Company name', required: true },
      { key: 'website', label: 'Website (optional)', placeholder: 'https://…' },
      { key: 'visible', label: 'Visible on the website', type: 'bool', default: 1 },
    ],
  },
  gallery: {
    title: 'Project gallery', singular: 'photo', imageKey: 'image', nameKey: 'title', filterKey: 'category', cover: true,
    sub: (it) => it.category || '',
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'category', label: 'Category', suggest: true, hint: 'Used for the filter buttons, e.g. Epoxy Flooring.' },
      { key: 'caption', label: 'Caption', type: 'textarea' },
      { key: 'visible', label: 'Visible on the website', type: 'bool', default: 1 },
    ],
  },
};

async function catalogView(kind) {
  const cfg = CATALOG[kind];
  let items = (await api(`/${kind}`)).items;
  const filter = { q: '', cat: '' };
  const addBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: () => editItem(null) }, icon('plus'), h('span', { text: `Add ${cfg.singular}` }));
  setPage(cfg.title, `${items.length} items · changes appear on the website immediately`, [addBtn]);

  const search = h('input', { class: 'input', type: 'search', placeholder: `Search ${cfg.title.toLowerCase()}…`, 'aria-label': 'Search' });
  const catSelect = cfg.filterKey ? h('select', { class: 'input', style: 'width:auto', 'aria-label': 'Filter by category' }) : null;
  const grid = h('div', { class: 'items' });
  const note = h('p', { class: 'hint', text: '' });
  view.replaceChildren(h('div', { class: 'toolbar' }, h('label', { class: 'search' }, icon('search'), search), catSelect, h('span', { class: 'spacer' }), note), grid);

  const categories = () => [...new Set(items.map((it) => it[cfg.filterKey]).filter(Boolean))];
  function renderCats() {
    if (!catSelect) return;
    catSelect.replaceChildren(h('option', { value: '', text: 'All categories' }), ...categories().map((c) => h('option', { value: c, text: c, selected: filter.cat === c })));
  }

  async function reorder(id, dir) {
    const i = items.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    render();
    try { await api(`/${kind}/reorder`, { method: 'POST', body: { ids: items.map((x) => x.id) } }); }
    catch (err) { toast(err.message, 'error'); }
  }

  function render() {
    const q = filter.q.toLowerCase();
    const list = items.filter((it) => (!filter.cat || it[cfg.filterKey] === filter.cat) && (!q || JSON.stringify([it[cfg.nameKey], cfg.sub(it)]).toLowerCase().includes(q)));
    const filtered = list.length !== items.length;
    note.textContent = filtered ? 'Clear the search/filter to change the order.' : 'Use the arrows to change the order on the website.';
    $('#crumb').textContent = `${items.length} items · changes appear on the website immediately`;
    if (!list.length) {
      grid.replaceChildren(h('div', { class: 'card empty', style: 'grid-column:1/-1' }, icon(kind === 'clients' ? 'users' : kind === 'gallery' ? 'image' : 'box'), h('strong', { text: items.length ? 'Nothing matches your search' : `No ${cfg.title.toLowerCase()} yet` }),
        items.length ? null : h('button', { class: 'btn btn--primary', type: 'button', onclick: () => editItem(null) }, icon('plus'), `Add ${cfg.singular}`)));
      return;
    }
    grid.replaceChildren(...list.map((it) => {
      const idx = items.indexOf(it);
      const vis = h('input', { type: 'checkbox', checked: !!it.visible, onchange: async (e) => {
        try {
          const r = await api(`/${kind}/${it.id}`, { method: 'PATCH', body: { visible: e.target.checked } });
          Object.assign(it, r.item); render();
          toast(r.item.visible ? 'Now visible on the website' : 'Hidden from the website');
        } catch (err) { toast(err.message, 'error'); e.target.checked = !e.target.checked; }
      } });
      const img = it[cfg.imageKey];
      return h('article', { class: `item${it.visible ? '' : ' is-hidden-item'}` },
        h('div', { class: `item__img${cfg.cover ? ' item__img--cover' : ''}` },
          img ? h('img', { src: img, alt: '', loading: 'lazy' }) : h('span', { class: 'noimg' }, icon('image')),
          h('div', { class: 'item__flag' }, it.featured ? h('span', { class: 'chip', style: 'background:#0d1b2c;color:#fff' }, 'Popular') : null, it.visible ? null : h('span', { class: 'chip' }, 'Hidden'))),
        h('div', { class: 'item__body' }, h('strong', { text: it[cfg.nameKey] }), h('small', { text: cfg.sub(it) })),
        h('div', { class: 'item__foot' },
          h('label', { class: 'switch', title: 'Show on website' }, vis, h('span', { class: 'switch__ui' }), 'Visible'),
          h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'aria-label': 'Move earlier', title: 'Move earlier', disabled: filtered || idx === 0, onclick: () => reorder(it.id, -1) }, icon('up')),
          h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'aria-label': 'Move later', title: 'Move later', disabled: filtered || idx === items.length - 1, onclick: () => reorder(it.id, 1) }, icon('down')),
          h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'aria-label': 'Edit', title: 'Edit', onclick: () => editItem(it) }, icon('edit')),
          h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'aria-label': 'Delete', title: 'Delete', onclick: () => removeItem(it) }, icon('trash'))));
    }));
  }

  async function removeItem(it) {
    if (!(await confirmDialog({ title: `Delete this ${cfg.singular}?`, text: `“${it[cfg.nameKey]}” will be removed from the website. This cannot be undone. (Tip: you can hide it instead.)` }))) return;
    try {
      await api(`/${kind}/${it.id}`, { method: 'DELETE' });
      items = items.filter((x) => x.id !== it.id);
      renderCats(); render(); toast('Deleted');
    } catch (err) { toast(err.message, 'error'); }
  }

  function editItem(it) {
    const isNew = !it;
    let file = null;
    let removeImage = false;
    const preview = h('div', { class: 'dropzone__preview' });
    const setPreview = (src) => preview.replaceChildren(src ? h('img', { src, alt: '' }) : icon('image'));
    setPreview(it?.[cfg.imageKey]);
    const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', 'aria-label': 'Choose image' });
    const drop = h('label', { class: 'dropzone' }, fileInput, preview,
      h('div', {}, h('p', {}, h('strong', { text: 'Click or drop an image' })), h('small', { text: kind === 'clients' ? 'Logo on a white background works best (PNG/JPG/WEBP, up to 6 MB).' : 'JPG, PNG or WEBP, up to 6 MB. Landscape images look best.' })));
    const pick = (f) => {
      if (!f) return;
      if (!f.type.startsWith('image/')) { m.showError('Please choose an image file.'); return; }
      if (f.size > 6 * 1024 * 1024) { m.showError('Image must be 6 MB or smaller.'); return; }
      m.showError('');
      file = f; removeImage = false;
      setPreview(URL.createObjectURL(f));
    };
    fileInput.addEventListener('change', () => pick(fileInput.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => pick(e.dataTransfer.files[0]));

    const listId = `dl-${kind}`;
    const inputs = {};
    const fields = cfg.fields.map((f) => {
      const val = it ? it[f.key] : f.default ?? '';
      if (f.type === 'bool') {
        inputs[f.key] = h('input', { type: 'checkbox', checked: !!val });
        return h('label', { class: 'switch' }, inputs[f.key], h('span', { class: 'switch__ui' }), f.label);
      }
      inputs[f.key] = f.type === 'textarea'
        ? h('textarea', { rows: 3, value: val ?? '' })
        : h('input', { value: val ?? '', required: f.required, placeholder: f.placeholder || '', list: f.suggest ? listId : null });
      return h('label', { class: 'fld' }, h('span', { text: `${f.label}${f.required ? ' *' : ''}` }), inputs[f.key], f.hint ? h('small', { text: f.hint }) : null);
    });
    const datalist = h('datalist', { id: listId }, ...(cfg.filterKey ? categories() : []).map((c) => h('option', { value: c })));
    const clearImg = it?.[cfg.imageKey] ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => { file = null; removeImage = true; setPreview(''); } }, icon('trash'), 'Remove image') : null;

    const save = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      const missing = cfg.fields.find((f) => f.required && !inputs[f.key].value.trim());
      if (missing) { m.showError(`${missing.label} is required.`); inputs[missing.key].focus(); return; }
      const fd = new FormData();
      for (const f of cfg.fields) fd.append(f.key, f.type === 'bool' ? (inputs[f.key].checked ? '1' : '0') : inputs[f.key].value.trim());
      if (file) fd.append('image', file);
      if (removeImage) fd.append('removeImage', '1');
      try {
        const r = await withBusy(save, () => api(isNew ? `/${kind}` : `/${kind}/${it.id}`, { method: isNew ? 'POST' : 'PUT', form: fd }));
        if (isNew) items.push(r.item); else Object.assign(it, r.item);
        m.close(); renderCats(); render();
        toast(isNew ? `${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} added` : 'Changes saved');
      } catch (err) { m.showError(err.message); }
    } }, isNew ? `Add ${cfg.singular}` : 'Save changes');

    const m = openModal({
      title: isNew ? `Add ${cfg.singular}` : `Edit ${cfg.singular}`,
      body: h('div', { class: 'stack', style: 'gap:14px' }, drop, clearImg, ...fields, datalist),
      footer: [h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'Cancel'), save],
    });
  }

  search.addEventListener('input', () => { filter.q = search.value.trim(); render(); });
  catSelect?.addEventListener('change', () => { filter.cat = catSelect.value; render(); });
  renderCats();
  render();
}

// ------------------------------------------------------------------ site content editor
const T = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
const TA = (key, label, extra = {}) => ({ key, label, type: 'textarea', ...extra });
const ACCENT = 'Wrap words in *asterisks* to highlight them in colour.';
const SERVICE_ICONS = ['fabrication', 'cleanroom', 'passbox', 'tank', 'piping', 'epoxy', 'partition', 'railing'];

const CONTENT_SCHEMA = {
  brand: { label: 'Brand & footer', anchor: 'top', fields: [T('name', 'Company name'), T('short', 'Short name'), T('tagline', 'Tagline (under the logo)'), { key: 'logo', label: 'Logo', type: 'image' }, TA('footerText', 'Footer description', { span: true })] },
  hero: { label: 'Hero (top of page)', anchor: 'top', fields: [T('eyebrow', 'Small label above headline', { span: true }), TA('title', 'Headline', { span: true, hint: ACCENT, rows: 2 }), TA('subtitle', 'Intro text', { span: true }), T('ctaPrimary', 'Main button'), T('ctaSecondary', 'Second button'),
    { key: 'stats', label: 'Figures under the hero', type: 'repeater', item: 'Figure', max: 4, fields: [T('value', 'Value', { hint: 'Numbers count up automatically' }), T('suffix', 'Suffix (e.g. +)'), T('label', 'Label', { span: true })] }] },
  about: { label: 'Company profile', anchor: 'about', fields: [T('eyebrow', 'Small label'), TA('title', 'Heading', { hint: ACCENT, rows: 2 }), TA('statement', 'Highlighted statement', { span: true }), TA('body', 'Paragraph', { span: true, rows: 5 }),
    { key: 'points', label: 'Capability chips', type: 'list', span: true }, { key: 'image', label: 'Main photo', type: 'image' }, { key: 'image2', label: 'Second photo', type: 'image' }] },
  founder: { label: 'Founder', anchor: 'founder', fields: [T('eyebrow', 'Small label'), T('name', 'Name'), T('role', 'Role'), T('years', 'Years of experience (badge)'), { key: 'photo', label: 'Photo', type: 'image', span: true }, TA('bio', 'Biography — paragraph 1', { span: true, rows: 5 }), TA('bio2', 'Biography — paragraph 2', { span: true, rows: 5 }), { key: 'skills', label: 'Skill tags', type: 'list', span: true }] },
  mission: { label: 'Vision & mission', anchor: 'mission', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }), TA('vision', 'Vision', { span: true, rows: 4 }), TA('mission', 'Mission', { span: true, rows: 4 })] },
  showcase: { label: '3D showcase', anchor: 'showcase', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }),
    { key: 'steps', label: 'Steps (shown while the 3D vessel turns)', type: 'repeater', item: 'Step', max: 4, fields: [T('title', 'Title', { span: true }), TA('text', 'Text', { span: true, rows: 2 })] }] },
  services: { label: 'Services', anchor: 'services', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }), TA('subtitle', 'Intro', { span: true, rows: 2 }),
    { key: 'items', label: 'Service cards', type: 'repeater', item: 'Service', fields: [{ key: 'icon', label: 'Icon', type: 'select', options: SERVICE_ICONS }, T('title', 'Title'), TA('text', 'Description', { span: true, rows: 3 })] }] },
  expertise: { label: 'Qualification & experience', anchor: 'expertise', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }),
    { key: 'items', label: 'Points', type: 'repeater', item: 'Point', fields: [T('title', 'Title', { span: true }), TA('text', 'Text', { span: true, rows: 3 })] }] },
  furniture: { label: 'SS furniture features', anchor: 'products', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }),
    { key: 'items', label: 'Features', type: 'repeater', item: 'Feature', fields: [T('title', 'Title', { span: true }), TA('text', 'Text', { span: true, rows: 2 })] }] },
  products: { label: 'Products section', anchor: 'products', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }), TA('subtitle', 'Intro', { span: true, rows: 2, hint: 'Products themselves are managed under Products.' })] },
  projects: { label: 'Epoxy & partition work', anchor: 'projects', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }), TA('body', 'Intro paragraph', { span: true, rows: 4 }), TA('epoxy', 'Epoxy flooring text', { span: true, rows: 3 }), TA('partition', 'Partition work text', { span: true, rows: 3 })] },
  process: { label: 'How we work', anchor: 'process', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }),
    { key: 'steps', label: 'Steps', type: 'repeater', item: 'Step', max: 6, fields: [T('title', 'Title', { span: true }), TA('text', 'Text', { span: true, rows: 2 })] }] },
  clients: { label: 'Clients section', anchor: 'clients', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }), T('note', 'Note under the logos', { span: true, hint: 'Client logos are managed under Clients.' })] },
  enquiry: { label: 'Enquiry form', anchor: 'enquiry', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }), TA('subtitle', 'Intro', { span: true, rows: 2 }), T('successTitle', 'Thank-you heading'), TA('successText', 'Thank-you message', { rows: 2 }),
    { key: 'industries', label: 'Industry options', type: 'list' }, { key: 'requirementTypes', label: 'Requirement type options', type: 'list' },
    { key: 'materials', label: 'Material options', type: 'list' }, { key: 'timelines', label: 'Timeline options', type: 'list' },
    { key: 'budgets', label: 'Budget options', type: 'list' }, { key: 'sources', label: '“How did you hear about us” options', type: 'list' }] },
  contact: { label: 'Contact details', anchor: 'contact', fields: [T('eyebrow', 'Small label'), T('title', 'Heading', { hint: ACCENT }), TA('address', 'Address', { span: true, rows: 2 }), T('phone', 'Phone (display)'), T('whatsapp', 'WhatsApp number', { hint: 'Digits with country code, e.g. 919004509994' }), T('email', 'Email'), T('hours', 'Working hours (optional)'), T('mapQuery', 'Map search text', { span: true, hint: 'What Google Maps should search for.' })] },
  seo: { label: 'Search engines (SEO)', anchor: 'top', fields: [T('title', 'Page title', { span: true, hint: 'Shown in Google results and the browser tab (50–60 characters).' }), TA('description', 'Meta description', { span: true, rows: 3, hint: 'Shown under the title in Google results (140–160 characters).' })] },
};

async function contentView(sectionKey) {
  const { content, defaults } = await api('/content');
  const keys = Object.keys(CONTENT_SCHEMA);
  let key = keys.includes(sectionKey) ? sectionKey : keys[0];
  let draft;
  const navEl = h('nav', { class: 'content-nav', 'aria-label': 'Content sections' });
  const panel = h('section', { class: 'card' });
  setPage('Site content', 'Edit the text and images on the website');
  view.replaceChildren(h('div', { class: 'content-layout' }, navEl, panel));

  const setDirty = (v) => { state.dirty = v; dirtyEl.hidden = !v; saveBtn.disabled = !v; renderNav(); };
  const dirtyEl = h('span', { class: 'dirty', text: 'Unsaved changes', hidden: true });
  const saveBtn = h('button', { class: 'btn btn--primary', type: 'button', disabled: true, onclick: save }, icon('check'), 'Save & publish');
  const resetBtn = h('button', { class: 'btn btn--ghost', type: 'button', onclick: reset }, 'Reset to default');
  const previewBtn = h('a', { class: 'btn', target: '_blank', rel: 'noopener' }, icon('external'), 'View on website');

  function renderNav() {
    navEl.replaceChildren(...keys.map((k) => h('button', { type: 'button', class: k === key ? 'is-on' : null, onclick: () => switchTo(k) }, CONTENT_SCHEMA[k].label, k === key && state.dirty ? h('i', { title: 'Unsaved changes' }) : null)));
  }
  function switchTo(k) {
    if (k === key) return;
    if (state.dirty && !window.confirm('You have unsaved changes in this section. Discard them?')) return;
    key = k;
    history.replaceState(null, '', `#/content/${k}`);
    currentHash = location.hash;
    open();
  }

  // --- field renderers (bind directly into the draft object)
  function fieldControl(f, obj) {
    const onChange = () => setDirty(true);
    const wrapCls = `fld${f.span || f.type === 'repeater' || f.type === 'list' ? ' span-2' : ''}`;
    if (f.type === 'repeater') return repeater(f, obj);
    if (f.type === 'image') {
      const prev = h('div', { class: 'img-field__preview' });
      const url = h('input', { class: 'input', value: obj[f.key] || '', placeholder: 'Image address, or upload', 'aria-label': `${f.label} URL` });
      const setPrev = () => prev.replaceChildren(url.value ? h('img', { src: url.value, alt: '' }) : icon('image'));
      setPrev();
      url.addEventListener('input', () => { obj[f.key] = url.value.trim(); setPrev(); onChange(); });
      const up = h('input', { type: 'file', accept: 'image/*', hidden: true });
      const upBtn = h('button', { class: 'btn btn--sm', type: 'button', onclick: () => up.click() }, icon('upload'), 'Upload image');
      up.addEventListener('change', async () => {
        const file = up.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
          const r = await withBusy(upBtn, () => api('/media', { method: 'POST', form: fd }));
          url.value = r.url; obj[f.key] = r.url; setPrev(); onChange();
        } catch (err) { toast(err.message, 'error'); }
        up.value = '';
      });
      return h('div', { class: wrapCls }, h('span', { class: 'fld__label', text: f.label }), h('div', { class: 'img-field' }, prev, h('div', { class: 'img-field__actions', style: 'flex:1' }, url, h('div', {}, upBtn), up)));
    }
    if (f.type === 'list') {
      const ta = h('textarea', { rows: Math.min(8, Math.max(3, (obj[f.key] || []).length + 1)), value: (obj[f.key] || []).join('\n') });
      ta.addEventListener('input', () => { obj[f.key] = ta.value.split('\n').map((s) => s.trim()).filter(Boolean); onChange(); });
      return h('label', { class: wrapCls }, h('span', { text: f.label }), ta, h('small', { text: 'One item per line.' }));
    }
    if (f.type === 'select') {
      const sel = h('select', {}, f.options.map((o) => h('option', { value: o, text: o, selected: obj[f.key] === o })));
      sel.addEventListener('change', () => { obj[f.key] = sel.value; onChange(); });
      return h('label', { class: wrapCls }, h('span', { text: f.label }), sel);
    }
    const input = f.type === 'textarea' ? h('textarea', { rows: f.rows || 3, value: obj[f.key] ?? '' }) : h('input', { value: obj[f.key] ?? '' });
    input.addEventListener('input', () => { obj[f.key] = input.value; onChange(); });
    return h('label', { class: wrapCls }, h('span', { text: f.label }), input, f.hint ? h('small', { text: f.hint }) : null);
  }

  function repeater(f, obj) {
    if (!Array.isArray(obj[f.key])) obj[f.key] = [];
    const arr = obj[f.key];
    const box = h('div', { class: 'rep' });
    const addBtn = h('button', { class: 'btn btn--sm', type: 'button', onclick: () => {
      arr.push(Object.fromEntries(f.fields.map((sf) => [sf.key, sf.type === 'select' ? sf.options[0] : ''])));
      setDirty(true); render();
    } }, icon('plus'), `Add ${f.item.toLowerCase()}`);
    function render() {
      box.replaceChildren(...arr.map((item, i) => h('div', { class: 'rep__item' },
        h('div', { class: 'rep__head' }, h('strong', { text: `${f.item} ${i + 1}${item.title ? ` — ${item.title}` : item.label ? ` — ${item.label}` : ''}` }),
          h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; setDirty(true); render(); } }, icon('up')),
          h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'aria-label': 'Move down', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; setDirty(true); render(); } }, icon('down')),
          h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'aria-label': 'Remove', onclick: () => { arr.splice(i, 1); setDirty(true); render(); } }, icon('trash'))),
        h('div', { class: 'rep__body' }, f.fields.map((sf) => fieldControl(sf, item))))));
      addBtn.hidden = f.max && arr.length >= f.max;
    }
    render();
    return h('div', { class: 'fld span-2' }, h('span', { class: 'fld__label', text: f.label }), box, h('div', {}, addBtn));
  }

  function open() {
    const schema = CONTENT_SCHEMA[key];
    draft = structuredClone(content[key] ?? defaults[key] ?? {});
    previewBtn.href = `../#${schema.anchor}`;
    panel.replaceChildren(
      h('div', { class: 'card__head' }, h('div', {}, h('h2', { text: schema.label }), h('p', { text: 'Changes go live as soon as you save.' })), previewBtn),
      h('div', { class: 'card__body form-grid' }, schema.fields.map((f) => fieldControl(f, draft))),
      h('div', { class: 'savebar' }, resetBtn, h('span', { class: 'spacer' }), dirtyEl, saveBtn));
    setDirty(false);
  }

  async function save() {
    try {
      await withBusy(saveBtn, () => api(`/content/${key}`, { method: 'PUT', body: { value: draft } }));
      content[key] = structuredClone(draft);
      setDirty(false);
      toast('Saved — the website is updated');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function reset() {
    if (!(await confirmDialog({ title: 'Reset this section?', text: `“${CONTENT_SCHEMA[key].label}” will go back to the original text from the company profile.`, confirmText: 'Reset', danger: true }))) return;
    try {
      const r = await api(`/content/${key}`, { method: 'DELETE' });
      content[key] = r.value;
      open();
      toast('Section reset to default');
    } catch (err) { toast(err.message, 'error'); }
  }

  renderNav();
  open();
}

// ------------------------------------------------------------------ settings
async function settingsView() {
  setPage('Settings', 'Your account and data');
  const me = state.me;
  const name = h('input', { value: me.name || '' });
  const username = h('input', { value: me.username, autocomplete: 'username' });
  const saveProfile = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
    try {
      const r = await withBusy(saveProfile, () => api('/profile', { method: 'PUT', body: { name: name.value, username: username.value } }));
      state.me = r.admin; renderUser(); toast('Profile updated');
    } catch (err) { toast(err.message, 'error'); }
  } }, 'Save profile');

  const cur = h('input', { type: 'password', autocomplete: 'current-password' });
  const nw = h('input', { type: 'password', autocomplete: 'new-password' });
  const nw2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const pwErr = h('p', { class: 'modal__error', hidden: true });
  const savePw = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
    pwErr.hidden = true;
    const fail = (m) => { pwErr.textContent = m; pwErr.hidden = false; };
    if (nw.value.length < 8) return fail('The new password must be at least 8 characters.');
    if (nw.value !== nw2.value) return fail('The two new passwords do not match.');
    try {
      await withBusy(savePw, () => api('/password', { method: 'POST', body: { current: cur.value, next: nw.value } }));
      cur.value = nw.value = nw2.value = '';
      state.me.mustChange = false; renderUser();
      toast('Password changed. Other devices have been signed out.');
    } catch (err) { fail(err.message); }
  } }, 'Change password');

  view.replaceChildren(h('div', { class: 'grid grid--2', style: 'align-items:start' },
    h('div', { class: 'stack' },
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Profile' })),
        h('div', { class: 'card__body stack' },
          h('label', { class: 'fld' }, h('span', { text: 'Display name' }), name),
          h('label', { class: 'fld' }, h('span', { text: 'Username' }), username, h('small', { text: 'Used to sign in. Letters, numbers, dots, dashes and underscores.' })),
          h('div', {}, saveProfile))),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Change password' })),
        h('div', { class: 'card__body stack' },
          me.mustChange ? h('p', { class: 'banner', style: 'margin:0' }, icon('alert'), 'You are still using the initial password.') : null,
          h('label', { class: 'fld' }, h('span', { text: 'Current password' }), cur),
          h('label', { class: 'fld' }, h('span', { text: 'New password' }), nw, h('small', { text: 'At least 8 characters. A short sentence is easy to remember and hard to guess.' })),
          h('label', { class: 'fld' }, h('span', { text: 'Repeat new password' }), nw2),
          pwErr, h('div', {}, savePw)))),
    h('div', { class: 'stack' },
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Export & backup' })),
        h('div', { class: 'card__body stack' },
          h('a', { class: 'file', href: `${API}/enquiries.csv?status=all` }, icon('table'), h('span', { text: 'All enquiries (Excel / CSV)' }), icon('download')),
          h('a', { class: 'file', href: `${API}/backup` }, icon('file'), h('span', { text: 'Full backup of website data (JSON)' }), icon('download')),
          h('p', { class: 'hint', text: 'Uploaded files are stored in the “uploads” folder and the database in the “data” folder on the server — copy both folders to keep a complete backup.' }),
          demo ? h('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
            if (!(await confirmDialog({ title: 'Reset the preview?', text: 'All preview changes and test enquiries in this browser will be cleared.', confirmText: 'Reset' }))) return;
            demo.reset(); location.hash = '#/'; location.reload();
          } }, icon('trash'), 'Reset preview data') : null)),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Signed in' })),
        h('div', { class: 'card__body' }, h('dl', { class: 'kv' },
          h('dt', { text: 'Account' }), h('dd', { text: `${me.name || me.username} (@${me.username})` }),
          h('dt', { text: 'Last sign-in' }), h('dd', { text: me.lastLogin ? fmtDateTime(me.lastLogin) : 'This is your first sign-in' })))))));
}

// ------------------------------------------------------------------ boot
(async () => {
  try {
    const { admin } = await api('/me');
    state.me = admin;
    showApp();
  } catch {
    showLogin();
  }
})();
