// Multi-step enquiry form: validation, product picker, attachments, review, submit.
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const MAX_FILES = 3;
const MAX_SIZE = 10 * 1024 * 1024;
const FILE_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'dwg', 'dxf', 'zip'];
const DRAFT_KEY = 'spe_enquiry_draft';
const SERVICE_ICONS = ['fabrication', 'cleanroom', 'passbox', 'tank', 'piping', 'epoxy', 'partition', 'railing'];

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isPhone = (v) => { const d = v.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15 && /^[+\d\s().-]+$/.test(v); };
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ic');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

export function initEnquiry({ data, demo, basket, toast, scrollTo, onSent }) {
  const form = $('#enquiry-form');
  if (!form) return;
  const E = data.content.enquiry || {};
  const panels = $$('.eform__panel', form);
  const stepItems = $$('#eform-steps li');
  const btnNext = $('#eform-next'), btnBack = $('#eform-back'), btnSubmit = $('#eform-submit');
  const errorBox = $('#eform-error');
  let step = 0;
  let files = [];
  let startedAt = Date.now();

  // ---------------------------------------------------------------- options
  const fillSelect = (sel, options) => $(sel).append(...(options || []).map((o) => el('option', { value: o, text: o })));
  fillSelect('#f-industry', E.industries);
  fillSelect('#f-material', E.materials);
  fillSelect('#f-budget', E.budgets);
  fillSelect('#f-source', E.sources);

  const pick = (container, name, options, { multi = false, icons = null } = {}) => {
    $(container).append(...options.map((o, i) => el('label', {},
      el('input', { type: multi ? 'checkbox' : 'radio', name, value: o }),
      el('span', {}, icons ? icon(icons[i] || 'check') : null, o))));
  };
  const services = (data.content.services?.items || []).map((s) => s.title);
  pick('#f-services', 'services', [...services, 'Other / custom fabrication'], {
    multi: true,
    icons: [...(data.content.services?.items || []).map((s, i) => (SERVICE_ICONS.includes(s.icon) ? s.icon : SERVICE_ICONS[i % 8])), 'spark'],
  });
  pick('#f-reqtype', 'requirementType', E.requirementTypes || []);
  pick('#f-timeline', 'timeline', E.timelines || []);
  pick('#f-contact', 'contactMethod', ['Phone call', 'WhatsApp', 'Email']);

  // ---------------------------------------------------------------- product picker (shares the catalogue's enquiry list)
  const products = data.products || [];
  const selectedBox = $('#prodpick-selected');
  const pickInput = $('#prodpick-input');
  const pickList = $('#prodpick-list');
  let focusIdx = -1;

  basket.subscribe((items) => {
    selectedBox.replaceChildren(...items.map((n) => el('span', { class: 'pchip' }, n,
      el('button', { type: 'button', 'aria-label': `Remove ${n}`, onclick: () => basket.remove(n) }, icon('close')))));
    if (items.length) clearError('services');
  });

  function renderPickList() {
    const q = pickInput.value.trim().toLowerCase();
    const matches = products
      .filter((p) => !basket.has(p.name) && (!q || `${p.name} ${p.category}`.toLowerCase().includes(q)))
      .slice(0, 8);
    focusIdx = matches.length ? 0 : -1;
    pickList.replaceChildren(...(matches.length ? matches.map((p, i) => el('li', {
      role: 'option', class: i === 0 ? 'is-focus' : null, 'data-name': p.name,
      onmousedown: (e) => { e.preventDefault(); choose(p.name); },
    }, el('img', { src: p.image, alt: '' }), el('div', {}, p.name, el('small', { text: p.category }))))
      : [el('li', { class: 'is-empty', text: q ? 'No match — describe it in the message box instead.' : 'All products added.' })]));
    pickList.hidden = false;
  }
  function choose(name) {
    basket.add(name);
    pickInput.value = '';
    renderPickList();
  }
  pickInput.addEventListener('focus', renderPickList);
  pickInput.addEventListener('input', renderPickList);
  pickInput.addEventListener('blur', () => setTimeout(() => { pickList.hidden = true; }, 120));
  pickInput.addEventListener('keydown', (e) => {
    const items = $$('li[data-name]', pickList);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      focusIdx = (focusIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.classList.toggle('is-focus', i === focusIdx));
      items[focusIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[focusIdx]) choose(items[focusIdx].dataset.name);
    } else if (e.key === 'Escape') pickList.hidden = true;
  });

  // ---------------------------------------------------------------- conditional fields
  const areaField = $('#area-field'), siteField = $('#site-field');
  function syncConditional() {
    const chosen = $$('input[name="services"]:checked', form).map((i) => i.value).join(' ');
    areaField.hidden = !/epoxy|partition/i.test(chosen);
    siteField.hidden = !$('#f-sitevisit').checked;
  }
  form.addEventListener('change', syncConditional);

  const msg = $('#f-message');
  const updateCount = () => { $('#msg-count').textContent = msg.value.length; };
  msg.addEventListener('input', updateCount);

  // ---------------------------------------------------------------- attachments
  const drop = $('#dropzone');
  const fileInput = $('#f-files');
  function addFiles(list) {
    clearError('attachments');
    for (const f of list) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (!FILE_EXT.includes(ext)) { showError('attachments', `“${f.name}” is not a supported file type.`); continue; }
      if (f.size > MAX_SIZE) { showError('attachments', `“${f.name}” is larger than 10 MB.`); continue; }
      if (files.length >= MAX_FILES) { showError('attachments', 'You can attach up to 3 files.'); break; }
      if (!files.some((x) => x.name === f.name && x.size === f.size)) files.push(f);
    }
    renderFiles();
  }
  function renderFiles() {
    $('#file-list').replaceChildren(...files.map((f, i) => el('li', {}, icon('file'), el('span', { text: f.name }), el('small', { text: fmtSize(f.size) }),
      el('button', { type: 'button', 'aria-label': `Remove ${f.name}`, onclick: () => { files.splice(i, 1); renderFiles(); } }, icon('close')))));
  }
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  // ---------------------------------------------------------------- errors
  function fieldWrap(name) {
    const input = form.elements[name];
    const node = input instanceof RadioNodeList ? input[0] : input;
    return node?.closest('.field');
  }
  function showError(name, text) {
    const special = $(`.field__err[data-for="${name}"]`, form);
    if (special) { special.textContent = text; return; }
    const wrap = fieldWrap(name);
    if (!wrap) return;
    wrap.classList.add('is-invalid');
    $('.field__err', wrap).textContent = text;
  }
  function clearError(name) {
    const special = $(`.field__err[data-for="${name}"]`, form);
    if (special) special.textContent = '';
    const wrap = fieldWrap(name);
    if (wrap) { wrap.classList.remove('is-invalid'); const err = $('.field__err', wrap); if (err) err.textContent = ''; }
  }
  form.addEventListener('input', (e) => { if (e.target.name) clearError(e.target.name); errorBox.hidden = true; });
  form.addEventListener('change', (e) => { if (e.target.name) clearError(e.target.name); });

  const val = (name) => (form.elements[name]?.value || '').trim();
  const checked = (name) => $$(`input[name="${name}"]:checked`, form).map((i) => i.value);

  function validate(s) {
    const errs = {};
    if (s === 0) {
      if (val('name').length < 2) errs.name = 'Please enter your full name.';
      if (!val('company')) errs.company = 'Please enter your company name.';
      if (!val('industry')) errs.industry = 'Please select your industry.';
      if (!isEmail(val('email'))) errs.email = 'Please enter a valid email address.';
      if (!isPhone(val('phone'))) errs.phone = 'Please enter a valid phone number.';
      if (!val('city')) errs.city = 'Please enter your city.';
    }
    if (s === 1 && !checked('services').length && !basket.items.length) errs.services = 'Pick at least one service, or add a product.';
    if (s === 2) {
      if (val('message').length < 10) errs.message = 'Please describe your requirement in a sentence or two.';
    }
    if (s === 3 && !$('#f-consent').checked) errs.consent = 'Please confirm we may contact you about this enquiry.';
    Object.entries(errs).forEach(([k, v]) => showError(k, v));
    const first = Object.keys(errs)[0];
    if (first) {
      const target = form.elements[first];
      (target instanceof RadioNodeList ? target[0] : target || $('#f-consent'))?.focus?.({ preventScroll: false });
    }
    return !first;
  }

  // ---------------------------------------------------------------- steps
  function goTo(n, { back = false, scroll = true } = {}) {
    step = Math.max(0, Math.min(panels.length - 1, n));
    panels.forEach((p, i) => {
      p.classList.toggle('is-active', i === step);
      p.classList.toggle('is-back', back && i === step);
    });
    stepItems.forEach((li, i) => {
      li.classList.toggle('is-active', i === step);
      li.classList.toggle('is-done', i < step);
    });
    $('#eform-progress').style.width = `${((step + 1) / panels.length) * 100}%`;
    btnBack.hidden = step === 0;
    btnNext.hidden = step === panels.length - 1;
    btnSubmit.hidden = step !== panels.length - 1;
    $('#eform-hint').textContent = `Step ${step + 1} of ${panels.length}`;
    if (step === panels.length - 1) renderReview();
    const top = form.getBoundingClientRect().top;
    if (scroll && (top < 0 || top > window.innerHeight * 0.6)) scrollTo(form);
  }
  btnNext.addEventListener('click', () => { if (validate(step)) goTo(step + 1); });
  btnBack.addEventListener('click', () => goTo(step - 1, { back: true }));
  stepItems.forEach((li, i) => {
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => { if (i < step) goTo(i, { back: true }); else if (i === step + 1 && validate(step)) goTo(i); });
  });
  // Enter in a text input moves to the next step instead of submitting early.
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target !== pickInput && step < panels.length - 1) {
      e.preventDefault();
      btnNext.click();
    }
  });

  // ---------------------------------------------------------------- review
  function renderReview() {
    const row = (label, value) => (value ? [el('dt', { text: label }), el('dd', { text: value })] : []);
    const group = (title, stepIdx, rows) => el('section', { class: 'review__group' },
      el('header', {}, el('h4', { text: title }), el('button', { type: 'button', text: 'Edit', onclick: () => goTo(stepIdx, { back: true }) })),
      el('dl', {}, ...rows.flat()));
    $('#review').replaceChildren(
      group('Contact', 0, [
        row('Name', val('name')), row('Company', val('company')), row('Designation', val('designation')), row('Industry', val('industry')),
        row('Email', val('email')), row('Phone', val('phone')), row('Location', [val('city'), val('state')].filter(Boolean).join(', ')),
      ]),
      group('Requirement', 1, [
        row('Services', checked('services').join(', ')), row('Products', basket.items.join(', ')),
        row('Type', checked('requirementType')[0]), row('Material', val('material')), row('Quantity / scope', val('quantity')),
        row('Area', areaField.hidden ? '' : val('area')),
      ]),
      group('Project', 2, [
        row('Timeline', checked('timeline')[0]), row('Budget', val('budget')), row('Preferred contact', checked('contactMethod')[0]),
        row('Best time', val('contactTime')), row('Site visit', $('#f-sitevisit').checked ? `Yes${val('siteLocation') ? ` — ${val('siteLocation')}` : ''}` : 'Not needed'),
        row('Heard via', val('source')), row('Message', val('message')), row('Attachments', files.map((f) => f.name).join(', ')),
      ]),
    );
  }

  // ---------------------------------------------------------------- draft autosave (this browser only)
  const DRAFT_FIELDS = ['name', 'company', 'designation', 'industry', 'email', 'phone', 'city', 'state', 'material', 'quantity', 'area', 'budget', 'source', 'contactTime', 'siteLocation', 'message'];
  const GROUPS = ['services', 'requirementType', 'timeline', 'contactMethod'];
  function saveDraft() {
    const draft = {};
    DRAFT_FIELDS.forEach((k) => { draft[k] = val(k); });
    GROUPS.forEach((k) => { draft[k] = checked(k); });
    draft.siteVisit = $('#f-sitevisit').checked;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage unavailable */ }
  }
  function loadDraft() {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { draft = null; }
    if (!draft) return;
    DRAFT_FIELDS.forEach((k) => { if (draft[k] && form.elements[k]) form.elements[k].value = draft[k]; });
    GROUPS.forEach((k) => (draft[k] || []).forEach((v) => {
      const input = $$(`input[name="${k}"]`, form).find((i) => i.value === v);
      if (input) input.checked = true;
    }));
    $('#f-sitevisit').checked = !!draft.siteVisit;
    syncConditional();
    updateCount();
  }
  let draftTimer;
  form.addEventListener('input', () => { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400); });
  form.addEventListener('change', () => { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 200); });
  loadDraft();

  // ---------------------------------------------------------------- submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (step !== panels.length - 1) { btnNext.click(); return; }
    for (let s = 0; s < panels.length; s++) {
      if (!validate(s)) { goTo(s, { back: true }); validate(s); return; }
    }
    const fd = new FormData();
    DRAFT_FIELDS.forEach((k) => {
      if (k === 'area' && areaField.hidden) return;
      if (k === 'siteLocation' && siteField.hidden) return;
      fd.append(k, val(k));
    });
    fd.append('services', JSON.stringify(checked('services')));
    fd.append('products', JSON.stringify(basket.items));
    ['requirementType', 'timeline', 'contactMethod'].forEach((k) => fd.append(k, checked(k)[0] || ''));
    fd.append('siteVisit', $('#f-sitevisit').checked ? 'yes' : 'no');
    fd.append('website', form.elements.website.value);
    fd.append('startedAt', String(startedAt));
    files.forEach((f) => fd.append('attachments', f, f.name));

    btnSubmit.classList.add('is-loading');
    btnSubmit.disabled = true;
    errorBox.hidden = true;
    try {
      let res, body;
      if (demo) {
        await new Promise((r) => setTimeout(r, 700));
        body = demo.submitEnquiry(fd);
        res = { ok: true };
      } else {
        res = await fetch('api/enquiries', { method: 'POST', body: fd });
        body = await res.json().catch(() => ({}));
      }
      if (!res.ok) {
        if (body.fields) {
          const stepOf = { name: 0, company: 0, email: 0, phone: 0, city: 0, industry: 0, services: 1, message: 2 };
          const first = Object.keys(body.fields).map((k) => stepOf[k] ?? 3).sort()[0];
          goTo(first, { back: true });
          Object.entries(body.fields).forEach(([k, v]) => showError(k, v));
        }
        throw new Error(body.error || 'Something went wrong. Please try again.');
      }
      $('#done-ref').textContent = body.ref;
      if (demo && !$('.done__demo', form)) {
        $('.done__actions', form).before(el('p', { class: 'done__demo' },
          'Preview version: this enquiry was saved in your browser. See it in the ',
          el('a', { href: 'admin/', target: '_blank', rel: 'noopener', text: 'admin panel' }),
          ' (sign in with demo / demo1234).'));
      }
      form.classList.add('is-done');
      $('#eform-done').hidden = false;
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      basket.clear();
      onSent?.();
      scrollTo(form);
    } catch (err) {
      errorBox.textContent = err.message === 'Failed to fetch'
        ? `We could not reach the server. Please check your connection, or call us on ${data.content.contact.phone}.`
        : err.message;
      errorBox.hidden = false;
    } finally {
      btnSubmit.classList.remove('is-loading');
      btnSubmit.disabled = false;
    }
  });

  $('#eform-again').addEventListener('click', () => {
    form.reset();
    files = [];
    renderFiles();
    startedAt = Date.now();
    form.classList.remove('is-done');
    $('#eform-done').hidden = true;
    syncConditional();
    updateCount();
    goTo(0);
    toast?.('Ready for your next enquiry');
  });

  syncConditional();
  goTo(0, { scroll: false });
}
