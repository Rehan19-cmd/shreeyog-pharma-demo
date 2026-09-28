// =====================================================================
// Preview mode (static hosting such as GitHub Pages, where there is no Node server).
// Mimics the backend API in the visitor's own browser (localStorage), so the enquiry form
// and the admin panel can be tried end-to-end. Nothing is sent anywhere.
// =====================================================================
const KEY = 'spe_demo_v1';
const SESSION = 'spe_demo_session';
export const DEMO_LOGIN = { username: 'demo', password: 'demo1234' };

const STATUSES = ['new', 'contacted', 'site_visit', 'quoted', 'won', 'lost', 'spam'];
const STATUS_LABEL = { new: 'New', contacted: 'Contacted', site_visit: 'Site visit', quoted: 'Quoted', won: 'Won', lost: 'Lost', spam: 'Spam' };
const now = () => new Date().toISOString();
const clone = (v) => JSON.parse(JSON.stringify(v));

export class DemoError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Asset paths in the seed are relative to the site root; store them absolute so both the
// site ("./") and the admin ("../") resolve them the same way.
function absolutise(value, base) {
  if (typeof value === 'string') return /^(assets|uploads)\//.test(value) ? new URL(value, base).href : value;
  if (Array.isArray(value)) return value.map((v) => absolutise(v, base));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutise(v, base)]));
  return value;
}

function sampleEnquiries() {
  const day = 86400000;
  const mk = (id, daysAgo, o) => ({
    id, ref: `SPE-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`, status: 'new', priority: 'normal',
    designation: '', state: 'Maharashtra', products: [], requirement_type: 'New project', material: '', quantity: '', area: '',
    budget: '', site_visit: false, site_location: '', contact_method: 'Phone call', contact_time: '', source: 'Google search',
    attachments: [], ip: 'preview', user_agent: 'Sample enquiry',
    created_at: new Date(Date.now() - daysAgo * day).toISOString(), updated_at: new Date(Date.now() - daysAgo * day).toISOString(), ...o,
  });
  return [
    mk(1, 6, { name: 'Sample – Priya Deshmukh', company: 'Sample Pharma Pvt Ltd', email: 'priya@example.com', phone: '+91 98200 11111', city: 'Pune', industry: 'Pharmaceutical', services: ['Clean Room Furniture', 'Pass Boxes'], products: ['Static Pass Box', 'SS Trolley (All Types)'], timeline: '1 – 3 months', status: 'quoted', message: 'Sample enquiry: 2 static pass boxes and 8 SS trolleys for a new OSD block.' }),
    mk(2, 3, { name: 'Sample – Rakesh Iyer', company: 'Sample Lifesciences', email: 'rakesh@example.com', phone: '+91 98200 22222', city: 'Ahmedabad', state: 'Gujarat', industry: 'Pharmaceutical', services: ['Epoxy Flooring', 'Partition Work'], area: '4,000 sq. ft.', timeline: 'Within 1 month', status: 'contacted', site_visit: true, site_location: 'Sanand GIDC', message: 'Sample enquiry: epoxy flooring and cleanroom partitions for a packing hall.' }),
    mk(3, 1, { name: 'Sample – Sneha Kulkarni', company: 'Sample Biotech', email: 'sneha@example.com', phone: '+91 98200 33333', city: 'Navi Mumbai', industry: 'Biotech / Vaccines', services: ['SS & Utility Piping'], timeline: '3 – 6 months', message: 'Sample enquiry: SS utility piping for a purified water loop.' }),
  ];
}

