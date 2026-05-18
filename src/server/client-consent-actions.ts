"use server";

import { revalidatePath } from "next/cache";
import { revalidateSetupAndPlanning } from "@/lib/planning-revalidate";
import { getProfileById } from "@/data/repositories/profiles";
import { markAsReadByDedupeKey } from "@/data/repositories/inbox-notifications";
import { getMyAdvisorContact } from "@/data/repositories/coupons";
import {
  getMyConsentStatusForAdvisor,
  type AdvisorClientConsentStatus,
} from "@/data/repositories/advisor-clients";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isClient } from "@/lib/profile-role";
import {
  CONSENT_PURPOSE,
  CONSENT_STATUSES,
  CONSENT_SUPPORTING_LINE,
  CONSENT_VERSION,
  renderConsentText,
  type ConsentStatus,
} from "@/server/advisor-consent";

/**
 * Server-resolve the adviser display name from the caller's OWN linkage
 * (`get_my_advisor_contact` RPC — never client/form input). Fail-soft: any
 * RPC error yields null so callers decide (a grant must name the adviser; a
 * withdrawal must never be blocked).
 */
async function resolveAdviserName(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<string | null> {
  try {
    const contact = await getMyAdvisorContact(supabase);
    return contact.advisor_name;
  } catch {
    return null;
  }
}

function isConsentStatus(v: string): v is ConsentStatus {
  return (CONSENT_STATUSES as readonly string[]).includes(v);
}

/**
 * Client-only, append-only consent event writer (P0-H1 — the C1 write
 * producer). Trust boundary:
 *  - the writer is the CLIENT, resolved from the session (auth.getUser);
 *    `client_user_id` is the session uid, NEVER form input;
 *  - `advisor_user_id` is read from the client's own profile linkage, NEVER
 *    client-supplied — a forged advisor id cannot bind consent elsewhere;
 *  - `status` is validated to exactly granted|withdrawn;
 *  - `consent_version`/`purpose`/`consent_text` are server constants;
 *  - `created_at` + `seq` are DB-assigned (default now() / identity) and are
 *    intentionally NOT in the insert payload — the C1 monotonic-ordering
 *    invariant (a client-supplied seq/created_at would reintroduce the
 *    nondeterministic tie-break);
 *  - INSERT only. The ledger has no UPDATE/DELETE policy — "withdraw" is a
 *    new 'withdrawn' row; latest-event-wins by (created_at desc, seq desc).
 */
export async function recordAdvisorConsentAction(
  _prev: { error: string | null; status?: ConsentStatus },
  formData: FormData
): Promise<{ error: string | null; status?: ConsentStatus }> {
  const statusRaw = String(formData.get("status") ?? "").trim();
  if (!isConsentStatus(statusRaw)) return { error: "Invalid consent action" };
  const status: ConsentStatus = statusRaw;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const me = await getProfileById(supabase, user.id);
  if (!isClient(me)) return { error: "Not allowed" };

  const advisorUserId = me?.advisor_user_id;
  if (!advisorUserId) {
    return { error: "No linked advisor to record consent for" };
  }

  // G1c: record the RENDERED disclosure (real adviser name) — exactly what the
  // client agreed to. A grant MUST name the adviser (legal attributability;
  // the grant UI already showed the named text). A withdrawal must NEVER be
  // blocked by a name-resolution hiccup (safety: the client must always be
  // able to revoke), so it falls back to a neutral phrase.
  const adviserName = await resolveAdviserName(supabase);
  if (status === "granted" && !adviserName) {
    return {
      error: "Advisor details are unavailable; cannot record consent right now.",
    };
  }
  const consentText = renderConsentText(
    adviserName ?? "your linked financial adviser"
  );

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("advisor_client_consents").insert({
    client_user_id: user.id, // session uid — never form input
    advisor_user_id: advisorUserId, // profile linkage — never form input
    status,
    consent_version: CONSENT_VERSION,
    purpose: CONSENT_PURPOSE,
    consent_text: consentText,
    granted_at: status === "granted" ? nowIso : null,
    withdrawn_at: status === "withdrawn" ? nowIso : null,
    // created_at + seq omitted on purpose — DB-assigned (C1 invariant).
  });
  if (error) {
    console.error(error);
    return { error: "Could not record consent. Please try again." };
  }

  // Clear the re-consent inbox prompt on grant (best-effort; missing key is a
  // no-op). The prompt's creation is a separate surface.
  if (status === "granted") {
    try {
      await markAsReadByDedupeKey(
        supabase,
        user.id,
        `advisor_consent_request:${advisorUserId}`
      );
    } catch (e) {
      console.error(e);
    }
  }

  // Advisor read access flips on their next read — revalidate the gated
  // surfaces (the advisor's view of this client + the client's own).
  revalidatePath("/advisor/clients");
  revalidatePath(`/advisor/client/${user.id}`);
  revalidatePath("/dashboard");
  revalidateSetupAndPlanning();
  return { error: null, status };
}

export type AdvisorConsentGate = {
  status: AdvisorClientConsentStatus;
  /** RENDERED disclosure (real adviser name); null if not resolvable. */
  consentText: string | null;
  supportingLine: string;
};

/**
 * Read-only consent-gate probe for the contact-advisor entry point. Resolves
 * everything server-side from the caller's session (status from the client's
 * own ledger, adviser name from the client's own linkage) — never form input.
 * Does NOT write; granting still goes through `recordAdvisorConsentAction`.
 */
export async function getAdvisorConsentGateAction(): Promise<AdvisorConsentGate> {
  const idle: AdvisorConsentGate = {
    status: "none",
    consentText: null,
    supportingLine: CONSENT_SUPPORTING_LINE,
  };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return idle;

  const me = await getProfileById(supabase, user.id);
  if (!isClient(me)) return idle;

  const advisorUserId = me?.advisor_user_id;
  if (!advisorUserId) return idle;

  const status = await getMyConsentStatusForAdvisor(
    supabase,
    user.id,
    advisorUserId
  );
  // Already consented: the dialog won't render, so skip the name RPC.
  if (status === "active") {
    return {
      status,
      consentText: null,
      supportingLine: CONSENT_SUPPORTING_LINE,
    };
  }
  const adviserName = await resolveAdviserName(supabase);
  return {
    status,
    consentText: adviserName ? renderConsentText(adviserName) : null,
    supportingLine: CONSENT_SUPPORTING_LINE,
  };
}
