import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { buildGatewayAuthHeaders } from "../../src/adapters/http/gateway-auth.ts";

describe("buildGatewayAuthHeaders", () => {
  test("gera headers obrigatórios de gateway", () => {
    const headers = buildGatewayAuthHeaders(
      {
        userId: "06edc407-4f63-42e8-b07c-946b9ef0a19c",
        gatewaySecretHex: "secret",
      },
      1_700_000_000_000,
    );

    expect(headers["X-User-ID"]).toBe("06edc407-4f63-42e8-b07c-946b9ef0a19c");
    expect(headers["X-Gateway-Timestamp"]).toBe("1700000000");
    expect(headers["X-Gateway-Auth"]).toBeDefined();
  });

  test("assinatura é HMAC-SHA256 hex sobre userId.lower + '.' + timestamp", () => {
    const now = 1_700_000_000_000;
    const userId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";
    const secret = "secret";

    const headers = buildGatewayAuthHeaders(
      { userId, gatewaySecretHex: secret },
      now,
    );

    const expected = createHmac("sha256", secret)
      .update(`${userId}.${Math.floor(now / 1000)}`)
      .digest("hex");

    expect(headers["X-Gateway-Auth"]).toBe(expected);
  });

  test("normaliza userId para minúsculas", () => {
    const headers = buildGatewayAuthHeaders(
      {
        userId: "06EDC407-4F63-42E8-B07C-946B9EF0A19C",
        gatewaySecretHex: "secret",
      },
      1_700_000_000_000,
    );

    expect(headers["X-User-ID"]).toBe("06edc407-4f63-42e8-b07c-946b9ef0a19c");
  });
});
