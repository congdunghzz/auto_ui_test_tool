// Runs INSIDE the browser page (injected as a string by explore.ts, so keep it plain JS
// and self-contained). Collects interactive elements and UI structures from the DOM.
// It tags each visible interactive element with data-qa-idx so the Node side can
// verify that a candidate selector resolves to exactly that element.
(function collect(opts) {
  const testIdAttr = opts.testIdAttribute || 'data-testid';
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const isVisible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
  };
  const byIds = (ids) => clean(String(ids || '').split(/\s+/).map((id) => {
    const n = document.getElementById(id);
    return n ? n.textContent : '';
  }).join(' '));

  function roleOf(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit.split(/\s+/)[0];
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
    if (tag === 'button') return 'button';
    if (tag === 'select') return el.multiple || el.size > 1 ? 'listbox' : 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (el.hasAttribute('list')) return 'combobox';
      return ({ text: 'textbox', email: 'textbox', tel: 'textbox', url: 'textbox', search: 'searchbox',
        checkbox: 'checkbox', radio: 'radio', number: 'spinbutton', range: 'slider',
        submit: 'button', button: 'button', reset: 'button', image: 'button' })[t] || null;
    }
    if (tag === 'table') return 'table';
    if (tag === 'nav') return 'navigation';
    if (tag === 'dialog') return 'dialog';
    if (tag === 'form') return 'form';
    return null;
  }
  const labelOf = (el) => (el.labels && el.labels.length
    ? clean(Array.from(el.labels).map((l) => l.innerText || l.textContent).join(' '))
    : null);
  function nameOf(el) {
    const al = el.getAttribute('aria-label');
    if (al) return clean(al);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return byIds(lb);
    const lab = labelOf(el);
    if (lab) return lab;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' && ['submit', 'button', 'reset'].includes(el.type)) return clean(el.value);
    const role = roleOf(el);
    if (['a', 'button', 'summary'].includes(tag) || ['button', 'link', 'tab', 'menuitem', 'option'].includes(role)) {
      return clean(el.innerText || el.textContent);
    }
    if (tag === 'table') {
      const cap = el.querySelector('caption');
      if (cap) return clean(cap.textContent);
    }
    if (tag === 'fieldset') {
      const lg = el.querySelector('legend');
      if (lg) return clean(lg.textContent);
    }
    return clean(el.getAttribute('title') || '');
  }

  // Nearest ancestor container that has an accessible name (used to scope selectors).
  const CONTAINER_SEL = 'dialog,[role=dialog],[role=alertdialog],nav,[role=navigation],[role=tabpanel],form,[role=form],table,[role=table],[role=grid],[role=region],section[aria-label],section[aria-labelledby]';
  function containerOf(el) {
    let cur = el.parentElement ? el.parentElement.closest(CONTAINER_SEL) : null;
    while (cur) {
      const name = nameOf(cur);
      let role = roleOf(cur);
      if (!role && cur.tagName.toLowerCase() === 'section') role = 'region';
      if (name && role) return { role, name };
      cur = cur.parentElement ? cur.parentElement.closest(CONTAINER_SEL) : null;
    }
    return null;
  }

  // reset tags from a previous collection
  document.querySelectorAll('[data-qa-idx]').forEach((n) => n.removeAttribute('data-qa-idx'));
  document.querySelectorAll('[data-qa-row]').forEach((n) => n.removeAttribute('data-qa-row'));

  const INTERACTIVE = [
    'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
    '[role=button]', '[role=link]', '[role=tab]', '[role=checkbox]', '[role=radio]', '[role=switch]',
    '[role=combobox]', '[role=menuitem]', '[role=option]', '[role=textbox]', '[contenteditable=""]', '[contenteditable=true]',
  ].join(',');

  const elements = [];
  const rowRepeats = {};
  let idx = 0;
  let rowSeq = 0;
  const rowIds = new Map();
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (!isVisible(el)) {
      // radios/checkboxes are sometimes visually hidden behind a styled label
      const t = (el.getAttribute('type') || '').toLowerCase();
      if (!(['radio', 'checkbox'].includes(t) && el.labels && el.labels[0] && isVisible(el.labels[0]))) continue;
    }
    // Collapse repeated per-row controls inside table bodies: keep only the first data row.
    const tr = el.closest('tbody tr, [role=rowgroup] [role=row]');
    let rowScoped = null;
    if (tr) {
      const body = tr.parentElement;
      const rows = Array.from(body.children).filter((r) => isVisible(r));
      const table = tr.closest('table,[role=table],[role=grid]');
      const tableName = table ? nameOf(table) : '';
      if (rows.indexOf(tr) > 0) {
        const key = tableName + '|' + roleOf(el) + '|' + nameOf(el);
        rowRepeats[key] = (rowRepeats[key] || 0) + 1;
        continue;
      }
      if (!rowIds.has(tr)) {
        rowIds.set(tr, String(++rowSeq));
        tr.setAttribute('data-qa-row', rowIds.get(tr));
      }
      rowScoped = { table: tableName, rowId: rowIds.get(tr), rows: rows.length };
    }
    const id = String(++idx);
    el.setAttribute('data-qa-idx', id);
    const tag = el.tagName.toLowerCase();
    const fieldset = el.closest('fieldset');
    const form = el.closest('form');
    const constraints = {};
    for (const a of ['type', 'min', 'max', 'minlength', 'maxlength', 'pattern', 'step', 'inputmode', 'autocomplete']) {
      if (el.hasAttribute(a)) constraints[a] = el.getAttribute(a);
    }
    elements.push({
      idx: id,
      tag,
      role: roleOf(el),
      inputType: tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : null,
      name: nameOf(el),
      label: labelOf(el),
      placeholder: el.getAttribute('placeholder'),
      testId: el.getAttribute(testIdAttr),
      id: el.id || null,
      nameAttr: el.getAttribute('name'),
      value: tag === 'input' && ['radio', 'checkbox'].includes(el.type) ? el.value : null,
      text: clean(el.innerText || '').slice(0, 80),
      href: tag === 'a' ? el.getAttribute('href') : null,
      required: el.required || el.getAttribute('aria-required') === 'true',
      disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
      checked: ['radio', 'checkbox'].includes(el.type) ? el.checked : (el.getAttribute('aria-checked') ? el.getAttribute('aria-checked') === 'true' : null),
      selected: el.getAttribute('aria-selected'),
      current: el.getAttribute('aria-current'),
      constraints,
      options: tag === 'select' ? Array.from(el.options).slice(0, 30).map((o) => clean(o.textContent)) : null,
      group: fieldset ? nameOf(fieldset) : null,
      form: form ? (form.id || form.getAttribute('name') || nameOf(form) || 'form') : null,
      container: containerOf(el),
      rowScoped,
    });
  }

  const tables = Array.from(document.querySelectorAll('table,[role=table],[role=grid]')).filter(isVisible).map((t) => {
    const headers = Array.from(t.querySelectorAll('thead th, [role=columnheader]')).map((h) => clean(h.textContent));
    const bodyRows = Array.from(t.querySelectorAll('tbody tr, [role=rowgroup]:not(:first-child) [role=row]')).filter(isVisible);
    const first = bodyRows[0] ? Array.from(bodyRows[0].querySelectorAll('td,[role=cell],[role=gridcell]')).map((c) => clean(c.textContent)) : [];
    return { name: nameOf(t), role: roleOf(t) || 'table', headers, visibleRows: bodyRows.length, sampleRow: first };
  });

  const dialogs = Array.from(document.querySelectorAll('dialog,[role=dialog],[role=alertdialog]')).map((d) => ({
    role: roleOf(d) || 'dialog',
    name: nameOf(d),
    visible: isVisible(d),
    modal: d.getAttribute('aria-modal') === 'true' || (d.tagName === 'DIALOG' && d.open),
  }));

  const tablists = Array.from(document.querySelectorAll('[role=tablist]')).filter(isVisible).map((tl) => ({
    name: nameOf(tl),
    tabs: Array.from(tl.querySelectorAll('[role=tab]')).map((t) => ({ name: nameOf(t), selected: t.getAttribute('aria-selected') === 'true' })),
  }));

  const navs = Array.from(document.querySelectorAll('nav,[role=navigation]')).filter(isVisible).map((n) => ({
    name: nameOf(n),
    isPagination: /pag|trang|page/i.test(nameOf(n) + ' ' + n.className),
    links: Array.from(n.querySelectorAll('a[href]')).map((a) => ({ text: clean(a.textContent), href: a.getAttribute('href'), current: a.getAttribute('aria-current') })),
    controls: Array.from(n.querySelectorAll('button')).map((b) => clean(b.textContent)),
  }));

  const liveRegions = Array.from(document.querySelectorAll('[role=alert],[role=status],[aria-live]')).map((r) => ({
    role: r.getAttribute('role') || 'live-region',
    live: r.getAttribute('aria-live'),
    testId: r.getAttribute(testIdAttr),
    id: r.id || null,
    visible: isVisible(r),
    text: clean(r.textContent).slice(0, 120),
  }));

  // Non-interactive elements that carry a test id: good assertion targets (totals, status labels, ...)
  const testIdElements = Array.from(document.querySelectorAll('[' + testIdAttr + ']'))
    .filter((el) => !el.hasAttribute('data-qa-idx'))
    .map((el) => ({ testId: el.getAttribute(testIdAttr), tag: el.tagName.toLowerCase(), role: roleOf(el), visible: isVisible(el), text: clean(el.textContent).slice(0, 80) }));

  const headings = Array.from(document.querySelectorAll('h1,h2,h3')).filter(isVisible).map((h) => ({ level: Number(h.tagName[1]), text: clean(h.textContent) }));

  const links = Array.from(document.querySelectorAll('a[href]')).filter(isVisible).map((a) => ({ text: clean(a.textContent) || a.getAttribute('aria-label') || '', href: a.href }));

  const texts = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = clean(walker.currentNode.textContent);
    const p = walker.currentNode.parentElement;
    if (!t || t.length > 200 || seen.has(t) || !p || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName) || !isVisible(p)) continue;
    seen.add(t);
    texts.push(t);
  }

  return {
    title: document.title,
    url: location.href,
    elements,
    rowRepeats,
    tables,
    dialogs,
    tablists,
    navs,
    liveRegions,
    testIdElements,
    headings,
    links,
    texts: texts.slice(0, 400),
  };
})
