import createClient from "openapi-fetch";
import type {
  TargetPostPort,
  TargetPostResult,
} from "../../application/ports/target-post-port.ts";
import { DomainError } from "../../domain/common/errors.ts";
import type {
  IdempotencyFingerprint,
  PilotAggregate,
} from "../../domain/sync/types.ts";
import type { paths } from "../../generated/target-api.ts";

type OpenApiTargetServiceConfig = {
  baseUrl: string;
  token: string;
  path: "/records";
  idempotencyHeader: string;
};

export class OpenApiTargetServiceAdapter implements TargetPostPort {
  private readonly client;

  constructor(private readonly config: OpenApiTargetServiceConfig) {
    this.client = createClient<paths>({
      baseUrl: config.baseUrl,
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
    });
  }

  async post(
    aggregate: PilotAggregate,
    fingerprint: IdempotencyFingerprint,
  ): Promise<TargetPostResult> {
    const { data, error, response } = await this.client.POST(this.config.path, {
      headers: {
        [this.config.idempotencyHeader]: fingerprint.hash,
      },
      body: {
        source: aggregate.source,
        entity: aggregate.entity,
        externalId: aggregate.externalId,
        capturedAt: aggregate.capturedAt,
        payload: aggregate.payload,
      },
    });

    if (error || !response.ok || !data) {
      throw new DomainError(
        "INTEGRATION_FAILURE",
        "Failed to post target payload.",
        {
          status: response.status,
          aggregate,
        },
      );
    }

    return {
      remoteId: data.id,
      status: data.status,
    };
  }
}
