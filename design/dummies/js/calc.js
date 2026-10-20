/*
 * calc.js: Rechenkern des Klick-Dummys.
 * Im echten Neubau rechnet Convex (TypeScript), die App zeigt nur an. Der Dummy rechnet
 * hier, damit jede Zahl auf jedem Bildschirm aus denselben Cents stammt.
 * Jede Kennzahl kommt als Paket: Wert, Rechenweg, Datenalter und Status (Plan, "Rechnen und Erkenntnisse").
 * Alle Regeln und Schwellen sind Annahmen des Dummys. Offene sind im Leitfaden als "offen" markiert.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./core.js') : globalThis.Accura);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Accura = Object.assign(root.Accura || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function (core) {
  'use strict';

  const STALE_DAYS = 7; // offen: ab wann ein Stand "alt" heißt
  const NOTICE_WINDOW_DAYS = 120; // offen: wie früh vor dem letzten Kündigungstag der Hinweis erscheint
  const FOOD = { daysPerMonth: 30, minCentsPer1000Kcal: 150, maxCentsPer1000Kcal: 300 }; // Platzhalter, Quelle offen

  const NECESSITY = [
    { id: 'essential', label: 'Existenziell' },
    { id: 'necessary', label: 'Notwendig' },
    { id: 'worthwhile', label: 'Sinnvoll' },
    { id: 'optional', label: 'Optional' },
    { id: 'unnecessary', label: 'Unnötig' },
  ];
  const CATEGORY = {
    wohnen: 'Wohnen', lebensmittel: 'Lebensmittel', mobilitaet: 'Mobilität', versicherung: 'Versicherung',
    vertrag: 'Vertrag', abo: 'Abo', freizeit: 'Freizeit', sonstiges: 'Sonstiges', ruecklage: 'Rücklage',
  };
  const ART = { loan: 'Ratenkredit', installment: 'Ratenkauf mit Zins', installment0: 'Ratenkauf ohne Zins' };
  const SUBGROUP = { streaming: 'Streamingdienste' };
  const NUMBER_WORDS = ['', '', 'Zwei', 'Drei', 'Vier', 'Fünf'];

  const necessityLabel = (id) => (NECESSITY.find((n) => n.id === id) || { label: id }).label;
  const necessityRank = (id) => NECESSITY.findIndex((n) => n.id === id);
  const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
  const hasCents = (x) => x != null && Number.isSafeInteger(x);

  // ---------- Kredite: Tilgungsplan ----------

  /**
   * Monatlicher Tilgungsplan. Vereinfacht: Zins je Monat = Restschuld mal Sollzins durch 12, auf Cent gerundet.
   * Banken zählen Zinstage anders, deshalb ist das Ergebnis "berechnet" und kann um Cents bis wenige Euro abweichen.
   * Ein bestätigter Bankstand (confirmed) ersetzt die Rechnung ab seinem Tag und ist neuer Ausgangspunkt.
   */
  function schedule(debt) {
    const first = core.parseDay(debt.firstPaymentDay);
    const conf = debt.confirmed || null;
    const rows = [];
    let bal = debt.principalCents;
    let fromBank = false;
    for (let i = 0; i < debt.paymentCount; i++) {
      const day = core.monthPlus(debt.firstPaymentDay, i, first.d);
      if (conf && !fromBank && day > conf.day) {
        bal = conf.cents;
        fromBank = true;
      }
      if (bal <= 0) break;
      const interest = core.roundDiv(bal * debt.nominalBps, 120000);
      const isLast = i === debt.paymentCount - 1;
      let payment = debt.monthlyPaymentCents;
      if (isLast) payment = hasCents(debt.finalPaymentCents) ? debt.finalPaymentCents : bal + interest;
      else if (payment >= bal + interest) payment = bal + interest;
      bal = bal + interest - payment;
      rows.push({ i, day, payment, interest, principalCents: payment - interest, balanceAfter: bal, fromBank });
    }
    return rows;
  }

  /** Restschuld nach allen Raten bis einschließlich `day`. */
  function balanceAt(debt, rows, day) {
    const conf = debt.confirmed || null;
    let last = null;
    for (const r of rows) {
      if (r.day <= day) last = r;
      else break;
    }
    if (conf && conf.day <= day && (!last || last.day <= conf.day)) return { cents: conf.cents, source: 'bank' };
    return { cents: last ? last.balanceAfter : debt.principalCents, source: 'plan' };
  }

  function computeDebt(debt, T) {
    const rows = schedule(debt);
    const rest = balanceAt(debt, rows, core.addDays(T, -1));
    const remaining = rows.filter((r) => r.day >= T);
    const remainingCount = remaining.length;
    // Obergrenze der Vorfälligkeitsentschädigung: Annahme des Dummys, vor dem Rechenkern gegenprüfen.
    const capBps = debt.nominalBps > 0 ? (remainingCount > 12 ? 100 : 50) : 0;
    const cap = rest.cents > 0 ? core.roundDiv(rest.cents * capBps, 10000) : 0;
    const quote = debt.payoffQuote && hasCents(debt.payoffQuote.cents) ? debt.payoffQuote : null;
    return {
      id: debt.id,
      name: debt.name,
      lender: debt.lender,
      art: debt.art,
      principalCents: debt.principalCents,
      nominalBps: debt.nominalBps,
      effBps: debt.effBps,
      monthlyPaymentCents: debt.monthlyPaymentCents,
      firstPaymentDay: debt.firstPaymentDay,
      paymentCount: debt.paymentCount,
      confirmed: debt.confirmed || null,
      rows,
      restCents: rest.cents,
      restSource: rest.source,
      remainingCount,
      remainingTotalCents: sum(remaining, (r) => r.payment),
      remainingInterestCents: sum(remaining, (r) => r.interest),
      capBps,
      capCents: cap,
      payoffQuote: quote,
      payoffMaxCents: quote ? quote.cents : rest.cents + cap,
      endDay: rows.length ? rows[rows.length - 1].day : null,
      nextRow: remaining[0] || null,
      lastRow: rows[rows.length - 1] || null,
      ongoing: remainingCount > 0,
    };
  }

  // ---------- Gehalt, Demnächst ----------

  /** Am Gehaltstag selbst gilt das Gehalt als eingegangen, der nächste Gehaltstag liegt dann im Folgemonat. */
  function nextSalaryDay(salaryDay, T) {
    const { y, m } = core.parseDay(T);
    const c = core.clampedDay(y, m, salaryDay);
    return c > T ? c : core.monthPlus(T, 1, salaryDay);
  }

  // ---------- Kennzahl-Paket ----------

  function metric(T, id, label, p) {
    const missing = p.missing || [];
    const ageDays = p.oldestDay ? core.daysBetween(p.oldestDay, T) : null;
    let status = 'ok';
    if (missing.length) status = 'offen';
    else if (ageDays != null && ageDays > STALE_DAYS) status = 'alt';
    return {
      id, label,
      question: p.question,
      value: missing.length ? null : p.value,
      kind: p.kind, // eur | monateZehntel | monat | prozent | tage | text
      basis: p.basis, // eingetragen | geplant | berechnet | geschaetzt
      status, // ok = belastbar, alt = beruht auf alten Daten, offen = nicht berechenbar
      oldestDay: p.oldestDay || null,
      ageDays,
      steps: p.steps || [],
      note: p.note || '',
      missing,
    };
  }

  const step = (label, cents, op, items, text) => ({ label, cents: cents == null ? null : cents, op: op || '', items: items || [], text: text || '' });

  /** Alle Kennzahlen, Listen und Hinweise für einen Datenstand und einen Kalendertag. */
  function compute(data, T) {
    const accounts = data.accounts.map((a) => ({
      id: a.id, name: a.name, kind: a.kind,
      has: !!(a.stand && hasCents(a.stand.cents)),
      cents: a.stand ? a.stand.cents : null,
      day: a.stand ? a.stand.day : null,
    })).map((a) => ({ ...a, ageDays: a.has ? core.daysBetween(a.day, T) : null }));
    const accs = accounts.filter((a) => a.has);
    const pockets = data.pockets.map((p) => ({
      id: p.id, name: p.name, accountId: p.accountId,
      has: !!(p.stand && hasCents(p.stand.cents)),
      cents: p.stand ? p.stand.cents : null,
      day: p.stand ? p.stand.day : null,
    })).map((p) => ({ ...p, ageDays: p.has ? core.daysBetween(p.day, T) : null }));
    const sumAccounts = sum(accs, (a) => a.cents);
    const oldestAccountDay = accs.length ? accs.map((a) => a.day).sort()[0] : null;

    const income = hasCents(data.incomeCents) ? data.incomeCents : null;
    const salaryDay = Number.isInteger(data.salaryDay) ? data.salaryDay : null;
    const nextSalary = salaryDay ? nextSalaryDay(salaryDay, T) : null;
    const daysToSalary = nextSalary ? core.daysBetween(T, nextSalary) : null;

    const debts = data.debts.map((d) => computeDebt(d, T));
    const ongoing = debts.filter((d) => d.ongoing);
    const ratesTotal = sum(ongoing, (d) => d.monthlyPaymentCents);

    const items = data.budgetItems.filter((i) => i.active !== false);
    const itemsMissing = items.filter((i) => !hasCents(i.cents));
    const entered = items.filter((i) => hasCents(i.cents));
    const expenses = entered.filter((i) => i.kind === 'expense');
    const reserves = entered.filter((i) => i.kind === 'reserve');
    const expenseTotal = sum(expenses, (i) => i.cents);
    const reserveTotal = sum(reserves, (i) => i.cents);

    // Demnächst: Zahlungen ab heute bis einschließlich Vortag des Gehalts
    const upcoming = [];
    if (nextSalary) {
      for (const k of [0, 1]) {
        const base = core.monthPlus(T, k, 1);
        const { y, m } = core.parseDay(base);
        for (const it of expenses) {
          if (!Number.isInteger(it.dueDay)) continue;
          const day = core.clampedDay(y, m, it.dueDay);
          if (day >= T && day < nextSalary) upcoming.push({ day, label: it.label, cents: it.cents, type: 'item', id: it.id });
        }
      }
      for (const d of ongoing) {
        for (const r of d.rows) {
          if (r.day >= T && r.day < nextSalary) upcoming.push({ day: r.day, label: 'Rate ' + d.name, cents: r.payment, type: 'rate', id: d.id });
        }
      }
      upcoming.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.label.localeCompare(b.label, 'de')));
    }
    const upcomingTotal = sum(upcoming, (u) => u.cents);
    upcoming.forEach((u) => { u.daysBeforeSalary = core.daysBetween(u.day, nextSalary); u.inDays = core.daysBetween(T, u.day); });

    const itemsOf = (list) => list.map((i) => ({ label: i.label, cents: i.cents }));
    const m = {};

    m.verfuegbar = metric(T, 'verfuegbar', 'Jetzt verfügbar', {
      question: 'Was habe ich wirklich?',
      value: sumAccounts, kind: 'eur', basis: 'eingetragen', oldestDay: oldestAccountDay,
      missing: accs.length ? [] : ['Mindestens ein Konto mit Stand'],
      steps: [step('Summe aller Konten', sumAccounts, '+', accs.map((a) => ({ label: a.name, cents: a.cents, note: 'Stand ' + core.fmtDay(a.day) })))],
      note: 'Pockets sind eine zweite Sicht auf dasselbe Geld und zählen nicht extra. Negative Stände bleiben negativ.',
    });

    // --- Bis Gehalt verfügbar, Tagesrahmen
    const gehaltMissing = [];
    if (!accs.length) gehaltMissing.push('Mindestens ein Konto mit Stand');
    accounts.filter((a) => !a.has).forEach((a) => gehaltMissing.push('Stand für ' + a.name));
    if (!salaryDay) gehaltMissing.push('Gehaltstag');
    const bis = sumAccounts - upcomingTotal;
    m.bisGehalt = metric(T, 'bisGehalt', 'Bis Gehalt verfügbar', {
      question: 'Wie viel kann ich bis zum nächsten Gehalt noch ausgeben?',
      value: bis, kind: 'eur', basis: 'berechnet', oldestDay: oldestAccountDay, missing: gehaltMissing,
      steps: [
        step('Summe aller Konten', sumAccounts, '+', accs.map((a) => ({ label: a.name, cents: a.cents, note: 'Stand ' + core.fmtDay(a.day) }))),
        upcoming.length
          ? step('Zahlungen bis zum Gehalt (' + upcoming.length + ')', -upcomingTotal, '−', upcoming.map((u) => ({ label: u.label, cents: u.cents, note: core.fmtDay(u.day) })))
          : step('Keine festen Zahlungen mehr bis zum Gehalt', 0, '−'),
      ],
      note: 'Pockets sind Teil der Konten und zählen nicht doppelt. Gerechnet sind Zahlungen ab heute bis einschließlich Vortag des Gehalts. Lebensmittel und andere Budgets ohne festen Tag sind nicht abgezogen, sie kommen aus diesem Betrag.',
    });
    m.tagesrahmen = metric(T, 'tagesrahmen', 'Tagesrahmen bis Gehalt', {
      question: 'Wie viel ist das pro Tag?',
      value: gehaltMissing.length ? null : core.floorDiv(bis, daysToSalary), kind: 'eur', basis: 'berechnet', oldestDay: oldestAccountDay, missing: gehaltMissing,
      steps: [
        step('Bis Gehalt verfügbar', bis, '+'),
        step('geteilt durch Tage bis zum Gehalt', null, '÷', [], daysToSalary ? daysToSalary + ' Tage (' + core.fmtDay(T) + ' bis ' + core.fmtDay(core.addDays(nextSalary, -1)) + ')' : ''),
      ],
      note: 'Auf ganze Cent abgerundet. Der heutige Tag zählt mit, der Gehaltstag nicht.',
    });

    // --- Frei im Monat, Aufteilung
    const freiMissing = [];
    if (income == null) freiMissing.push('Monatseinkommen');
    itemsMissing.forEach((i) => freiMissing.push('Betrag für ' + i.label));
    const free = (income || 0) - expenseTotal - ratesTotal - reserveTotal;
    m.freiImMonat = metric(T, 'freiImMonat', 'Frei im Monat', {
      question: 'Was bleibt vom Einkommen nach Budgetposten, Raten und Rücklagen?',
      value: free, kind: 'eur', basis: 'geplant', missing: freiMissing,
      steps: [
        step('Monatseinkommen', income, '+'),
        step('Budgetposten', -expenseTotal, '−', itemsOf(expenses)),
        step('Raten', -ratesTotal, '−', ongoing.map((d) => ({ label: d.name, cents: d.monthlyPaymentCents }))),
        step('Rücklagen', -reserveTotal, '−', itemsOf(reserves)),
      ],
      note: 'Geplante Werte, keine tatsächlichen Ausgaben. Raten zählen, solange sie laufen.',
    });
    let split = null;
    if (income != null && income > 0 && free >= 0) {
      const parts = [
        { id: 'fix', label: 'Fixkosten und Budget', cents: expenseTotal },
        { id: 'rates', label: 'Raten', cents: ratesTotal },
        { id: 'reserve', label: 'Rücklagen', cents: reserveTotal },
        { id: 'free', label: 'Frei', cents: free },
      ];
      const pct = core.shareWhole(parts.map((p) => p.cents), 100);
      split = parts.map((p, i) => ({ ...p, percent: pct[i] }));
    }
    m.aufteilung = metric(T, 'aufteilung', 'Aufteilung des Einkommens', {
      question: 'Welcher Anteil geht in Fixkosten, Raten, Rücklagen, was bleibt frei?',
      value: split ? split.find((p) => p.id === 'free').percent : null, kind: 'prozent', basis: 'geplant',
      missing: freiMissing.length ? freiMissing : free < 0 ? ['Mehr verplant als Einkommen: ' + core.fmtEUR(-free)] : [],
      steps: split ? split.map((p) => step(p.label, p.cents, '', [], p.percent + ' %')) : [],
      note: 'Prozente auf ganze Prozent verteilt, die Summe ist immer 100 %.',
    });

    // --- Puffer in Monaten
    const necessaryItems = expenses.filter((i) => necessityRank(i.necessity) <= 1);
    const necessaryCost = sum(necessaryItems, (i) => i.cents) + ratesTotal;
    const pufferMissing = [];
    if (!accs.length) pufferMissing.push('Mindestens ein Konto mit Stand');
    if (!necessaryCost) pufferMissing.push('Notwendige Monatskosten');
    m.puffer = metric(T, 'puffer', 'Puffer in Monaten', {
      question: 'Wie lange reichen Rücklagen und verfügbares Geld für die notwendigen Kosten ohne Einkommen?',
      value: pufferMissing.length ? null : core.floorDiv(sumAccounts * 10, necessaryCost), kind: 'monateZehntel', basis: 'berechnet', oldestDay: oldestAccountDay, missing: pufferMissing,
      steps: [
        step('Summe aller Konten', sumAccounts, '+'),
        step('geteilt durch notwendige Kosten im Monat', necessaryCost, '÷', [
          ...itemsOf(necessaryItems),
          ...ongoing.map((d) => ({ label: 'Rate ' + d.name, cents: d.monthlyPaymentCents })),
        ]),
      ],
      note: 'Notwendig sind die Stufen "Existenziell" und "Notwendig" plus alle laufenden Raten. Rücklagen liegen auf den Konten und zählen darin. Auf eine Nachkommastelle abgerundet.',
    });

    // --- Schulden
    const sumRest = sum(debts, (d) => d.restCents);
    const sumPayoff = sum(debts, (d) => d.payoffMaxCents);
    const sumRemaining = sum(debts, (d) => d.remainingTotalCents);
    const sumInterest = sum(debts, (d) => d.remainingInterestCents);
    const restNote = (d) => (d.restSource === 'bank' ? 'von der Bank bestätigt am ' + core.fmtDay(d.confirmed.day) : 'nach Tilgungsplan berechnet');
    m.restschuld = metric(T, 'restschuld', 'Restschuld heute', {
      question: 'Wie viel schulde ich heute, ohne dass ich es nachtragen muss?',
      value: sumRest, kind: 'eur', basis: 'berechnet',
      steps: debts.map((d) => step(d.name, d.restCents, '+', [], restNote(d))),
      note: 'Aus dem Tilgungsplan berechnet. Ein Bankstand, den du einträgst, ersetzt die Rechnung ab seinem Tag. Banken runden und zählen Zinstage anders, die Zahl kann um Cents bis wenige Euro abweichen.',
    });
    m.abloesesumme = metric(T, 'abloesesumme', 'Ablösesumme (Obergrenze)', {
      question: 'Was kostet die sofortige Ablösung höchstens?',
      value: sumPayoff, kind: 'eur', basis: 'berechnet',
      steps: debts.map((d) => (d.payoffQuote
        ? step(d.name, d.payoffMaxCents, '+', [], 'laut Bank vom ' + core.fmtDay(d.payoffQuote.day))
        : step(d.name, d.payoffMaxCents, '+', [
          { label: 'Restschuld', cents: d.restCents },
          { label: d.capBps ? 'Entschädigung, höchstens ' + core.fmtBps(d.capBps) + ' der Restschuld' : 'Entschädigung (Ratenkauf ohne Zins)', cents: d.capCents },
        ]))),
      note: 'Die Bank darf bei vorzeitiger Rückzahlung eine Entschädigung verlangen. Gezeigt ist die Obergrenze, die der Dummy annimmt (1 % bei mehr als 12 Monaten Restlaufzeit, sonst 0,5 %), oder der Betrag, den du von der Bank eingetragen hast.',
    });
    m.nochZuZahlen = metric(T, 'nochZuZahlen', 'Noch zu zahlen', {
      question: 'Was zahle ich bis zum Ende aller Kredite noch?',
      value: sumRemaining, kind: 'eur', basis: 'berechnet',
      steps: debts.map((d) => step(d.name, d.remainingTotalCents, '+', [], d.remainingCount + ' Raten')),
      note: 'Alle Raten ab heute laut Tilgungsplan, einschließlich der abweichenden Schlussrate.',
    });
    m.zinsen = metric(T, 'zinsen', 'Zinsen bis Laufzeitende', {
      question: 'Wie viel Zins zahle ich noch, je Kredit und insgesamt?',
      value: sumInterest, kind: 'eur', basis: 'berechnet',
      steps: debts.map((d) => step(d.name, d.remainingInterestCents, '+', [], d.nominalBps ? 'Sollzins ' + core.fmtBps(d.nominalBps) : 'ohne Zins')),
      note: 'Zinsanteil aller Raten ab heute.',
    });
    m.mehrkosten = metric(T, 'mehrkosten', 'Mehrkosten gegenüber Ablösung', {
      question: 'Was zahle ich bei planmäßiger Tilgung mehr als bei sofortiger Ablösung?',
      value: sumRemaining - sumPayoff, kind: 'eur', basis: 'berechnet',
      steps: [step('Noch zu zahlen', sumRemaining, '+'), step('Ablösesumme (Obergrenze)', -sumPayoff, '−')],
      note: 'Mit der Obergrenze der Entschädigung gerechnet. Mit dem Betrag deiner Bank kann sich das ändern.',
    });
    const lastEnd = ongoing.length ? ongoing.map((d) => d.endDay).sort().pop() : null;
    m.schuldenfrei = metric(T, 'schuldenfrei', 'Schuldenfrei', {
      question: 'Wann ist jede Schuld abbezahlt, wann alle?',
      value: lastEnd, kind: 'monat', basis: 'berechnet',
      steps: ongoing.map((d) => step(d.name, null, '', [], 'letzte Rate ' + core.fmtDay(d.endDay, 'kurzJahr'))),
      note: ongoing.length ? 'Die letzte Rate gibt den Monat vor. Ab dem Folgemonat ist die Rate frei.' : 'Keine laufende Schuld erfasst.',
    });

    // Entlastung: ab wann wird wie viel frei, weil eine Rate endet
    const relief = ongoing
      .map((d) => ({ debtId: d.id, name: d.name, from: core.monthPlus(d.endDay, 1, 1), lastDay: d.endDay, cents: d.monthlyPaymentCents }))
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    let acc = free;
    relief.forEach((e) => { acc += e.cents; e.freeAfter = acc; });
    m.entlastung = metric(T, 'entlastung', 'Entlastungsplan', {
      question: 'Ab wann wird wie viel Geld im Monat frei, weil eine Rate endet?',
      value: relief.length ? relief[0].cents : null, kind: 'eur', basis: 'berechnet', missing: relief.length ? freiMissing : ['Laufende Kredite'],
      steps: relief.map((e) => step('Ab ' + core.fmtDay(e.from, 'monat') + ': ' + e.name + ' endet', e.cents, '+', [], 'dann frei im Monat ' + core.fmtEUR(e.freeAfter))),
      note: 'Berechnet aus den Tilgungsplänen. Nichts davon trägst du von Hand ein.',
    });

    // Nettovermögen
    m.nettovermoegen = metric(T, 'nettovermoegen', 'Nettovermögen heute', {
      question: 'Kontostände minus Ablösesummen aller Schulden',
      value: sumAccounts - sumPayoff, kind: 'eur', basis: 'berechnet', oldestDay: oldestAccountDay,
      missing: accs.length ? [] : ['Mindestens ein Konto mit Stand'],
      steps: [
        step('Summe aller Konten', sumAccounts, '+', accs.map((a) => ({ label: a.name, cents: a.cents, note: 'Stand ' + core.fmtDay(a.day) }))),
        step('Ablösesummen (Obergrenze)', -sumPayoff, '−', debts.map((d) => ({ label: d.name, cents: d.payoffMaxCents }))),
      ],
      note: 'Pockets zählen nicht extra. Mit der Obergrenze der Entschädigung gerechnet.',
    });

    // Datenalter
    const standList = [
      ...accounts.filter((a) => a.has).map((a) => ({ type: 'account', id: a.id, name: a.name, cents: a.cents, day: a.day, ageDays: a.ageDays, group: 'Konten' })),
      ...pockets.filter((p) => p.has).map((p) => ({ type: 'pocket', id: p.id, name: p.name, cents: p.cents, day: p.day, ageDays: p.ageDays, group: 'Pockets' })),
      ...debts.filter((d) => d.restSource === 'bank').map((d) => ({ type: 'debt', id: d.id, name: d.name, cents: d.restCents, day: d.confirmed.day, ageDays: core.daysBetween(d.confirmed.day, T), group: 'Kredite' })),
    ].sort((a, b) => b.ageDays - a.ageDays);
    const oldest = standList.length ? standList[0] : null;
    m.datenalter = metric(T, 'datenalter', 'Datenalter', {
      question: 'Wie alt sind die Stände hinter jeder Zahl?',
      value: oldest ? oldest.ageDays : null, kind: 'tage', basis: 'eingetragen', oldestDay: oldest ? oldest.day : null,
      missing: oldest ? [] : ['Mindestens ein eingetragener Stand'],
      steps: standList.map((s) => step(s.name, s.cents, '', [], 'Stand ' + core.fmtDay(s.day) + ' (' + core.fmtDaysAgo(s.ageDays) + ')')),
      note: 'Ein Stand gilt ab ' + (STALE_DAYS + 1) + ' Tagen als alt. Die Schwelle ist im Dummy fest.',
    });

    const stale = standList.filter((s) => s.type !== 'debt' && s.ageDays > STALE_DAYS);

    return {
      today: T, income, salaryDay, nextSalary, daysToSalary,
      accounts, pockets, sumAccounts, oldestAccountDay, standList, stale,
      items: { expenses, reserves, missing: itemsMissing, expenseTotal, reserveTotal },
      debts, ongoing, ratesTotal, free, split, relief, upcoming, upcomingTotal,
      metrics: m,
      hints: computeHints(data, T, { expenses, free }),
      series: debtSeries(data, debts, T),
    };
  }

  /** Restschuld aller Kredite zum Monatsende, von heute bis zur letzten Rate (Weg auf null). */
  function debtSeries(data, debts, T) {
    const ongoing = debts.filter((d) => d.ongoing);
    if (!ongoing.length) return [];
    const end = ongoing.map((d) => d.endDay).sort().pop();
    const points = [{ day: T, label: 'heute', cents: sum(debts, (d) => d.restCents) }];
    let cursor = core.lastDayOfMonth(T);
    for (let guard = 0; guard < 600; guard++) {
      points.push({
        day: cursor, label: core.fmtDay(cursor, 'monat'),
        cents: sum(debts, (d) => balanceAt(data.debts.find((x) => x.id === d.id), d.rows, cursor).cents),
      });
      if (cursor >= end) break;
      cursor = core.lastDayOfMonth(core.monthPlus(cursor, 1, 1));
    }
    return points;
  }

  // ---------- Einspar-Hinweise ----------

  function computeHints(data, T, ctx) {
    const hints = [];
    const exp = ctx.expenses;
    const row = (i) => ({ label: i.label, cents: i.cents });
    const yearly = (c) => c * 12;
    const abos = exp.filter((i) => i.category === 'abo' || i.category === 'vertrag');

    // Abos der gleichen Art
    const groups = {};
    abos.forEach((i) => { if (i.subgroup) (groups[i.subgroup] = groups[i.subgroup] || []).push(i); });
    Object.keys(groups).forEach((g) => {
      const list = groups[g];
      if (list.length < 2) return;
      const cheapest = Math.min(...list.map((i) => i.cents));
      const dearest = Math.max(...list.map((i) => i.cents));
      hints.push({
        id: 'abo-' + g, rank: 3, type: 'abo',
        title: (NUMBER_WORDS[list.length] || list.length) + ' ' + (SUBGROUP[g] || 'Abos der gleichen Art'),
        text: 'Du zahlst dafür zusammen ' + core.fmtEUR(sum(list, (i) => i.cents)) + ' im Monat. Bestellst du einen ab, bleiben dir ' + core.fmtEUR(cheapest) + ' bis ' + core.fmtEUR(dearest) + ' im Monat.',
        monthlyCents: cheapest, yearlyCents: yearly(cheapest), from: true,
        steps: [
          step('Posten dieser Art', sum(list, (i) => i.cents), '+', list.map(row)),
          step('Wegfall des günstigsten', cheapest, '=', [], 'mindestens, je nachdem welchen du abbestellst'),
        ],
        why: 'Mehrere Abos derselben Art fallen auf. Ob du beide brauchst, entscheidest du.',
        signature: JSON.stringify(list.map((i) => [i.id, i.cents])),
        items: list.map((i) => i.id),
      });
    });

    // Letzter Kündigungstag
    abos.forEach((i) => {
      if (!i.contractEnd || !Number.isInteger(i.noticeDays)) return;
      const last = core.addDays(i.contractEnd, -i.noticeDays);
      const left = core.daysBetween(T, last);
      if (left < 0 || left > NOTICE_WINDOW_DAYS) return;
      hints.push({
        id: 'kuendigung-' + i.id, rank: 1, type: 'kuendigung',
        title: i.label + ': letzter Kündigungstag ' + core.fmtDay(last, 'kurzJahr'),
        text: 'Der Vertrag läuft bis ' + core.fmtDay(i.contractEnd, 'lang') + '. Kündigen geht noch ' + (left === 0 ? 'heute' : 'in ' + left + (left === 1 ? ' Tag' : ' Tagen')) + '. Du musst nichts tun, das ist nur zur Erinnerung.',
        monthlyCents: i.cents, yearlyCents: yearly(i.cents), from: false,
        steps: [
          step('Vertragsende', null, '', [], core.fmtDay(i.contractEnd, 'lang')),
          step('Kündigungsfrist', null, '−', [], i.noticeDays + ' Tage'),
          step('Letzter Kündigungstag', null, '=', [], core.fmtDay(last, 'lang')),
        ],
        why: 'Eine Kündigungsfrist ist erfasst. Der Hinweis erscheint, wenn der letzte Tag in den nächsten ' + NOTICE_WINDOW_DAYS + ' Tagen liegt.',
        signature: JSON.stringify([i.id, i.cents, i.contractEnd, i.noticeDays]),
        items: [i.id],
      });
    });

    // Lebensmittel gegen Richtwert
    const food = exp.filter((i) => i.category === 'lebensmittel');
    const members = data.household || [];
    if (food.length && members.length) {
      const budget = sum(food, (i) => i.cents);
      const kcalMonth = sum(members, (p) => p.dailyKcal) * FOOD.daysPerMonth;
      const lo = core.roundDiv(kcalMonth * FOOD.minCentsPer1000Kcal, 1000);
      const hi = core.roundDiv(kcalMonth * FOOD.maxCentsPer1000Kcal, 1000);
      if (budget > hi) {
        hints.push({
          id: 'lebensmittel', rank: 2, type: 'lebensmittel',
          title: 'Lebensmittel über dem Richtwert',
          text: 'Dein Budget von ' + core.fmtEUR(budget) + ' liegt über der großzügigen Grenze von ' + core.fmtEUR(hi) + ' für euren Haushalt. Das kann gute Gründe haben.',
          monthlyCents: budget - hi, yearlyCents: yearly(budget - hi), from: true,
          steps: [
            step('Kalorienbedarf im Monat', null, '', [], core.fmtInt(kcalMonth) + ' kcal (' + sum(members, (p) => p.dailyKcal) + ' kcal am Tag mal ' + FOOD.daysPerMonth + ' Tage)'),
            step('Richtwert, günstig bis großzügig', null, '', [], core.fmtEUR(lo) + ' bis ' + core.fmtEUR(hi)),
            step('Dein Lebensmittel-Budget', budget, '', food.map(row)),
            step('Differenz zur großzügigen Grenze', budget - hi, '='),
          ],
          why: 'Verglichen wird das Budget, nicht deine tatsächlichen Ausgaben. Mit Ist-Ausgaben nach v1 wird der Hinweis genauer.',
          source: 'Preise je 1.000 kcal (' + core.fmtEUR(FOOD.minCentsPer1000Kcal) + ' bis ' + core.fmtEUR(FOOD.maxCentsPer1000Kcal) + ') sind Platzhalter. Die Quelle ist noch offen.',
          signature: JSON.stringify([food.map((i) => [i.id, i.cents]), members.map((p) => [p.label, p.dailyKcal])]),
          items: food.map((i) => i.id),
        });
      }
    }

    // Niedrige Notwendigkeit
    const low = exp.filter((i) => necessityRank(i.necessity) >= 3).sort((a, b) => b.cents - a.cents);
    if (low.length) {
      const total = sum(low, (i) => i.cents);
      hints.push({
        id: 'niedrig', rank: 4, type: 'niedrig',
        title: 'Posten mit niedriger Notwendigkeit',
        text: 'Die Stufen "Optional" und "Unnötig" kosten zusammen ' + core.fmtEUR(total) + ' im Monat. So viel würde frei, wenn sie wegfielen. Es ist nur ein Blick auf deinen Spielraum.',
        monthlyCents: total, yearlyCents: yearly(total), from: false,
        steps: [step('Posten der Stufen Optional und Unnötig', total, '+', low.map((i) => ({ label: i.label, cents: i.cents, note: necessityLabel(i.necessity) })))],
        why: 'Die Stufen legst du selbst fest. Rücklagen zählen nicht mit.',
        signature: JSON.stringify(low.map((i) => [i.id, i.cents, i.necessity])),
        items: low.map((i) => i.id),
      });
    }

    return hints.sort((a, b) => a.rank - b.rank || b.yearlyCents - a.yearlyCents);
  }

  /** Hinweise ohne die mit "bewusst so" beantworteten. Ein Hinweis kehrt zurück, wenn sich seine Posten ändern. */
  function visibleHints(hints, waived) {
    return hints.filter((h) => waived[h.id] !== h.signature);
  }

  return {
    STALE_DAYS, NOTICE_WINDOW_DAYS, FOOD, NECESSITY, CATEGORY, ART, SUBGROUP,
    necessityLabel, schedule, balanceAt, computeDebt, nextSalaryDay, compute, visibleHints,
  };
});
