/*
 * core.js: Geld und Kalendertage für den Klick-Dummy.
 * Reine Funktionen. Geld ist immer eine ganze Zahl in Cents, nie eine Kommazahl.
 * Läuft im Browser (window.Accura) und in Node (require) für design/check/pruefen.cjs.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Accura = Object.assign(root.Accura || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const NBSP = ' ';
  const MINUS = '−';
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

  // ---------- Geld ----------

  function assertCents(cents) {
    if (!Number.isSafeInteger(cents)) throw new Error('Cents müssen eine ganze Zahl sein: ' + cents);
  }

  function groupThousands(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function fmtInt(n) {
    return (n < 0 ? MINUS : '') + groupThousands(Math.abs(n));
  }

  /** "1.482,60", negativ mit echtem Minuszeichen. Ohne Eurozeichen, für Eingabefelder. */
  function fmtPlain(cents) {
    assertCents(cents);
    const abs = Math.abs(cents);
    return (cents < 0 ? MINUS : '') + groupThousands(Math.trunc(abs / 100)) + ',' + String(abs % 100).padStart(2, '0');
  }

  /** "1.482,60 €" mit geschütztem Leerzeichen, damit das Eurozeichen nie allein umbricht. */
  function fmtEUR(cents) {
    return fmtPlain(cents) + NBSP + '€';
  }

  /** "+120,00 €" oder "−120,00 €" für Rechenwege. */
  function fmtSigned(cents) {
    return (cents > 0 ? '+' : '') + fmtEUR(cents);
  }

  /**
   * Text aus dem Betragsfeld in Cents. Kein Umweg über Kommazahlen.
   * Komma ist das Dezimalzeichen, Punkte nur als Tausendertrennung (1.482 = 1482).
   * Ein Punkt mit ein oder zwei Nachkommastellen (12.50) gilt als Dezimalzeichen.
   * Ungültig: null.
   */
  function parseEUR(text) {
    let t = String(text == null ? '' : text).trim().replace(/[\s €]/g, '');
    let neg = false;
    if (/^[-−]/.test(t)) {
      neg = true;
      t = t.slice(1);
    }
    if (t === '') return null;
    let int;
    let frac = '';
    if (t.includes(',')) {
      const parts = t.split(',');
      if (parts.length !== 2) return null;
      [int, frac] = parts;
      if (int.includes('.')) {
        if (!/^\d{1,3}(\.\d{3})+$/.test(int)) return null;
        int = int.replace(/\./g, '');
      }
    } else if (t.includes('.')) {
      if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
        int = t.replace(/\./g, '');
      } else {
        const m = /^(\d+)\.(\d{1,2})$/.exec(t);
        if (!m) return null;
        int = m[1];
        frac = m[2];
      }
    } else {
      int = t;
    }
    if (int === '') int = '0';
    if (!/^\d+$/.test(int) || !/^\d{0,2}$/.test(frac)) return null;
    const cents = Number(int) * 100 + Number(frac.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents)) return null;
    return neg && cents !== 0 ? -cents : cents;
  }

  /** "5,90" in Basispunkte (590). Höchstens zwei Nachkommastellen. */
  function parseBps(text) {
    const t = String(text == null ? '' : text).trim().replace(/[\s %]/g, '');
    const m = /^(\d{1,3})(?:[,.](\d{1,2}))?$/.exec(t);
    if (!m) return null;
    return Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
  }

  function fmtBps(bps) {
    return String(Math.trunc(bps / 100)) + ',' + String(bps % 100).padStart(2, '0') + NBSP + '%';
  }

  /** Ganzzahl-Division mit Rundung auf die nächste Ganzzahl, Hälften weg von null. */
  function roundDiv(a, b) {
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b <= 0) throw new Error('roundDiv: ungültig');
    const sign = a < 0 ? -1 : 1;
    return sign * Math.floor((2 * Math.abs(a) + b) / (2 * b));
  }

  /** Abrunden Richtung minus unendlich, auch für negative Werte. */
  function floorDiv(a, b) {
    return Math.floor(a / b);
  }

  /** Verteilt `total` ganzzahlig im Verhältnis der Werte, die Summe stimmt immer (größter Rest). */
  function shareWhole(values, total) {
    const sum = values.reduce((s, v) => s + v, 0);
    if (sum <= 0) return values.map(() => 0);
    const base = values.map((v) => Math.floor((v * total) / sum));
    let left = total - base.reduce((s, v) => s + v, 0);
    const order = values
      .map((v, i) => ({ i, rest: (v * total) % sum }))
      .sort((a, b) => b.rest - a.rest || a.i - b.i);
    for (let k = 0; left > 0 && k < order.length; k++, left--) base[order[k].i] += 1;
    return base;
  }

  // ---------- Kalendertage ("YYYY-MM-DD", keine Uhrzeit, keine Zeitzone) ----------

  function isLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function daysInMonth(y, m) {
    return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }

  function parseDay(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new Error('Kein Kalendertag: ' + s);
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) throw new Error('Kein Kalendertag: ' + s);
    return { y, m: mo, d };
  }

  function isDay(s) {
    try {
      parseDay(s);
      return true;
    } catch (e) {
      return false;
    }
  }

  function toDay({ y, m, d }) {
    return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function daysFromCivil(y, m, d) {
    const yy = y - (m <= 2 ? 1 : 0);
    const era = Math.floor(yy / 400);
    const yoe = yy - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }

  function civilFromDays(z0) {
    const z = z0 + 719468;
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
  }

  function dayNumber(s) {
    const { y, m, d } = parseDay(s);
    return daysFromCivil(y, m, d);
  }

  function addDays(s, n) {
    return toDay(civilFromDays(dayNumber(s) + n));
  }

  /** Tage von a bis b, b minus a. */
  function daysBetween(a, b) {
    return dayNumber(b) - dayNumber(a);
  }

  /** Tag `d` im Monat `y-m`, ein zu großer Tag (31.) rutscht auf den letzten Tag des Monats. */
  function clampedDay(y, m, d) {
    return toDay({ y, m, d: Math.min(d, daysInMonth(y, m)) });
  }

  /** `k` Monate nach dem Monat von `s`, mit Tag `anchorDay` (gekürzt auf den Monat). */
  function monthPlus(s, k, anchorDay) {
    const { y, m } = parseDay(s);
    const idx = y * 12 + (m - 1) + k;
    return clampedDay(Math.floor(idx / 12), (idx % 12) + 1, anchorDay);
  }

  function lastDayOfMonth(s) {
    const { y, m } = parseDay(s);
    return clampedDay(y, m, 31);
  }

  function monthKey(s) {
    return s.slice(0, 7);
  }

  function fmtDay(s, style) {
    const { y, m, d } = parseDay(s);
    switch (style) {
      case 'monat':
        return MONTHS[m - 1] + NBSP + y;
      case 'lang':
        return d + '.' + NBSP + MONTHS[m - 1] + NBSP + y;
      case 'kurzJahr':
        return d + '.' + NBSP + MONTHS_SHORT[m - 1] + NBSP + y;
      default:
        return d + '.' + NBSP + MONTHS_SHORT[m - 1];
    }
  }

  const WEEKDAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

  function weekday(s) {
    return WEEKDAYS[(((dayNumber(s) + 4) % 7) + 7) % 7];
  }

  function fmtDaysAgo(n) {
    if (n <= 0) return 'heute';
    if (n === 1) return 'gestern';
    return 'vor ' + n + ' Tagen';
  }

  return {
    NBSP, MINUS, MONTHS, MONTHS_SHORT,
    fmtInt, fmtPlain, fmtEUR, fmtSigned, parseEUR, parseBps, fmtBps, roundDiv, floorDiv, shareWhole,
    isLeap, daysInMonth, parseDay, isDay, toDay, dayNumber, addDays, daysBetween, clampedDay, monthPlus,
    lastDayOfMonth, monthKey, weekday, fmtDay, fmtDaysAgo,
  };
});
