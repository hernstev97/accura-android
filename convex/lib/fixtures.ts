import type { BudgetItemInput, DebtInput, FinanceInput } from "./input";

/**
 * Vollständig ausgedachte Testdaten. Heute ist der 8. August 2026, das Gehalt
 * kommt am 25. Beträge in Cent. Keine echten Finanzdaten.
 */
export const TODAY = "2026-08-08";

const item = (
  id: string,
  label: string,
  monthlyAmountCents: number,
  necessity: BudgetItemInput["necessity"],
  category: string,
  order: number,
  extra: Partial<BudgetItemInput> = {},
): BudgetItemInput => ({
  id,
  label,
  monthlyAmountCents,
  necessity,
  kind: "expense",
  category,
  dueDay: null,
  contractEndDay: null,
  noticePeriodDays: null,
  order,
  active: true,
  ...extra,
});

export const budgetFixture: BudgetItemInput[] = [
  item("housing", "Wohnen", 100_000, "essential", "Wohnen", 1, { dueDay: 1 }),
  item("groceries", "Lebensmittel", 50_000, "essential", "Lebensmittel", 2, { dueDay: 5 }),
  item("reserve", "Rücklagen", 30_000, "worthwhile", "Rücklage", 3, { kind: "reserve" }),
  item("utilities", "Nebenkosten", 20_000, "necessary", "Wohnen", 4),
  item("mobility", "Mobilität", 15_000, "necessary", "Mobilität", 5),
  item("insurance", "Versicherungen", 10_000, "essential", "Versicherung", 6, { dueDay: 15 }),
  item("fitness", "Fitness", 6_000, "optional", "Abo", 7),
  item("internet", "Internet", 5_000, "necessary", "Wohnen", 8),
  item("gifts", "Geschenke", 5_000, "unnecessary", "Freizeit", 9),
  item("subscriptions", "Abos", 4_000, "optional", "Abo", 10),
];

/** 12.000 € zu 5,00 % in 60 Monatsraten ab 20.01.2025; die letzte Rate löst den Rest ab. */
export const loanFixture: DebtInput = {
  id: "primary-loan",
  lender: "Ratenkredit",
  kind: "loan",
  terms: {
    principalCents: 1_200_000,
    nominalRateBps: 500,
    monthlyPaymentCents: 22_645,
    firstPaymentDay: "2025-01-20",
    paymentCount: 60,
    finalPaymentCents: null,
    specialRepaymentYearlyCents: null,
  },
  effectiveRateBps: 512,
  note: null,
  order: 1,
  active: true,
  anchor: null,
};

/** Ratenkauf ohne Zins: 3 × 120 €, erste Rate am 15.07.2026. */
export const installmentAFixture: DebtInput = {
  id: "installment-a",
  lender: "Finanzierung A",
  kind: "installment",
  terms: {
    principalCents: 36_000,
    nominalRateBps: 0,
    monthlyPaymentCents: 12_000,
    firstPaymentDay: "2026-07-15",
    paymentCount: 3,
    finalPaymentCents: null,
    specialRepaymentYearlyCents: null,
  },
  effectiveRateBps: 0,
  note: null,
  order: 2,
  active: true,
  anchor: null,
};

/** Ratenkauf ohne Zins mit Fälligkeit am 31.: 6 × 60 €, erste Rate am 31.05.2026. */
export const installmentBFixture: DebtInput = {
  id: "installment-b",
  lender: "Finanzierung B",
  kind: "installment",
  terms: {
    principalCents: 36_000,
    nominalRateBps: 0,
    monthlyPaymentCents: 6_000,
    firstPaymentDay: "2026-05-31",
    paymentCount: 6,
    finalPaymentCents: null,
    specialRepaymentYearlyCents: null,
  },
  effectiveRateBps: 0,
  note: null,
  order: 3,
  active: true,
  anchor: null,
};

export const anonymousInput = (): FinanceInput => ({
  today: TODAY,
  incomeCents: 300_000,
  salaryDay: 25,
  accounts: [
    { id: "daily-account", name: "Alltagskonto", kind: "bank", order: 1, active: true, stand: { day: TODAY, cents: 120_025, recordedDay: TODAY } },
    { id: "travel-wallet", name: "Reise-Wallet", kind: "wallet", order: 2, active: true, stand: { day: TODAY, cents: 12_050, recordedDay: TODAY } },
    { id: "cash-box", name: "Bargeld", kind: "cash", order: 3, active: true, stand: { day: TODAY, cents: 3_000, recordedDay: TODAY } },
    { id: "old-account", name: "Altes Konto", kind: "bank", order: 4, active: false, stand: { day: "2026-01-02", cents: 99_999, recordedDay: "2026-01-02" } },
  ],
  pockets: [
    { id: "home-reserve", accountId: "daily-account", name: "Wohnen", order: 1, active: true, stand: { day: TODAY, cents: 30_000, recordedDay: TODAY } },
    { id: "food-reserve", accountId: "daily-account", name: "Lebensmittel", order: 2, active: true, stand: { day: TODAY, cents: 15_025, recordedDay: TODAY } },
    { id: "trip-reserve", accountId: "travel-wallet", name: "Reise", order: 3, active: true, stand: { day: TODAY, cents: 7_500, recordedDay: TODAY } },
    { id: "tech-reserve", accountId: "daily-account", name: "Technik", order: 4, active: true, stand: { day: TODAY, cents: 0, recordedDay: TODAY } },
    { id: "gift-reserve", accountId: "daily-account", name: "Geschenke", order: 5, active: true, stand: { day: TODAY, cents: 2_500, recordedDay: TODAY } },
  ],
  budgetItems: budgetFixture.map((entry) => ({ ...entry })),
  debts: [structuredClone(loanFixture), structuredClone(installmentAFixture), structuredClone(installmentBFixture)],
});
