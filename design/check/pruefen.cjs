#!/usr/bin/env node
/*
 * Prüft den Klick-Dummy ohne Browser und ohne Abhängigkeiten:
 *   node design/check/pruefen.cjs
 * - Geld und Datum (Cents, Format, Monatsende, Schaltjahr)
 * - Rechenkern: Summen stimmen, dieselbe Zahl steht überall gleich
 * - Farbkontraste der Farbrollen in Hell und Dunkel
 * - Markup aller Ansichten: doppelte IDs, Eingaben ohne Beschriftung, externe Adressen
 * Es ist eine Prüfung des Dummys, kein Test des späteren Rechenkerns.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'dummies');
const core = require(path.join(root, 'js', 'core.js'));
const calc = require(path.join(root, 'js', 'calc.js'));
const data = require(path.join(root, 'js', 'data.js'));

let failed = 0;
let passed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FEHLER: ' + msg); }
}
function eq(a, b, msg) {
  ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (erwartet ' + JSON.stringify(b) + ', war ' + JSON.stringify(a) + ')');
}
const NB = ' ';
const MI = '−';

// ---------- Geld ----------
eq(core.fmtEUR(148260), '1.482,60' + NB + '€', 'fmtEUR');
eq(core.fmtEUR(5), '0,05' + NB + '€', 'fmtEUR 5 Cent');
eq(core.fmtEUR(-398346), MI + '3.983,46' + NB + '€', 'fmtEUR negativ');
eq(core.fmtEUR(0), '0,00' + NB + '€', 'fmtEUR null');
eq(core.fmtEUR(100000000), '1.000.000,00' + NB + '€', 'fmtEUR Million');
[['1.482,60', 148260], ['1482,6', 148260], ['1482', 148200], ['1.482', 148200], ['12.50', 1250], ['12,5', 1250], [',50', 50], ['0,05', 5], ['-5,00', -500], ['−5,00', -500], ['85 €', 8500], ['1.234.567,89', 123456789]]
  .forEach(([t, c]) => eq(core.parseEUR(t), c, 'parseEUR ' + t));
['', 'abc', '1,234', '1,2,3', '12.5.3', '1.48', '--5', '1,5e3'].forEach((t) => {
  // "1.48" ist ein gültiger Dezimalwert (1,48), die anderen sind ungültig
  if (t === '1.48') eq(core.parseEUR(t), 148, 'parseEUR 1.48 als Dezimalwert');
  else eq(core.parseEUR(t), null, 'parseEUR ungültig: ' + JSON.stringify(t));
});
[148260, 1, 99, 100, 123456789, -1, -100000].forEach((c) => eq(core.parseEUR(core.fmtPlain(c)), c, 'Rundreise ' + c));
let threw = false;
try { core.fmtEUR(1.5); } catch (e) { threw = true; }
ok(threw, 'fmtEUR lehnt Kommazahlen ab');
eq(core.parseBps('5,90'), 590, 'parseBps');
eq(core.parseBps('5,9'), 590, 'parseBps eine Stelle');
eq(core.parseBps('0'), 0, 'parseBps null');
eq(core.parseBps('5,901'), null, 'parseBps zu genau');
eq(core.roundDiv(5, 2), 3, 'roundDiv 2,5 rundet auf 3');
eq(core.roundDiv(4, 3), 1, 'roundDiv');
eq(core.shareWhole([181526, 34078, 25000, 44396], 100), [64, 12, 9, 15], 'shareWhole');
eq(core.shareWhole([1, 1, 1], 100).reduce((a, b) => a + b, 0), 100, 'shareWhole Summe');

// ---------- Kalender ----------
eq(core.daysBetween('2026-10-13', '2026-10-28'), 15, 'Tage bis Gehalt');
eq(core.monthPlus('2026-01-31', 1, 31), '2026-02-28', 'Monatsende kurzer Monat');
eq(core.monthPlus('2028-01-31', 1, 31), '2028-02-29', 'Schaltjahr');
eq(core.monthPlus('2026-11-30', 3, 30), '2027-02-28', 'Jahreswechsel');
eq(core.addDays('2028-02-28', 1), '2028-02-29', 'addDays Schaltjahr');
eq(core.addDays('2026-12-31', 1), '2027-01-01', 'addDays Jahreswechsel');
eq(core.daysBetween('2027-04-01', '2027-03-31'), -1, 'daysBetween negativ');
eq(core.weekday('2026-10-13'), 'Di.', 'Wochentag');
eq(core.fmtDay('2029-02-01', 'monat'), 'Februar' + NB + '2029', 'fmtDay Monat');
eq(calc.nextSalaryDay(28, '2026-10-13'), '2026-10-28', 'nächster Gehaltstag');
eq(calc.nextSalaryDay(28, '2026-10-28'), '2026-11-28', 'am Gehaltstag zählt der Folgemonat');
eq(calc.nextSalaryDay(31, '2026-02-10'), '2026-02-28', 'Gehaltstag 31 im Februar');
eq(calc.nextSalaryDay(5, '2026-12-20'), '2027-01-05', 'Gehaltstag über den Jahreswechsel');

// ---------- Rechenkern auf den Testdaten ----------
const T = data.TODAY;
const d = data.sampleData();
const C = calc.compute(d, T);
const M = C.metrics;
const all = [d.incomeCents, ...d.accounts.map((a) => a.stand.cents), ...d.pockets.map((p) => p.stand.cents), ...d.budgetItems.map((i) => i.cents), ...d.debts.flatMap((x) => [x.principalCents, x.monthlyPaymentCents])];
ok(all.every(Number.isSafeInteger), 'alle Testbeträge sind ganze Cents');

eq(C.sumAccounts, d.accounts.reduce((s, a) => s + a.stand.cents, 0), 'Summe der Konten');
eq(M.verfuegbar.value, C.sumAccounts, 'Jetzt verfügbar = Summe der Konten');
eq(M.bisGehalt.value, C.sumAccounts - C.upcomingTotal, 'Bis Gehalt = Konten minus Zahlungen');
ok(M.tagesrahmen.value * C.daysToSalary <= M.bisGehalt.value && (M.tagesrahmen.value + 1) * C.daysToSalary > M.bisGehalt.value, 'Tagesrahmen ist abgerundet');
eq(C.daysToSalary, 15, 'Tage bis Gehalt');
eq(C.upcoming.map((u) => u.day), ['2026-10-14', '2026-10-15', '2026-10-18', '2026-10-20', '2026-10-22'], 'Demnächst: Reihenfolge und Fenster');
ok(!C.upcoming.some((u) => u.day >= C.nextSalary), 'Demnächst: nichts am Gehaltstag oder danach');
eq(C.split.reduce((s, p) => s + p.cents, 0), C.income, 'Aufteilung: Summe der Cents = Einkommen');
eq(C.split.reduce((s, p) => s + p.percent, 0), 100, 'Aufteilung: Prozent = 100');
eq(M.freiImMonat.value, C.income - C.items.expenseTotal - C.ratesTotal - C.items.reserveTotal, 'Frei im Monat');
eq(C.ratesTotal, d.debts.reduce((s, x) => s + x.monthlyPaymentCents, 0), 'Raten laufen alle');

// Tilgungspläne
for (const x of d.debts) {
  const dd = C.debts.find((y) => y.id === x.id);
  const rows = dd.rows;
  ok(rows[rows.length - 1].balanceAfter === 0, x.id + ': Plan endet bei 0');
  ok(rows.every((r) => r.principalCents + r.interest === r.payment), x.id + ': Rate = Zins + Tilgung');
  ok(rows.every((r) => r.balanceAfter >= 0), x.id + ': keine negative Restschuld');
  const start = x.confirmed ? x.confirmed.cents : x.principalCents;
  const after = rows.filter((r) => !x.confirmed || r.day > x.confirmed.day);
  eq(after.reduce((s, r) => s + r.principalCents, 0), start, x.id + ': Tilgung summiert sich auf den Ausgangspunkt');
}
eq(C.debts.find((y) => y.id === 'kauf-b').restCents, 80000, 'Ratenkauf ohne Zins: 8 Raten bezahlt, 800,00 € offen');
eq(C.debts.find((y) => y.id === 'kredit-a').restSource, 'bank', 'bestätigter Bankstand ist Ausgangspunkt');
eq(C.debts.find((y) => y.id === 'kredit-a').restCents, 489087, 'Restschuld = Bankstand');
eq(C.debts.find((y) => y.id === 'kauf-c').restSource, 'plan', 'Rest berechnet');
eq(M.restschuld.value, C.debts.reduce((s, y) => s + y.restCents, 0), 'Restschuld gesamt');
eq(M.abloesesumme.value, C.debts.reduce((s, y) => s + y.payoffMaxCents, 0), 'Ablösesumme gesamt');
eq(M.nochZuZahlen.value, C.debts.reduce((s, y) => s + y.rows.filter((r) => r.day >= T).reduce((a, r) => a + r.payment, 0), 0), 'Noch zu zahlen');
eq(M.mehrkosten.value, M.nochZuZahlen.value - M.abloesesumme.value, 'Mehrkosten');
eq(M.zinsen.value, C.debts.reduce((s, y) => s + y.remainingInterestCents, 0), 'Zinsen');
eq(M.nettovermoegen.value, C.sumAccounts - M.abloesesumme.value, 'Nettovermögen');
eq(M.schuldenfrei.value, '2029-02-01', 'Schuldenfrei');
eq(C.relief.map((e) => e.from), ['2027-03-01', '2028-02-01', '2029-03-01'], 'Entlastung: Termine');
eq(C.relief[C.relief.length - 1].freeAfter, M.freiImMonat.value + C.ratesTotal, 'Entlastung: am Ende ist alles frei');
eq(C.series[0].cents, M.restschuld.value, 'Verlauf beginnt bei der Restschuld heute');
eq(C.series[C.series.length - 1].cents, 0, 'Verlauf endet bei 0');
ok(C.series.every((p, i) => i === 0 || p.cents <= C.series[i - 1].cents), 'Verlauf fällt nie');

// Datenalter und Status
eq(M.verfuegbar.status, 'alt', 'alte Stände machen Zahlen "alt"');
eq(M.datenalter.value, 41, 'ältester Stand 41 Tage');
eq(M.freiImMonat.status, 'ok', 'Plan-Zahl ohne Stand ist belastbar');
eq(C.stale.map((s) => s.id).sort(), ['bar', 'geschenke', 'reise', 'tages'], 'veraltete Stände');
const fresh = data.sampleData();
fresh.accounts.forEach((a) => { a.stand.day = T; });
fresh.pockets.forEach((p) => { p.stand.day = T; });
const Cf = calc.compute(fresh, T);
eq(Cf.metrics.bisGehalt.status, 'ok', 'frische Stände: belastbar');
eq(Cf.stale.length, 0, 'frische Stände: nichts veraltet');

// Leer, fehlende Daten, negativ
const E = calc.compute(data.emptyData(), T);
eq(Object.values(E.metrics).filter((m) => m.kind === 'eur' && m.value != null && m.id !== 'restschuld' && m.id !== 'abloesesumme' && m.id !== 'nochZuZahlen' && m.id !== 'zinsen' && m.id !== 'mehrkosten' && m.id !== 'nettovermoegen').length, 0, 'leer: keine erfundenen Werte');
eq(E.metrics.bisGehalt.status, 'offen', 'leer: Bis Gehalt nicht berechenbar');
ok(E.metrics.bisGehalt.missing.includes('Gehaltstag'), 'leer: nennt, was fehlt');
const neg = data.sampleData();
neg.accounts[0].stand.cents = -200000;
const Cn = calc.compute(neg, T);
ok(Cn.metrics.verfuegbar.value === Cn.sumAccounts && Cn.sumAccounts < 216760, 'negative Stände bleiben negativ');
ok(Cn.metrics.bisGehalt.value < 0, 'Bis Gehalt darf negativ sein');
const over = data.sampleData();
over.incomeCents = 100000;
ok(calc.compute(over, T).metrics.aufteilung.status === 'offen', 'mehr verplant als Einkommen: keine Aufteilung');

// Monatsende und Schaltjahr im Tilgungsplan
const eom = { id: 'x', name: 'x', art: 'loan', principalCents: 120000, nominalBps: 0, effBps: 0, monthlyPaymentCents: 10000, firstPaymentDay: '2027-01-31', paymentCount: 12 };
const rows = calc.schedule(eom);
eq(rows[1].day, '2027-02-28', 'Rate am 31.: Februar rutscht auf den 28.');
eq(rows[2].day, '2027-03-31', 'Rate am 31.: März wieder der 31.');
const leap = calc.schedule({ ...eom, firstPaymentDay: '2027-12-31' });
eq(leap[2].day, '2028-02-29', 'Rate am 31.: Schaltjahr 29.');
// Rundung: 1000,00 € zu 5,90 % ergibt im ersten Monat 4,92 € Zins (4,9167 gerundet)
eq(calc.schedule({ id: 'y', principalCents: 100000, nominalBps: 590, monthlyPaymentCents: 20000, firstPaymentDay: '2027-01-01', paymentCount: 6 })[0].interest, 492, 'Zinsrundung');
// Eine zu hohe Rate beendet den Kredit früher, die Schlussrate ist kleiner
const early = calc.schedule({ id: 'z', principalCents: 100000, nominalBps: 0, monthlyPaymentCents: 60000, firstPaymentDay: '2027-01-01', paymentCount: 6 });
eq(early.length, 2, 'Kredit endet, wenn die Restschuld 0 ist');
eq(early[1].payment, 40000, 'letzte Rate ist der Rest');

// Einspar-Hinweise
eq(C.hints.map((h) => h.id), ['kuendigung-fitness', 'lebensmittel', 'abo-streaming', 'niedrig'], 'Hinweise und Reihenfolge');
const hs = Object.fromEntries(C.hints.map((h) => [h.id, h]));
eq([hs['abo-streaming'].monthlyCents, hs['abo-streaming'].yearlyCents], [999, 11988], 'Streaming: Monat und Jahr');
eq(hs['kuendigung-fitness'].title.includes('31.' + NB + 'Dez.' + NB + '2026'), true, 'Kündigungstag 31. Dez. 2026');
eq(hs.lebensmittel.monthlyCents, 7200, 'Lebensmittel: 450,00 minus großzügige Grenze 378,00');
eq(hs.niedrig.monthlyCents, 22398, 'niedrige Notwendigkeit');
ok(C.hints.every((h) => h.yearlyCents === h.monthlyCents * 12), 'Jahresbetrag = 12 mal Monatsbetrag');
const waived = { [hs['abo-streaming'].id]: hs['abo-streaming'].signature };
eq(calc.visibleHints(C.hints, waived).map((h) => h.id).includes('abo-streaming'), false, '"Bewusst so" blendet aus');
const bumped = data.sampleData();
bumped.budgetItems.find((i) => i.id === 'film').cents = 1499;
const hb = calc.compute(bumped, T).hints.find((h) => h.id === 'abo-streaming');
eq(calc.visibleHints([hb], waived).length, 1, 'Hinweis kehrt zurück, wenn sich ein Posten ändert');

// ---------- Anzeige: dieselbe Zahl überall gleich ----------
const window_ = { Accura: Object.assign({}, core, calc, data) };
global.window = window_;
require(path.join(root, 'js', 'ui.js'));
require(path.join(root, 'js', 'screens-ansichten.js'));
require(path.join(root, 'js', 'screens-erfassen.js'));
require(path.join(root, 'js', 'screens-staende.js'));
const A = window_.Accura;
const S = {
  data: d, today: T, hide: false, waived: {}, preset: 'std', scale: 100, theme: 'system',
  erf: { done: {}, started: false, noDebts: false }, ui: { err: null, draft: null, draftKey: null, calc: { weight: '', height: '', age: '', variant: 'm', activity: 1.375 }, calcFor: null, bank: {}, quote: {}, upd: { val: null, bank: {} }, updKey: null },
  upd: { queue: [{ type: 'account', id: 'tages' }], i: 0, changed: 0, kept: 1, skipped: 0, banks: 0, t0: 0, t1: 5000, before: 1 },
};
const routes = [['uebersicht'], ['demnaechst'], ['budget'], ['schulden'], ['kennzahlen'], ['hinweise'], ['daten'], ['mehr'], ['start'], ['schuld', 'kredit-a'], ['schuld', 'kauf-b'],
  ['erfassen/willkommen'], ['erfassen/einkommen'], ['erfassen/konten'], ['erfassen/pockets'], ['erfassen/kosten-auswahl'], ['erfassen/kosten-betraege'], ['erfassen/kredite'], ['erfassen/kredit-neu', 'new'], ['erfassen/haushalt'], ['erfassen/fertig'],
  ['staende/start'], ['staende/item', '0'], ['staende/kredite'], ['staende/fertig']];
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, NB).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t\r\n]+/g, ' ');
const eurOf = (m) => (m.kind === 'eur' && m.value != null ? core.fmtEUR(m.value) : null);
function render(route, args, state, comp) {
  const fn = A.screens[route];
  if (!fn) throw new Error('Ansicht fehlt: ' + route);
  return fn({ S: state, C: comp }, args || []);
}
for (const [r, ...args] of routes) {
  let res;
  try { res = render(r, args, S, C); } catch (e) { ok(false, 'Ansicht ' + r + ' wirft: ' + e.message); continue; }
  const html = res.html;
  const text = strip(html);
  // Markup ist ausgewogen: jedes geöffnete Element wird geschlossen
  {
    const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link']);
    const stack = [];
    let bad = null;
    for (const t of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g)) {
      const [, close, tag, self] = t;
      if (VOID.has(tag) || self) continue;
      if (!close) stack.push(tag);
      else if (stack.pop() !== tag) { bad = bad || '</' + tag + '>'; }
    }
    ok(!bad && stack.length === 0, r + ': Markup nicht ausgewogen ' + (bad || stack.join(',')));
  }
  // doppelte IDs
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  ok(!dup.length, r + ': doppelte IDs ' + dup.join(','));
  // Eingaben brauchen eine Beschriftung
  for (const m of html.matchAll(/<(input|select)\b([^>]*)>/g)) {
    const attrs = m[2];
    const id = (/\bid="([^"]+)"/.exec(attrs) || [])[1];
    if (/type="hidden"/.test(attrs)) continue;
    const labelled = id && new RegExp('for="' + id + '"').test(html);
    ok(labelled || /aria-label=/.test(attrs) || /type="(checkbox|radio)"/.test(attrs), r + ': Eingabe ohne Beschriftung ' + attrs.slice(0, 60));
  }
  for (const m of html.matchAll(/<input\b[^>]*type="(checkbox|radio)"[^>]*>/g)) {
    const id = (/\bid="([^"]+)"/.exec(m[0]) || [])[1];
    const idx = html.indexOf(m[0]);
    const nested = /<label[^>]*>(?:(?!<\/label>).)*$/s.test(html.slice(Math.max(0, idx - 200), idx));
    ok((id && new RegExp('for="' + id + '"').test(html)) || nested, r + ': Auswahlfeld ohne Beschriftung ' + m[0].slice(0, 70));
  }
  // Schaltflächen und Links brauchen einen Namen
  for (const m of html.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const name = strip(m[2]).trim() || (/aria-label="([^"]+)"/.exec(m[0]) || [])[1];
    ok(name, r + ': Schaltfläche ohne Namen ' + m[0].slice(0, 80));
  }
  ok(!/https?:\/\//.test(html), r + ': keine externen Adressen');
  // Kennzahlen: Name und Wert stehen zusammen, überall gleich
  for (const m of Object.values(C.metrics)) {
    const v = eurOf(m);
    if (!v) continue;
    const re = new RegExp(m.label.replace(/[()]/g, '\\$&') + '[^€]{0,160}?' + '(' + v.replace(/[.+$^()|[\]\\]/g, '\\$&') + ')');
    if (text.includes(m.label) && !res.title.startsWith('Alle') && !(r.startsWith('erfassen/kredit') && m.id === 'restschuld')) {
      ok(re.test(text) || text.indexOf(v) >= 0, r + ': "' + m.label + '" ohne den Wert ' + v);
    }
  }
}
// Die Kennzahlen-Ansicht enthält jede Kennzahl mit ihrem Wert
{
  const text = strip(render('kennzahlen', [], S, C).html);
  for (const m of Object.values(C.metrics)) {
    ok(text.includes(m.label), 'Kennzahlen: ' + m.label + ' fehlt');
    const v = eurOf(m);
    if (v) ok(text.includes(v), 'Kennzahlen: Wert von ' + m.label + ' fehlt (' + v + ')');
  }
}
// Beträge ausblenden: nirgends ein Betrag
A.ui.hide = true;
for (const [r, ...args] of [['uebersicht'], ['demnaechst'], ['budget'], ['schulden'], ['hinweise'], ['kennzahlen'], ['daten']]) {
  const text = strip(render(r, args, { ...S, hide: true }, C).html);
  ok(!/\d,\d\d €/.test(text), r + ': bei ausgeblendeten Beträgen steht kein Betrag im Text');
}
A.ui.hide = false;
// Leere Ansichten: Leerzustand statt Zahlen
{
  const Se = { ...S, data: data.emptyData() };
  const Ce = calc.compute(Se.data, T);
  for (const r of ['uebersicht', 'demnaechst', 'budget', 'schulden', 'hinweise', 'daten']) {
    const t = strip(render(r, [], Se, Ce).html);
    ok(!/\d,\d\d €/.test(t), r + ' (leer): keine Beträge');
    ok(/Ersterfassung|Kredit eintragen/.test(t), r + ' (leer): führt zur Erfassung');
  }
}

// ---------- Kontrast ----------
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');
function tokens(block) {
  const o = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) o[m[1]] = m[2];
  return o;
}
const lightBlock = /:root\s*\{([^}]*)\}/.exec(css)[1];
const darkBlock = /:root\[data-theme='dark'\]\s*\{([^}]*)\}/.exec(css)[1];
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, p) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * p + parseInt(b.slice(i, i + 2), 16) * (1 - p)).toString(16).padStart(2, '0')).join('');
let minText = 99;
let minUi = 99;
for (const [name, block] of [['hell', lightBlock], ['dunkel', darkBlock]]) {
  const t = tokens(block);
  const text = [
    ['on', 'bg'], ['on2', 'bg'], ['on', 's1'], ['on2', 's1'], ['on', 's2'], ['on2', 's2'], ['on', 's3'], ['pri', 'bg'], ['pri', 's1'], ['on-pri', 'pri'], ['on-pri-c', 'pri-c'],
    ['on-free-c', 'free-c'], ['on-res-c', 'res-c'], ['on-att-c', 'att-c'], ['on-debt-c', 'debt-c'], ['free', 's1'], ['res', 's1'], ['att', 'bg'], ['on', 'att-c'],
    ['on2', 'bg'], ['debt', 's1'], ['pri', 'pri-c'],
  ];
  for (const [f, b] of text) {
    const r = ratio(t[f], t[b]);
    minText = Math.min(minText, r);
    ok(r >= 4.5, name + ': Text ' + f + ' auf ' + b + ' hat Kontrast ' + r.toFixed(2) + ', nötig 4,5');
  }
  const rowFree = mix(t['free-c'], t.s1, 0.55);
  const rf = ratio(t.free, rowFree);
  minText = Math.min(minText, rf);
  ok(rf >= 4.5, name + ': Betrag auf grüner Zeile ' + rf.toFixed(2));
  const nonText = [['line', 'bg'], ['line', 's1'], ['pri', 'bg'], ['debt', 'bg'], ['res', 'bg'], ['free', 'bg'], ['att', 'att-c'], ['att', 'bg'], ['line', 's3']];
  for (const [f, b] of nonText) {
    const r = ratio(t[f], t[b]);
    minUi = Math.min(minUi, r);
    ok(r >= 3, name + ': Rand/Fläche ' + f + ' auf ' + b + ' hat Kontrast ' + r.toFixed(2) + ', nötig 3');
  }
}

// ---------- Quelltext: nichts Externes, keine Kommazahlen für Geld ----------
const files = fs.readdirSync(path.join(root, 'js')).map((f) => path.join(root, 'js', f)).concat([path.join(root, 'index.html'), path.join(root, 'css', 'app.css')]);
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  ok(!/(src|href)="https?:\/\//.test(src) && !/url\(\s*['"]?https?:/.test(src) && !/@import/.test(src), path.basename(f) + ': keine externe Abhängigkeit');
  ok(!/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), path.basename(f) + ': kein Netzwerkzugriff');
}
for (const f of ['core.js', 'calc.js']) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  ok(!/toFixed|parseFloat|\bNumber\(\s*[^)]*\.\d/.test(src), f + ': kein Float-Umweg für Geld');
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="((?!#|https?:)[^"]+)"/g)) ok(fs.existsSync(path.join(root, m[1])), 'index.html verweist auf fehlende Datei ' + m[1]);
ok(fs.existsSync(path.join(root, 'assets', 'fonts', 'Google-Sans-Flex-OFL.txt')), 'Schrift-Lizenz liegt bei');

console.log((failed ? 'FEHLGESCHLAGEN' : 'OK') + ': ' + passed + ' Prüfungen bestanden, ' + failed + ' fehlgeschlagen. Kleinster Textkontrast ' + minText.toFixed(2) + ', kleinster Flächenkontrast ' + minUi.toFixed(2) + '.');
process.exit(failed ? 1 : 0);
