import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsKeepingDay,
  addMonthsToMonth,
  calendarDayInZone,
  dayInMonth,
  daysInMonth,
  diffDays,
  isCalendarDay,
  isValidTimeZone,
  lastDayOfMonth,
  nextOccurrence,
  occurrencesInWindow,
  parseDay,
} from "../../convex/lib/calendar";

describe("Kalendertage prüfen", () => {
  it("erkennt gültige Tage, auch den 29. Februar im Schaltjahr", () => {
    expect(isCalendarDay("2026-08-08")).toBe(true);
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2000-02-29")).toBe(true);
  });

  it("lehnt nicht existierende Tage ab", () => {
    expect(isCalendarDay("2026-02-31")).toBe(false);
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("1900-02-29")).toBe(false);
    expect(isCalendarDay("2026-04-31")).toBe(false);
    expect(isCalendarDay("2026-13-01")).toBe(false);
    expect(isCalendarDay("2026-00-10")).toBe(false);
    expect(isCalendarDay("2026-08-00")).toBe(false);
  });

  it("lehnt falsche Formate ab", () => {
    for (const value of ["", "2026-8-8", "08.08.2026", "2026-08-08T10:00:00Z", " 2026-08-08", "2026/08/08"]) {
      expect(isCalendarDay(value)).toBe(false);
    }
    expect(isCalendarDay(20260808)).toBe(false);
    expect(parseDay("2026-08-08")).toEqual({ year: 2026, month: 8, day: 8 });
  });

  it("kennt die Monatslängen inklusive Schaltjahr-Regeln", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 3)).toBe(31);
  });
});

describe("Tage addieren und zählen", () => {
  it("rechnet über Monats- und Jahresgrenzen ohne Zeitzonen-Drift", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-28", 2)).toBe("2028-03-01");
    expect(addDays("2026-03-02", -7)).toBe("2026-02-23");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("zählt Tage zwischen zwei Terminen, auch über Schaltjahr und Sommerzeit", () => {
    expect(diffDays("2026-08-08", "2026-08-25")).toBe(17);
    expect(diffDays("2028-02-28", "2028-03-01")).toBe(2);
    expect(diffDays("2026-02-28", "2026-03-01")).toBe(1);
    expect(diffDays("2026-12-31", "2027-01-01")).toBe(1);
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2); // Zeitumstellung in Deutschland am 29.03.2026
    expect(diffDays("2026-08-25", "2026-08-08")).toBe(-17);
    expect(diffDays("2026-01-01", "2027-01-01")).toBe(365);
    expect(diffDays("2028-01-01", "2029-01-01")).toBe(366);
  });
});

