/*
 * screens-staende.js: "Stände aktualisieren". Nur Konten und Pockets mit altem Stand, ein Stand pro Bildschirm,
 * alter Wert vorausgefüllt, "unverändert" ist ein Tipp. Ziel: unter zwei Minuten.
 */
(function () {
  'use strict';
  const A = window.Accura;
  const UI = A.ui;
  const R = (A.screens = A.screens || {});
  const esc = UI.esc;
  const eur = UI.eur;
  A.live = A.live || {};

  const findStand = (S, q) => {
    if (q.type === 'account') {
      const a = S.data.accounts.find((x) => x.id === q.id);
      return a ? { name: a.name, sub: 'Konto', stand: a.stand, ref: a } : null;
    }
    const p = S.data.pockets.find((x) => x.id === q.id);
    if (!p) return null;
    const acc = S.data.accounts.find((x) => x.id === p.accountId);
    return { name: p.name, sub: 'Pocket in ' + (acc ? acc.name : 'Konto'), stand: p.stand, ref: p };
  };
  A.findStand = findStand;

  const dur = (ms) => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const view = (html, title) => ({ title: title || 'Stände aktualisieren', html, nav: null, flow: 'staende', later: true });

  R['staende/start'] = ({ S, C }) => {
    if (!C.accounts.length) {
      return view(UI.empty({ title: 'Noch keine Stände', text: 'Trag zuerst deine Konten ein.', action: '<a class="btn filled" href="#/erfassen/willkommen">Ersterfassung</a>' }));
    }
    const stale = C.stale;
    if (!stale.length) {
      return view('<h2 class="step-t">Stände aktualisieren</h2>' + UI.empty({
        title: 'Alles aktuell', text: 'Kein Stand ist älter als ' + A.STALE_DAYS + ' Tage. Mehr ist heute nicht zu tun.',
        action: '<button class="btn tonal" type="button" data-act="updBegin" data-arg="all">Trotzdem alle durchgehen</button>',
      }));
    }
    let h = '<h2 class="step-t">Stände aktualisieren</h2><p class="lead">'
      + (stale.length === 1 ? 'Ein Stand ist' : stale.length + ' Stände sind') + ' älter als ' + A.STALE_DAYS + ' Tage. Du gehst sie nacheinander durch, ein Stand pro Bildschirm. Der alte Wert steht schon da. Stimmt er noch, reicht ein Tipp.</p>';
    h += UI.list(stale.map((s) => UI.row({ title: s.name, sub: s.type === 'pocket' ? 'Pocket' : 'Konto', amount: eur(s.cents), chips: UI.standChip(s.day, s.ageDays) })), 'Alte Stände');
    h += '<div class="actions sticky"><button class="btn filled" type="button" data-act="updBegin" data-arg="stale">Los geht’s</button></div>';
    return view(h);
  };

  A.live.updBtn = (S) => {
    const q = S.upd.queue[S.upd.i];
    const f = findStand(S, q);
    const same = f && f.stand && S.ui.upd.val === f.stand.cents;
    return '<button class="btn filled" type="button" data-act="updSave">' + (same ? 'Stimmt noch, weiter' : 'Neuen Stand speichern') + '</button>';
  };

  R['staende/item'] = ({ S, C }, args) => {
    const i = parseInt(args[0], 10);
    const u = S.upd;
    if (!u || !u.queue[i]) return R['staende/start']({ S, C });
    const q = u.queue[i];
    const f = findStand(S, q);
    if (!f) return R['staende/start']({ S, C });
    const key = q.type + ':' + q.id;
    if (S.ui.updKey !== key) { S.ui.updKey = key; S.ui.upd = { val: f.stand ? f.stand.cents : null, bank: (S.ui.upd && S.ui.upd.bank) || {} }; }
    const age = f.stand ? A.daysBetween(f.stand.day, S.today) : null;
    let h = UI.stepHead({ n: i + 1, total: u.queue.length, label: 'Stand' }) + err(S);
    h += '<h2 class="step-t">' + esc(f.name) + '</h2><p class="lead">' + esc(f.sub) + '</p>';
    if (f.stand) h += '<p class="chips">' + UI.standChip(f.stand.day, age) + '</p>';
    h += '<div class="card form big">'
      + UI.moneyField({ path: 'ui.upd.val', label: 'Stand heute', cents: S.ui.upd.val, required: true, negatable: true, hint: 'Der Stand bekommt das Datum von heute, ' + A.fmtDay(S.today, 'lang') + '.' })
      + '</div>';
    h += '<div class="actions sticky">' + (i > 0 ? '<a class="btn tonal" href="#/staende/' + (i - 1) + '">Zurück</a>' : '')
      + '<button class="btn text" type="button" data-act="updSkip">Überspringen</button>'
      + '<span data-livefn="updBtn" class="live-btn">' + A.live.updBtn(S) + '</span></div>';
    return view(h, 'Stand ' + (i + 1) + ' von ' + u.queue.length);
  };

  const err = (S) => (S.ui.err ? '<div role="alert">' + UI.callout({ kind: 'achtung', title: S.ui.err }) + '</div>' : '');

  R['staende/kredite'] = ({ S, C }) => {
    const u = S.upd;
    if (!u) return R['staende/start']({ S, C });
    let h = UI.stepHead({ n: u.queue.length + 1, total: u.queue.length + 1, label: 'Stand' })
      + '<h2 class="step-t">Kredite abgleichen <span class="opt">(freiwillig)</span></h2>'
      + '<p class="lead">accura rechnet die Restschuld selbst, du musst nichts nachtragen. Zeigt deine Bank-App einen anderen Wert, trag ihn ein. Er ist dann der neue Ausgangspunkt. Sonst einfach überspringen.</p>';
    h += C.ongoing.map((d) => {
      if (S.ui.upd.bank[d.id] === undefined) S.ui.upd.bank[d.id] = d.restCents;
      return '<div class="card form"><div class="card-head"><h3>' + esc(d.name) + '</h3>'
        + (d.restSource === 'bank' ? '<span class="chip chip-ok">' + UI.icon('check') + 'Bank, ' + esc(A.fmtDay(d.confirmed.day)) + '</span>' : '<span class="chip chip-basis">Berechnet</span>') + '</div>'
        + UI.moneyField({ path: 'ui.upd.bank.' + d.id, label: 'Restschuld laut Bank-App', cents: S.ui.upd.bank[d.id], required: true, hint: 'Vorausgefüllt mit dem Wert, den accura rechnet.' }) + '</div>';
    }).join('');
    h += '<div class="actions sticky"><button class="btn text" type="button" data-act="updBanks" data-arg="skip">Überspringen</button><button class="btn filled" type="button" data-act="updBanks" data-arg="save">Fertig</button></div>';
    return view(h, 'Kredite');
  };

  R['staende/fertig'] = ({ S, C }) => {
    const u = S.upd;
    if (!u) return R['staende/start']({ S, C });
    if (!u.t1) u.t1 = Date.now();
    const ms = u.t1 - u.t0;
    const total = u.changed + u.kept;
    let h = '<h2 class="step-t">Fertig</h2>';
    h += '<section class="card hero tone-free"><p class="hero-q">' + (total === 1 ? 'Ein Stand' : total + ' Stände') + ' auf heute gebracht</p>'
      + '<p class="hero-sub">' + u.changed + ' geändert, ' + u.kept + ' bestätigt'
      + (u.skipped ? ', ' + u.skipped + (u.skipped === 1 ? ' übersprungen' : ' übersprungen') : '') + (u.banks ? ', ' + u.banks + (u.banks === 1 ? ' Bankstand' : ' Bankstände') + ' eingetragen' : '') + '.</p>'
      + '<p class="chips"><span class="chip chip-basis">Dauer ' + dur(ms) + '</span><span class="chip chip-basis">Ziel: unter 2 Minuten</span></p>'
      + '<p class="note">Die Zeitmessung gibt es nur im Dummy.</p></section>';
    h += UI.hero({ m: C.metrics.bisGehalt, tone: 'free', id: 'neu', sub: u.before != null ? 'Vorher: ' + eur(u.before) : '' });
    if (C.stale.length) {
      h += UI.callout({ kind: 'achtung', title: C.stale.length === 1 ? 'Ein Stand bleibt alt' : C.stale.length + ' Stände bleiben alt', text: 'Du hast sie übersprungen. Sie sind weiter als „alt“ markiert, bis du sie einträgst.' });
    } else {
      h += '<p class="note">Kein Stand ist jetzt älter als ' + A.STALE_DAYS + ' Tage.</p>';
    }
    h += '<div class="actions sticky"><a class="btn tonal" href="#/daten">Datenalter ansehen</a><a class="btn filled" href="#/uebersicht">Zur Übersicht</a></div>';
    return view(h, 'Fertig');
  };
})();
