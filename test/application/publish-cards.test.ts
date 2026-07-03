import { describe, expect, test } from "bun:test";
import type {
  CardBusinessKey,
  CardTargetPort,
} from "../../src/application/ports/card-target-port.ts";
import type { ClockPort } from "../../src/application/ports/clock-port.ts";
import type { LoggerPort } from "../../src/application/ports/logger-port.ts";
import type { RemoteBindingStorePort } from "../../src/application/ports/remote-binding-store-port.ts";
import { PublishCardsUseCase } from "../../src/application/use-cases/publish-cards.ts";
import type {
  ConsolidatedCard,
  LegacySourceRef,
} from "../../src/domain/consolidation/types.ts";
import type {
  PublishableCard,
  RemoteCardBinding,
  RemoteCardMatch,
  RemoteCardRecord,
} from "../../src/domain/publication/types.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

const makeLogger = (): LoggerPort => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

const fixedClock: ClockPort = {
  nowIso: () => "2026-01-15T12:00:00.000Z",
};

class InMemoryCardTarget implements CardTargetPort {
  readonly created: {
    readonly input: PublishableCard;
    readonly idempotencyKey: string;
  }[] = [];

  constructor(private readonly existing: RemoteCardMatch[] = []) {}

  async findByBusinessKey(
    input: CardBusinessKey,
  ): Promise<RemoteCardMatch | undefined> {
    return this.existing.find(
      (match) => match.businessKey === input.businessKey,
    );
  }

  async create(
    input: PublishableCard,
    idempotencyKey: string,
  ): Promise<RemoteCardRecord> {
    this.created.push({ input, idempotencyKey });
    return {
      remoteId: `remote-${input.businessKey}`,
      businessKey: input.businessKey,
      createdAt: fixedClock.nowIso(),
    };
  }
}

class InMemoryBindingStore implements RemoteBindingStorePort {
  private readonly bindings = new Map<string, RemoteCardBinding>();

  async readCard(ref: LegacySourceRef): Promise<RemoteCardBinding | undefined> {
    return this.bindings.get(`${ref.database}:${ref.table}:${ref.primaryKey}`);
  }

  async writeCard(binding: RemoteCardBinding): Promise<void> {
    this.bindings.set(
      `${binding.legacyRef.database}:${binding.legacyRef.table}:${binding.legacyRef.primaryKey}`,
      binding,
    );
  }
}

const makeCard = (overrides?: Partial<ConsolidatedCard>): ConsolidatedCard => ({
  businessKey: "nubank",
  nickname: "Nu Pessoal",
  bank: "Nubank",
  dueDay: 10,
  closingDay: 3,
  legacyRefs: [
    {
      database: "FinancialControlDB",
      table: "Card",
      primaryKey: "card-1",
    },
  ],
  ownerEvidence: [],
  reconciliationStatus: "reconciled",
  ...overrides,
});

