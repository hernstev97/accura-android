/*
 * app.js: Zustand, Routing, Rahmen (Kopfzeile, Navigation) und alle Aktionen des Klick-Dummys.
 * Der Zustand liegt nur in sessionStorage dieses Tabs. Nichts verlässt das Gerät.
 */
(function () {
  'use strict';
  const A = window.Accura;
  const UI = A.ui;
  const R = A.screens;
  const KEY = 'accura-dummy-v1';

  // ---------- Zustand ----------
  const freshUi = () => ({ err: null, draft: null, draftKey: null, calc: { weight: '', height: '', age: '', variant: 'm', activity: 1.375 }, calcFor: null, bank: {}, quote: {}, upd: { val: null, bank: {} }, updKey: null });
  const freshErf = (started) => ({ done: {}, started: !!started, noDebts: false });
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function initialState() {
    return { preset: 'std', data: A.sampleData(), today: A.TODAY, hide: false, theme: 'system', scale: 100, waived: {}, erf: freshErf(false), upd: null, ui: freshUi() };
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return Object.assign(initialState(), s, { ui: freshUi() });
    } catch (e) {
      return null;
    }
  }

  const S = load() || initialState();
  function save() {
    try {
      const { ui, ...rest } = S;
      sessionStorage.setItem(KEY, JSON.stringify(rest));
    } catch (e) { /* Speicher voll oder gesperrt: der Dummy läuft trotzdem */ }
  }

  const compute = () => A.compute(S.data, S.today);

  // ---------- Hilfen ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const go = (hash) => {
    if (location.hash === hash) render();
    else location.hash = hash;
  };

  function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
    if (/\.stand\.cents$/.test(path)) {
      const holder = path.replace(/\.cents$/, '').split('.').reduce((x, k) => x[k], obj);
      if (!holder.day) holder.day = S.today;
    }
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    $('#live').textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function resetData(preset) {
    S.preset = preset;
    S.data = preset === 'std' ? A.sampleData() : A.emptyData();
    S.waived = {};
    S.erf = freshErf(false);
    S.upd = null;
    S.ui = freshUi();
  }

  // ---------- Ersterfassung: Prüfen und Testwerte ----------
  const sample = () => A.sampleData();
  const withToday = (list) => list.map((x) => ({ ...x, stand: { day: S.today, cents: x.stand.cents } }));
  const TPL_OF_SAMPLE = { miete: 'miete', strom: 'strom', netz: 'netz', haftpflicht: 'haftpflicht', ticket: 'ticket', essen: 'essen', fitness: 'fitness', film: 'stream-v', serie: 'stream-m', cloud: 'cloud', freizeit: 'freizeit', lieferdienst: 'lieferdienst', notgroschen: 'notgroschen', 'reise-r': 'reise' };

  function fill(topic) {
    const sm = sample();
    if (topic === 'einkommen') { S.data.incomeCents = sm.incomeCents; S.data.salaryDay = sm.salaryDay; }
    if (topic === 'konten') S.data.accounts = withToday(sm.accounts);
    if (topic === 'pockets') {
      const first = S.data.accounts[0] ? S.data.accounts[0].id : '';
      S.data.pockets = withToday(sm.pockets).map((p) => ({ ...p, accountId: S.data.accounts.some((a) => a.id === p.accountId) ? p.accountId : first }));
    }
    if (topic === 'kosten' || (topic === 'betraege' && !S.data.budgetItems.length)) {
      S.data.budgetItems = sm.budgetItems.map((i) => ({ ...i, tpl: TPL_OF_SAMPLE[i.id] }));
    } else if (topic === 'betraege') {
      S.data.budgetItems.forEach((it) => {
        const match = sm.budgetItems.find((x) => TPL_OF_SAMPLE[x.id] === it.tpl);
        if (match && it.cents == null) { it.cents = match.cents; it.dueDay = match.dueDay; if (match.contractEnd) { it.contractEnd = match.contractEnd; it.noticeDays = match.noticeDays; } }
      });
    }
    if (topic === 'kredite') { S.data.debts = sm.debts.map((d) => { const { confirmed, ...rest } = d; return rest; }); S.erf.noDebts = false; }
    if (topic === 'haushalt') S.data.household = sm.household;
  }

  function validate(topic) {
    const d = S.data;
    if (topic === 'einkommen') {
      if (!(d.incomeCents > 0) || !Number.isInteger(d.salaryDay)) return 'Trag bitte Einkommen und Gehaltstag ein. Ohne beides kann accura nicht bis zum nächsten Gehalt rechnen.';
    }
    if (topic === 'konten') {
      const bad = d.accounts.filter((a) => !a.name || !a.name.trim() || !a.stand || a.stand.cents == null);
      if (!d.accounts.length) return 'Trag bitte mindestens ein Konto ein.';
      if (bad.length) return 'Bei ' + (bad.length === 1 ? 'einem Konto' : bad.length + ' Konten') + ' fehlen noch Name oder Stand.';
    }
    if (topic === 'kosten-auswahl') {
      if (!d.budgetItems.length) return 'Wähle mindestens einen Posten, zum Beispiel die Miete.';
    }
    if (topic === 'kosten-betraege') {
      const bad = d.budgetItems.filter((i) => i.cents == null || !i.label || !i.label.trim());
      if (bad.length) return 'Bei ' + (bad.length === 1 ? 'einem Posten' : bad.length + ' Posten') + ' fehlt noch der Betrag' + (bad.length <= 3 ? ': ' + bad.map((i) => i.label || 'Eigener Posten').join(', ') : '') + '.';
    }
    return null;
  }

  const TOPIC_DONE = { einkommen: 'einkommen', konten: 'konten', pockets: 'pockets', 'kosten-betraege': 'kosten', kredite: 'kredite', haushalt: 'haushalt' };

  // ---------- Aktionen ----------
  const acts = {
    toggleHide() { S.hide = !S.hide; save(); render(); },
    setPreset(v) { resetData(v); save(); toast(v === 'std' ? 'Testdaten geladen.' : 'Leerer Datenstand geladen.'); render(); },
    setScale(v) { S.scale = Number(v); save(); applyPrefs(); },
    setTheme(v) { S.theme = v; save(); applyPrefs(); },
    resetDummy() { Object.assign(S, initialState()); save(); applyPrefs(); toast('Dummy zurückgesetzt.'); go('#/start'); },
    startErfassung() { resetData('leer'); S.erf.started = true; save(); go('#/erfassen/willkommen'); },
    startUpdate() { resetData('std'); save(); go('#/staende/start'); },

    // Hinweise
    waive(id) { const h = compute().hints.find((x) => x.id === id); if (h) { S.waived[id] = h.signature; save(); toast('Hinweis ausgeblendet, bis sich etwas ändert.'); render(); } },
    unwaive(id) { delete S.waived[id]; save(); render(); },
    bumpFilm() { const it = S.data.budgetItems.find((i) => i.id === 'film'); if (it) { it.cents = 1499; save(); toast('Betrag geändert. Der Hinweis zu den Streamingdiensten kehrt zurück.'); render(); } },

    // Kredite
    saveBank(id) {
      const v = S.ui.bank[id];
      const d = S.data.debts.find((x) => x.id === id);
      if (v == null || v < 0 || !d) { S.ui.err = 'Bitte trag den Restbetrag aus deiner Bank-App ein, zum Beispiel 4.890,87.'; return render(); }
      d.confirmed = { day: S.today, cents: v };
      S.ui.bank[id] = undefined;
      save(); toast('Bankstand gespeichert. Er ist ab heute der Ausgangspunkt.'); render();
    },
    saveQuote(id) {
      const d = S.data.debts.find((x) => x.id === id);
      const v = S.ui.quote[id];
      if (!d) return;
      if (v == null) delete d.payoffQuote; else d.payoffQuote = { day: S.today, cents: v };
      save(); toast(v == null ? 'Ablösesumme entfernt.' : 'Ablösesumme gespeichert.'); render();
    },

    // Ersterfassung
    erfNext(arg, el) {
      const skip = el && el.dataset.skip;
      const err = skip ? null : validate(arg);
      if (err) { S.ui.err = err; return render(); }
      S.ui.err = null;
      if (TOPIC_DONE[arg]) S.erf.done[TOPIC_DONE[arg]] = true;
      const i = A.erfFlow.indexOf(arg === 'kosten-betraege' || arg === 'kosten-auswahl' || A.erfFlow.includes(arg) ? arg : arg);
      save();
      go('#/erfassen/' + A.erfFlow[Math.min(i + 1, A.erfFlow.length - 1)]);
    },
    erfFill(topic) { fill(topic); save(); toast('Testwerte eingesetzt.'); render(); },
    erfFillAll() {
      ['einkommen', 'konten', 'pockets', 'kosten', 'kredite', 'haushalt'].forEach(fill);
      A.erfTopics.forEach((t) => { S.erf.done[t.id] = true; });
      save(); toast('Alle Themen mit Testwerten gefüllt.'); render();
    },
    addAccount(arg) {
      const [name, kind] = arg.split('|');
      S.data.accounts.push({ id: 'a' + Date.now().toString(36), name, kind: kind || 'bank', stand: { day: S.today, cents: null } });
      save(); render();
    },
    removeAccount(i) { const [a] = S.data.accounts.splice(Number(i), 1); S.data.pockets = S.data.pockets.filter((p) => p.accountId !== a.id); save(); render(); },
    addPocket(name) { S.data.pockets.push({ id: 'p' + Date.now().toString(36), accountId: S.data.accounts[0].id, name, stand: { day: S.today, cents: null } }); save(); render(); },
    removePocket(i) { S.data.pockets.splice(Number(i), 1); save(); render(); },
    toggleTemplate(id, el) {
      const t = A.erfTemplates.find((x) => x.id === id);
      if (!t) return;
      if (el.checked) {
        S.data.budgetItems.push({ id: 'i-' + id, tpl: id, label: t.label, cents: null, necessity: t.necessity, kind: t.kind, category: t.category, subgroup: t.subgroup, dueDay: null });
      } else {
        S.data.budgetItems = S.data.budgetItems.filter((i) => i.tpl !== id);
      }
      save(); render();
    },
    addCustomItem() { S.data.budgetItems.push({ id: 'c' + Date.now().toString(36), label: '', cents: null, necessity: 'necessary', kind: 'expense', category: 'sonstiges', dueDay: null }); save(); toast('Eigener Posten hinzugefügt. Betrag und Name trägst du im nächsten Schritt ein.'); render(); },
    removeItem(i) { S.data.budgetItems.splice(Number(i), 1); save(); render(); },
    noDebts(v, el) { S.erf.noDebts = el.checked; save(); },
    erfFillDraft() {
      const d = sample().debts[0];
      S.ui.draft = { art: 'loan', lender: d.lender, principalCents: d.principalCents, nominalText: '5,90', effText: '6,06', monthlyPaymentCents: d.monthlyPaymentCents, firstPaymentDay: d.firstPaymentDay, paymentCount: String(d.paymentCount), finalPaymentCents: null, special: false, specialYearlyCents: null };
      render();
    },
    saveDebt() {
      const r = A.draftToDebt(S.ui.draft, S.today);
      if (r.missing.length) { S.ui.err = 'Es fehlt noch: ' + r.missing.join(', ') + '.'; return render(); }
      const key = S.ui.draftKey;
      const idx = key === 'new' ? -1 : parseInt(key, 10);
      if (idx >= 0) { r.debt.id = S.data.debts[idx].id; r.debt.confirmed = S.data.debts[idx].confirmed; S.data.debts[idx] = r.debt; } else S.data.debts.push(r.debt);
      S.ui.draftKey = null; S.ui.err = null; S.erf.noDebts = false;
      save(); toast('Kredit gespeichert. accura hat den Tilgungsplan gerechnet.'); go('#/erfassen/kredite');
    },
    addPerson() { S.data.household.push({ label: '', dailyKcal: null }); save(); render(); },
    removePerson(i) { S.data.household.splice(Number(i), 1); S.ui.calcFor = null; save(); render(); },
    openCalc(i) { S.ui.calcFor = S.ui.calcFor === Number(i) ? null : Number(i); render(); },
    applyCalc(i) {
      const k = A.kcalFromBody(S.ui.calc);
      if (!k) { S.ui.err = 'Trag bitte Gewicht, Größe und Alter ein.'; return render(); }
      S.data.household[Number(i)].dailyKcal = k;
      S.ui.calc = freshUi().calc; S.ui.calcFor = null; S.ui.err = null;
      save(); toast('Kalorienziel übernommen. Die Körperdaten sind verworfen.'); render();
    },

    // Stände aktualisieren
    updBegin(arg) {
      const C = compute();
      const queue = arg === 'all'
        ? [...C.accounts.filter((a) => a.has).map((a) => ({ type: 'account', id: a.id })), ...C.pockets.filter((p) => p.has).map((p) => ({ type: 'pocket', id: p.id }))]
        : C.stale.map((s) => ({ type: s.type, id: s.id }));
      S.upd = { queue, i: 0, changed: 0, kept: 0, skipped: 0, banks: 0, t0: Date.now(), t1: null, before: C.metrics.bisGehalt.value };
      S.ui.updKey = null; S.ui.upd = { val: null, bank: {} }; S.ui.err = null;
      save(); go('#/staende/0');
    },
    updSave() {
      const u = S.upd; const q = u.queue[u.i]; const f = A.findStand(S, q);
      const v = S.ui.upd.val;
      if (v == null) { S.ui.err = 'Bitte trag einen Betrag ein, zum Beispiel 1.482,60.'; return render(); }
      if (f.stand && f.stand.cents === v) u.kept++; else u.changed++;
      f.ref.stand = { day: S.today, cents: v };
      S.ui.err = null; advance();
    },
    updSkip() { S.upd.skipped++; S.ui.err = null; advance(); },
    updBanks(arg) {
      if (arg === 'save') {
        compute().ongoing.forEach((d) => {
          const v = S.ui.upd.bank[d.id];
          if (v != null && v !== d.restCents) {
            const debt = S.data.debts.find((x) => x.id === d.id);
            debt.confirmed = { day: S.today, cents: v };
            S.upd.banks++;
          }
        });
      }
      save(); go('#/staende/fertig');
    },
  };

  function advance() {
    const u = S.upd;
    u.i++;
    save();
    if (u.i < u.queue.length) return go('#/staende/' + u.i);
    return go(compute().ongoing.length ? '#/staende/kredite' : '#/staende/fertig');
  }

  // ---------- Eingaben ----------
  function readBind(el) {
    const t = el.dataset.type || 'text';
    if (el.type === 'checkbox') return el.checked;
    const v = el.value;
    if (t === 'int' || t === 'intnull') { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
    if (t === 'num') return Number(v);
    if (t === 'bool') return el.checked;
    return v;
  }

  function moneyValue(el) {
    const text = el.value;
    const box = el.closest('.mf');
    const minus = box && box.querySelector('[data-minus]');
    if (text.trim() === '') return { cents: null, empty: true };
    let cents = A.parseEUR(text);
    if (cents == null) return { cents: null, invalid: true };
    if (minus) {
      if (cents < 0) minus.checked = true;
      else if (minus.checked) cents = -cents;
    }
    return { cents };
  }

  function onMoney(el, finalize) {
    const r = moneyValue(el);
    setPath(S, el.dataset.money, r.cents);
    const pv = el.closest('.mf').querySelector('.mf-pv');
    el.setAttribute('aria-invalid', r.invalid ? 'true' : 'false');
    pv.classList.toggle('bad', !!r.invalid);
    pv.textContent = r.invalid ? 'Bitte nur Ziffern und ein Komma, zum Beispiel 1.482,60.' : r.cents == null ? '' : 'Gelesen als ' + A.fmtEUR(r.cents);
    if (finalize && r.cents != null) el.value = A.fmtPlain(Math.abs(r.cents));
    save(); refreshLive();
  }

  function refreshLive() {
    document.querySelectorAll('[data-livefn]').forEach((el) => {
      const fn = A.live && A.live[el.dataset.livefn];
      if (fn) el.innerHTML = fn(S);
    });
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || !acts[t.dataset.act]) return;
    acts[t.dataset.act](t.dataset.arg, t, e);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.money) return onMoney(t, false);
    if (t.dataset && t.dataset.bind && !(t.type === 'checkbox' || t.type === 'radio' || t.tagName === 'SELECT')) {
      setPath(S, t.dataset.bind, readBind(t)); save(); refreshLive();
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.dataset) return;
    if (t.dataset.actChange && acts[t.dataset.actChange]) return acts[t.dataset.actChange](t.value, t);
    if (t.dataset.minus) { const f = t.closest('.mf').querySelector('[data-money]'); return onMoney(f, true); }
    if (t.dataset.money) return onMoney(t, true);
    if (t.dataset.bind) {
      setPath(S, t.dataset.bind, readBind(t)); save();
      if (t.dataset.rerender) render(); else refreshLive();
    }
  });
  document.addEventListener('focusout', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.money) onMoney(t, true);
  });

  // ---------- Rahmen ----------
  const NAV = [
    { id: 'uebersicht', label: 'Übersicht', icon: 'home' },
    { id: 'demnaechst', label: 'Demnächst', icon: 'cal' },
    { id: 'budget', label: 'Budget', icon: 'pie' },
    { id: 'schulden', label: 'Schulden', icon: 'steps' },
  ];

  function applyPrefs() {
    const root = document.documentElement;
    root.style.setProperty('--scale', String(S.scale / 100));
    if (S.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', S.theme);
  }

  function resolve(hash) {
    const segs = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!segs.length) segs.push('start');
    if (R[segs[0] + '/' + segs[1]]) return { fn: R[segs[0] + '/' + segs[1]], args: segs.slice(2), key: segs.slice(0, 2).join('/') };
    if (segs[0] === 'staende' && /^\d+$/.test(segs[1] || '')) return { fn: R['staende/item'], args: [segs[1]], key: 'staende/item/' + segs[1] };
    if (R[segs[0]]) return { fn: R[segs[0]], args: segs.slice(1), key: segs.slice(0, 2).join('/') };
    return { fn: R.start, args: [], key: 'start' };
  }

  let lastKey = null;
  function render() {
    UI.hide = S.hide;
    applyPrefs();
    const { fn, args, key } = resolve(location.hash);
    const changed = key !== lastKey;
    if (changed) { S.ui.err = null; }
    const C = compute();
    const res = fn({ S, C }, args);
    const y = window.scrollY;

    // Kopfzeile
    const eye = '<button class="icon-btn" type="button" data-act="toggleHide" aria-pressed="' + S.hide + '" aria-label="Beträge ausblenden">' + UI.icon(S.hide ? 'eyeoff' : 'eye') + '</button>';
    let left = '';
    if (res.back) left = '<a class="icon-btn" href="' + res.back + '" aria-label="Zurück">' + UI.icon('back') + '</a>';
    else if (res.flow) left = '<a class="icon-btn" href="#/start" aria-label="Zum Dummy-Menü">' + UI.icon('close') + '</a>';
    let right = eye;
    if (res.nav) right += '<a class="icon-btn" href="#/mehr" aria-label="Mehr">' + UI.icon('more') + '</a>';
    if (res.later) right += '<a class="btn text tb-later" href="#/uebersicht">Später</a>';
    if (res.noBack) right = '';
    $('#topbar').innerHTML = '<div class="tb">' + left + '<h1 class="tb-t">' + UI.esc(res.title) + '</h1><div class="tb-r">' + right + '</div></div>';

    // Inhalt
    const main = $('#main');
    main.innerHTML = res.html;
    main.className = res.nav ? 'has-nav' : '';

    // Navigation
    const nav = $('#nav');
    if (res.nav) {
      nav.hidden = false;
      nav.innerHTML = NAV.map((n) => '<a class="nav-i" href="#/' + n.id + '"' + (n.id === res.nav ? ' aria-current="page"' : '') + '><span class="nav-pill">' + UI.icon(n.icon) + '</span><span class="nav-l">' + n.label + '</span></a>').join('');
    } else {
      nav.hidden = true; nav.innerHTML = '';
    }

    document.title = res.title + ' · accura Dummy';
    refreshLive();
    if (changed) {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
      $('#live').textContent = res.title;
    } else {
      window.scrollTo(0, y);
    }
    lastKey = key;
    save();
  }

  function safeRender() {
    try {
      render();
    } catch (e) {
      console.error(e);
      $('#main').innerHTML = '<div class="card"><h2>Im Dummy ist etwas schiefgegangen</h2><p>' + UI.esc(e.message) + '</p><p><a class="btn tonal" href="#/start">Zum Dummy-Menü</a></p></div>';
    }
  }
  window.addEventListener('hashchange', safeRender);
  safeRender();
})();
