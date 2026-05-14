const e164Pattern = /^\+[1-9]\d{1,14}$/;

export function normalizeE164(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim().replace(/\s+/g, "");
  if (!e164Pattern.test(trimmed)) return null;
  return trimmed;
}

export function isValidE164(value: string | null | undefined): boolean {
  return normalizeE164(value) != null;
}

export function e164ToDigits(value: string): string | null {
  const normalized = normalizeE164(value);
  if (!normalized) return null;
  return normalized.replace(/\D/g, "");
}
