import type { PaymentContext } from "../consolidation/canonical-fact-key.ts";
import type { PaymentMethod } from "../consolidation/types.ts";

export const paymentMethodToPaymentContext = (
  paymentMethod: PaymentMethod,
): PaymentContext => {
  switch (paymentMethod.kind) {
    case "credit_card":
      return {
        kind: "credit-card",
        cardBusinessKey: paymentMethod.cardBusinessKey,
      };
    case "debit_card":
      return {
        kind: "debit-card",
        cardBusinessKey: paymentMethod.cardBusinessKey,
      };
    case "pix":
      return { kind: "bank-transfer", method: "pix" };
    case "ted":
      return { kind: "bank-transfer", method: "ted" };
    case "other_bank_transfer":
      return { kind: "bank-transfer", method: "other" };
    case "cash":
      return { kind: "cash" };
    case "unknown":
      return { kind: "unknown" };
  }
};
