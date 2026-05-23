import { describe, expect, it } from "vitest";
import {
  calendarMonthsBetween,
  contributionScheduleFromDates,
} from "./investment-contribution-dates";

describe("calendarMonthsBetween", () => {
  it("counts whole months between dates", () => {
    const from = new Date("2026-01-15T12:00:00.000Z");
    const to = new Date("2026-07-20T12:00:00.000Z");
    expect(calendarMonthsBetween(from, to)).toBe(6);
  });
});

describe("contributionScheduleFromDates", () => {
  const asOf = new Date("2026-05-24T12:00:00.000Z");

  it("returns months through end date from today when start omitted", () => {
    const schedule = contributionScheduleFromDates(
      null,
      "2028-12-31",
      asOf
    );
    expect(schedule).not.toBeNull();
    expect(schedule!.contributionStartMonth).toBe(0);
    expect(schedule!.contributionMonthsLimit).toBeGreaterThan(30);
  });

  it("defers contributions when start is in the future", () => {
    const schedule = contributionScheduleFromDates(
      "2027-01-01",
      "2030-01-01",
      asOf
    );
    expect(schedule).not.toBeNull();
    expect(schedule!.contributionStartMonth).toBeGreaterThan(0);
    expect(schedule!.contributionMonthsLimit).toBeGreaterThan(
      schedule!.contributionStartMonth
    );
  });

  it("returns zero window when end is before effective start", () => {
    const schedule = contributionScheduleFromDates(
      null,
      "2020-01-01",
      asOf
    );
    expect(schedule).toEqual({
      contributionStartMonth: 0,
      contributionMonthsLimit: 0,
    });
  });
});
