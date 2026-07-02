import { describe, expect, test } from "bun:test";
import { loadConfig } from "../../src/bootstrap/config.ts";

describe("integration preconditions", () => {
  test("loads env only when explicitly configured", () => {
    const hasMinimumEnv = Boolean(
      process.env.FINANCIALCONTROLDB_SQLSERVER_HOST &&
        process.env.ACCOUNTCONTROLDB_SQLSERVER_HOST &&
        process.env.TARGET_API_BASE_URL &&
        process.env.TARGET_API_TOKEN,
    );

    if (!hasMinimumEnv) {
      expect(hasMinimumEnv).toBe(false);
      return;
    }

    expect(() => loadConfig()).not.toThrow();
  });
});
