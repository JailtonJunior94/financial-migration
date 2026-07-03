import type { LegacyFact } from "../../application/ports/legacy-financial-fact-reader-port.ts";
import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";
import { createCanonicalFactKey } from "./canonical-fact-key.ts";
import { deriveCompetence } from "./competence.ts";
import { readNumber, readString } from "./field-helpers.ts";
import {
  type InstallmentPlan,
  createInstallmentPlan,
} from "./installment-plan.ts";
import { normalizeAmount } from "./normalize-amount.ts";
import { createOccurrenceDateFromFact } from "./occurrence-date.ts";
import type {
  ConsolidatedTransaction,
  LegacyDatabase,
  LegacySourceRef,
  TransactionKind,
} from "./types.ts";

export type InvoiceItemContext = {
  readonly userId: string;
  readonly cardBusinessKey: string;
  readonly invoiceCompetence: string;
  readonly currency: string;
};

const resolveKind = (raw: unknown): TransactionKind => {
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "income" || normalized === "receita") {
      return "income";
    }
  }
  return "expense";
};

const buildSourceSummary = (ref: LegacySourceRef) =>
  ({
    primarySource: ref.database,
    secondarySources: [],
    notes: ["Fato detalhado de fatura de cartão."],
  }) satisfies ConsolidatedTransaction["sourceSummary"];

const buildSingleTransaction = (
  fact: LegacyFact,
  context: InvoiceItemContext,
  plan: InstallmentPlan,
): Result<ConsolidatedTransaction, DomainError> => {
  const ref = fact.ref;
  const fields = fact.fields;
  const description =
    readString(fields, "description", "Description", "name", "Name") ??
    `Fatura ${context.invoiceCompetence}`;

  const amountResult = normalizeAmount(
    readNumber(fields, "amount", "Amount", "value", "Value", "total", "Total"),
    context.currency,
  );
  if (!amountResult.ok) {
    return failure(amountResult.error);
  }

  const purchaseDate = readString(
    fields,
    "purchaseDate",
    "PurchaseDate",
    "transactionDate",
    "TransactionDate",
    "date",
    "Date",
  );
  const createdAt = readString(fields, "createdAt", "CreatedAt", "created_at");
  const occurrenceResult = createOccurrenceDateFromFact(
    purchaseDate,
    "PurchaseDate",
    createdAt,
  );
  if (!occurrenceResult.ok) {
    return failure(occurrenceResult.error);
  }

  const factKeyResult = createCanonicalFactKey(
    "transaction",
    context.userId,
    occurrenceResult.value.value,
    description,
    amountResult.value,
    { kind: "credit-card", cardBusinessKey: context.cardBusinessKey },
    {
      kind: "installment",
      groupKey: `${ref.database}.${ref.table}.${ref.primaryKey}`,
      current: plan.currentInstallment,
      total: plan.totalInstallments,
    },
  );
  if (!factKeyResult.ok) {
    return failure(factKeyResult.error);
  }

  return success({
    factKey: factKeyResult.value,
    kind: resolveKind(fields.kind ?? fields.Type ?? fields.type),
    occurredOn: occurrenceResult.value,
    competence: context.invoiceCompetence,
    description,
    amount: amountResult.value,
    paymentMethod: {
      kind: "credit_card",
      cardBusinessKey: context.cardBusinessKey,
    },
    cardBinding: context.cardBusinessKey,
    installmentPlan: plan,
    legacyRefs: [ref],
    sourceSummary: buildSourceSummary(ref),
  });
};

export const shapeInvoiceItem = (
  fact: LegacyFact,
  context: InvoiceItemContext,
): Result<readonly ConsolidatedTransaction[], DomainError> => {
  if (
    fact.ref.database !== "FinancialControlDB" &&
    fact.ref.database !== "AccountControlDB"
  ) {
    return failure(
      new DomainError(
        "INVALID_SOURCE_RECORD",
        "InvoiceItem shaping exige origem AccountControlDB ou FinancialControlDB.",
        { ref: fact.ref },
      ),
    );
  }

  const fields = fact.fields;
  const currentInstallment =
    readNumber(
      fields,
      "installmentNumber",
      "InstallmentNumber",
      "currentInstallment",
      "CurrentInstallment",
      "installment",
      "Installment",
    ) ?? 1;
  const totalInstallments =
    readNumber(
      fields,
      "totalInstallments",
      "TotalInstallments",
      "installments",
      "Installments",
      "total",
      "Total",
    ) ?? 1;

  const planResult = createInstallmentPlan(
    `${fact.ref.database}.${fact.ref.table}.${fact.ref.primaryKey}`,
    currentInstallment,
    totalInstallments,
  );
  if (!planResult.ok) {
    return failure(planResult.error);
  }

  const plan = planResult.value;

  if (plan.totalInstallments === 1) {
    const transactionResult = buildSingleTransaction(fact, context, plan);
    if (!transactionResult.ok) {
      return failure(transactionResult.error);
    }
    return success([transactionResult.value]);
  }

  if (plan.currentInstallment > 1) {
    const transactionResult = buildSingleTransaction(fact, context, plan);
    if (!transactionResult.ok) {
      return failure(transactionResult.error);
    }
    return success([transactionResult.value]);
  }

  const transactions: ConsolidatedTransaction[] = [];
  for (let index = 1; index <= plan.totalInstallments; index += 1) {
    const indexedPlanResult = createInstallmentPlan(
      plan.groupKey,
      index,
      plan.totalInstallments,
    );
    if (!indexedPlanResult.ok) {
      return failure(indexedPlanResult.error);
    }

    const transactionResult = buildSingleTransaction(
      fact,
      context,
      indexedPlanResult.value,
    );
    if (!transactionResult.ok) {
      return failure(transactionResult.error);
    }

    transactions.push(transactionResult.value);
  }

  return success(transactions);
};
