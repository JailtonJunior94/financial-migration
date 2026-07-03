import { describe, expect, test } from "bun:test";
import {
  buildCardBusinessKey,
  cardBusinessKeyFromLegacy,
} from "../../../src/domain/consolidation/card-business-key.ts";

describe("buildCardBusinessKey", () => {
  test("monta chave com brand e lastFourDigits", () => {
    const key = buildCardBusinessKey({
      brand: "visa",
      lastFourDigits: "1234",
      holderName: "Jailton Junior",
    });

    expect(key).toBe("visa-1234");
  });

  test("usa holderName quando não há brand nem lastFourDigits", () => {
    const key = buildCardBusinessKey({ holderName: "Jailton Junior" });

    expect(key).toBe("jailton junior");
  });

  test("retorna fallback quando nenhum campo está disponível", () => {
    const key = buildCardBusinessKey({});

    expect(key).toBe("card-unknown");
  });

  test("ignora campos vazios", () => {
    const key = buildCardBusinessKey({
      brand: "   ",
      lastFourDigits: "5678",
    });

    expect(key).toBe("5678");
  });
});

describe("cardBusinessKeyFromLegacy", () => {
  test("extrai últimos quatro dígitos do número do cartão", () => {
    const key = cardBusinessKeyFromLegacy({
      cardNumber: "1234567890123456",
      brand: "mastercard",
    });

    expect(key).toBe("mastercard-3456");
  });

  test("usa lastFourDigits quando disponível", () => {
    const key = cardBusinessKeyFromLegacy({
      lastFourDigits: "9999",
      cardBrand: "visa",
    });

    expect(key).toBe("visa-9999");
  });

  test("normaliza nome do portador como fallback", () => {
    const key = cardBusinessKeyFromLegacy({ name: "Jailton Júnior" });

    expect(key).toBe("jailton junior");
  });
});
