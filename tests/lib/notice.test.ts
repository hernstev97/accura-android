import { describe, expect, it } from "vitest";
import { addDays, addMonthsToMonth, dayInMonth, monthOf } from "../../convex/lib/calendar";
import { cancellation, lastNoticeDayByDays, lastNoticeDayByMonths } from "../../convex/lib/notice";

const fields = (contractEndDay: string | null, noticePeriodDays: number | null, noticePeriodMonths: number | null = null) => ({
  contractEndDay,
  noticePeriodDays,
  noticePeriodMonths,
});

describe("Letzter Kündigungstag bei einer Frist in Tagen", () => {
  it.each([
    ["Jahresende, 30 Tage", "2026-12-31", 30, "2026-12-01"],
    ["Frist 0 Tage: am Vertragsende selbst", "2026-12-31", 0, "2026-12-31"],
    ["4 Wochen sind 28 Tage", "2026-12-31", 28, "2026-12-03"],
    ["über den Monatswechsel", "2026-10-05", 14, "2026-09-21"],
    ["über den Jahreswechsel", "2027-01-15", 31, "2026-12-15"],
    ["Monatsende Februar", "2026-03-01", 1, "2026-02-28"],
    ["Schaltjahr: 29. Februar", "2028-03-01", 1, "2028-02-29"],
    ["Schaltjahr: über den 29. Februar", "2028-03-10", 10, "2028-02-29"],
    ["kein Schaltjahr 2100", "2100-03-01", 1, "2100-02-28"],
  ])("%s: Ende %s, %i Tage → %s", (_name, end, days, expected) => {
    expect(lastNoticeDayByDays(end, days)).toBe(expected);
  });
});

