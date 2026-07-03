import type { LegacyFact } from "../../application/ports/legacy-financial-fact-reader-port.ts";
import { readNumber, readString } from "./field-helpers.ts";
import { createReviewableIssue } from "./reviewable-issue.ts";
import type { ReviewableIssue } from "./types.ts";

const isInvoiceHeader = (tableName: string): boolean => {
  const normalized = tableName.toLowerCase();
  return normalized === "invoice" || normalized === "invoices";
};

const isInvoiceItem = (tableName: string): boolean => {
  const normalized = tableName.toLowerCase();
  return normalized === "invoiceitem" || normalized === "invoice_item";
};

const resolveInvoiceId = (
  fields: Record<string, unknown>,
): string | undefined =>
  readString(
    fields,
    "invoiceId",
    "InvoiceId",
    "invoice_id",
    "Invoice_Id",
    "invoiceID",
    "parentId",
    "ParentId",
    "parent_id",
    "Parent_Id",
  );

const resolveTotalAmount = (
  fields: Record<string, unknown>,
): number | undefined =>
  readNumber(
    fields,
    "total",
    "Total",
    "amount",
    "Amount",
    "value",
    "Value",
    "totalAmount",
    "TotalAmount",
  );

const amountToMinorUnits = (value: number): bigint =>
  BigInt(Math.round(value * 100));

export type InvoiceTotalValidationResult = {
  readonly issues: readonly ReviewableIssue[];
};

export const validateInvoiceTotals = (
  facts: readonly LegacyFact[],
): InvoiceTotalValidationResult => {
  const headers = facts.filter((fact) => isInvoiceHeader(fact.ref.table));
  const items = facts.filter((fact) => isInvoiceItem(fact.ref.table));

  if (headers.length === 0 || items.length === 0) {
    return { issues: [] };
  }

  const itemsByInvoiceId = new Map<string, typeof items>();
  for (const item of items) {
    const invoiceId = resolveInvoiceId(item.fields);
    if (!invoiceId) {
      continue;
    }
    const list = itemsByInvoiceId.get(invoiceId) ?? [];
    list.push(item);
    itemsByInvoiceId.set(invoiceId, list);
  }

  const issues: ReviewableIssue[] = [];

  for (const header of headers) {
    const headerTotal = resolveTotalAmount(header.fields);
    if (headerTotal === undefined) {
      continue;
    }

    const headerId = header.ref.primaryKey;
    const relatedItems = itemsByInvoiceId.get(headerId) ?? [];
    if (relatedItems.length === 0) {
      continue;
    }

    let itemsTotal = 0;
    for (const item of relatedItems) {
      const itemAmount = resolveTotalAmount(item.fields);
      if (itemAmount === undefined) {
        itemsTotal = Number.NaN;
        break;
      }
      itemsTotal += itemAmount;
    }

    if (Number.isNaN(itemsTotal)) {
      continue;
    }

    const headerMinor = amountToMinorUnits(headerTotal);
    const itemsMinor = amountToMinorUnits(itemsTotal);
    if (headerMinor === itemsMinor) {
      continue;
    }

    issues.push(
      createReviewableIssue({
        kind: "reconciliation-conflict",
        severity: "blocking" as const,
        reason:
          "Divergência material entre total da fatura e soma dos itens; revisão manual necessária.",
        legacyRefs: [header.ref, ...relatedItems.map((item) => item.ref)],
        evidence: {
          invoiceId: headerId,
          headerTotal,
          itemsTotal,
          itemCount: relatedItems.length,
        },
      }),
    );
  }

  return { issues };
};
