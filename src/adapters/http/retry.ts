import { ApplicationError } from "../../domain/common/errors.ts";

export type RetryConfig = {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly shouldRetry?: (error: unknown) => boolean;
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5000,
};

const isRetryableNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("econnrefused") ||
      message.includes("connection refused") ||
      message.includes("timeout") ||
      message.includes("etimedout") ||
      message.includes("econnreset") ||
      message.includes("networkerror") ||
      message.includes("fetch failed")
    ) {
      return true;
    }
  }

  return false;
};

const isRetryableHttpStatus = (error: unknown): boolean => {
  if (
    error instanceof ApplicationError &&
    error.details &&
    typeof error.details.status === "number"
  ) {
    return error.details.status >= 500 && error.details.status < 600;
  }

  return false;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async <T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> => {
  const { maxAttempts, baseDelayMs, maxDelayMs, shouldRetry } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  const isRetryable =
    shouldRetry ??
    ((error: unknown): boolean =>
      isRetryableNetworkError(error) || isRetryableHttpStatus(error));

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      if (!isRetryable(error)) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
};
