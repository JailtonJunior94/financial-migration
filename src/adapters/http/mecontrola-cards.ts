import { z } from "zod";
import type {
  CardBusinessKey,
  CardTargetPort,
} from "../../application/ports/card-target-port.ts";
import { ApplicationError } from "../../domain/common/errors.ts";
import { cardBusinessKeyFromLegacy } from "../../domain/consolidation/card-business-key.ts";
import type {
  PublishableCard,
  RemoteCardMatch,
  RemoteCardRecord,
} from "../../domain/publication/types.ts";
import {
  type GatewayAuthConfig,
  buildGatewayAuthHeaders,
} from "./gateway-auth.ts";

const cardResponseSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  nickname: z.string().min(1),
  bank: z.string().min(1),
  closing_day: z.number().int().min(1).max(31).optional(),
  due_day: z.number().int().min(1).max(31),
  best_purchase_day: z.number().int().min(1).max(31).optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1).optional(),
  deleted_at: z.string().nullable().optional(),
});

const cardListResponseSchema = z.object({
  items: z.array(cardResponseSchema),
  next_cursor: z.string().min(1).optional(),
});

export type MecontrolaCardTargetConfig = {
  readonly baseUrl: string;
  readonly gatewayAuth: GatewayAuthConfig;
};

const MAX_PAGE_SIZE = 100;

export class MecontrolaCardTargetAdapter implements CardTargetPort {
  constructor(private readonly config: MecontrolaCardTargetConfig) {}

  async findByBusinessKey(
    input: CardBusinessKey,
  ): Promise<RemoteCardMatch | undefined> {
    let cursor: string | undefined;

    do {
      const url = new URL("/api/v1/cards", this.config.baseUrl);
      url.searchParams.set("limit", MAX_PAGE_SIZE.toString());
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const response = await this.fetchJson(url, "GET");
      const parsed = cardListResponseSchema.safeParse(response);

      if (!parsed.success) {
        throw new ApplicationError(
          "INTEGRATION_FAILURE",
          "Resposta de listagem de cartões não segue o contrato esperado.",
          { businessKey: input.businessKey, issues: parsed.error.issues },
        );
      }

      for (const item of parsed.data.items) {
        const remoteKey = cardBusinessKeyFromLegacy({
          brand: item.bank,
          name: item.nickname,
        });

        if (remoteKey === input.businessKey) {
          return {
            remoteId: item.id,
            businessKey: input.businessKey,
          };
        }
      }

      cursor = parsed.data.next_cursor;
    } while (cursor);

    return undefined;
  }

  async create(
    input: PublishableCard,
    idempotencyKey: string,
  ): Promise<RemoteCardRecord> {
    const url = new URL("/api/v1/cards", this.config.baseUrl);

    const body = {
      nickname: input.nickname,
      bank: input.bank,
      due_day: input.dueDay,
    };

    const response = await this.fetchJson(url, "POST", body, idempotencyKey, {
      businessKey: input.businessKey,
    });
    const parsed = cardResponseSchema.safeParse(response);

    if (!parsed.success) {
      throw new ApplicationError(
        "INTEGRATION_FAILURE",
        "Resposta de criação de cartão não segue o contrato esperado.",
        { businessKey: input.businessKey, issues: parsed.error.issues },
      );
    }

    return {
      remoteId: parsed.data.id,
      businessKey: input.businessKey,
      createdAt: parsed.data.created_at,
    };
  }

  private async fetchJson(
    url: URL,
    method: "GET" | "POST",
    body?: Record<string, unknown>,
    idempotencyKey?: string,
    context?: { readonly businessKey?: string },
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
        `Falha na requisição de cartões: ${method} ${url.pathname}`,
        {
          url: url.toString(),
          status: response.status,
          ...(context?.businessKey ? { businessKey: context.businessKey } : {}),
        },
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch (error) {
      throw new ApplicationError(
        "INTEGRATION_FAILURE",
        "Resposta da API de cartões não é JSON válido.",
        {
          url: url.toString(),
          cause: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }
}
