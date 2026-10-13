/*
 * ui.js: die accura-Bausteine des Klick-Dummys. Jede Ansicht setzt sich nur aus diesen Bausteinen zusammen
 * (siehe docs/design/leitfaden.md, "Bausteine"). Gibt HTML-Text zurück, kein Zustand.
 */
(function () {
  'use strict';
  const A = window.Accura;

  const UI = { hide: false };
  window.Accura.ui = UI;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  UI.esc = esc;

  // ---------- Symbole (eigene, einfache Linien, keine externe Bibliothek) ----------
  const ICON = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    dash: '<path d="M6 12h12"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>',
    pie: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 6"/>',
    steps: '<path d="M3.5 6h4.5v4.5h4.5V15h4.5v4.5H20.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeoff: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><path d="M4 4l16 16"/>',
    more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="M7 10l5 5 5-5"/>',
    arrow: '<path d="M9 5l7 7-7 7"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3.5a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V17h5v-.6c0-.8.4-1.5 1-2A6 6 0 0012 3.5z"/>',
    flag: '<path d="M6 21V4M6 5h11l-2.5 4L17 13H6"/>',
  };
  UI.icon = (name, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON[name] + '</svg>';

  // ---------- Beträge ----------
  const NBSP = A.NBSP;
  UI.eur = (cents) => (UI.hide
    ? '<span class="num amt-hidden" role="img" aria-label="Betrag ausgeblendet">•••••' + NBSP + '€</span>'
    : '<span class="num">' + esc(A.fmtEUR(cents)) + '</span>');
  UI.signed = (cents) => (UI.hide ? UI.eur(cents) : '<span class="num">' + esc(A.fmtSigned(cents)) + '</span>');
  UI.plainEur = (cents) => (UI.hide ? '•••••' + NBSP + '€' : A.fmtEUR(cents));

  /** Text mit Beträgen: bei ausgeblendeten Beträgen werden sie durch gleichförmige Punkte ersetzt. */
  UI.mask = (s) => (UI.hide ? String(s).replace(/[\u2212-]?\d{1,3}(?:\.\d{3})*,\d{2}\u00A0€/g, '•••••' + NBSP + '€') : String(s));
  UI.t = (s) => esc(UI.mask(s));

  const BASIS = { eingetragen: 'Eingetragen', geplant: 'Geplant', berechnet: 'Berechnet', geschaetzt: 'Geschätzt' };
  const STATUS = { ok: 'belastbar', alt: 'beruht auf alten Daten', offen: 'nicht berechenbar' };
  UI.BASIS = BASIS;
  UI.STATUS = STATUS;

  UI.metricValue = (m) => {
    if (m.value == null) return '<span class="num">–</span>';
    switch (m.kind) {
      case 'eur': return UI.eur(m.value);
      case 'monateZehntel': return '<span class="num">' + Math.trunc(m.value / 10) + ',' + Math.abs(m.value % 10) + NBSP + 'Monate</span>';
      case 'monat': return '<span class="num">' + esc(A.fmtDay(m.value, 'monat')) + '</span>';
      case 'prozent': return '<span class="num">' + m.value + NBSP + '%</span>';
      case 'tage': return '<span class="num">' + m.value + NBSP + (m.value === 1 ? 'Tag' : 'Tage') + '</span>';
      default: return '<span class="num">' + esc(m.value) + '</span>';
    }
  };

  // ---------- Baustein: Datenalter-Chip ----------
  /** Zeigt das Alter der ältesten verwendeten Daten. Form und Text tragen die Aussage, nicht nur die Farbe. */
  UI.ageChip = (m) => {
    if (m.status === 'offen') return '<span class="chip chip-offen">' + UI.icon('dash') + 'Noch nicht berechenbar</span>';
    if (!m.oldestDay) return '';
    if (m.status === 'alt') {
      return '<span class="chip chip-alt">' + UI.icon('clock') + 'Stand vom ' + esc(A.fmtDay(m.oldestDay)) + ' · ' + esc(A.fmtDaysAgo(m.ageDays)) + '</span>';
    }
    return '<span class="chip chip-ok">' + UI.icon('check') + 'Stand vom ' + esc(A.fmtDay(m.oldestDay)) + '</span>';
  };
  UI.standChip = (day, ageDays) => (ageDays > A.STALE_DAYS
    ? '<span class="chip chip-alt">' + UI.icon('clock') + 'Stand vom ' + esc(A.fmtDay(day)) + ' · ' + esc(A.fmtDaysAgo(ageDays)) + '</span>'
    : '<span class="chip chip-ok">' + UI.icon('check') + 'Stand vom ' + esc(A.fmtDay(day)) + '</span>');
  UI.basisChip = (basis) => '<span class="chip chip-basis">' + esc(BASIS[basis] || basis) + '</span>';
  UI.chips = (m, opts) => '<div class="chips">' + UI.ageChip(m) + UI.basisChip(m.basis) + ((opts && opts.extra) || '') + '</div>';

  // ---------- Baustein: Rechenweg ("So gerechnet") ----------
  const OPWORD = { '+': 'plus', '−': 'minus', '÷': 'geteilt durch', '=': 'ergibt', '×': 'mal' };
  UI.rechenweg = (m) => {
    let h = '<div class="rw"><p class="rw-q">' + esc(m.question) + '</p>';
    if (m.status === 'offen') {
      h += '<p class="rw-missing"><strong>Noch nicht berechenbar.</strong> Es fehlt: ' + UI.t(m.missing.join(', ')) + '.</p>';
    } else {
      h += '<ol class="rw-steps">';
      m.steps.forEach((s) => {
        const hasMoney = s.cents != null;
        h += '<li class="rw-step"><div class="rw-line">'
          + (s.op ? '<span class="rw-op" aria-hidden="true">' + esc(s.op) + '</span><span class="sr-only">' + (OPWORD[s.op] || '') + ' </span>' : '')
          + '<span class="rw-l">' + UI.t(s.label) + '</span>'
          + (hasMoney ? '<span class="rw-v">' + UI.eur(s.cents) + '</span>' : '')
          + '</div>'
          + (s.text ? '<p class="rw-text">' + UI.t(s.text) + '</p>' : '');
        if (s.items.length) {
          h += '<ul class="rw-items">' + s.items.map((i) => '<li><span>' + UI.t(i.label) + (i.note ? ' <small>' + UI.t(i.note) + '</small>' : '') + '</span><span>' + UI.eur(i.cents) + '</span></li>').join('') + '</ul>';
        }
        h += '</li>';
      });
      h += '</ol>' + (m.noResult ? '' : '<p class="rw-result"><span>Ergebnis</span><strong>' + UI.metricValue(m) + '</strong></p>');
    }
    if (m.note) h += '<p class="rw-note">' + UI.t(m.note) + '</p>';
    if (!m.hideStatus) h += '<p class="rw-status"><strong>Status:</strong> ' + esc(STATUS[m.status]) + '. <strong>Art:</strong> ' + esc((BASIS[m.basis] || '').toLowerCase())
      + (m.oldestDay ? '. <strong>Ältester verwendeter Stand:</strong> ' + esc(A.fmtDay(m.oldestDay, 'kurzJahr')) : '') + '.</p>';
    return h + '</div>';
  };

  // ---------- Baustein: Hauptzahl-Karte ----------
  UI.hero = ({ m, tone, sub, extra, id }) => {
    const hid = 'hero-' + (id || m.id);
    return '<section class="card hero tone-' + (tone || 'primary') + '" aria-labelledby="' + hid + '">'
      + '<h2 class="hero-q" id="' + hid + '">' + esc(m.label) + '</h2>'
      + '<p class="hero-v">' + UI.metricValue(m) + '</p>'
      + (sub ? '<p class="hero-sub">' + sub + '</p>' : '')
      + (m.status === 'offen' ? '<p class="hero-sub">Es fehlt: ' + UI.t(m.missing.join(', ')) + '.</p>' : '')
      + UI.chips(m, { extra })
      + '<details class="sg"><summary><span>So gerechnet</span>' + UI.icon('chev', 'sg-ic') + '</summary>' + UI.rechenweg(m) + '</details>'
      + '</section>';
  };

  // ---------- Baustein: Kennzahl (aufklappbar mit "So gerechnet") ----------
  UI.metricRow = (m, opts) => {
    const o = opts || {};
    return '<details class="metric tone-' + (o.tone || 'plain') + '"><summary>'
      + '<span class="m-l">' + esc(o.label || m.label) + (o.sub ? '<small class="m-sub">' + o.sub + '</small>' : '') + '</span>'
      + '<span class="m-v">' + UI.metricValue(m) + '</span>' + UI.icon('chev', 'sg-ic') + '</summary>'
      + '<div class="m-body">' + UI.chips(m) + UI.rechenweg(m) + '</div></details>';
  };

  // ---------- Baustein: Liste ----------
  UI.row = ({ title, sub, amount, chips, href, go, tag, tone }) => {
    const inner = '<span class="row-main"><span class="row-t">' + esc(title) + '</span>'
      + (sub ? '<span class="row-s">' + sub + '</span>' : '')
      + (chips ? '<span class="chips">' + chips + '</span>' : '') + '</span>'
      + (amount != null ? '<span class="row-a">' + amount + '</span>' : '')
      + (href ? UI.icon('arrow', 'row-go') : '');
    const cls = 'row' + (tone ? ' tone-' + tone : '');
    return href ? '<a class="' + cls + ' row-link" href="' + href + '">' + inner + '</a>' : '<div class="' + cls + '">' + inner + '</div>';
  };
  UI.list = (rows, label) => '<ul class="list"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '>' + rows.map((r) => '<li>' + r + '</li>').join('') + '</ul>';

  // ---------- Baustein: Hinweis ----------
  /** Ruhiger Hinweis. `kind`: sparen (Einspar-Hinweis) oder achtung (Daten alt). Nie Alarmfarbe, nie beschämend. */
  UI.callout = ({ kind, title, text, actions }) => '<aside class="callout callout-' + (kind || 'info') + '">'
    + '<span class="callout-ic">' + UI.icon(kind === 'achtung' ? 'clock' : 'info') + '</span>'
    + '<div><p class="callout-t">' + esc(title) + '</p>' + (text ? '<p>' + text + '</p>' : '') + (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div></aside>';

  UI.hintCard = (h, opts) => {
    const o = opts || {};
    const amt = '<p class="hint-amt"><span>' + (h.from ? 'ab ' : '') + UI.eur(h.monthlyCents) + ' im Monat</span><span>' + (h.from ? 'ab ' : '') + UI.eur(h.yearlyCents) + ' im Jahr</span></p>';
    const rw = UI.rechenweg({ question: 'Wie kommt der Hinweis zustande?', steps: h.steps, status: 'ok', basis: 'berechnet', note: h.why + (h.source ? ' ' + h.source : ''), kind: 'eur', value: h.monthlyCents, oldestDay: null, missing: [], noResult: true, hideStatus: true });
    return '<article class="card hint" aria-labelledby="hint-' + esc(h.id) + '">'
      + '<div class="hint-head"><span class="hint-ic">' + UI.icon('bulb') + '</span><h3 id="hint-' + esc(h.id) + '">' + esc(h.title) + '</h3></div>'
      + '<p>' + UI.t(h.text) + '</p>' + amt
      + (o.compact ? '' : '<details class="sg"><summary><span>So gerechnet</span>' + UI.icon('chev', 'sg-ic') + '</summary>' + rw + '</details>')
      + '<div class="actions">' + (o.compact
        ? '<a class="btn tonal" href="#/hinweise">Alle Hinweise</a>'
        : '<button class="btn tonal" type="button" data-act="waive" data-arg="' + esc(h.id) + '">Bewusst so</button>')
      + '</div></article>';
  };
  // ---------- Baustein: Leerzustand ----------
  UI.empty = ({ title, text, action }) => '<section class="card empty"><span class="empty-shape" aria-hidden="true"></span>'
    + '<h2>' + esc(title) + '</h2><p>' + text + '</p>' + (action || '') + '</section>';

  // ---------- Baustein: Betragsfeld ----------
  /**
   * Ziffern und ein Komma, kein Komma-Akrobatik. Darunter steht, was accura daraus liest.
   * `path` zeigt in den Dummy-Zustand, `cents` ist der aktuelle Wert (oder null).
   */
  UI.moneyField = ({ path, label, cents, hint, negatable, required, unit }) => {
    const id = 'mf-' + path.replace(/[^a-z0-9]/gi, '-');
    const val = cents == null ? '' : A.fmtPlain(Math.abs(cents));
    return '<div class="field mf"><label for="' + id + '">' + esc(label) + (required ? '' : ' <span class="opt">(optional)</span>') + '</label>'
      + '<div class="mf-in"><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="' + esc(val) + '" data-money="' + esc(path) + '" aria-describedby="' + id + '-pv' + (hint ? ' ' + id + '-h' : '') + '">'
      + '<span class="mf-unit" aria-hidden="true">' + (unit || '€') + '</span></div>'
      + (negatable ? '<label class="check mf-neg"><input type="checkbox" data-minus="' + esc(path) + '"' + (cents != null && cents < 0 ? ' checked' : '') + '><span>Im Minus</span></label>' : '')
      + '<p class="mf-pv" id="' + id + '-pv" aria-live="polite"></p>'
      + (hint ? '<p class="hint-text" id="' + id + '-h">' + esc(hint) + '</p>' : '') + '</div>';
  };
  UI.textField = ({ path, label, value, placeholder, hint, type, inputmode, optional }) => {
    const id = 'tf-' + path.replace(/[^a-z0-9]/gi, '-');
    return '<div class="field"><label for="' + id + '">' + esc(label) + (optional ? ' <span class="opt">(optional)</span>' : '') + '</label>'
      + '<input id="' + id + '" type="' + (type || 'text') + '"' + (inputmode ? ' inputmode="' + inputmode + '"' : '') + ' autocomplete="off" value="' + esc(value == null ? '' : value) + '" placeholder="' + esc(placeholder || '') + '" data-bind="' + esc(path) + '"' + (inputmode === 'numeric' ? ' data-type="int"' : '') + (hint ? ' aria-describedby="' + id + '-h"' : '') + '>'
      + (hint ? '<p class="hint-text" id="' + id + '-h">' + esc(hint) + '</p>' : '') + '</div>';
  };
  UI.select = ({ path, label, value, options, hint, type }) => {
    const id = 'sel-' + path.replace(/[^a-z0-9]/gi, '-');
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>'
      + '<select id="' + id + '" data-bind="' + esc(path) + '" data-type="' + (type || 'text') + '"' + (hint ? ' aria-describedby="' + id + '-h"' : '') + '>'
      + options.map((o) => '<option value="' + esc(o.v) + '"' + (String(o.v) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>'
      + (hint ? '<p class="hint-text" id="' + id + '-h">' + esc(hint) + '</p>' : '') + '</div>';
  };
  UI.dayOptions = (blankLabel) => [{ v: '', label: blankLabel || 'Kein fester Tag' }].concat(Array.from({ length: 31 }, (_, i) => ({ v: i + 1, label: (i + 1) + '. des Monats' })));

  // ---------- Baustein: Auswahl-Chips ----------
  UI.choice = ({ name, path, options, value }) => '<div class="choice" role="radiogroup" aria-label="' + esc(name) + '">'
    + options.map((o, i) => {
      const id = 'ch-' + path.replace(/[^a-z0-9]/gi, '-') + '-' + i;
      return '<span class="choice-i"><input type="radio" name="' + esc(path) + '" id="' + id + '" value="' + esc(o.v) + '" data-bind="' + esc(path) + '" data-type="text"' + (o.v === value ? ' checked' : '') + '><label for="' + id + '">' + esc(o.label) + '</label></span>';
    }).join('') + '</div>';

  // ---------- Baustein: Schrittanzeige ----------
  UI.stepHead = ({ n, total, label }) => '<div class="stephead"><p class="stepno">' + esc(label || 'Schritt') + ' ' + n + ' von ' + total + '</p>'
    + '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + n + '" aria-label="Fortschritt"><span style="width:' + Math.round((n / total) * 100) + '%"></span></div></div>';

  // ---------- Baustein: Aufteilungsbalken ----------
  UI.splitBar = (split, income) => {
    const SW = { fix: 'fix', rates: 'rates', reserve: 'reserve', free: 'free' };
    const label = 'Aufteilung des Einkommens: ' + split.map((p) => p.label + ' ' + p.percent + ' Prozent').join(', ');
    return '<div class="split" role="img" aria-label="' + esc(label) + '">'
      + split.filter((p) => p.cents > 0).map((p) => '<span class="seg seg-' + SW[p.id] + '" style="flex-grow:' + p.cents + '"></span>').join('') + '</div>'
      + '<ul class="split-legend">' + split.map((p) => '<li><span class="sw sw-' + SW[p.id] + '" aria-hidden="true"></span><span class="sl-l">' + esc(p.label) + '</span><span class="sl-p">' + p.percent + NBSP + '%</span><span class="sl-a">' + UI.eur(p.cents) + '</span></li>').join('') + '</ul>';
  };

  // ---------- Verlauf der Restschuld (Weg auf null) ----------
  UI.seriesChart = (points) => {
    if (points.length < 2) return '';
    const W = 320; const H = 120; const L = 4; const R = 4; const T = 8; const B = 8;
    const max = Math.max(...points.map((p) => p.cents), 1);
    const x = (i) => L + ((W - L - R) * i) / (points.length - 1);
    const y = (c) => T + (H - T - B) * (1 - c / max);
    const pts = points.map((p, i) => [x(i), y(p.cents)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - B) + ' L' + pts[0][0].toFixed(1) + ' ' + (H - B) + ' Z';
    const first = points[0];
    const last = points[points.length - 1];
    return '<figure class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Restschuld von ' + esc(UI.plainEur(first.cents)) + ' heute auf ' + esc(UI.plainEur(last.cents)) + ' im ' + esc(last.label) + '">'
      + '<path d="' + area + '" class="chart-area"/><path d="' + line + '" class="chart-line"/></svg>'
      + '<figcaption><span>heute ' + UI.eur(first.cents) + '</span><span>' + esc(last.label) + ' ' + UI.eur(last.cents) + '</span></figcaption>'
      + '<details class="sg"><summary><span>Verlauf als Liste</span>' + UI.icon('chev', 'sg-ic') + '</summary><ul class="rw-items">'
      + points.map((p) => '<li><span>' + esc(p.label) + '</span><span>' + UI.eur(p.cents) + '</span></li>').join('') + '</ul></details></figure>';
  };

  // ---------- Abschnitte ----------
  UI.section = (title, body, opts) => '<section class="sec' + (opts && opts.cls ? ' ' + opts.cls : '') + '"><h2 class="sec-t">' + esc(title) + '</h2>' + (opts && opts.lead ? '<p class="lead">' + opts.lead + '</p>' : '') + body + '</section>';
  UI.dummyHelp = (label, act, arg) => '<div class="dummy-help"><span>Dummy-Hilfe</span><button class="btn text" type="button" data-act="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + '>' + esc(label) + '</button></div>';
})();
