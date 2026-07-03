import { createHmac } from "node:crypto";

export type GatewayAuthConfig = {
  readonly userId: string;
  readonly gatewaySecretHex: string;
};

export type GatewayAuthHeaders = {
  readonly "X-User-ID": string;
  readonly "X-Gateway-Timestamp": string;
  readonly "X-Gateway-Auth": string;
};

export const buildGatewayAuthHeaders = (
  config: GatewayAuthConfig,
  now = Date.now(),
): GatewayAuthHeaders => {
  const timestampSeconds = Math.floor(now / 1000).toString();
  const normalizedUserId = config.userId.trim().toLowerCase();
  const payload = `${normalizedUserId}.${timestampSeconds}`;
  const signature = createHmac("sha256", config.gatewaySecretHex)
    .update(payload)
    .digest("hex");

  return {
    "X-User-ID": normalizedUserId,
    "X-Gateway-Timestamp": timestampSeconds,
    "X-Gateway-Auth": signature,
  };
};
