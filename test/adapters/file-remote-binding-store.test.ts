import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { FileRemoteBindingStore } from "../../src/adapters/checkpoint/file-remote-binding-store.ts";

const directoryPath = "./tmp/test-remote-bindings";

afterEach(async () => {
  await rm(directoryPath, { recursive: true, force: true });
});

describe("FileRemoteBindingStore", () => {
  test("persiste e carrega binding por referência legada", async () => {
    const store = new FileRemoteBindingStore(directoryPath);
    const binding = {
      legacyRef: {
        database: "FinancialControlDB" as const,
        table: "Card",
        primaryKey: "card-1",
      },
      remoteId: "remote-1",
      businessKey: "nubank",
      boundAt: "2026-01-15T12:00:00.000Z",
    };

    await store.writeCard(binding);
    const loaded = await store.readCard(binding.legacyRef);

    expect(loaded).toBeDefined();
    expect(loaded?.remoteId).toBe("remote-1");
    expect(loaded?.businessKey).toBe("nubank");
    expect(loaded?.legacyRef.primaryKey).toBe("card-1");
  });

  test("retorna undefined para referência inexistente", async () => {
    const store = new FileRemoteBindingStore(directoryPath);

    const loaded = await store.readCard({
      database: "FinancialControlDB",
      table: "Card",
      primaryKey: "missing",
    });

    expect(loaded).toBeUndefined();
  });

  test("sobrescreve binding existente para a mesma referência", async () => {
    const store = new FileRemoteBindingStore(directoryPath);
    const ref = {
      database: "FinancialControlDB" as const,
      table: "Card",
      primaryKey: "card-1",
    };

    await store.writeCard({
      legacyRef: ref,
      remoteId: "remote-old",
      businessKey: "nubank",
      boundAt: "2026-01-01T00:00:00.000Z",
    });

    await store.writeCard({
      legacyRef: ref,
      remoteId: "remote-new",
      businessKey: "nubank",
      boundAt: "2026-01-15T12:00:00.000Z",
    });

    const loaded = await store.readCard(ref);
    expect(loaded?.remoteId).toBe("remote-new");
  });

  test("mantém bindings de referências diferentes no mesmo documento", async () => {
    const store = new FileRemoteBindingStore(directoryPath);

    await store.writeCard({
      legacyRef: {
        database: "FinancialControlDB" as const,
        table: "Card",
        primaryKey: "card-1",
      },
      remoteId: "remote-1",
      businessKey: "nubank",
      boundAt: "2026-01-15T12:00:00.000Z",
    });

    await store.writeCard({
      legacyRef: {
        database: "AccountControlDB" as const,
        table: "Cards",
        primaryKey: "card-2",
      },
      remoteId: "remote-2",
      businessKey: "visa-1234",
      boundAt: "2026-01-15T12:00:00.000Z",
    });

    const first = await store.readCard({
      database: "FinancialControlDB",
      table: "Card",
      primaryKey: "card-1",
    });
    const second = await store.readCard({
      database: "AccountControlDB",
      table: "Cards",
      primaryKey: "card-2",
    });

    expect(first?.remoteId).toBe("remote-1");
    expect(second?.remoteId).toBe("remote-2");
  });

  test("lista todos os bindings persistidos", async () => {
    const store = new FileRemoteBindingStore(directoryPath);

    await store.writeCard({
      legacyRef: {
        database: "FinancialControlDB",
        table: "Card",
        primaryKey: "card-1",
      },
      remoteId: "remote-1",
      businessKey: "nubank",
      boundAt: "2026-01-15T12:00:00.000Z",
    });

    const bindings = await store.list();
    expect(bindings).toHaveLength(1);
    expect(bindings[0]?.remoteId).toBe("remote-1");
  });

  test("remove binding específico", async () => {
    const store = new FileRemoteBindingStore(directoryPath);
    const ref = {
      database: "FinancialControlDB" as const,
      table: "Card",
      primaryKey: "card-1",
    };

    await store.writeCard({
      legacyRef: ref,
      remoteId: "remote-1",
      businessKey: "nubank",
      boundAt: "2026-01-15T12:00:00.000Z",
    });

    await store.reset(ref);
    const loaded = await store.readCard(ref);
    expect(loaded).toBeUndefined();
  });
});
