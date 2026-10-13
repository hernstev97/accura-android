/*
 * screens-ansichten.js: die vier Ansichten (Übersicht, Demnächst, Budget, Schulden), Kennzahlen, Hinweise,
 * Datenalter, Mehr und das Dummy-Menü. Texte entstehen mit den Bildschirmen, nicht danach.
 */
(function () {
  'use strict';
  const A = window.Accura;
  const UI = A.ui;
  const R = (A.screens = A.screens || {});
  const esc = UI.esc;
  const eur = UI.eur;
  const stack = (items) => '<div class="stack">' + items.join('') + '</div>';
  const kindLabel = { bank: 'Bankkonto', cash: 'Bargeld', wallet: 'Wallet' };


  function staleCallout(C) {
    if (!C.stale.length) return '';
    const n = C.stale.length;
    return UI.callout({
      kind: 'achtung',
      title: (n === 1 ? 'Ein Stand ist' : n + ' Stände sind') + ' älter als ' + A.STALE_DAYS + ' Tage',
      text: 'Zahlen, die darauf beruhen, tragen den Hinweis „alt“. Mit einem Durchgang bist du wieder auf dem neuesten Stand.',
      actions: '<a class="btn tonal" href="#/staende/start">Stände aktualisieren</a>',
    });
  }

  function emptyView(S, title, text) {
    const n = Object.keys(S.erf.done).length;
    const action = S.erf.started
      ? '<a class="btn filled" href="#/erfassen/willkommen">Ersterfassung fortsetzen (' + n + ' von 6 Themen)</a>'
      : '<a class="btn filled" href="#/erfassen/willkommen">Mit der Ersterfassung beginnen</a>';
    return UI.empty({ title, text, action });
  }

  // ---------- Übersicht: Was habe ich wirklich? ----------
  R.uebersicht = ({ S, C }) => {
    const m = C.metrics;
    if (!C.accounts.length) {
      return { title: 'Übersicht', nav: 'uebersicht', html: emptyView(S, 'Noch nichts eingetragen', 'accura fragt dich einmal Schritt für Schritt nach deinen Konten, festen Kosten und Krediten. Danach siehst du hier, was du wirklich hast.') };
    }
    let h = UI.hero({ m: m.verfuegbar, tone: 'primary', sub: 'Summe deiner ' + C.accounts.length + (C.accounts.length === 1 ? ' Kontos' : ' Konten') });
    h += staleCallout(C);
    h += UI.section('Auf einen Blick', stack([
      UI.metricRow(m.freiImMonat, { tone: 'free', sub: 'Was nach Fixkosten, Raten und Rücklagen bleibt' }),
      UI.metricRow(m.puffer, { tone: 'reserve', sub: 'Wie lange das Geld für das Notwendige reicht' }),
      UI.metricRow(m.nettovermoegen, { sub: 'Konten minus Ablösesummen' }),
    ]));
    if (C.relief.length) {
      const e = C.relief[0];
      h += UI.section('Nächster Spielraum', UI.list([UI.row({
        title: 'Ab ' + A.fmtDay(e.from, 'monat') + ' bleiben ' + UI.plainEur(e.cents) + ' mehr im Monat',
        sub: esc(e.name) + ' ist dann abbezahlt. Frei im Monat steigt auf ' + eur(e.freeAfter) + '.',
        href: '#/schulden', tone: 'free',
      })]));
    }
    const accRows = C.accounts.map((a) => UI.row({
      title: a.name, sub: kindLabel[a.kind] || 'Konto', amount: a.has ? eur(a.cents) : '–',
      chips: a.has ? UI.standChip(a.day, a.ageDays) : '<span class="chip chip-offen">' + UI.icon('dash') + 'Stand fehlt</span>',
    }));
    h += UI.section('Konten', UI.list(accRows, 'Konten'));
    if (C.pockets.length) {
      const pRows = C.pockets.map((p) => {
        const acc = C.accounts.find((a) => a.id === p.accountId);
        return UI.row({ title: p.name, sub: 'Pocket in ' + esc(acc ? acc.name : 'Konto'), amount: p.has ? eur(p.cents) : '–', chips: p.has ? UI.standChip(p.day, p.ageDays) : '' });
      });
      h += UI.section('Pockets', UI.list(pRows, 'Pockets'), { lead: 'Pockets sind eine zweite Sicht auf dasselbe Geld. Sie zählen nicht zusätzlich zum Kontostand.' });
    }
    const hint = A.visibleHints(C.hints, S.waived)[0];
    if (hint) h += UI.section('Ein Hinweis', UI.hintCard(hint, { compact: true }));
    h += '<div class="actions center"><a class="btn tonal" href="#/kennzahlen">Alle Kennzahlen</a><a class="btn text" href="#/daten">Wie aktuell sind meine Daten?</a></div>';
    return { title: 'Übersicht', nav: 'uebersicht', html: h };
  };

  // ---------- Demnächst: Was wird bis zum Gehalt noch fällig? ----------
  R.demnaechst = ({ S, C }) => {
    const m = C.metrics;
    if (!C.accounts.length || !C.salaryDay) {
      return { title: 'Demnächst', nav: 'demnaechst', html: emptyView(S, 'Noch nicht berechenbar', 'Für diese Ansicht braucht accura mindestens ein Konto mit Stand und deinen Gehaltstag.') };
    }
    const sub = 'Noch ' + C.daysToSalary + ' Tage bis zum Gehalt am ' + esc(A.weekday(C.nextSalary) + ' ' + A.fmtDay(C.nextSalary));
    let h = UI.hero({ m: m.bisGehalt, tone: 'free', sub });
    h += staleCallout(C);
    h += UI.section('Pro Tag', stack([UI.metricRow(m.tagesrahmen, { tone: 'free', sub: 'Bis zum Gehalt, heute mitgezählt' })]));
    const rows = C.upcoming.map((u) => UI.row({
      title: u.label,
      sub: esc(A.weekday(u.day) + ' ' + A.fmtDay(u.day)) + ' · ' + (u.inDays === 0 ? 'heute' : u.inDays === 1 ? 'morgen' : 'in ' + u.inDays + ' Tagen') + ' · ' + u.daysBeforeSalary + (u.daysBeforeSalary === 1 ? ' Tag' : ' Tage') + ' vor dem Gehalt',
      amount: UI.signed(-u.cents),
      chips: u.type === 'rate' ? '<span class="chip chip-basis">Rate</span>' : '',
    }));
    if (C.income != null) {
      rows.push(UI.row({ title: 'Gehalt', sub: esc(A.weekday(C.nextSalary) + ' ' + A.fmtDay(C.nextSalary)) + ' · ab hier zählt der nächste Monat', amount: UI.signed(C.income), tone: 'free' }));
    }
    h += UI.section('Das geht noch ab', C.upcoming.length ? UI.list(rows, 'Zahlungen bis zum Gehalt') : '<p class="lead">Bis zum Gehalt stehen keine festen Zahlungen an.</p>' + UI.list(rows), {
      lead: C.upcoming.length ? 'Zusammen ' + eur(C.upcomingTotal) + ', in der Reihenfolge der Abbuchung.' : '',
    });
    h += '<p class="note">Nicht enthalten sind Posten ohne festen Tag, zum Beispiel Lebensmittel oder Freizeit. Sie kommen aus dem Betrag oben.</p>';
    return { title: 'Demnächst', nav: 'demnaechst', html: h };
  };

  // ---------- Budget: Wohin geht mein Einkommen? ----------
  R.budget = ({ S, C }) => {
    const m = C.metrics;
    if (C.income == null && !C.items.expenses.length) {
      return { title: 'Budget', nav: 'budget', html: emptyView(S, 'Noch kein Budget', 'Trag dein Einkommen und deine festen Kosten ein, dann zeigt accura hier, was jeden Monat frei bleibt.') };
    }
    let h = UI.hero({ m: m.freiImMonat, tone: 'free', sub: C.income != null ? 'von ' + eur(C.income) + ' Einkommen im Monat' : '' });
    if (C.split) {
      h += UI.section('Wohin das Einkommen geht', UI.splitBar(C.split, C.income));
    } else if (m.aufteilung.status === 'offen' && C.free < 0) {
      h += UI.callout({ kind: 'achtung', title: 'Mehr verplant als Einkommen', text: 'Geplant sind ' + eur(-C.free) + ' mehr, als monatlich hereinkommt. Das ist nur eine Rechnung. Du entscheidest, was du ändern willst.' });
    }
    const groups = A.NECESSITY.map((n) => ({ n, list: C.items.expenses.filter((i) => i.necessity === n.id) })).filter((g) => g.list.length);
    const itemRow = (i) => UI.row({
      title: i.label,
      sub: esc(A.CATEGORY[i.category] || '') + (Number.isInteger(i.dueDay) ? ' · am ' + i.dueDay + '.' : ' · ohne festen Tag'),
      amount: eur(i.cents),
    });
    const groupHtml = groups.map((g) => '<details class="group"><summary><span class="g-l">' + esc(g.n.label) + '<small>' + g.list.length + (g.list.length === 1 ? ' Posten' : ' Posten') + '</small></span><span class="g-v">'
      + eur(g.list.reduce((s, i) => s + i.cents, 0)) + '</span>' + UI.icon('chev', 'sg-ic') + '</summary>' + UI.list(g.list.map(itemRow)) + '</details>');
    if (C.ongoing.length) {
      groupHtml.push('<details class="group"><summary><span class="g-l">Raten<small>' + C.ongoing.length + ' laufend</small></span><span class="g-v">' + eur(C.ratesTotal) + '</span>' + UI.icon('chev', 'sg-ic') + '</summary>'
        + UI.list(C.ongoing.map((d) => UI.row({ title: d.name, sub: 'bis ' + esc(A.fmtDay(d.endDay, 'monat')), amount: eur(d.monthlyPaymentCents), href: '#/schuld/' + d.id }))) + '</details>');
    }
    if (C.items.reserves.length) {
      groupHtml.push('<details class="group tone-reserve"><summary><span class="g-l">Rücklagen<small>' + C.items.reserves.length + ' Posten</small></span><span class="g-v">' + eur(C.items.reserveTotal) + '</span>' + UI.icon('chev', 'sg-ic') + '</summary>'
        + UI.list(C.items.reserves.map(itemRow)) + '</details>');
    }
    h += UI.section('Nach Notwendigkeit', stack(groupHtml), { lead: 'Geplante Beträge, keine tatsächlichen Ausgaben.' });
    const hints = A.visibleHints(C.hints, S.waived);
    if (hints.length) {
      h += UI.section('Wo sich sparen lässt', hints.slice(0, 2).map((x) => UI.hintCard(x, { compact: true })).join('')
        + (hints.length > 2 ? '<p class="note">Noch ' + (hints.length - 2) + ' weitere Hinweise.</p>' : ''));
    }
    return { title: 'Budget', nav: 'budget', html: h };
  };

  // ---------- Schulden: Wie entwickeln sich meine Schulden? ----------
  R.schulden = ({ S, C }) => {
    const m = C.metrics;
    if (!C.debts.length) {
      return { title: 'Schulden', nav: 'schulden', html: UI.empty({ title: 'Keine Schulden eingetragen', text: 'Wenn du Kredite oder Ratenkäufe hast, trägst du sie einmal mit den Vertragsdaten ein. Restschuld und Schuldenfrei-Datum rechnet accura selbst.', action: '<a class="btn filled" href="#/erfassen/kredite">Kredit eintragen</a>' }) };
    }
    const end = m.schuldenfrei.value;
    const banks = C.debts.filter((d) => d.restSource === 'bank').length;
    let h = UI.hero({
      m: m.restschuld, tone: 'debt', id: 'rest',
      sub: end ? 'Schuldenfrei im ' + esc(A.fmtDay(end, 'monat')) + ' · noch ' + C.ongoing.reduce((mx, d) => Math.max(mx, d.remainingCount), 0) + ' Monate' : 'Alles abbezahlt.',
      extra: banks ? '<span class="chip chip-ok">' + UI.icon('check') + banks + (banks === 1 ? ' Kredit' : ' Kredite') + ' von der Bank bestätigt</span>' : '',
    });
    h += UI.section('Kennzahlen', stack([
      UI.metricRow(m.nochZuZahlen, { sub: 'Alle Raten bis zum Ende' }),
      UI.metricRow(m.zinsen, { sub: 'Der Zinsanteil davon' }),
      UI.metricRow(m.abloesesumme, { sub: 'Restschuld plus mögliche Entschädigung' }),
      UI.metricRow(m.mehrkosten, { sub: 'Bei planmäßiger Tilgung statt sofortiger Ablösung' }),
    ]));
    const rows = C.debts.map((d) => UI.row({
      title: d.name,
      sub: d.ongoing ? 'Rate ' + eur(d.monthlyPaymentCents) + ' · bis ' + esc(A.fmtDay(d.endDay, 'monat')) : 'abbezahlt',
      amount: eur(d.restCents), href: '#/schuld/' + d.id,
      chips: d.restSource === 'bank'
        ? '<span class="chip chip-ok">' + UI.icon('check') + 'Von der Bank bestätigt am ' + esc(A.fmtDay(d.confirmed.day)) + '</span>'
        : '<span class="chip chip-basis">Berechnet</span>',
    }));
    h += UI.section('Deine Kredite', UI.list(rows, 'Kredite'));
    if (C.relief.length) {
      h += UI.section('Wann Geld frei wird', UI.list(C.relief.map((e) => UI.row({
        title: 'Ab ' + A.fmtDay(e.from, 'monat'),
        sub: esc(e.name) + ' ist abbezahlt. Dann sind ' + eur(e.freeAfter) + ' im Monat frei.',
        amount: UI.signed(e.cents), tone: 'free',
      }))), { lead: 'Berechnet aus den Tilgungsplänen, nichts davon trägst du von Hand ein.' });
    }
    h += UI.section('Weg auf null', UI.seriesChart(C.series), { lead: 'Restschuld aller Kredite am Monatsende.' });
    return { title: 'Schulden', nav: 'schulden', html: h };
  };

  // ---------- Ein Kredit: Vertragsdaten, Plan, Bankstand ----------
  R.schuld = ({ S, C }, args) => {
    const d = C.debts.find((x) => x.id === args[0]);
    if (!d) return { title: 'Kredit', back: '#/schulden', html: UI.empty({ title: 'Kredit nicht gefunden', text: 'Zurück zur Übersicht der Schulden.', action: '<a class="btn tonal" href="#/schulden">Zu den Schulden</a>' }) };
    const rest = {
      id: 'rest-' + d.id, label: d.name, question: 'Wie viel schulde ich hier heute?', value: d.restCents, kind: 'eur', basis: d.restSource === 'bank' ? 'eingetragen' : 'berechnet', status: 'ok',
      oldestDay: d.restSource === 'bank' ? d.confirmed.day : null, ageDays: null, missing: [],
      steps: [{ label: d.restSource === 'bank' ? 'Von der Bank bestätigt am ' + A.fmtDay(d.confirmed.day) : 'Nach Tilgungsplan berechnet', cents: d.restCents, op: '+', items: [], text: '' }],
      note: d.restSource === 'bank'
        ? 'Dein Bankstand ist der neue Ausgangspunkt. Raten danach rechnet accura weiter.'
        : 'Banken runden und zählen Zinstage anders. Die Zahl kann um Cents bis wenige Euro abweichen. Sieht deine Bank-App einen anderen Wert, trag ihn unten ein.',
    };
    let h = UI.hero({ m: rest, tone: 'debt', id: 'k' });
    const next = d.rows.filter((r) => r.day >= C.today).slice(0, 6);
    const bankVal = S.ui.bank[d.id] != null ? S.ui.bank[d.id] : d.restCents;
    h += UI.section('Bankstand eintragen', '<div class="card form">'
      + UI.moneyField({ path: 'ui.bank.' + d.id, label: 'Restschuld laut Bank-App', cents: bankVal, required: true, hint: 'Gilt ab heute als neuer Ausgangspunkt für die Rechnung.' })
      + '<div class="actions"><button class="btn filled" type="button" data-act="saveBank" data-arg="' + esc(d.id) + '">Bankstand speichern</button></div></div>');
    const quoteVal = S.ui.quote[d.id] != null ? S.ui.quote[d.id] : null;
    h += UI.section('Ablösesumme', '<div class="card form"><p>' + (d.payoffQuote
      ? 'Laut Bank vom ' + esc(A.fmtDay(d.payoffQuote.day)) + ': ' + eur(d.payoffQuote.cents) + '.'
      : 'Höchstens ' + eur(d.payoffMaxCents) + '. Das ist die Restschuld plus eine Entschädigung, die die Bank bei vorzeitiger Rückzahlung verlangen darf. Der genaue Betrag steht erst fest, wenn du ihn bei der Bank erfragst.') + '</p>'
      + UI.moneyField({ path: 'ui.quote.' + d.id, label: 'Ablösesumme laut Bank', cents: quoteVal, required: false })
      + '<div class="actions"><button class="btn tonal" type="button" data-act="saveQuote" data-arg="' + esc(d.id) + '">Betrag speichern</button></div></div>');
    const dl = (k, v) => '<div class="dl-r"><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>';
    h += UI.section('Vertragsdaten', '<dl class="card dl">'
      + dl('Kreditgeber', esc(d.lender)) + dl('Art', esc(A.ART[d.art]))
      + dl('Ursprünglicher Betrag', eur(d.principalCents))
      + (d.nominalBps ? dl('Sollzins', esc(A.fmtBps(d.nominalBps))) + dl('Effektiver Jahreszins', esc(A.fmtBps(d.effBps))) : dl('Zins', 'ohne Zins'))
      + dl('Monatsrate', eur(d.monthlyPaymentCents)) + dl('Erste Rate', esc(A.fmtDay(d.firstPaymentDay, 'lang')))
      + dl('Anzahl Raten', String(d.paymentCount)) + dl('Schlussrate', d.lastRow ? eur(d.lastRow.payment) + ' <small>berechnet</small>' : '–') + '</dl>');
    h += UI.section('Nächste Raten', next.length ? UI.list(next.map((r) => UI.row({
      title: A.fmtDay(r.day, 'kurzJahr'), sub: 'Zins ' + eur(r.interest) + ' · Tilgung ' + eur(r.principalCents) + (r.payment !== d.monthlyPaymentCents ? ' · Schlussrate' : ''),
      amount: eur(r.payment),
    }))) : '<p class="lead">Alle Raten sind bezahlt.</p>', { lead: 'Zinsen sind vereinfacht gerechnet: Restschuld mal Sollzins durch zwölf, auf Cent gerundet.' });
    return { title: d.name, back: '#/schulden', html: h };
  };

  // ---------- Kennzahlen: alles mit Rechenweg ----------
  R.kennzahlen = ({ C }) => {
    const m = C.metrics;
    const sec = (t, list) => UI.section(t, stack(list.map((x) => UI.metricRow(x.m, { tone: x.tone, sub: x.sub }))));
    let h = '<p class="lead">accura rechnet mehr, als die Ansichten zeigen. Hier steht alles, jede Zahl mit ihrem Rechenweg. Tippe auf eine Zahl.</p>';
    h += '<div class="card legend"><h2>So liest du die Zahlen</h2><ul>'
      + '<li>' + UI.basisChip('eingetragen') + ' ein Stand, den du eingetragen hast</li>'
      + '<li>' + UI.basisChip('geplant') + ' ein Betrag aus deinem Plan, keine Ist-Ausgabe</li>'
      + '<li>' + UI.basisChip('berechnet') + ' von accura gerechnet</li>'
      + '<li>' + UI.basisChip('geschaetzt') + ' ein Richtwert, nicht dein Betrag</li>'
      + '<li><span class="chip chip-ok">' + UI.icon('check') + 'Stand vom 12. Okt.</span> belastbar</li>'
      + '<li><span class="chip chip-alt">' + UI.icon('clock') + 'Stand vom 2. Sept. · vor 41 Tagen</span> beruht auf alten Daten</li>'
      + '<li><span class="chip chip-offen">' + UI.icon('dash') + 'Noch nicht berechenbar</span> es fehlt etwas</li></ul></div>';
    h += sec('Spielraum', [
      { m: m.verfuegbar, tone: 'primary', sub: 'Was habe ich wirklich?' },
      { m: m.bisGehalt, tone: 'free', sub: 'Bis zum nächsten Gehalt' },
      { m: m.tagesrahmen, tone: 'free', sub: 'Pro Tag bis zum Gehalt' },
      { m: m.freiImMonat, tone: 'free', sub: 'Nach Fixkosten, Raten und Rücklagen' },
      { m: m.aufteilung, tone: 'free', sub: 'Anteil, der frei bleibt' },
    ]);
    h += sec('Puffer und Vermögen', [
      { m: m.puffer, tone: 'reserve', sub: 'Ohne Einkommen, nur Notwendiges' },
      { m: m.nettovermoegen, sub: 'Konten minus Ablösesummen' },
    ]);
    h += sec('Schulden', [
      { m: m.restschuld, sub: 'Nach Tilgungsplan' }, { m: m.abloesesumme, sub: 'Höchstens' }, { m: m.nochZuZahlen },
      { m: m.zinsen }, { m: m.mehrkosten }, { m: m.schuldenfrei }, { m: m.entlastung, tone: 'free', sub: 'Erste Entlastung' },
    ]);
    h += sec('Daten', [{ m: m.datenalter, sub: 'Ältester Stand' }]);
    return { title: 'Alle Kennzahlen', back: '#/uebersicht', html: h };
  };

  // ---------- Einspar-Hinweise ----------
  R.hinweise = ({ S, C }) => {
    const visible = A.visibleHints(C.hints, S.waived);
    const waived = C.hints.filter((h) => S.waived[h.id] === h.signature);
    let h = '<p class="lead">Konkrete Stellen, an denen sich sparen lässt. Das sind Vorschläge zum Nachdenken, du entscheidest. „Bewusst so“ blendet einen Hinweis aus, bis sich der Posten ändert.</p>';
    if (!C.items.expenses.length) {
      return { title: 'Einspar-Hinweise', back: '#/uebersicht', html: h + emptyView(S, 'Noch nichts zu prüfen', 'Hinweise entstehen aus deinen festen Kosten. Trag sie in der Ersterfassung ein.') };
    }
    if (visible.length) h += visible.map((x) => UI.hintCard(x)).join('');
    else h += UI.empty({ title: 'Gerade keine Hinweise', text: 'Alles, was auffällt, hast du mit „Bewusst so“ beantwortet. Ändert sich ein Posten, meldet sich der Hinweis wieder.', action: '' });
    if (visible.length > 1) h += '<p class="note">Die Hinweise überschneiden sich. Ihre Beträge addieren sich nicht.</p>';
    if (waived.length) {
      h += UI.section('Bewusst so (' + waived.length + ')', UI.list(waived.map((x) => UI.row({ title: x.title, sub: esc('Ausgeblendet, bis sich etwas ändert') }) + '<div class="actions inline"><button class="btn text" type="button" data-act="unwaive" data-arg="' + esc(x.id) + '">Wieder anzeigen</button></div>')));
    }
    h += UI.dummyHelp('Filmwelt von 13,99 € auf 14,99 € erhöhen', 'bumpFilm');
    return { title: 'Einspar-Hinweise', back: '#/uebersicht', html: h };
  };

  // ---------- Datenalter ----------
  R.daten = ({ S, C }) => {
    const m = C.metrics.datenalter;
    let h = '';
    if (m.status === 'offen') {
      return { title: 'Datenalter', back: '#/uebersicht', html: emptyView(S, 'Noch keine Stände', 'Sobald du Kontostände einträgst, zeigt accura hier, wie alt sie sind.') };
    }
    const old = C.stale.length;
    h += UI.hero({ m, tone: old ? 'attention' : 'free', id: 'alter', sub: old ? 'Der älteste Stand ist ' + esc(C.standList[0].name) + '. ' + old + (old === 1 ? ' Stand ist' : ' Stände sind') + ' älter als ' + A.STALE_DAYS + ' Tage.' : 'Alle Stände sind frisch. Mehr ist nicht zu tun.' });
    h += old
      ? '<div class="actions"><a class="btn filled" href="#/staende/start">Stände aktualisieren</a></div>'
      : '';
    const groups = ['Konten', 'Pockets', 'Kredite'];
    groups.forEach((g) => {
      const list = C.standList.filter((s) => s.group === g);
      if (!list.length) return;
      h += UI.section(g, UI.list(list.map((s) => UI.row({ title: s.name, sub: s.group === 'Kredite' ? 'Vom dir eingetragener Bankstand' : 'Eingetragen', amount: eur(s.cents), chips: UI.standChip(s.day, s.ageDays) }))));
    });
    const calculated = C.debts.filter((d) => d.restSource === 'plan');
    if (calculated.length) {
      h += UI.section('Berechnet statt eingetragen', UI.list(calculated.map((d) => UI.row({ title: d.name, sub: 'Restschuld nach Tilgungsplan. Ohne Alter, weil sie sich aus dem Vertrag ergibt.', amount: eur(d.restCents), chips: '<span class="chip chip-basis">Berechnet</span>' }))));
    }
    h += '<p class="note">Ein Stand gilt ab ' + (A.STALE_DAYS + 1) + ' Tagen als alt. Eine Erinnerung als Benachrichtigung folgt bald nach v1.</p>';
    return { title: 'Datenalter', back: '#/uebersicht', html: h };
  };

  // ---------- Mehr ----------
  R.mehr = ({ S, C }) => {
    const row = (title, sub, href) => UI.row({ title, sub, href });
    const off = (title, sub) => UI.row({ title, sub: sub + ' <em>(im Dummy nicht gezeigt)</em>' });
    let h = UI.list([
      row('Stände aktualisieren', C.stale.length ? C.stale.length + ' Stände sind alt' : 'Alles aktuell', '#/staende/start'),
      row('Alle Kennzahlen', 'Mit Rechenweg', '#/kennzahlen'),
      row('Einspar-Hinweise', A.visibleHints(C.hints, S.waived).length + ' offen', '#/hinweise'),
      row('Wie aktuell sind meine Daten?', 'Alter aller Stände', '#/daten'),
      row('Haushalt', 'Personen und Kalorienziel', '#/erfassen/haushalt'),
    ], 'Mehr');
    h += '<div class="card form"><div class="switch-row"><div><p class="row-t">Beträge ausblenden</p><p class="row-s">Ersetzt alle Beträge durch Punkte, wenn jemand mitschaut.</p></div>'
      + '<label class="switch"><input type="checkbox" data-act-change="toggleHide"' + (S.hide ? ' checked' : '') + '><span class="sr-only">Beträge ausblenden</span><span class="switch-ui" aria-hidden="true"></span></label></div></div>';
    h += UI.list([off('Darstellung', 'Hell, Dunkel, System'), off('Datenexport', 'Alle Daten als Datei'), off('Sperre', 'Fingerabdruck oder Gesicht'), off('Abmelden', 'Löscht die Offline-Kopie')], 'Weitere Einstellungen');
    h += '<div class="actions center"><a class="btn text" href="#/start">Dummy-Menü</a></div>';
    return { title: 'Mehr', back: '#/uebersicht', html: h };
  };

  // ---------- Dummy-Menü: Ablauf wählen ----------
  R.start = ({ S, C }) => {
    const card = (n, title, text, links) => '<section class="card flow"><h2><span class="flow-n" aria-hidden="true">' + n + '</span>' + esc(title) + '</h2><p>' + text + '</p><div class="actions">' + links + '</div></section>';
    const erfDone = Object.keys(S.erf.done).length;
    let h = '<p class="lead">Grobe Abläufe zum Durchklicken. Es geht um Reihenfolge, Inhalt und Texte, nicht um Optik. Alle Zahlen sind ausgedacht. Heute ist im Dummy der ' + esc(A.fmtDay(S.today, 'lang')) + '.</p>';
    h += card(1, 'Ersterfassung', 'Geführt, ein Thema pro Bildschirm, mit Vorlagen. Startet mit einem leeren Konto und setzt die Testdaten zurück. Kredite werden vollständig erfasst.',
      '<button class="btn filled" type="button" data-act="startErfassung">Leer starten</button>'
      + (S.erf.started ? '<a class="btn tonal" href="#/erfassen/willkommen">Weitermachen (' + erfDone + ' von 6 Themen)</a>' : ''));
    h += card(2, 'Stände aktualisieren', 'Alle alten Stände in einem Durchgang, mit dem alten Wert als Vorschlag. Ziel: unter zwei Minuten. Braucht die Testdaten.',
      '<button class="btn filled" type="button" data-act="startUpdate">Mit Testdaten starten</button>');
    h += card(3, 'Die vier Ansichten', 'Übersicht, Demnächst, Budget, Schulden, wie sie mit Daten aussehen. Mit „Leer“ siehst du die Leerzustände.',
      '<a class="btn filled" href="#/uebersicht">Übersicht</a><a class="btn tonal" href="#/demnaechst">Demnächst</a><a class="btn tonal" href="#/budget">Budget</a><a class="btn tonal" href="#/schulden">Schulden</a>');
    h += card(4, 'Kennzahlen und „So gerechnet“', 'Alle Kennzahlen mit Rechenweg zum Aufklappen, Status und Datenalter.',
      '<a class="btn filled" href="#/kennzahlen">Alle Kennzahlen</a>');
    h += card(5, 'Einspar-Hinweise', 'Konkrete Hinweise zu Abos, Lebensmitteln und Posten mit niedriger Notwendigkeit. „Bewusst so“ blendet aus.',
      '<a class="btn filled" href="#/hinweise">Hinweise</a>');
    h += card(6, 'Datenalter', 'Wie alt ist jeder Stand, und was zeigt die App, wenn Zahlen auf alten Daten beruhen.',
      '<a class="btn filled" href="#/daten">Datenalter</a>');
    h += UI.section('Einstellungen des Dummys', '<div class="card form">'
      + '<div class="field"><p class="label">Datenstand</p><div class="choice" role="radiogroup" aria-label="Datenstand">'
      + ['std:Testdaten', 'leer:Leer'].map((o) => { const [v, l] = o.split(':'); return '<span class="choice-i"><input type="radio" name="preset" id="pr-' + v + '" value="' + v + '" data-act-change="setPreset"' + (S.preset === v ? ' checked' : '') + '><label for="pr-' + v + '">' + l + '</label></span>'; }).join('') + '</div></div>'
      + '<div class="field"><p class="label">Schriftgröße</p><div class="choice" role="radiogroup" aria-label="Schriftgröße">'
      + [100, 150, 200].map((v) => '<span class="choice-i"><input type="radio" name="scale" id="sc-' + v + '" value="' + v + '" data-act-change="setScale"' + (S.scale === v ? ' checked' : '') + '><label for="sc-' + v + '">' + v + ' %</label></span>').join('') + '</div></div>'
      + '<div class="field"><p class="label">Darstellung</p><div class="choice" role="radiogroup" aria-label="Darstellung">'
      + ['system:System', 'light:Hell', 'dark:Dunkel'].map((o) => { const [v, l] = o.split(':'); return '<span class="choice-i"><input type="radio" name="theme" id="th-' + v + '" value="' + v + '" data-act-change="setTheme"' + (S.theme === v ? ' checked' : '') + '><label for="th-' + v + '">' + l + '</label></span>'; }).join('') + '</div></div>'
      + '<div class="actions"><button class="btn tonal" type="button" data-act="resetDummy">Dummy zurücksetzen</button></div></div>');
    return { title: 'accura Klick-Dummy', html: h, nav: null, noBack: true };
  };
})();
