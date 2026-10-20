/*
 * screens-erfassen.js: geführte Ersterfassung. Ein Thema pro Bildschirm, jederzeit unterbrechbar,
 * Vorlagen für feste Kosten, Kredite vollständig. Alles landet im Dummy-Zustand (S.data) und
 * fließt sofort in alle Ansichten.
 */
(function () {
  'use strict';
  const A = window.Accura;
  const UI = A.ui;
  const R = (A.screens = A.screens || {});
  const esc = UI.esc;
  const eur = UI.eur;

  const FLOW = ['willkommen', 'einkommen', 'konten', 'pockets', 'kosten-auswahl', 'kosten-betraege', 'kredite', 'haushalt', 'fertig'];
  const TOPICS = [
    { id: 'einkommen', label: 'Einkommen und Gehaltstag', route: 'einkommen' },
    { id: 'konten', label: 'Konten', route: 'konten' },
    { id: 'pockets', label: 'Pockets', route: 'pockets', optional: true },
    { id: 'kosten', label: 'Feste Kosten und Rücklagen', route: 'kosten-auswahl' },
    { id: 'kredite', label: 'Kredite', route: 'kredite', optional: true },
    { id: 'haushalt', label: 'Haushalt', route: 'haushalt', optional: true },
  ];
  const TOPIC_OF_ROUTE = { einkommen: 0, konten: 1, pockets: 2, 'kosten-auswahl': 3, 'kosten-betraege': 3, kredite: 4, 'kredit-neu': 4, haushalt: 5 };

  // Vorlagen für feste Kosten: Vorschlag für Kategorie und Notwendigkeit, meist reichen Betrag und Tag. (Auswahl: offen)
  const TEMPLATES = [
    { id: 'miete', group: 'Wohnen und Leben', label: 'Miete inkl. Nebenkosten', necessity: 'essential', category: 'wohnen', kind: 'expense' },
    { id: 'strom', group: 'Wohnen und Leben', label: 'Strom', necessity: 'essential', category: 'wohnen', kind: 'expense' },
    { id: 'essen', group: 'Wohnen und Leben', label: 'Lebensmittel', necessity: 'essential', category: 'lebensmittel', kind: 'expense' },
    { id: 'ticket', group: 'Wohnen und Leben', label: 'Monatsticket oder Fahrtkosten', necessity: 'necessary', category: 'mobilitaet', kind: 'expense' },
    { id: 'netz', group: 'Verträge und Versicherungen', label: 'Internet und Handy', necessity: 'necessary', category: 'vertrag', kind: 'expense' },
    { id: 'haftpflicht', group: 'Verträge und Versicherungen', label: 'Haftpflichtversicherung', necessity: 'necessary', category: 'versicherung', kind: 'expense' },
    { id: 'hausrat', group: 'Verträge und Versicherungen', label: 'Hausratversicherung', necessity: 'necessary', category: 'versicherung', kind: 'expense' },
    { id: 'stream-v', group: 'Abos', label: 'Streamingdienst (Video)', necessity: 'optional', category: 'abo', subgroup: 'streaming', kind: 'expense' },
    { id: 'stream-m', group: 'Abos', label: 'Streamingdienst (Musik)', necessity: 'optional', category: 'abo', subgroup: 'streaming', kind: 'expense' },
    { id: 'fitness', group: 'Abos', label: 'Fitnessstudio', necessity: 'worthwhile', category: 'abo', kind: 'expense' },
    { id: 'cloud', group: 'Abos', label: 'Cloud-Speicher', necessity: 'worthwhile', category: 'abo', kind: 'expense' },
    { id: 'freizeit', group: 'Freizeit', label: 'Freizeit und Kleidung', necessity: 'optional', category: 'freizeit', kind: 'expense' },
    { id: 'lieferdienst', group: 'Freizeit', label: 'Essen gehen und Lieferdienste', necessity: 'unnecessary', category: 'freizeit', kind: 'expense' },
    { id: 'notgroschen', group: 'Rücklagen', label: 'Notgroschen', necessity: 'necessary', category: 'ruecklage', kind: 'reserve' },
    { id: 'reise', group: 'Rücklagen', label: 'Reise', necessity: 'optional', category: 'ruecklage', kind: 'reserve' },
    { id: 'geschenke', group: 'Rücklagen', label: 'Geschenke', necessity: 'optional', category: 'ruecklage', kind: 'reserve' },
  ];
  const POCKET_TEMPLATES = ['Wohnen', 'Reise', 'Geschenke'];
  const ACCOUNT_TEMPLATES = [{ name: 'Girokonto', kind: 'bank' }, { name: 'Tagesgeld', kind: 'bank' }, { name: 'Bargeld', kind: 'cash' }];
  A.erfTemplates = TEMPLATES;

  const nav = ({ back, next, nextLabel, skip }) => '<div class="actions sticky">'
    + (back ? '<a class="btn tonal" href="#/erfassen/' + back + '">Zurück</a>' : '')
    + (skip ? '<button class="btn text" type="button" data-act="erfNext" data-arg="' + esc(skip) + '" data-skip="1">Überspringen</button>' : '')
    + '<button class="btn filled" type="button" data-act="erfNext" data-arg="' + esc(next) + '">' + esc(nextLabel || 'Weiter') + '</button></div>';

  const err = (S) => (S.ui.err ? '<div role="alert">' + UI.callout({ kind: 'achtung', title: S.ui.err }) + '</div>' : '');

  const head = (route, extra) => {
    const t = TOPIC_OF_ROUTE[route];
    return UI.stepHead({ n: t + 1, total: TOPICS.length, label: 'Thema' }) + '<h2 class="step-t">' + esc(TOPICS[t].label) + (TOPICS[t].optional ? ' <span class="opt">(optional)</span>' : '') + '</h2>' + (extra || '');
  };

  const view = (route, html, title) => ({ title: title || 'Ersterfassung', html, nav: null, flow: 'erfassen', later: true });

  // ---------- Willkommen ----------
  R['erfassen/willkommen'] = ({ S }) => {
    S.erf.started = true;
    const done = (id) => !!S.erf.done[id];
    const nDone = TOPICS.filter((t) => done(t.id)).length;
    let h = '<h2 class="step-t">Einmal eintragen, dann rechnet accura</h2>'
      + '<p class="lead">Ein Thema pro Bildschirm. Nimm Banking-App und Verträge zur Hand. Du kannst jederzeit aufhören, dein Fortschritt bleibt. Was sich ausrechnen lässt, fragt accura nicht ab.</p>';
    h += UI.list(TOPICS.map((t, i) => UI.row({
      title: (i + 1) + '. ' + t.label,
      sub: t.optional ? 'Kann übersprungen werden' : 'Nötig für die Übersicht',
      href: '#/erfassen/' + t.route,
      chips: done(t.id) ? '<span class="chip chip-ok">' + UI.icon('check') + 'Erledigt</span>' : '',
    })), 'Themen');
    h += '<p class="note">' + nDone + ' von ' + TOPICS.length + ' Themen erledigt.</p>';
    h += UI.dummyHelp('Alle Themen mit Testwerten füllen', 'erfFillAll');
    h += '<div class="actions sticky"><a class="btn filled" href="#/erfassen/' + TOPICS[Math.min(nDone, TOPICS.length - 1)].route + '">' + (nDone ? 'Weitermachen' : 'Beginnen') + '</a></div>';
    return view('willkommen', h, 'Ersterfassung');
  };

  // ---------- 1 Einkommen und Gehaltstag ----------
  R['erfassen/einkommen'] = ({ S }) => {
    const d = S.data;
    let h = head('einkommen', '<p class="lead">Beides braucht accura, um bis zum nächsten Gehalt zu rechnen.</p>') + err(S);
    h += '<div class="card form">'
      + UI.moneyField({ path: 'data.incomeCents', label: 'Monatliches Netto-Einkommen', cents: d.incomeCents, required: true, hint: 'Was im Schnitt monatlich auf dein Konto kommt.' })
      + UI.select({ path: 'data.salaryDay', label: 'Gehaltstag', value: d.salaryDay, type: 'int', options: UI.dayOptions('Bitte wählen'), hint: 'Der Tag, an dem dein Gehalt kommt. Ein Tag wie der 31. rutscht in kurzen Monaten auf den letzten Tag.' })
      + '</div>' + UI.dummyHelp('Testwerte einsetzen', 'erfFill', 'einkommen')
      + nav({ back: 'willkommen', next: 'einkommen' });
    return view('einkommen', h);
  };

  // ---------- 2 Konten ----------
  R['erfassen/konten'] = ({ S }) => {
    const d = S.data;
    let h = head('konten', '<p class="lead">Trag ein, wo dein Geld liegt, mit dem Stand von heute aus deiner Banking-App.</p>') + err(S);
    const chips = ACCOUNT_TEMPLATES.map((t) => '<button class="chip-btn" type="button" data-act="addAccount" data-arg="' + esc(t.name + '|' + t.kind) + '">' + UI.icon('plus') + esc(t.name) + '</button>').join('')
      + '<button class="chip-btn" type="button" data-act="addAccount" data-arg="|bank">' + UI.icon('plus') + 'Anderes Konto</button>';
    h += '<div class="chip-row" role="group" aria-label="Konto hinzufügen">' + chips + '</div>';
    h += d.accounts.map((a, i) => '<div class="card form"><div class="card-head"><h3>' + esc(a.name || 'Neues Konto') + '</h3>'
      + '<button class="btn text" type="button" data-act="removeAccount" data-arg="' + i + '" aria-label="Konto ' + esc(a.name || 'ohne Namen') + ' entfernen">Entfernen</button></div>'
      + UI.textField({ path: 'data.accounts.' + i + '.name', label: 'Name', value: a.name, placeholder: 'zum Beispiel Girokonto' })
      + UI.moneyField({ path: 'data.accounts.' + i + '.stand.cents', label: 'Stand von heute', cents: a.stand ? a.stand.cents : null, required: true, negatable: true, hint: a.kind === 'cash' ? 'Wie viel Bargeld du ungefähr dabeihast.' : '' })
      + '</div>').join('');
    if (!d.accounts.length) h += '<p class="note">Noch kein Konto. Tippe oben auf eine Vorlage.</p>';
    h += UI.dummyHelp('Testwerte einsetzen', 'erfFill', 'konten') + nav({ back: 'einkommen', next: 'konten' });
    return view('konten', h);
  };

  // ---------- 3 Pockets ----------
  R['erfassen/pockets'] = ({ S }) => {
    const d = S.data;
    let h = head('pockets', '<p class="lead">Pockets sind Unterkonten, zum Beispiel für Wohnen oder Reise. Sie sind eine zweite Sicht auf Geld, das schon auf einem Konto liegt, und zählen nicht zusätzlich.</p>');
    if (!d.accounts.length) {
      h += UI.callout({ kind: 'achtung', title: 'Pockets gehören zu einem Konto', text: 'Trag zuerst ein Konto ein.' });
      return view('pockets', h + nav({ back: 'konten', next: 'pockets', skip: 'pockets' }));
    }
    h += '<div class="chip-row" role="group" aria-label="Pocket hinzufügen">'
      + POCKET_TEMPLATES.map((t) => '<button class="chip-btn" type="button" data-act="addPocket" data-arg="' + esc(t) + '">' + UI.icon('plus') + esc(t) + '</button>').join('')
      + '<button class="chip-btn" type="button" data-act="addPocket" data-arg="">' + UI.icon('plus') + 'Eigener Name</button></div>';
    h += d.pockets.map((p, i) => '<div class="card form"><div class="card-head"><h3>' + esc(p.name || 'Neues Pocket') + '</h3>'
      + '<button class="btn text" type="button" data-act="removePocket" data-arg="' + i + '" aria-label="Pocket ' + esc(p.name || 'ohne Namen') + ' entfernen">Entfernen</button></div>'
      + UI.textField({ path: 'data.pockets.' + i + '.name', label: 'Name', value: p.name })
      + UI.select({ path: 'data.pockets.' + i + '.accountId', label: 'Liegt auf Konto', value: p.accountId, options: d.accounts.map((a) => ({ v: a.id, label: a.name || 'Konto' })) })
      + UI.moneyField({ path: 'data.pockets.' + i + '.stand.cents', label: 'Stand von heute', cents: p.stand ? p.stand.cents : null, required: true })
      + '</div>').join('');
    h += UI.dummyHelp('Testwerte einsetzen', 'erfFill', 'pockets') + nav({ back: 'konten', next: 'pockets', skip: 'pockets' });
    return view('pockets', h);
  };

  // ---------- 4a Feste Kosten: Auswahl ----------
  R['erfassen/kosten-auswahl'] = ({ S }) => {
    const d = S.data;
    const chosen = (id) => d.budgetItems.some((i) => i.tpl === id);
    const groups = [...new Set(TEMPLATES.map((t) => t.group))];
    const nCustom = d.budgetItems.filter((i) => !i.tpl).length;
    let h = head('kosten-auswahl', '<p class="lead">Wähle, was bei dir regelmäßig anfällt. Kategorie und Notwendigkeit schlägt accura vor, meist fehlen dann nur Betrag und Abbuchungstag.</p>') + err(S);
    groups.forEach((g) => {
      h += '<fieldset class="tpl-group"><legend>' + esc(g) + '</legend>' + TEMPLATES.filter((t) => t.group === g).map((t) => {
        const id = 'tpl-' + t.id;
        return '<div class="tpl"><input type="checkbox" id="' + id + '" data-act-change="toggleTemplate" value="' + esc(t.id) + '"' + (chosen(t.id) ? ' checked' : '') + '>'
          + '<label for="' + id + '"><span class="tpl-l">' + esc(t.label) + '</span><small>' + esc(A.necessityLabel(t.necessity)) + ' · ' + esc(A.CATEGORY[t.category]) + '</small></label></div>';
      }).join('') + '</fieldset>';
    });
    h += '<div class="chip-row"><button class="chip-btn" type="button" data-act="addCustomItem">' + UI.icon('plus') + 'Eigenen Posten hinzufügen</button></div>';
    h += '<p class="note">' + d.budgetItems.length + ' Posten ausgewählt' + (nCustom ? ', davon ' + nCustom + ' eigene' : '') + '.</p>';
    h += UI.dummyHelp('Testposten auswählen', 'erfFill', 'kosten') + nav({ back: 'pockets', next: 'kosten-auswahl', nextLabel: 'Weiter zu den Beträgen' });
    return view('kosten-auswahl', h);
  };

  // ---------- 4b Feste Kosten: Beträge ----------
  R['erfassen/kosten-betraege'] = ({ S }) => {
    const d = S.data;
    let h = head('kosten-betraege', '<p class="lead">Pro Posten reichen Betrag und Abbuchungstag. Ohne Tag erscheint ein Posten nicht unter Demnächst.</p>') + err(S);
    h += d.budgetItems.map((it, i) => {
      const p = 'data.budgetItems.' + i;
      const isContract = it.category === 'abo' || it.category === 'vertrag';
      const more = UI.select({ path: p + '.necessity', label: 'Notwendigkeit', value: it.necessity, options: A.NECESSITY.map((n) => ({ v: n.id, label: n.label })), hint: 'Vorschlag von accura. Du kannst ihn ändern.' })
        + (it.kind === 'expense' ? UI.select({ path: p + '.category', label: 'Kategorie', value: it.category, options: Object.keys(A.CATEGORY).filter((k) => k !== 'ruecklage').map((k) => ({ v: k, label: A.CATEGORY[k] })) }) : '')
        + (isContract ? UI.textField({ path: p + '.contractEnd', label: 'Vertragsende', value: it.contractEnd || '', type: 'date', optional: true, hint: 'Mit Kündigungsfrist nennt accura den letzten Kündigungstag.' })
          + UI.textField({ path: p + '.noticeDays', label: 'Kündigungsfrist in Tagen', value: it.noticeDays == null ? '' : it.noticeDays, inputmode: 'numeric', optional: true }) : '');
      return '<div class="card form"><div class="card-head"><h3>' + esc(it.label || 'Eigener Posten') + '</h3>'
        + '<button class="btn text" type="button" data-act="removeItem" data-arg="' + i + '" aria-label="Posten ' + esc(it.label || 'ohne Namen') + ' entfernen">Entfernen</button></div>'
        + (it.tpl ? '' : UI.textField({ path: p + '.label', label: 'Bezeichnung', value: it.label, placeholder: 'zum Beispiel Zeitung' }))
        + UI.moneyField({ path: p + '.cents', label: it.kind === 'reserve' ? 'Rücklage pro Monat' : 'Betrag im Monat', cents: it.cents, required: true })
        + (it.kind === 'expense' ? UI.select({ path: p + '.dueDay', label: 'Abbuchungstag', value: it.dueDay, type: 'intnull', options: UI.dayOptions('Kein fester Tag') }) : '')
        + '<details class="more"><summary><span>Mehr Angaben</span>' + UI.icon('chev', 'sg-ic') + '</summary><div class="more-body">' + more + '</div></details></div>';
    }).join('');
    if (!d.budgetItems.length) h += '<p class="note">Noch kein Posten ausgewählt.</p>';
    h += UI.dummyHelp('Testwerte einsetzen', 'erfFill', 'betraege') + nav({ back: 'kosten-auswahl', next: 'kosten-betraege' });
    return view('kosten-betraege', h);
  };

  // ---------- 5 Kredite ----------
  R['erfassen/kredite'] = ({ S, C }) => {
    const d = S.data;
    let h = head('kredite', '<p class="lead">Trag jeden Kredit einmal mit den Angaben aus dem Vertrag ein. Restschuld, Schuldenfrei-Datum, Zinskosten und Entlastungen rechnet accura selbst.</p>');
    if (C.debts.length) {
      h += UI.list(C.debts.map((x, i) => UI.row({
        title: x.name, sub: 'Rate ' + eur(x.monthlyPaymentCents) + ' · ' + x.paymentCount + ' Raten · Restschuld heute ' + eur(x.restCents),
        chips: '<span class="chip chip-basis">Berechnet</span>',
        href: '#/erfassen/kredit-neu/' + i,
      })), 'Erfasste Kredite');
    } else {
      h += '<p class="note">Noch kein Kredit eingetragen.</p>';
    }
    h += '<div class="actions"><a class="btn tonal" href="#/erfassen/kredit-neu/new">' + UI.icon('plus') + 'Kredit hinzufügen</a></div>';
    if (!d.debts.length) {
      h += '<div class="card form"><label class="check"><input type="checkbox" data-act-change="noDebts"' + (S.erf.noDebts ? ' checked' : '') + '><span>Ich habe keine Kredite oder Ratenkäufe</span></label></div>';
    }
    h += UI.dummyHelp('Testkredite einsetzen', 'erfFill', 'kredite') + nav({ back: 'kosten-betraege', next: 'kredite', skip: 'kredite' });
    return view('kredite', h);
  };

  /** Draft → Kredit-Objekt, oder null mit Liste der fehlenden Angaben. */
  function draftToDebt(dr, today) {
    const missing = [];
    const nominal = dr.art === 'installment0' ? 0 : A.parseBps(dr.nominalText);
    if (!dr.lender || !dr.lender.trim()) missing.push('Kreditgeber');
    if (dr.principalCents == null || dr.principalCents <= 0) missing.push('Ursprünglicher Betrag');
    if (nominal == null) missing.push('Sollzins');
    if (dr.monthlyPaymentCents == null || dr.monthlyPaymentCents <= 0) missing.push('Monatsrate');
    if (!dr.firstPaymentDay || !A.isDay(dr.firstPaymentDay)) missing.push('Erste Rate');
    const n = parseInt(dr.paymentCount, 10);
    if (!(n > 0 && n <= 600)) missing.push('Anzahl der Raten');
    let eff = dr.art === 'installment0' ? 0 : A.parseBps(dr.effText);
    if (missing.length) return { missing };
    if (eff == null) eff = suggestEff(nominal);
    return {
      missing,
      debt: {
        id: dr.id || 'kredit-' + Date.now().toString(36), name: A.ART[dr.art] + ' ' + dr.lender.trim(), lender: dr.lender.trim(), art: dr.art,
        principalCents: dr.principalCents, nominalBps: nominal, effBps: eff, monthlyPaymentCents: dr.monthlyPaymentCents,
        firstPaymentDay: dr.firstPaymentDay, paymentCount: n,
        finalPaymentCents: dr.finalPaymentCents != null ? dr.finalPaymentCents : undefined,
        specialRepayment: dr.special ? { yearlyCents: dr.specialYearlyCents } : undefined,
      },
    };
  }
  A.draftToDebt = draftToDebt;

  /** Vorschlag für den effektiven Jahreszins aus dem Sollzins (monatliche Verzinsung, ohne Gebühren), ganzzahlig in Basispunkten. */
  function suggestEff(nominalBps) {
    const SCALE = 10n ** 18n;
    const step = SCALE + (BigInt(nominalBps) * SCALE) / 120000n;
    let f = SCALE;
    for (let i = 0; i < 12; i++) f = (f * step) / SCALE;
    return Number(((f - SCALE) * 20000n + SCALE) / (2n * SCALE));
  }
  A.suggestEff = suggestEff;

  function kreditPreview(S) {
    const r = draftToDebt(S.ui.draft, S.today);
    if (r.missing.length) return '<p class="note">Sobald alle Angaben da sind, rechnet accura hier den Tilgungsplan: ' + esc(r.missing.join(', ')) + ' fehlt noch.</p>';
    const d = A.computeDebt(r.debt, S.today);
    const finalRow = d.lastRow;
    const warn = finalRow && Math.abs(finalRow.payment - r.debt.monthlyPaymentCents) > r.debt.monthlyPaymentCents / 2
      ? UI.callout({ kind: 'achtung', title: 'Die letzte Rate weicht stark von der Monatsrate ab', text: 'Berechnet ist ' + eur(finalRow.payment) + '. Prüfe Zins, Rate und Anzahl der Raten im Vertrag.' }) : '';
    const dev = r.debt.finalPaymentCents != null && finalRow && r.debt.finalPaymentCents !== finalRow.payment
      ? '<p class="note">Deine Schlussrate ' + eur(r.debt.finalPaymentCents) + ' weicht von der berechneten ' + eur(finalRow.payment) + ' um ' + eur(Math.abs(r.debt.finalPaymentCents - finalRow.payment)) + ' ab.</p>' : '';
    return '<div class="card preview"><h3>Daraus rechnet accura</h3><p class="chips">' + UI.basisChip('berechnet') + '</p><dl class="dl">'
      + '<div class="dl-r"><dt>Restschuld heute</dt><dd>' + eur(d.restCents) + '</dd></div>'
      + '<div class="dl-r"><dt>Letzte Rate</dt><dd>' + (finalRow ? esc(A.fmtDay(finalRow.day, 'lang')) + ' · ' + eur(finalRow.payment) : '–') + '</dd></div>'
      + '<div class="dl-r"><dt>Zinsen bis Ende</dt><dd>' + eur(d.remainingInterestCents) + '</dd></div>'
      + '<div class="dl-r"><dt>Noch zu zahlen</dt><dd>' + eur(d.remainingTotalCents) + '</dd></div></dl>'
      + '<p class="note">Banken runden und zählen Zinstage anders. Die Zahl kann um Cents bis wenige Euro abweichen. Sieht deine Bank-App einen anderen Wert, trägst du ihn später ein.</p></div>' + warn + dev;
  }
  A.live = A.live || {};
  A.live.kreditPreview = (S) => kreditPreview(S);

  R['erfassen/kredit-neu'] = ({ S, C }, args) => {
    const key = args[0] || 'new';
    if (S.ui.draftKey !== key) {
      S.ui.draftKey = key;
      const idx = key === 'new' ? -1 : parseInt(key, 10);
      const ex = idx >= 0 ? S.data.debts[idx] : null;
      S.ui.draft = ex
        ? { id: ex.id, art: ex.art, lender: ex.lender, principalCents: ex.principalCents, nominalText: ex.nominalBps ? A.fmtBps(ex.nominalBps).replace(/[\s ]%/, '') : '', effText: ex.effBps ? A.fmtBps(ex.effBps).replace(/[\s ]%/, '') : '', monthlyPaymentCents: ex.monthlyPaymentCents, firstPaymentDay: ex.firstPaymentDay, paymentCount: String(ex.paymentCount), finalPaymentCents: ex.finalPaymentCents == null ? null : ex.finalPaymentCents, special: !!ex.specialRepayment, specialYearlyCents: ex.specialRepayment ? ex.specialRepayment.yearlyCents : null }
        : { art: 'loan', lender: '', principalCents: null, nominalText: '', effText: '', monthlyPaymentCents: null, firstPaymentDay: '', paymentCount: '', finalPaymentCents: null, special: false, specialYearlyCents: null };
    }
    const dr = S.ui.draft;
    const zero = dr.art === 'installment0';
    const nominal = zero ? 0 : A.parseBps(dr.nominalText);
    let h = UI.stepHead({ n: 5, total: TOPICS.length, label: 'Thema' }) + '<h2 class="step-t">' + (key === 'new' ? 'Kredit hinzufügen' : 'Kredit ansehen') + '</h2>'
      + '<p class="lead">Die Angaben stehen im Kreditvertrag. Was sich rechnen lässt, trägst du nicht ein.</p>' + err(S);
    h += '<div class="card form">'
      + '<div class="field"><p class="label" id="art-l">Art</p>' + UI.choice({ name: 'Art', path: 'ui.draft.art', value: dr.art, options: [{ v: 'loan', label: 'Ratenkredit' }, { v: 'installment', label: 'Ratenkauf mit Zins' }, { v: 'installment0', label: 'Ratenkauf ohne Zins' }] }) + '</div>'
      + UI.textField({ path: 'ui.draft.lender', label: 'Kreditgeber', value: dr.lender, placeholder: 'zum Beispiel Musterbank' })
      + UI.moneyField({ path: 'ui.draft.principalCents', label: 'Ursprünglicher Betrag', cents: dr.principalCents, required: true })
      + (zero ? '<p class="note">Ohne Zins entfallen Sollzins und effektiver Jahreszins.</p>'
        : UI.textField({ path: 'ui.draft.nominalText', label: 'Sollzins in Prozent', value: dr.nominalText, inputmode: 'decimal', placeholder: '5,90' })
          + UI.textField({ path: 'ui.draft.effText', label: 'Effektiver Jahreszins in Prozent', value: dr.effText, inputmode: 'decimal', placeholder: nominal != null ? A.fmtBps(suggestEff(nominal)).replace(/[\s ]%/, '') : '6,06', hint: 'Steht im Vertrag. Ohne Eingabe nimmt accura den Vorschlag, aus dem Sollzins gerechnet. Mit Gebühren liegt der Vertragswert höher.' }))
      + UI.moneyField({ path: 'ui.draft.monthlyPaymentCents', label: 'Monatsrate', cents: dr.monthlyPaymentCents, required: true })
      + UI.textField({ path: 'ui.draft.firstPaymentDay', label: 'Erste Rate', value: dr.firstPaymentDay, type: 'date', hint: 'Der Tag der ersten Abbuchung. Daraus ergibt sich der Abbuchungstag jedes Monats.' })
      + UI.textField({ path: 'ui.draft.paymentCount', label: 'Anzahl der Raten', value: dr.paymentCount, inputmode: 'numeric', placeholder: '48' })
      + '<details class="more"><summary><span>Mehr Angaben</span>' + UI.icon('chev', 'sg-ic') + '</summary><div class="more-body">'
      + UI.moneyField({ path: 'ui.draft.finalPaymentCents', label: 'Abweichende Schlussrate', cents: dr.finalPaymentCents, required: false, hint: 'Nur, wenn der Vertrag sie nennt. Sonst rechnet accura sie aus.' })
      + '<label class="check"><input type="checkbox" data-bind="ui.draft.special" data-type="bool" data-rerender="1"' + (dr.special ? ' checked' : '') + '><span>Sondertilgung erlaubt</span></label>'
      + (dr.special ? UI.moneyField({ path: 'ui.draft.specialYearlyCents', label: 'Sondertilgung pro Jahr, höchstens', cents: dr.specialYearlyCents, required: false }) : '')
      + '</div></details></div>';
    h += '<div data-livefn="kreditPreview">' + kreditPreview(S) + '</div>';
    h += UI.dummyHelp('Testkredit einsetzen', 'erfFillDraft')
      + '<div class="actions sticky"><a class="btn tonal" href="#/erfassen/kredite">Abbrechen</a><button class="btn filled" type="button" data-act="saveDebt">Kredit speichern</button></div>';
    return view('kredit-neu', h, 'Kredit');
  };

  // ---------- 6 Haushalt ----------
  const ACTIVITY = [{ v: 1.2, label: 'Überwiegend sitzend' }, { v: 1.375, label: 'Leicht aktiv' }, { v: 1.55, label: 'Mäßig aktiv' }, { v: 1.725, label: 'Sehr aktiv' }];
  /** Mifflin-St Jeor mal Aktivitätsfaktor, auf 10 kcal gerundet. Rechnet nur im Browser, nichts wird gespeichert. */
  function kcalFromBody(c) {
    const w = Number(c.weight); const h = Number(c.height); const a = Number(c.age);
    if (!(w > 0 && h > 0 && a > 0)) return null;
    const bmr = 10 * w + 6.25 * h - 5 * a + (c.variant === 'w' ? -161 : 5);
    return Math.round((bmr * Number(c.activity)) / 10) * 10;
  }
  A.kcalFromBody = kcalFromBody;
  A.live.kcalCalc = (S) => {
    const k = kcalFromBody(S.ui.calc);
    return k ? '<p class="mf-pv">Ergibt etwa <strong class="num">' + A.fmtInt(k) + ' kcal</strong> am Tag.</p>' : '<p class="mf-pv">Trag Gewicht, Größe und Alter ein.</p>';
  };

  R['erfassen/haushalt'] = ({ S }) => {
    const d = S.data;
    let h = head('haushalt', '<p class="lead">Für den Lebensmittel-Hinweis. Gespeichert wird nur das Kalorienziel je Person, keine Körperdaten.</p>');
    h += d.household.map((p, i) => {
      const open = S.ui.calcFor === i;
      return '<div class="card form"><div class="card-head"><h3>' + esc(p.label || 'Person') + '</h3><button class="btn text" type="button" data-act="removePerson" data-arg="' + i + '" aria-label="Person ' + esc(p.label || '') + ' entfernen">Entfernen</button></div>'
        + UI.textField({ path: 'data.household.' + i + '.label', label: 'Name', value: p.label })
        + UI.textField({ path: 'data.household.' + i + '.dailyKcal', label: 'Kalorienziel pro Tag in kcal', value: p.dailyKcal == null ? '' : p.dailyKcal, inputmode: 'numeric', placeholder: '2000' })
        + '<div class="actions inline"><button class="btn tonal" type="button" data-act="openCalc" data-arg="' + i + '">' + (open ? 'Rechner schließen' : 'Ausrechnen lassen') + '</button></div>'
        + (open ? '<div class="calc">'
          + '<p class="note">Der Rechner läuft nur auf diesem Handy. Gewicht, Größe und Alter werden nicht gespeichert, nur das Ergebnis, wenn du es übernimmst.</p>'
          + UI.textField({ path: 'ui.calc.weight', label: 'Gewicht in kg', value: S.ui.calc.weight, inputmode: 'numeric' })
          + UI.textField({ path: 'ui.calc.height', label: 'Größe in cm', value: S.ui.calc.height, inputmode: 'numeric' })
          + UI.textField({ path: 'ui.calc.age', label: 'Alter in Jahren', value: S.ui.calc.age, inputmode: 'numeric' })
          + '<div class="field"><p class="label">Variante der Formel</p>' + UI.choice({ name: 'Variante der Formel', path: 'ui.calc.variant', value: S.ui.calc.variant, options: [{ v: 'm', label: 'männlich' }, { v: 'w', label: 'weiblich' }] }) + '<p class="hint-text">Die Formel nach Mifflin und St Jeor kennt nur diese beiden Varianten.</p></div>'
          + UI.select({ path: 'ui.calc.activity', label: 'Aktivität', value: S.ui.calc.activity, type: 'num', options: ACTIVITY.map((a) => ({ v: a.v, label: a.label })) })
          + '<div data-livefn="kcalCalc">' + A.live.kcalCalc(S) + '</div>'
          + '<div class="actions"><button class="btn filled" type="button" data-act="applyCalc" data-arg="' + i + '">Übernehmen</button></div></div>' : '')
        + '</div>';
    }).join('');
    h += '<div class="actions"><button class="btn tonal" type="button" data-act="addPerson">' + UI.icon('plus') + 'Person hinzufügen</button></div>';
    h += UI.dummyHelp('Testwerte einsetzen', 'erfFill', 'haushalt') + nav({ back: 'kredite', next: 'haushalt', skip: 'haushalt' });
    return view('haushalt', h);
  };

  // ---------- Fertig ----------
  R['erfassen/fertig'] = ({ S, C }) => {
    const m = C.metrics;
    let h = '<h2 class="step-t">Deine erste Übersicht</h2><p class="lead">Das hat accura aus deinen Angaben gerechnet. Alles, was fehlt, kannst du jederzeit ergänzen.</p>';
    h += UI.hero({ m: m.verfuegbar, tone: 'primary' });
    h += UI.section('Gleich daneben', '<div class="stack">' + UI.metricRow(m.freiImMonat, { tone: 'free' }) + UI.metricRow(m.schuldenfrei, { sub: 'Wann alles abbezahlt ist' }) + '</div>');
    h += UI.section('Stand der Themen', UI.list(TOPICS.map((t) => UI.row({
      title: t.label, href: '#/erfassen/' + t.route,
      chips: S.erf.done[t.id] ? '<span class="chip chip-ok">' + UI.icon('check') + (t.id === 'pockets' || t.id === 'kredite' || t.id === 'haushalt' ? 'Erledigt oder übersprungen' : 'Erledigt') + '</span>' : '<span class="chip chip-offen">' + UI.icon('dash') + 'Offen</span>',
    }))));
    h += '<p class="note">Alle Stände tragen das Datum von heute. Wird einer alt, sagt dir accura Bescheid.</p>';
    h += '<div class="actions sticky"><a class="btn tonal" href="#/erfassen/haushalt">Zurück</a><a class="btn filled" href="#/uebersicht">Zur Übersicht</a></div>';
    return view('fertig', h, 'Ersterfassung');
  };

  A.erfFlow = FLOW;
  A.erfTopics = TOPICS;
  A.erfPocketTemplates = POCKET_TEMPLATES;
  A.erfAccountTemplates = ACCOUNT_TEMPLATES;
})();
