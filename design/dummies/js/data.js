/*
 * data.js: ausgedachte Testdaten für den Klick-Dummy. Keine echten Finanzdaten.
 * Geld steht immer in ganzen Cents. "Heute" ist im Dummy fest.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Accura = Object.assign(root.Accura || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const TODAY = '2026-10-13'; // Dienstag

  function emptyData() {
    return { incomeCents: null, salaryDay: null, accounts: [], pockets: [], budgetItems: [], debts: [], household: [] };
  }

  function sampleData() {
    return {
      incomeCents: 285000,
      salaryDay: 28,
      accounts: [
        { id: 'giro', name: 'Girokonto', kind: 'bank', stand: { day: '2026-10-12', cents: 148260 } },
        { id: 'tages', name: 'Tagesgeld', kind: 'bank', stand: { day: '2026-09-29', cents: 60000 } },
        { id: 'bar', name: 'Bargeld', kind: 'cash', stand: { day: '2026-09-02', cents: 8500 } },
      ],
      pockets: [
        { id: 'wohnen', accountId: 'giro', name: 'Wohnen', stand: { day: '2026-10-12', cents: 64000 } },
        { id: 'reise', accountId: 'tages', name: 'Reise', stand: { day: '2026-09-29', cents: 45000 } },
        { id: 'geschenke', accountId: 'giro', name: 'Geschenke', stand: { day: '2026-09-29', cents: 12000 } },
      ],
      budgetItems: [
        { id: 'miete', label: 'Miete inkl. Nebenkosten', cents: 92000, necessity: 'essential', kind: 'expense', category: 'wohnen', dueDay: 1 },
        { id: 'strom', label: 'Strom', cents: 6200, necessity: 'essential', kind: 'expense', category: 'wohnen', dueDay: 5 },
        { id: 'netz', label: 'Internet und Handy', cents: 4499, necessity: 'necessary', kind: 'expense', category: 'vertrag', dueDay: 14 },
        { id: 'haftpflicht', label: 'Haftpflichtversicherung', cents: 1840, necessity: 'necessary', kind: 'expense', category: 'versicherung', dueDay: 18 },
        { id: 'ticket', label: 'Monatsticket Nahverkehr', cents: 6300, necessity: 'necessary', kind: 'expense', category: 'mobilitaet', dueDay: 1 },
        { id: 'essen', label: 'Lebensmittel', cents: 45000, necessity: 'essential', kind: 'expense', category: 'lebensmittel', dueDay: null },
        { id: 'fitness', label: 'Fitnessstudio', cents: 2990, necessity: 'worthwhile', kind: 'expense', category: 'abo', dueDay: 3, contractEnd: '2027-03-31', noticeDays: 90 },
        { id: 'film', label: 'Streaming Filmwelt', cents: 1399, necessity: 'optional', kind: 'expense', category: 'abo', subgroup: 'streaming', dueDay: 8 },
        { id: 'serie', label: 'Streaming Serienland', cents: 999, necessity: 'optional', kind: 'expense', category: 'abo', subgroup: 'streaming', dueDay: 20 },
        { id: 'cloud', label: 'Cloud-Speicher', cents: 299, necessity: 'worthwhile', kind: 'expense', category: 'abo', dueDay: 22 },
        { id: 'freizeit', label: 'Freizeit und Kleidung', cents: 12000, necessity: 'optional', kind: 'expense', category: 'freizeit', dueDay: null },
        { id: 'lieferdienst', label: 'Essen gehen und Lieferdienste', cents: 8000, necessity: 'unnecessary', kind: 'expense', category: 'freizeit', dueDay: null },
        { id: 'notgroschen', label: 'Notgroschen', cents: 15000, necessity: 'necessary', kind: 'reserve', category: 'ruecklage', dueDay: null },
        { id: 'reise-r', label: 'Reise', cents: 10000, necessity: 'optional', kind: 'reserve', category: 'ruecklage', dueDay: null },
      ],
      debts: [
        {
          id: 'kredit-a', name: 'Ratenkredit Musterbank', lender: 'Musterbank', art: 'loan',
          principalCents: 800000, nominalBps: 590, effBps: 606, monthlyPaymentCents: 18767,
          firstPaymentDay: '2025-03-01', paymentCount: 48,
          confirmed: { day: '2026-10-05', cents: 489087 },
        },
        {
          id: 'kauf-b', name: 'Ratenkauf Waschmaschine', lender: 'Elektro-Fix', art: 'installment0',
          principalCents: 120000, nominalBps: 0, effBps: 0, monthlyPaymentCents: 5000,
          firstPaymentDay: '2026-02-15', paymentCount: 24,
        },
        {
          id: 'kauf-c', name: 'Ratenkauf Sofa', lender: 'Wohnwelt', art: 'installment',
          principalCents: 180000, nominalBps: 390, effBps: 397, monthlyPaymentCents: 10311,
          firstPaymentDay: '2025-09-10', paymentCount: 18,
        },
      ],
      household: [
        { label: 'Ich', dailyKcal: 2300 },
        { label: 'Sam', dailyKcal: 1900 },
      ],
    };
  }

  return { TODAY, emptyData, sampleData };
});
