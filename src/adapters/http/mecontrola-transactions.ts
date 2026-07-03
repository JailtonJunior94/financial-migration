import { z } from "zod";
import type {
  TransactionBusinessKey,
  TransactionTargetPort,
} from "../../application/ports/transaction-target-port.ts";
import { ApplicationError } from "../../domain/common/errors.ts";
import type { PaymentContext } from "../../domain/consolidation/canonical-fact-key.ts";
import { canonicalFactKeyHash } from "../../domain/consolidation/canonical-fact-key.ts";
import { normalizeMoneyAmount } from "../../domain/consolidation/money-amount.ts";
import {
  type CanonicalTransactionPayload,
  buildCanonicalPayload,
  transactionPayloadsAreEqual,
} from "../../domain/publication/payload-canonical.ts";
import { buildTransactionIdempotencyKey } from "../../domain/publication/transaction-idempotency.ts";
import type {
  PublishableTransaction,
  RemoteTransactionMatch,
  RemoteTransactionRecord,
} from "../../domain/publication/types.ts";
import {
  type GatewayAuthConfig,
  buildGatewayAuthHeaders,
} from "./gateway-auth.ts";
import { withRetry } from "./retry.ts";

const paymentContextResponseSchema = z.union([
  z.object({
    kind: z.literal("credit-card"),
    card_business_key: z.string().min(1).optional(),
    cardBusinessKey: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal("debit-card"),
    card_business_key: z.string().min(1).optional(),
    cardBusinessKey: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal("bank-transfer"),
    method: z.enum(["pix", "ted", "other"]),
  }),
  z.object({ kind: z.literal("cash") }),
  z.object({ kind: z.literal("unknown") }),
]);

const installmentPlanResponseSchema = z.object({
  group_key: z.string().min(1).optional(),
  groupKey: z.string().min(1).optional(),
  current_installment: z.number().int().positive().optional(),
  currentInstallment: z.number().int().positive().optional(),
  total_installments: z.number().int().positive().optional(),
  totalInstallments: z.number().int().positive().optional(),
});

const transactionResponseSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1).optional(),
  kind: z.enum(["expense", "income"]),
  occurred_on: z.string().min(1).optional(),
  occurredOn: z.string().min(1).optional(),
  competence: z.string().min(1),
  description: z.string().min(1),
  amount_minor_units: z.string().min(1).optional(),
  amountMinorUnits: z.string().min(1).optional(),
  scale: z.number().int().min(0).max(18).optional(),
  currency: z.string().min(3).max(3),
  category_id: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  subcategory_id: z.string().min(1).optional(),
  subcategoryId: z.string().min(1).optional(),
  payment_context: paymentContextResponseSchema.optional(),
  paymentContext: paymentContextResponseSchema.optional(),
  installment_plan: installmentPlanResponseSchema.optional(),
  installmentPlan: installmentPlanResponseSchema.optional(),
  external_id: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  created_at: z.string().min(1),
});

const transactionListResponseSchema = z.object({
  items: z.array(transactionResponseSchema),
  next_cursor: z.string().min(1).optional(),
  nextCursor: z.string().min(1).optional(),
});

export type MecontrolaTransactionTargetConfig = {
  readonly baseUrl: string;
  readonly gatewayAuth: GatewayAuthConfig;
};

const MAX_PAGE_SIZE = 100;

const resolveSnake = <T>(
  snake: T | undefined,
  camel: T | undefined,
): T | undefined => snake ?? camel;

