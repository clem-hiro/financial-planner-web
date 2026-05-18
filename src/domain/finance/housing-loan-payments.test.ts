import { describe, expect, it } from "vitest";
import {
  oaShareForCpfProjection,
  resolveHousingPaymentSource,
  resolveHousingPaymentSourceForCash,
  splitHousingInstalment,
  sumHousingCashInstalmentsForMonth,
} from "./housing-loan-payments";

const baseLoan = {
  principal: 400_000,
  annual_nominal_rate: 0.026,
  term_months: 300,
  first_payment_month: "2026-01",
  oa_share_of_payment: 1,
};

describe("resolveHousingPaymentSourceForCash", () => {
  it("defaults legacy null payment_source to cash", () => {
    expect(
      resolveHousingPaymentSourceForCash({
        payment_source: null,
        oa_share_of_payment: 1,
      })
    ).toBe("cash");
  });

  it("uses explicit payment_source when set", () => {
    expect(
      resolveHousingPaymentSourceForCash({
        payment_source: "cpf_oa",
        oa_share_of_payment: 0,
      })
    ).toBe("cpf_oa");
  });
});

describe("splitHousingInstalment", () => {
  it("cpf_oa puts full instalment in OA, zero cash", () => {
    const r = splitHousingInstalment(
      { ...baseLoan, payment_source: "cpf_oa" },
      2000
    );
    expect(r.cashPayment).toBe(0);
    expect(r.cpfOaPayment).toBe(2000);
    expect(r.oaShareForCpf).toBe(1);
  });

  it("cash puts full instalment in cash budget", () => {
    const r = splitHousingInstalment(
      { ...baseLoan, payment_source: "cash" },
      2000
    );
    expect(r.cashPayment).toBe(2000);
    expect(r.cpfOaPayment).toBe(0);
    expect(r.oaShareForCpf).toBe(0);
  });

  it("split honours stored portions", () => {
    const r = splitHousingInstalment(
      {
        ...baseLoan,
        payment_source: "split",
        cpf_oa_payment: 1200,
        cash_payment: 800,
      },
      2000
    );
    expect(r.cpfOaPayment).toBe(1200);
    expect(r.cashPayment).toBe(800);
  });
});

describe("oaShareForCpfProjection", () => {
  it("legacy row keeps oa_share_of_payment for CPF", () => {
    expect(
      oaShareForCpfProjection({
        ...baseLoan,
        payment_source: null,
        oa_share_of_payment: 1,
      })
    ).toBe(1);
  });

  it("explicit cash uses zero OA share", () => {
    expect(
      oaShareForCpfProjection({
        ...baseLoan,
        payment_source: "cash",
        oa_share_of_payment: 1,
      })
    ).toBe(0);
  });
});

describe("sumHousingCashInstalmentsForMonth", () => {
  it("sums only cash portions for active month", () => {
    const total = sumHousingCashInstalmentsForMonth(
      [
        { ...baseLoan, payment_source: "cash" },
        {
          ...baseLoan,
          payment_source: "cpf_oa",
          first_payment_month: "2026-01",
        },
      ],
      "2026-01"
    );
    expect(total).toBeGreaterThan(0);
  });
});

describe("resolveHousingPaymentSource", () => {
  it("infers from legacy oa share when payment_source unset", () => {
    expect(
      resolveHousingPaymentSource({
        payment_source: null,
        oa_share_of_payment: 0.5,
      })
    ).toBe("split");
  });
});
