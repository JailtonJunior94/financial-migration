import { describe, expect, test } from "bun:test";
import { createMoneyAmount } from "../../../src/domain/consolidation/money-amount.ts";
import {
  buildCanonicalPayload,
  transactionPayloadsAreEqual,
} from "../../../src/domain/publication/payload-canonical.ts";

const makeMoney = (minorUnits: bigint, scale = 2) => {
  const result = createMoneyAmount(minorUnits, scale, "BRL");
  if (!result.ok) throw new Error("Invalid money amount");
  return result.value;
};

const basePayload = () =>
  buildCanonicalPayload({
    kind: "expense",
    occurredOn: "2026-01-15",
    competence: "2026-01",
    description: "Supermercado",
    amount: makeMoney(1000n),
    categoryId: "cat-1",
    subcategoryId: "sub-1",
    paymentContext: { kind: "bank-transfer", method: "pix" },
    installmentPlan: {
      groupKey: "group-1",
      currentInstallment: 1,
      totalInstallments: 1,
    },
  });

describe("buildCanonicalPayload", () => {
  test("mantém subcategoryId quando informado", () => {
    const payload = basePayload();
    expect(payload.subcategoryId).toBe("sub-1");
  });

  test("omite subcategoryId quando não informado", () => {
    const payload = buildCanonicalPayload({
      kind: "expense",
      occurredOn: "2026-01-15",
      competence: "2026-01",
      description: "Supermercado",
      amount: makeMoney(1000n),
      categoryId: "cat-1",
      paymentContext: { kind: "bank-transfer", method: "pix" },
      installmentPlan: {
        groupKey: "group-1",
        currentInstallment: 1,
        totalInstallments: 1,
      },
    });

    expect("subcategoryId" in payload).toBe(false);
  });
});

describe("transactionPayloadsAreEqual", () => {
  test("considera payloads idênticos como equivalentes", () => {
    const left = basePayload();
    const right = basePayload();

    expect(transactionPayloadsAreEqual(left, right)).toBe(true);
  });

  test("distingue por kind", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      kind: "income",
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("distingue por data de ocorrência", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      occurredOn: "2026-01-16",
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("distingue por competência", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      competence: "2026-02",
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("distingue por descrição", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      description: "Farmácia",
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("distingue por valor monetário", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      amount: makeMoney(2000n),
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("iguala valores monetários com escalas diferentes", () => {
    const left = makeMoney(1000n, 2);
    const right = makeMoney(10000n, 3);

    const leftPayload = buildCanonicalPayload({
      ...basePayload(),
      amount: left,
    });
    const rightPayload = buildCanonicalPayload({
      ...basePayload(),
      amount: right,
    });

    expect(transactionPayloadsAreEqual(leftPayload, rightPayload)).toBe(true);
  });

  test("distingue por categoria", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      categoryId: "cat-2",
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("distingue por subcategoria", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      subcategoryId: "sub-2",
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("distingue por contexto de pagamento", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      paymentContext: { kind: "bank-transfer", method: "ted" },
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("distingue por cartão no contexto de pagamento", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      paymentContext: {
        kind: "credit-card",
        cardBusinessKey: "nubank",
      },
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("distingue por parcelamento", () => {
    const left = basePayload();
    const right = buildCanonicalPayload({
      ...left,
      installmentPlan: {
        groupKey: "group-1",
        currentInstallment: 2,
        totalInstallments: 3,
      },
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });

  test("distingue por moeda", () => {
    const left = basePayload();
    const result = createMoneyAmount(1000n, 2, "USD");
    if (!result.ok) throw new Error("Invalid money amount");

    const right = buildCanonicalPayload({
      ...left,
      amount: result.value,
    });

    expect(transactionPayloadsAreEqual(left, right)).toBe(false);
  });
});