describe("Letzter Kündigungstag bei einer Frist in Monaten", () => {
  it.each([
    ["Jahresende, 3 Monate", "2026-12-31", 3, "2026-09-30"],
    ["Jahresende, 1 Monat", "2026-12-31", 1, "2026-11-30"],
    ["Monatsmitte, 1 Monat", "2026-08-15", 1, "2026-07-15"],
    ["12 Monate über den Jahreswechsel", "2027-01-31", 12, "2026-01-31"],
    ["Frist 0 Monate: am Vertragsende selbst", "2026-12-31", 0, "2026-12-31"],
    ["Ende 31. März, 1 Monat: Ende Februar", "2026-03-31", 1, "2026-02-28"],
    ["Ende 31. März im Schaltjahr: 29. Februar", "2028-03-31", 1, "2028-02-29"],
    ["Ende 30. Juni, 4 Monate", "2026-06-30", 4, "2026-02-28"],
    ["Ende 30. Juni, 4 Monate, Schaltjahr", "2028-06-30", 4, "2028-02-29"],
    ["Ende 28. Februar, 1 Monat", "2026-02-28", 1, "2026-01-31"],
    ["Ende 29. Februar im Schaltjahr, 1 Monat", "2028-02-29", 1, "2028-01-31"],
    ["Ende 28. Februar im Schaltjahr, 1 Monat", "2028-02-28", 1, "2028-01-28"],
    // Rückwärts gerechnet gäbe es den 30. bzw. 31. Februar nicht: die Frist beginnt am 1. März.
    ["nicht existierender 30. Februar", "2026-04-29", 2, "2026-02-28"],
    ["nicht existierender 31. Februar", "2026-05-30", 3, "2026-02-28"],
    ["nicht existierender 31. April", "2026-07-30", 3, "2026-04-30"],
    ["nicht existierender 29. Februar außerhalb des Schaltjahrs", "2026-03-28", 1, "2026-02-28"],
    ["29. Februar im Schaltjahr existiert", "2028-03-28", 1, "2028-02-28"],
  ])("%s: Ende %s, %i Monate → %s", (_name, end, months, expected) => {
    expect(lastNoticeDayByMonths(end, months)).toBe(expected);
  });

  /**
   * Gegenprobe ohne die Rückwärtsrechnung: Eine Kündigung, die am Tag `r`
   * ankommt, endet nach § 188 BGB am Tag mit derselben Zahl `months` Monate
   * später, fehlt er, am Monatsletzten. Gesucht ist der späteste Tag, für den
   * das Fristende nicht nach dem Vertragsende liegt.
   */
  const noticeEnds = (r: string, months: number) => dayInMonth(addMonthsToMonth(monthOf(r), months), Number(r.slice(8)));
  const latestByForwardRule = (end: string, months: number) => {
    // Ein Monat hat höchstens 31 Tage: dieser Tag liegt sicher früh genug.
    let r = addDays(end, -(31 * months + 1));
    while (noticeEnds(addDays(r, 1), months) <= end) r = addDays(r, 1);
    return r;
  };

  it("stimmt für jeden Tag 2027 und 2028 und Fristen von 0 bis 13 Monaten mit der Vorwärtsrechnung überein", () => {
    const mismatches: string[] = [];
    for (let end = "2027-01-01"; end <= "2028-12-31"; end = addDays(end, 1)) {
      for (let months = 0; months <= 13; months += 1) {
        const expected = latestByForwardRule(end, months);
        const actual = lastNoticeDayByMonths(end, months);
        if (actual !== expected) mismatches.push(`${end} ${months}: ${actual} statt ${expected}`);
        // Probe: Kündigung am letzten Tag reicht, einen Tag später nicht mehr.
        if (noticeEnds(actual, months) > end || noticeEnds(addDays(actual, 1), months) <= end) mismatches.push(`${end} ${months}: Probe`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("Kündigung im Hinweis", () => {
  const today = "2026-08-08";

  it("ohne Vertragsdaten gibt es keine Angabe", () => {
    expect(cancellation(fields(null, null), today)).toBeNull();
  });

  it("nennt den letzten Kündigungstag und die Tage bis dahin", () => {
    expect(cancellation(fields("2026-12-31", null, 3), today)).toEqual({
      state: "open",
      contractEndDay: "2026-12-31",
      noticePeriodDays: null,
      noticePeriodMonths: 3,
      lastNoticeDay: "2026-09-30",
      daysUntilLastNoticeDay: 53,
      reason: null,
    });
  });

  it("heute ist der letzte Kündigungstag: noch offen, 0 Tage", () => {
    expect(cancellation(fields("2026-09-07", 30), today)).toMatchObject({ state: "open", lastNoticeDay: today, daysUntilLastNoticeDay: 0 });
  });

  it("Kündigungstag schon vorbei, Vertragsende noch nicht", () => {
    expect(cancellation(fields("2026-09-06", 30), today)).toMatchObject({
      state: "passed",
      lastNoticeDay: "2026-08-07",
      daysUntilLastNoticeDay: -1,
      reason: "Der letzte Kündigungstag für dieses Vertragsende ist vorbei.",
    });
  });

  it("Vertragsende schon vorbei: bittet um das neue Ende, statt eines zu erfinden", () => {
    const result = cancellation(fields("2026-07-31", null, 1), today)!;
    expect(result).toMatchObject({ state: "passed", lastNoticeDay: "2026-06-30" });
    expect(result.reason).toContain("neue Ende");
  });

  it("fehlt Ende oder Frist, gibt es keinen Tag", () => {
    expect(cancellation(fields("2026-12-31", null), today)).toMatchObject({ state: "incomplete", lastNoticeDay: null, reason: "Die Kündigungsfrist fehlt." });
    expect(cancellation(fields(null, 30), today)).toMatchObject({ state: "incomplete", lastNoticeDay: null, reason: "Das Vertragsende fehlt." });
    expect(cancellation(fields(null, null, 3), today)).toMatchObject({ state: "incomplete", daysUntilLastNoticeDay: null });
  });

  it.each([
    ["nicht existierendes Vertragsende", fields("2026-02-30", 30)],
    ["Vertragsende im falschen Format", fields("31.12.2026", 30)],
    ["Monat 13", fields("2026-13-01", null, 1)],
    ["negative Frist", fields("2026-12-31", -1)],
    ["negative Frist in Monaten", fields("2026-12-31", null, -1)],
    ["Frist in Tagen und Monaten", fields("2026-12-31", 30, 1)],
    ["mehr als zehn Jahre", fields("2036-12-31", 3_661)],
    ["mehr als 120 Monate", fields("2036-12-31", null, 121)],
    ["Frist ohne ganze Zahl", fields("2026-12-31", 1.5)],
    ["Rechnung vor dem Jahr 1", fields("0001-01-15", 30)],
  ])("ungültig: %s", (_name, input) => {
    const result = cancellation(input, today)!;
    expect(result.state).toBe("invalid");
    expect(result.lastNoticeDay).toBeNull();
    expect(result.reason).not.toBeNull();
  });
});