export class MecontrolaTransactionTargetAdapter
  implements TransactionTargetPort
{
  constructor(private readonly config: MecontrolaTransactionTargetConfig) {}

  async findByBusinessKey(
    input: TransactionBusinessKey,
  ): Promise<RemoteTransactionMatch | undefined> {
    return withRetry(async () => this.findByBusinessKeyOnce(input), {
      maxAttempts: 3,
    });
  }

  private async findByBusinessKeyOnce(
    input: TransactionBusinessKey,
  ): Promise<RemoteTransactionMatch | undefined> {
    let cursor: string | undefined;

    do {
      const url = new URL("/api/v1/transactions", this.config.baseUrl);
      url.searchParams.set("limit", MAX_PAGE_SIZE.toString());
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const response = await this.fetchJson(url, "GET");
      const parsed = transactionListResponseSchema.safeParse(response);

      if (!parsed.success) {
        throw new ApplicationError(
          "INTEGRATION_FAILURE",
          "Resposta de listagem de transações não segue o contrato esperado.",
          { factKeyHash: input.factKeyHash, issues: parsed.error.issues },
        );
      }

      for (const item of parsed.data.items) {
        const matchesByExternalId =
          resolveSnake(item.external_id, item.externalId) === input.factKeyHash;

        if (matchesByExternalId) {
          return {
            remoteId: item.id,
            factKeyHash: input.factKeyHash,
            equivalent: true,
          };
        }
      }

      cursor = resolveSnake(parsed.data.next_cursor, parsed.data.nextCursor);
    } while (cursor);

    return undefined;
  }

  async create(
    input: PublishableTransaction,
    idempotencyKey: string,
  ): Promise<RemoteTransactionRecord> {
    return withRetry(async () => this.createOnce(input, idempotencyKey), {
      maxAttempts: 3,
    });
  }

  private async createOnce(
    input: PublishableTransaction,
    idempotencyKey: string,
  ): Promise<RemoteTransactionRecord> {
    const url = new URL("/api/v1/transactions", this.config.baseUrl);
    const factKeyHash = canonicalFactKeyHash(input.factKey);

    const body = {
      kind: input.kind,
      occurred_on: input.occurredOn,
      competence: input.competence,
      description: input.description,
      amount_minor_units: input.amount.minorUnits.toString(),
      scale: input.amount.scale,
      currency: input.amount.currency,
      category_id: input.categoryId,
      ...(input.subcategoryId ? { subcategory_id: input.subcategoryId } : {}),
      payment_context: input.paymentContext,
      installment_plan: input.installmentPlan,
      external_id: factKeyHash,
    };

    const response = await this.fetchJson(url, "POST", body, idempotencyKey, {
      factKeyHash,
    });
    const parsed = transactionResponseSchema.safeParse(response);

    if (!parsed.success) {
      throw new ApplicationError(
        "INTEGRATION_FAILURE",
        "Resposta de criação de transação não segue o contrato esperado.",
        { factKeyHash, issues: parsed.error.issues },
      );
    }

    return {
      remoteId: parsed.data.id,
      factKeyHash,
      createdAt: parsed.data.created_at,
    };
  }

  private async fetchJson(
    url: URL,
    method: "GET" | "POST",
    body?: Record<string, unknown>,
    idempotencyKey?: string,
    context?: { readonly factKeyHash?: string },
  ): Promise<unknown> {
    const headers = buildGatewayAuthHeaders(this.config.gatewayAuth);
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (idempotencyKey) {
      requestHeaders["Idempotency-Key"] = idempotencyKey;
    }

    const response = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      throw new ApplicationError(
        "INTEGRATION_FAILURE",
        `Falha na requisição de transações: ${method} ${url.pathname}`,
        {
          url: url.toString(),
          status: response.status,
          ...(context?.factKeyHash ? { factKeyHash: context.factKeyHash } : {}),
        },
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch (error) {
      throw new ApplicationError(
        "INTEGRATION_FAILURE",
        "Resposta da API de transações não é JSON válido.",
        {
          url: url.toString(),
          cause: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  private remoteItemToCanonicalPayload(
    item: z.infer<typeof transactionResponseSchema>,
  ): CanonicalTransactionPayload | undefined {
    const amountMinorUnitsRaw = resolveSnake(
      item.amount_minor_units,
      item.amountMinorUnits,
    );
    const scale = item.scale ?? 2;
    const categoryId = resolveSnake(item.category_id, item.categoryId);
    const subcategoryId = resolveSnake(item.subcategory_id, item.subcategoryId);
    const occurredOn = resolveSnake(item.occurred_on, item.occurredOn);
    const paymentContextRaw = resolveSnake(
      item.payment_context,
      item.paymentContext,
    );
    const installmentPlanRaw = resolveSnake(
      item.installment_plan,
      item.installmentPlan,
    );

    if (
      !amountMinorUnitsRaw ||
      !categoryId ||
      !occurredOn ||
      !paymentContextRaw ||
      !installmentPlanRaw
    ) {
      return undefined;
    }

    try {
      const paymentContext = this.parsePaymentContext(paymentContextRaw);
      if (!paymentContext) {
        return undefined;
      }

      const normalizedAmount = normalizeMoneyAmount(
        {
          minorUnits: BigInt(amountMinorUnitsRaw),
          scale,
          currency: item.currency,
        },
        scale,
      );

      if (!normalizedAmount.ok) {
        return undefined;
      }

      const payloadInput: Parameters<typeof buildCanonicalPayload>[0] = {
        kind: item.kind,
        occurredOn,
        competence: item.competence,
        description: item.description,
        amount: normalizedAmount.value,
        categoryId,
        paymentContext,
        installmentPlan: {
          groupKey:
            resolveSnake(
              installmentPlanRaw.group_key,
              installmentPlanRaw.groupKey,
            ) ?? item.id,
          currentInstallment:
            resolveSnake(
              installmentPlanRaw.current_installment,
              installmentPlanRaw.currentInstallment,
            ) ?? 1,
          totalInstallments:
            resolveSnake(
              installmentPlanRaw.total_installments,
              installmentPlanRaw.totalInstallments,
            ) ?? 1,
        },
      };

      if (subcategoryId !== undefined) {
        return buildCanonicalPayload({ ...payloadInput, subcategoryId });
      }

      return buildCanonicalPayload(payloadInput);
    } catch {
      return undefined;
    }
  }

  private parsePaymentContext(
    raw: z.infer<typeof paymentContextResponseSchema>,
  ): PaymentContext | undefined {
    switch (raw.kind) {
      case "credit-card":
      case "debit-card": {
        const key = resolveSnake(raw.card_business_key, raw.cardBusinessKey);
        if (!key) {
          return undefined;
        }
        return { kind: raw.kind, cardBusinessKey: key };
      }
      case "bank-transfer":
        return { kind: raw.kind, method: raw.method };
      case "cash":
        return { kind: "cash" };
      case "unknown":
        return { kind: "unknown" };
    }
  }
}

export const buildTransactionIdempotencyKeyForPublish = (
  userId: string,
  factKeyHash: string,
): string => buildTransactionIdempotencyKey(userId, factKeyHash);
