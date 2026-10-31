import { describe, expect, it } from "vitest";

import { headline, money, type Offer } from "../api/offerHooks";
import { offerFacts } from "./Offers";

// Offers' text comes from locales/en/offers.ts (i18n-offers). A before/after snapshot of the
// pages and form showed no change; these pin what the demo data can't reach.

const offer = (over: Partial<Offer> = {}) =>
  ({
    value_basis: "salary",
    currency: "GBP",
    salary: 85000,
    day_rate: null,
    bonus: null,
    pension_percent: null,
    equity: null,
    holiday_days: null,
    ir35: null,
    contract_months: null,
    start_on: null,
    ...over,
  }) as Offer;

describe("money", () => {
  it("keeps the offer's own currency", () => {
    expect(money(85000, "GBP")).toBe("£85,000");
    expect(money(85000, "usd")).toBe("$85,000");
    expect(money(85000, "CHF")).toBe("85,000 CHF");
    expect(money(85000, null)).toBe("85,000");
    expect(money(null, "GBP")).toBe("—");
  });
});

describe("the headline", () => {
  it("says what it pays and how often", () => {
    expect(headline(offer())).toBe("£85,000 a year");
    expect(headline(offer({ value_basis: "day rate", day_rate: 650 }))).toBe("£650 a day");
    expect(headline(offer({ salary: null }))).toBe("No figures yet");
  });
});

describe("an offer's facts", () => {
  it("lists each figure that's set", () => {
    expect(
      offerFacts(
        offer({
          bonus: 8000,
          pension_percent: 6,
          equity: "0.1%",
          holiday_days: 25,
          contract_months: 12,
          start_on: "2026-11-02",
        }),
      ),
    ).toEqual([
      "Bonus £8,000",
      "Pension 6%",
      "Equity: 0.1%",
      "25 days' holiday",
      "12 months",
      "Starts 2 Nov 2026",
    ]);
  });

  it("says each IR35 state on a day rate, and keeps one it doesn't know", () => {
    const facts = (ir35: string) => offerFacts(offer({ value_basis: "day rate", ir35 }));
    expect(facts("outside")).toEqual(["IR35 outside"]);
    expect(facts("inside")).toEqual(["IR35 inside"]);
    expect(facts("unknown")).toEqual(["IR35 unknown"]);
    expect(facts("maybe")).toEqual(["IR35 maybe"]);
  });
});
