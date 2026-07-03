export const readString = (
  fields: Record<string, unknown>,
  ...candidates: string[]
): string | undefined => {
  for (const key of candidates) {
    const value = fields[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

export const readNumber = (
  fields: Record<string, unknown>,
  ...candidates: string[]
): number | undefined => {
  for (const key of candidates) {
    const value = fields[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

export const readBoolean = (
  fields: Record<string, unknown>,
  ...candidates: string[]
): boolean | undefined => {
  for (const key of candidates) {
    const value = fields[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") {
        return true;
      }
      if (normalized === "false" || normalized === "0") {
        return false;
      }
    }
    if (typeof value === "number") {
      return value === 1;
    }
  }
  return undefined;
};
