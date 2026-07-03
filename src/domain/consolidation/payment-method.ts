import type { PaymentMethod } from "./types.ts";

export type PaymentMethodInput = {
  readonly sourceTable: string;
  readonly description: string;
  readonly hasCardBinding: boolean;
  readonly cardBusinessKey?: string;
  readonly pixEvidence?: boolean;
  readonly tedEvidence?: boolean;
  readonly cashEvidence?: boolean;
};

const normalizeForMatching = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

const isInvoiceItemLike = (table: string): boolean => {
  const normalized = table.toLowerCase();
  return (
    normalized === "invoiceitem" ||
    normalized === "invoice_item" ||
    normalized === "billitem" ||
    normalized === "bill_item"
  );
};

const isAccountOrBillLike = (table: string): boolean => {
  const normalized = table.toLowerCase();
  return (
    normalized === "accounts" ||
    normalized === "bill" ||
    normalized === "billitem" ||
    normalized === "bill_item" ||
    normalized === "transaction" ||
    normalized === "transactionitem" ||
    normalized === "transaction_item"
  );
};

export const inferPaymentMethod = (
  input: PaymentMethodInput,
): PaymentMethod => {
  if (input.hasCardBinding && input.cardBusinessKey) {
    return { kind: "credit_card", cardBusinessKey: input.cardBusinessKey };
  }

  if (isInvoiceItemLike(input.sourceTable) && input.cardBusinessKey) {
    return { kind: "credit_card", cardBusinessKey: input.cardBusinessKey };
  }

  const normalizedDescription = normalizeForMatching(input.description);

  if (input.pixEvidence || normalizedDescription.includes("pix")) {
    return { kind: "pix" };
  }

  if (
    input.tedEvidence ||
    normalizedDescription.includes("ted") ||
    normalizedDescription.includes("transferencia") ||
    normalizedDescription.includes("doc")
  ) {
    return { kind: "ted" };
  }

  if (input.cashEvidence || normalizedDescription.includes("dinheiro")) {
    return { kind: "cash" };
  }

  if (isAccountOrBillLike(input.sourceTable)) {
    return { kind: "other_bank_transfer" };
  }

  return { kind: "unknown" };
};

export const paymentMethodIsProvable = (
  paymentMethod: PaymentMethod,
): boolean => paymentMethod.kind !== "unknown";
