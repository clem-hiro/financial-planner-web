import { normalizeCategory } from "@/domain/finance";

/** Lightweight emoji icons for category rows (no icon dependency). */
export function budgetCategoryEmoji(categoryRaw: string): string {
  const k = normalizeCategory(categoryRaw);
  if (
    k.includes("saving") ||
    k.includes("invest") ||
    k === "cpf" ||
    k.includes("retirement")
  ) {
    return "\u{1F4B0}";
  }
  if (
    k.includes("shop") ||
    k.includes("subscription") ||
    k.includes("entertain") ||
    k.includes("dining") ||
    k.includes("hobby") ||
    k.includes("travel")
  ) {
    return "\u{2728}";
  }
  if (k.includes("food") || k.includes("grocery") || k.includes("grocer")) {
    return "\u{1F37D}";
  }
  if (k.includes("hous") || k.includes("rent") || k.includes("mortgage")) {
    return "\u{1F3E0}";
  }
  if (k.includes("transport") || k.includes("car") || k.includes("petrol")) {
    return "\u{1F697}";
  }
  if (k.includes("insur")) {
    return "\u{1F6E1}";
  }
  if (k.includes("util") || k.includes("bill") || k.includes("electric")) {
    return "\u{1F4A1}";
  }
  if (k.includes("health") || k.includes("medical")) {
    return "\u{1F3E5}";
  }
  if (k.includes("child") || k.includes("school") || k.includes("education")) {
    return "\u{1F4DA}";
  }
  return "\u{1F4C8}";
}
