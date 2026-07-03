import type { LegacyFact } from "../../application/ports/legacy-financial-fact-reader-port.ts";
import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";
import { createCanonicalFactKey } from "./canonical-fact-key.ts";
import { deriveCompetence } from "./competence.ts";
import { readBoolean, readNumber, readString } from "./field-helpers.ts";
import { createInstallmentPlan } from "./installment-plan.ts";
import { normalizeAmount } from "./normalize-amount.ts";
import { createOccurrenceDateFromFact } from "./occurrence-date.ts";
import { inferPaymentMethod } from "./payment-method.ts";
import type {
  ConsolidatedTransaction,
  LegacyDatabase,
  LegacySourceRef,
  TransactionKind,
} from "./types.ts";

export type NonCardFactContext = {
  readonly userId: string;
  readonly currency: string;
};

const DETAIL_TABLES = new Set<string>([
  "accounts",
  "bill",
  "billitem",
  "bill_item",
  "transaction",
  "transactionitem",
  "transaction_item",
]);

const resolveKind = (raw: unknown): TransactionKind => {
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (
      normalized === "income" ||
      normalized === "receita" ||
      normalized === "revenue"
    ) {
      return "income";
    }
  }
  return "expense";
};

const isAggregate = (tableName: string): boolean => {
  const normalized = tableName.toLowerCase();
  return normalized === "bill" || normalized === "transaction";
};

const buildSourceSummary = (ref: LegacySourceRef) =>
  ({
    primarySource: ref.database,
    secondarySources: [],
    notes: isAggregate(ref.table)
      ? ["Fato agregado usado como contexto para itens detalhados."]
      : ["Fato detalhado não-cartão."],
  }) satisfies ConsolidatedTransaction["sourceSummary"];

const buildPaymentContext = (
  paymentMethod: ConsolidatedTransaction["paymentMethod"],
):
  | { kind: "credit-card"; cardBusinessKey: string }
  | { kind: "debit-card"; cardBusinessKey: string }
  | { kind: "bank-transfer"; method: "pix" | "ted" | "other" }
  | { kind: "cash" }
  | { kind: "unknown" } => {
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

const deriveFactDateField = (tableName: string): string => {
  const normalized = tableName.toLowerCase();
  if (normalized === "accounts") return "AccountDate";
  if (
    normalized === "bill" ||
    normalized === "billitem" ||
    normalized === "bill_item"
  ) {
    return "BillDate";
  }
  return "TransactionDate";
};

export const shapeNonCardFact = (
  fact: LegacyFact,
  context: NonCardFactContext,
): Result<ConsolidatedTransaction, DomainError> => {
  const ref = fact.ref;
  const fields = fact.fields;
  const tableName = ref.table;

  if (
    ref.database !== "AccountControlDB" &&
    ref.database !== "FinancialControlDB"
  ) {
    return failure(
      new DomainError(
        "INVALID_SOURCE_RECORD",
        "Fato não-cartão deve pertencer a AccountControlDB ou FinancialControlDB.",
        { ref },
      ),
    );
  }

  const description =
    readString(
      fields,
      "description",
      "Description",
      "name",
      "Name",
      "title",
      "Title",
    ) ?? `${tableName} ${ref.primaryKey}`;

  const amountResult = normalizeAmount(
    readNumber(
      fields,
      "amount",
      "Amount",
      "value",
      "Value",
      "total",
      "Total",
      "price",
      "Price",
    ),
    context.currency,
  );
  if (!amountResult.ok) {
    return failure(amountResult.error);
  }

  const factDateField = deriveFactDateField(tableName);
  const factDate = readString(
    fields,
    "date",
    "Date",
    "transactionDate",
    "TransactionDate",
    "accountDate",
    "AccountDate",
    "billDate",
    "BillDate",
    "dueDate",
    "DueDate",
  );
  const createdAt = readString(fields, "createdAt", "CreatedAt", "created_at");
  const occurrenceResult = createOccurrenceDateFromFact(
    factDate,
    factDateField,
    createdAt,
  );
  if (!occurrenceResult.ok) {
    return failure(occurrenceResult.error);
  }

  const competenceResult = deriveCompetence(occurrenceResult.value.value);
  if (!competenceResult.ok) {
    return failure(competenceResult.error);
  }

  const paymentMethod = inferPaymentMethod({
    sourceTable: tableName,
    description,
    hasCardBinding: false,
    pixEvidence: readBoolean(fields, "isPix", "is_pix", "pix") ?? false,
    tedEvidence: readBoolean(fields, "isTed", "is_ted", "ted") ?? false,
    cashEvidence: readBoolean(fields, "isCash", "is_cash", "cash") ?? false,
  });

  const paymentContext = buildPaymentContext(paymentMethod);
  const planResult = createInstallmentPlan(
    `${ref.database}.${ref.table}.${ref.primaryKey}`,
    1,
    1,
  );
  if (!planResult.ok) {
    return failure(planResult.error);
  }

  const factKeyResult = createCanonicalFactKey(
    "transaction",
    context.userId,
    occurrenceResult.value.value,
    description,
    amountResult.value,
    paymentContext,
    { kind: "single" },
  );
  if (!factKeyResult.ok) {
    return failure(factKeyResult.error);
  }

  return success({
    factKey: factKeyResult.value,
    kind: resolveKind(fields.kind ?? fields.Type ?? fields.type),
    occurredOn: occurrenceResult.value,
    competence: competenceResult.value,
    description,
    amount: amountResult.value,
    paymentMethod,
    installmentPlan: planResult.value,
    legacyRefs: [ref],
    sourceSummary: buildSourceSummary(ref),
  });
};
