import type { SupabaseClient } from "@supabase/supabase-js";
import { advisorCanReadClient } from "@/data/repositories/advisor-clients";

/**
 * Consent-first denial message. Regex-loose by contract: callers' tests assert
 * `/has not granted consent/i`, so the substring "has not granted consent" must
 * survive any rewording.
 */
export const CONSENT_DENIED_MESSAGE =
  "This client has not granted consent. Suggestions are unavailable until they do.";

export const CONSENT_STATUSES = ["granted", "withdrawn"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

/**
 * Canonical advisor-view consent copy — the RENDERED string (with the real
 * resolved adviser name) is recorded verbatim per consent event, so a prior
 * grant stays attributable to the exact text the client accepted.
 *
 * `CONSENT_TEXT` is the user-approved PDPA Option-B disclosure. `{adviserName}`
 * is the ONLY interpolation and is ALWAYS server-resolved from the client's
 * own advisor linkage (never client/form input) via `renderConsentText`.
 *
 * ⚠ Pending user confirmation before #9 prod apply (see prod-apply runbook
 * G1a/G1b): `CONSENT_VERSION` and `CONSENT_SUPPORTING_LINE` are PROPOSED
 * values — do not treat as finalized until the user confirms.
 *
 * All four are server-only — never client-supplied (the writer ignores any
 * client-sent version/purpose/text).
 */
export const CONSENT_VERSION = "2026-05-18.option-b";
export const CONSENT_PURPOSE = "advisor_view";
export const CONSENT_TEXT =
  "I consent to BYOFA disclosing my in-app financial planning data to my " +
  "linked licensed financial adviser, {adviserName}, for the purpose of " +
  "providing financial advisory services to me, including communication via " +
  "WhatsApp. I understand I may withdraw this consent at any time.";

/** Non-legal helper shown beneath the consent text (PROPOSED — see G1b). */
export const CONSENT_SUPPORTING_LINE =
  "Manage or withdraw this anytime in More → Privacy & Advisor Access.";

/**
 * Render the canonical consent copy with the server-resolved adviser name.
 * `adviserName` must be the value resolved from the client's own linkage
 * (e.g. `get_my_advisor_contact`), never anything client-supplied.
 */
export function renderConsentText(adviserName: string): string {
  return CONSENT_TEXT.replaceAll("{adviserName}", adviserName);
}

export type ConsentAssertion = { ok: true } | { ok: false; error: string };

/**
 * Consent-first trust boundary, shared by every advisor proposal author path.
 * The caller MUST resolve the advisor from the session before calling this;
 * `clientId` is the subject whose latest-event-wins active consent gates
 * authoring. Fail-closed: `advisorCanReadClient` throws on RPC error and that
 * propagates (deny), identical to the prior inline blocks.
 */
export async function assertConsent(
  supabase: SupabaseClient,
  clientId: string
): Promise<ConsentAssertion> {
  const consentOk = await advisorCanReadClient(supabase, clientId);
  if (!consentOk) return { ok: false, error: CONSENT_DENIED_MESSAGE };
  return { ok: true };
}