describe("Tag des Monats", () => {
  it("rutscht in kurzen Monaten auf den letzten Tag", () => {
    expect(dayInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(dayInMonth("2028-02", 31)).toBe("2028-02-29");
    expect(dayInMonth("2026-04", 31)).toBe("2026-04-30");
    expect(dayInMonth("2026-01", 31)).toBe("2026-01-31");
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
  });

  it("addiert Monate über das Jahresende", () => {
    expect(addMonthsToMonth("2026-11", 3)).toBe("2027-02");
    expect(addMonthsToMonth("2026-01", 12)).toBe("2027-01");
  });

  it("hält beim wiederholten Fälligkeitstag den ursprünglichen Tag (31. Jan. → 28. Feb. → 31. März)", () => {
    expect(addMonthsKeepingDay("2026-01-31", 0)).toBe("2026-01-31");
    expect(addMonthsKeepingDay("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsKeepingDay("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsKeepingDay("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsKeepingDay("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsKeepingDay("2026-05-31", 1)).toBe("2026-06-30");
  });

  describe("nächstes Vorkommen am oder nach heute", () => {
    it("später im Monat, heute und im Folgemonat", () => {
      expect(nextOccurrence("2026-08-10", 15)).toBe("2026-08-15");
      expect(nextOccurrence("2026-08-15", 15)).toBe("2026-08-15");
      expect(nextOccurrence("2026-08-16", 15)).toBe("2026-09-15");
    });

    it("beim Jahreswechsel", () => {
      expect(nextOccurrence("2026-12-28", 25)).toBe("2027-01-25");
    });

    it("mit Tag 29 bis 31 in kurzen Monaten, inklusive Schaltjahr", () => {
      expect(nextOccurrence("2026-02-01", 31)).toBe("2026-02-28");
      expect(nextOccurrence("2028-02-01", 31)).toBe("2028-02-29");
      expect(nextOccurrence("2026-04-01", 31)).toBe("2026-04-30");
      expect(nextOccurrence("2026-02-28", 31)).toBe("2026-02-28");
      expect(nextOccurrence("2026-03-01", 31)).toBe("2026-03-31");
    });

    it("liefert null bei unmöglichen Tagen", () => {
      expect(nextOccurrence("2026-08-10", 0)).toBeNull();
      expect(nextOccurrence("2026-08-10", 32)).toBeNull();
      expect(nextOccurrence("2026-08-10", 1.5)).toBeNull();
    });
  });

  describe("alle Vorkommen in einem Fenster", () => {
    it("schließt den Starttag ein und das Ende aus", () => {
      expect(occurrencesInWindow(15, "2026-08-15", "2026-08-25")).toEqual(["2026-08-15"]);
      expect(occurrencesInWindow(25, "2026-08-08", "2026-08-25")).toEqual([]);
      expect(occurrencesInWindow(24, "2026-08-08", "2026-08-25")).toEqual(["2026-08-24"]);
    });

    it("findet Vorkommen über den Monatswechsel", () => {
      expect(occurrencesInWindow(1, "2026-08-26", "2026-09-25")).toEqual(["2026-09-01"]);
      expect(occurrencesInWindow(31, "2026-01-26", "2026-02-25")).toEqual(["2026-01-31"]);
      expect(occurrencesInWindow(28, "2026-01-26", "2026-03-01")).toEqual(["2026-01-28", "2026-02-28"]);
    });

    it("rutscht der 31. im Februar auf den 28., der im März wieder auf den 31.", () => {
      expect(occurrencesInWindow(31, "2026-02-01", "2026-03-05")).toEqual(["2026-02-28"]);
      expect(occurrencesInWindow(31, "2026-02-20", "2026-04-01")).toEqual(["2026-02-28", "2026-03-31"]);
    });

    it("liefert nichts bei leerem oder umgekehrtem Fenster", () => {
      expect(occurrencesInWindow(10, "2026-08-25", "2026-08-25")).toEqual([]);
      expect(occurrencesInWindow(10, "2026-08-25", "2026-08-01")).toEqual([]);
    });
  });
});

describe("Kalendertag in Stevens Zeitzone", () => {
  it("nutzt die Zeitzone, nicht UTC", () => {
    const lateEveningUtc = Date.UTC(2026, 7, 8, 22, 30); // 8. August, 22:30 UTC
    expect(calendarDayInZone(lateEveningUtc, "UTC")).toBe("2026-08-08");
    expect(calendarDayInZone(lateEveningUtc, "Europe/Berlin")).toBe("2026-08-09"); // 00:30 MESZ
    expect(calendarDayInZone(lateEveningUtc, "America/New_York")).toBe("2026-08-08");
  });

  it("beachtet Winter- und Sommerzeit", () => {
    // Winter: MEZ = UTC+1, 23:30 UTC ist schon der nächste Tag
    expect(calendarDayInZone(Date.UTC(2026, 0, 15, 23, 30), "Europe/Berlin")).toBe("2026-01-16");
    // Sommer: MESZ = UTC+2, 21:59 UTC ist noch derselbe Tag, 22:00 UTC nicht mehr
    expect(calendarDayInZone(Date.UTC(2026, 6, 15, 21, 59), "Europe/Berlin")).toBe("2026-07-15");
    expect(calendarDayInZone(Date.UTC(2026, 6, 15, 22, 0), "Europe/Berlin")).toBe("2026-07-16");
  });

  it("prüft IANA-Zeitzonen", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
