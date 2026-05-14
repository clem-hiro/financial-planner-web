import { e164ToDigits } from "@/lib/phone-format";

export function buildWhatsAppChatUrl(
  phoneE164: string,
  message?: string | null
): string | null {
  const digits = e164ToDigits(phoneE164);
  if (!digits) return null;
  const url = new URL(`https://wa.me/${digits}`);
  const text = String(message ?? "").trim();
  if (text) url.searchParams.set("text", text);
  return url.toString();
}