describe("PublishCardsUseCase", () => {
  test("cria cartão remoto quando não existe no destino", async () => {
    const cardTarget = new InMemoryCardTarget();
    const bindingStore = new InMemoryBindingStore();
    const useCase = new PublishCardsUseCase({
      cardTarget,
      bindingStore,
      clock: fixedClock,
      logger: makeLogger(),
    });

    const card = makeCard();
    const result = await useCase.execute({
      userId: targetUserId,
      cards: [card],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.published).toHaveLength(1);
    expect(result.value.skipped).toHaveLength(0);
    expect(result.value.issues).toHaveLength(0);

    const binding = result.value.published[0];
    expect(binding?.remoteId).toBe("remote-nubank");
    expect(binding?.businessKey).toBe("nubank");
    expect(binding?.legacyRef.primaryKey).toBe("card-1");

    expect(cardTarget.created).toHaveLength(1);
    expect(cardTarget.created[0]?.input.nickname).toBe("Nu Pessoal");
    expect(cardTarget.created[0]?.input.bank).toBe("Nubank");
    expect(cardTarget.created[0]?.input.dueDay).toBe(10);
    expect(cardTarget.created[0]?.input.closingDay).toBe(3);
  });

  test("pula cartão quando binding local já existe", async () => {
    const cardTarget = new InMemoryCardTarget();
    const bindingStore = new InMemoryBindingStore();
    const card = makeCard();

    await bindingStore.writeCard({
      legacyRef: card.legacyRefs[0] as LegacySourceRef,
      remoteId: "existing-remote-id",
      businessKey: card.businessKey,
      boundAt: fixedClock.nowIso(),
    });

    const useCase = new PublishCardsUseCase({
      cardTarget,
      bindingStore,
      clock: fixedClock,
      logger: makeLogger(),
    });

    const result = await useCase.execute({
      userId: targetUserId,
      cards: [card],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.published).toHaveLength(0);
    expect(result.value.skipped).toHaveLength(1);
    expect(result.value.issues).toHaveLength(0);
    expect(cardTarget.created).toHaveLength(0);

    const skipped = result.value.skipped[0];
    expect(skipped?.remoteId).toBe("existing-remote-id");
  });

  test("pula cartão quando cartão remoto já existe", async () => {
    const cardTarget = new InMemoryCardTarget([
      { remoteId: "remote-nubank", businessKey: "nubank" },
    ]);
    const bindingStore = new InMemoryBindingStore();
    const useCase = new PublishCardsUseCase({
      cardTarget,
      bindingStore,
      clock: fixedClock,
      logger: makeLogger(),
    });

    const card = makeCard();
    const result = await useCase.execute({
      userId: targetUserId,
      cards: [card],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.published).toHaveLength(0);
    expect(result.value.skipped).toHaveLength(1);
    expect(result.value.issues).toHaveLength(0);
    expect(cardTarget.created).toHaveLength(0);

    const skipped = result.value.skipped[0];
    expect(skipped?.remoteId).toBe("remote-nubank");
    expect(skipped?.businessKey).toBe("nubank");
  });

  test("persiste binding para múltiplas referências legadas do mesmo cartão", async () => {
    const cardTarget = new InMemoryCardTarget();
    const bindingStore = new InMemoryBindingStore();
    const useCase = new PublishCardsUseCase({
      cardTarget,
      bindingStore,
      clock: fixedClock,
      logger: makeLogger(),
    });

    const card = makeCard({
      legacyRefs: [
        {
          database: "FinancialControlDB",
          table: "Card",
          primaryKey: "fc-card-1",
        },
        {
          database: "AccountControlDB",
          table: "Cards",
          primaryKey: "ac-card-1",
        },
      ],
    });

    const result = await useCase.execute({
      userId: targetUserId,
      cards: [card],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.published).toHaveLength(2);
    expect(result.value.published[0]?.remoteId).toBe("remote-nubank");
    expect(result.value.published[1]?.remoteId).toBe("remote-nubank");

    const firstRef = card.legacyRefs[0] as LegacySourceRef;
    const storedFirst = await bindingStore.readCard(firstRef);
    expect(storedFirst?.remoteId).toBe("remote-nubank");

    const secondRef = card.legacyRefs[1] as LegacySourceRef;
    const storedSecond = await bindingStore.readCard(secondRef);
    expect(storedSecond?.remoteId).toBe("remote-nubank");
  });

  test("emite issue e continua quando cartão não tem campos obrigatórios", async () => {
    const cardTarget = new InMemoryCardTarget();
    const bindingStore = new InMemoryBindingStore();
    const useCase = new PublishCardsUseCase({
      cardTarget,
      bindingStore,
      clock: fixedClock,
      logger: makeLogger(),
    });

    const invalidCard = makeCard({
      businessKey: "invalid",
      nickname: "",
      bank: "",
      dueDay: 0,
    });
    const validCard = makeCard({ businessKey: "valid" });

    const result = await useCase.execute({
      userId: targetUserId,
      cards: [invalidCard, validCard],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.published).toHaveLength(1);
    expect(result.value.issues).toHaveLength(1);

    const issue = result.value.issues[0];
    expect(issue?.kind).toBe("semantic-mismatch");
    expect(issue?.severity).toBe("blocking");
  });

  test("retorna erro quando criação remota falha", async () => {
    const failingCardTarget: CardTargetPort = {
      findByBusinessKey: async () => undefined,
      create: async () => {
        throw new Error("connection refused");
      },
    };
    const bindingStore = new InMemoryBindingStore();
    const useCase = new PublishCardsUseCase({
      cardTarget: failingCardTarget,
      bindingStore,
      clock: fixedClock,
      logger: makeLogger(),
    });

    const result = await useCase.execute({
      userId: targetUserId,
      cards: [makeCard()],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTEGRATION_FAILURE");
    }
  });
});