export async function createDemoStore({ seed, seedUrl, base }) {
  const root = base || new URL(seedUrl ? '../' : './', location.href).href;
  let db = null;
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
  let initial = seed;
  if (!initial) initial = await fetch(seedUrl).then((r) => r.json());
  const defaults = absolutise(clone(initial.content), root);

  if (!db) {
    const enquiries = sampleEnquiries();
    db = {
      content: clone(defaults),
      products: absolutise(clone(initial.products), root).map((p, i) => ({ ...p, visible: 1, featured: p.featured ? 1 : 0, sort: i + 1, created_at: now() })),
      clients: absolutise(clone(initial.clients), root).map((c, i) => ({ ...c, website: c.website || '', visible: 1, sort: i + 1, created_at: now() })),
      gallery: absolutise(clone(initial.gallery), root).map((g, i) => ({ ...g, visible: 1, sort: i + 1, created_at: now() })),
      enquiries,
      activity: enquiries.map((e, i) => ({ id: i + 1, enquiry_id: e.id, author: 'Website', kind: 'created', body: 'Sample enquiry for the preview.', created_at: e.created_at })),
      seq: { enquiry: enquiries.length, products: initial.products.length, clients: initial.clients.length, gallery: initial.gallery.length, activity: enquiries.length },
      admin: { id: 1, username: DEMO_LOGIN.username, name: 'Demo Admin', password: DEMO_LOGIN.password, last_login: null },
    };
    save();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { throw new DemoError(507, 'Preview storage is full. Use smaller images or reset the preview data in Settings.'); }
  }
  const adminOut = () => ({ id: 1, username: db.admin.username, name: db.admin.name, mustChange: false, lastLogin: db.admin.last_login });
  const findEnquiry = (id) => db.enquiries.find((e) => e.id === Number(id));
  const activityFor = (id) => db.activity.filter((a) => a.enquiry_id === id).sort((a, b) => b.id - a.id);
  const log = (enquiry_id, kind, body) => db.activity.push({ id: ++db.seq.activity, enquiry_id, author: db.admin.name, kind, body, created_at: now() });

  // ---------------------------------------------------------------- public site
  function siteData() {
    const vis = (arr) => arr.filter((x) => x.visible).sort((a, b) => a.sort - b.sort || a.id - b.id);
    return { demo: true, content: clone(db.content), products: vis(db.products), clients: vis(db.clients), gallery: vis(db.gallery) };
  }

  function submitEnquiry(fd) {
    const get = (k) => String(fd.get(k) || '').trim();
    const parse = (k) => { try { return JSON.parse(get(k) || '[]'); } catch { return []; } };
    const id = ++db.seq.enquiry;
    const e = {
      id, ref: `SPE-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`, status: 'new', priority: 'normal',
      name: get('name'), company: get('company'), designation: get('designation'), email: get('email'), phone: get('phone'),
      city: get('city'), state: get('state'), industry: get('industry'), services: parse('services'), products: parse('products'),
      requirement_type: get('requirementType'), material: get('material'), quantity: get('quantity'), area: get('area'),
      timeline: get('timeline'), budget: get('budget'), site_visit: get('siteVisit') === 'yes', site_location: get('siteLocation'),
      contact_method: get('contactMethod'), contact_time: get('contactTime'), source: get('source'), message: get('message'),
      attachments: fd.getAll('attachments').filter((f) => f && f.name).map((f) => ({ name: f.name, stored: '', size: f.size, type: f.type })),
      ip: 'preview', user_agent: navigator.userAgent.slice(0, 200), created_at: now(), updated_at: now(),
    };
    db.enquiries.push(e);
    db.activity.push({ id: ++db.seq.activity, enquiry_id: id, author: 'Website', kind: 'created', body: `Enquiry submitted from the website${e.attachments.length ? ` with ${e.attachments.length} attachment(s)` : ''}.`, created_at: now() });
    save();
    return { ok: true, ref: e.ref };
  }

  // ---------------------------------------------------------------- admin API
  function filterEnquiries(q) {
    let list = [...db.enquiries];
    const st = q.get('status') || '';
    if (STATUSES.includes(st)) list = list.filter((e) => e.status === st);
    else if (st === 'open') list = list.filter((e) => ['new', 'contacted', 'site_visit', 'quoted'].includes(e.status));
    else if (st !== 'all') list = list.filter((e) => e.status !== 'spam');
    const text = (q.get('q') || '').toLowerCase();
    if (text) list = list.filter((e) => [e.name, e.company, e.email, e.phone, e.ref, e.city, ...e.services, ...e.products].join(' ').toLowerCase().includes(text));
    if (q.get('from')) list = list.filter((e) => e.created_at >= new Date(`${q.get('from')}T00:00:00+05:30`).toISOString());
    if (q.get('to')) list = list.filter((e) => e.created_at < new Date(new Date(`${q.get('to')}T00:00:00+05:30`).getTime() + 86400000).toISOString());
    return list.sort((a, b) => b.id - a.id);
  }
  const counts = () => Object.fromEntries(STATUSES.map((s) => [s, db.enquiries.filter((e) => e.status === s).length]));

  function stats() {
    const byStatus = counts();
    const since = (d) => new Date(Date.now() - d * 86400000).toISOString();
    const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const days = [];
    for (let i = 29; i >= 0; i--) days.push({ date: dayKey.format(new Date(Date.now() - i * 86400000)), count: 0 });
    for (const e of db.enquiries) { const d = days.find((x) => x.date === dayKey.format(new Date(e.created_at))); if (d) d.count += 1; }
    const tally = (pick) => {
      const m = new Map();
      for (const e of db.enquiries.filter((x) => x.status !== 'spam')) for (const v of pick(e)) m.set(v, (m.get(v) || 0) + 1);
      return [...m].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    };
    return {
      total: db.enquiries.length, byStatus,
      last7: db.enquiries.filter((e) => e.created_at >= since(7)).length,
      last30: db.enquiries.filter((e) => e.created_at >= since(30)).length,
      open: byStatus.new + byStatus.contacted + byStatus.site_visit + byStatus.quoted,
      days, services: tally((e) => e.services), industries: tally((e) => [e.industry || 'Not specified']),
      recent: [...db.enquiries].sort((a, b) => b.id - a.id).slice(0, 6),
      catalog: { products: db.products.length, clients: db.clients.length, gallery: db.gallery.length },
    };
  }

  async function imageToDataURL(file) {
    if (!file || !file.type?.startsWith('image/')) throw new DemoError(400, 'Please upload an image file.');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.82);
    } finally { URL.revokeObjectURL(url); }
  }

  const CATALOG = {
    products: { image: 'image', fields: { name: 'text', category: 'text', description: 'text', featured: 'bool', visible: 'bool' }, required: ['name', 'category'] },
    clients: { image: 'logo', fields: { name: 'text', website: 'text', visible: 'bool' }, required: ['name'] },
    gallery: { image: 'image', fields: { title: 'text', category: 'text', caption: 'text', visible: 'bool' }, required: ['title'] },
  };

  async function catalogWrite(kind, id, input, isForm) {
    const cfg = CATALOG[kind];
    const get = (k) => (isForm ? input.get(k) : input?.[k]);
    const row = {};
    for (const [k, type] of Object.entries(cfg.fields)) {
      const v = get(k);
      if (v === undefined || v === null) continue;
      row[k] = type === 'bool' ? (['1', 'true', 'on', true, 1].includes(v) ? 1 : 0) : String(v).trim();
    }
    const creating = id == null;
    for (const r of cfg.required) if ((creating || row[r] !== undefined) && !row[r]) throw new DemoError(400, `${r[0].toUpperCase()}${r.slice(1)} is required.`);
    if (isForm) {
      const file = input.get('image');
      if (file && file.size) row[cfg.image] = await imageToDataURL(file);
      else if (input.get('removeImage') === '1') row[cfg.image] = '';
    }
    if (creating) {
      const item = { id: ++db.seq[kind], ...Object.fromEntries(Object.keys(cfg.fields).map((k) => [k, cfg.fields[k] === 'bool' ? 1 : ''])), [cfg.image]: '', ...row, sort: db[kind].length + 1, created_at: now() };
      db[kind].push(item);
      save();
      return { item };
    }
    const item = db[kind].find((x) => x.id === Number(id));
    if (!item) throw new DemoError(404, 'Item not found.');
    Object.assign(item, row);
    save();
    return { item };
  }

  async function request(method, rawPath, { body, form } = {}) {
    const url = new URL(rawPath, 'http://x');
    const path = url.pathname;
    const q = url.searchParams;
    const seg = path.split('/').filter(Boolean);
    const authed = sessionStorage.getItem(SESSION) === '1';

    if (path === '/login' && method === 'POST') {
      if (String(body?.username || '').trim().toLowerCase() !== db.admin.username.toLowerCase() || body?.password !== db.admin.password) {
        throw new DemoError(401, `Incorrect username or password. Preview login: ${DEMO_LOGIN.username} / ${db.admin.password === DEMO_LOGIN.password ? DEMO_LOGIN.password : 'the password you set'}`);
      }
      sessionStorage.setItem(SESSION, '1');
      db.admin.last_login = now();
      save();
      return { admin: adminOut() };
    }
    if (path === '/logout') { sessionStorage.removeItem(SESSION); return { ok: true }; }
    if (!authed) throw new DemoError(401, 'Please sign in to continue.');

    if (path === '/me') return { admin: adminOut() };
    if (path === '/password' && method === 'POST') {
      if (body.current !== db.admin.password) throw new DemoError(400, 'Your current password is incorrect.');
      if (String(body.next || '').length < 8) throw new DemoError(400, 'The new password must be at least 8 characters.');
      db.admin.password = body.next; save(); return { ok: true };
    }
    if (path === '/profile' && method === 'PUT') {
      if (!/^[a-zA-Z0-9._-]{3,40}$/.test(body.username || '')) throw new DemoError(400, 'Username must be 3–40 letters, numbers, dots, dashes or underscores.');
      db.admin.username = body.username; db.admin.name = body.name || body.username; save(); return { admin: adminOut() };
    }
    if (path === '/stats') return stats();

    // enquiries
    if (seg[0] === 'enquiries' && seg.length === 1 && method === 'GET') {
      const list = filterEnquiries(q);
      const per = Math.min(100, Math.max(5, Number(q.get('per')) || 20));
      const page = Math.max(1, Number(q.get('page')) || 1);
      return { items: list.slice((page - 1) * per, page * per), total: list.length, page, per, counts: counts() };
    }
    if (seg[0] === 'enquiries' && seg[1]) {
      const e = findEnquiry(seg[1]);
      if (!e) throw new DemoError(404, 'Enquiry not found.');
      if (seg[2] === 'notes' && method === 'POST') {
        if (!String(body?.body || '').trim()) throw new DemoError(400, 'Write a note first.');
        log(e.id, 'note', String(body.body).trim()); e.updated_at = now(); save();
        return { activity: activityFor(e.id) };
      }
      if (seg[2] === 'files') throw new DemoError(404, 'Attachments are stored on the live server, not in this preview.');
      if (method === 'GET') {
        const ids = db.enquiries.map((x) => x.id);
        return { enquiry: e, activity: activityFor(e.id), siblings: { prev: ids.filter((x) => x > e.id).sort((a, b) => a - b)[0] || null, next: ids.filter((x) => x < e.id).sort((a, b) => b - a)[0] || null } };
      }
      if (method === 'PATCH') {
        if (body.status && body.status !== e.status) { log(e.id, 'status', `Status changed from ${STATUS_LABEL[e.status]} to ${STATUS_LABEL[body.status]}.`); e.status = body.status; }
        if (body.priority && body.priority !== e.priority) { log(e.id, 'priority', `Priority set to ${body.priority}.`); e.priority = body.priority; }
        e.updated_at = now(); save();
        return { enquiry: e, activity: activityFor(e.id) };
      }
      if (method === 'DELETE') {
        db.enquiries = db.enquiries.filter((x) => x.id !== e.id);
        db.activity = db.activity.filter((a) => a.enquiry_id !== e.id);
        save(); return { ok: true };
      }
    }

    // site content
    if (path === '/content' && method === 'GET') return { content: clone(db.content), defaults: clone(defaults) };
    if (seg[0] === 'content' && seg[1]) {
      if (!(seg[1] in defaults)) throw new DemoError(404, 'Unknown content section.');
      if (method === 'PUT') { db.content[seg[1]] = clone(body.value); save(); return { ok: true, value: body.value }; }
      if (method === 'DELETE') { db.content[seg[1]] = clone(defaults[seg[1]]); save(); return { ok: true, value: defaults[seg[1]] }; }
    }
    if (path === '/media' && method === 'POST') return { url: await imageToDataURL(form.get('file')) };

    // catalogue
    if (CATALOG[seg[0]]) {
      const kind = seg[0];
      if (seg.length === 1 && method === 'GET') return { items: [...db[kind]].sort((a, b) => a.sort - b.sort || a.id - b.id) };
      if (seg.length === 1 && method === 'POST') return catalogWrite(kind, null, form, true);
      if (seg[1] === 'reorder') { (body.ids || []).forEach((id, i) => { const it = db[kind].find((x) => x.id === id); if (it) it.sort = i + 1; }); save(); return { ok: true }; }
      if (method === 'PUT') return catalogWrite(kind, seg[1], form, true);
      if (method === 'PATCH') return catalogWrite(kind, seg[1], body, false);
      if (method === 'DELETE') { db[kind] = db[kind].filter((x) => x.id !== Number(seg[1])); save(); return { ok: true }; }
    }
    throw new DemoError(404, 'Not available in the preview.');
  }

  /** Downloads that the live server would stream (CSV export, backup). */
  function download(rawPath) {
    const url = new URL(rawPath, 'http://x');
    let blob, name;
    if (url.pathname.endsWith('/enquiries.csv')) {
      const rows = filterEnquiries(url.searchParams);
      const cols = [['Reference', 'ref'], ['Received', (e) => new Date(e.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })], ['Status', 'status'], ['Name', 'name'], ['Company', 'company'], ['Email', 'email'], ['Phone', 'phone'], ['City', 'city'], ['Industry', 'industry'], ['Services', (e) => e.services.join('; ')], ['Products', (e) => e.products.join('; ')], ['Timeline', 'timeline'], ['Budget', 'budget'], ['Message', 'message']];
      const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const csv = [cols.map((c) => c[0]).join(','), ...rows.map((r) => cols.map(([, v]) => esc(typeof v === 'function' ? v(r) : r[v])).join(','))].join('\r\n');
      blob = new Blob(['﻿' + csv], { type: 'text/csv' });
      name = 'shreeyog-enquiries-preview.csv';
    } else if (url.pathname.endsWith('/backup')) {
      blob = new Blob([JSON.stringify({ exportedAt: now(), ...db, admin: undefined }, null, 2)], { type: 'application/json' });
      name = 'shreeyog-backup-preview.json';
    } else {
      throw new DemoError(404, 'Attachments are stored on the live server, not in this preview.');
    }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function reset() { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); }

  return { siteData, submitEnquiry, request, download, reset };
}
