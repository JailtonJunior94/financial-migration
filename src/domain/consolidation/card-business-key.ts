const sanitize = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : undefined;
};

export const buildCardBusinessKey = (params: {
  readonly lastFourDigits?: string;
  readonly brand?: string;
  readonly holderName?: string;
}): string => {
  const lastFour = sanitize(params.lastFourDigits);
  const brand = sanitize(params.brand);
  const holder = sanitize(params.holderName);

  const parts: string[] = [];

  if (brand) {
    parts.push(brand);
  }

  if (lastFour) {
    parts.push(lastFour);
  }

  if (parts.length === 0 && holder) {
    parts.push(holder);
  }

  if (parts.length === 0) {
    return "card-unknown";
  }

  return parts.join("-");
};

export const cardBusinessKeyFromLegacy = (
  fields: Record<string, unknown>,
): string => {
  const lastFourDigits =
    sanitize(fields.lastFourDigits) ??
    sanitize(fields.last_four_digits) ??
    sanitize(fields.cardLastFour) ??
    sanitize(fields.cardNumber)?.slice(-4);

  const brand =
    sanitize(fields.brand) ??
    sanitize(fields.cardBrand) ??
    sanitize(fields.bandeira) ??
    sanitize(fields.cardType);

  const holderName =
    sanitize(fields.holderName) ??
    sanitize(fields.holder_name) ??
    sanitize(fields.cardHolder) ??
    sanitize(fields.name);

  const params: {
    lastFourDigits?: string;
    brand?: string;
    holderName?: string;
  } = {};
  if (lastFourDigits) params.lastFourDigits = lastFourDigits;
  if (brand) params.brand = brand;
  if (holderName) params.holderName = holderName;

  return buildCardBusinessKey(params);
};
