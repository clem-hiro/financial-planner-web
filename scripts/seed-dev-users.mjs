#!/usr/bin/env node
// Dev-only: seed two auth users + access keys for end-to-end testing.
// Run via `npm run seed:dev` (loads .env.local via Node's --env-file flag).
// Idempotent: safe to re-run; existing users / keys are reused.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local. App code never imports this.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[seed-dev-users] Missing env. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local. See .env.local.example.",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEV_ADVISOR = {
  email: "_dev@dev.com",
  password: "dev123",
  phone: "+6596340104",
  display_name: "Dev Advisor",
  profile_type: "advisor",
};

const DEV_CLIENT = {
  email: "_dev_client@dev.com",
  password: "dev123",
  display_name: "dev_client",
  profile_type: "client",
};

// Mirror prod `fulfill_access_key_purchase` (gen_random_bytes(16) → 32 hex):
// the strict clientAccessKeyInputSchema only accepts uppercase hex, so a
// `DEV-` prefix would make seeded keys unusable for client signup.
function genKey() {
  return randomBytes(16).toString("hex").toUpperCase();
}

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureAdvisor() {
  const existing = await findUserByEmail(DEV_ADVISOR.email);
  if (existing) {
    // Sync phone if it drifted from the script's source of truth.
    const wantPhone = DEV_ADVISOR.phone.replace(/^\+/, "");
    const havePhone = (existing.phone ?? "").replace(/^\+/, "");
    if (havePhone !== wantPhone) {
      const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(
        existing.id,
        { phone: DEV_ADVISOR.phone, phone_confirm: true },
      );
      if (updErr) throw new Error(`updateUserById advisor phone: ${updErr.message}`);
      return { user: updated.user, created: false, phone_synced: true };
    }
    return { user: existing, created: false, phone_synced: false };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: DEV_ADVISOR.email,
    password: DEV_ADVISOR.password,
    email_confirm: true,
    phone: DEV_ADVISOR.phone,
    phone_confirm: true,
    user_metadata: {
      display_name: DEV_ADVISOR.display_name,
      profile_type: DEV_ADVISOR.profile_type,
    },
  });
  if (error) throw new Error(`createUser advisor: ${error.message}`);
  if (!data.user) throw new Error("createUser advisor: no user returned");
  return { user: data.user, created: true, phone_synced: false };
}

async function insertAvailableKey(advisorUserId) {
  const accessKey = genKey();
  const { data, error } = await admin
    .from("advisor_access_keys")
    .insert({
      advisor_user_id: advisorUserId,
      access_key: accessKey,
      status: "available",
    })
    .select("access_key")
    .single();
  if (error) throw new Error(`insert access key: ${error.message}`);
  return data.access_key;
}

async function ensureClient(advisorUserId) {
  const existing = await findUserByEmail(DEV_CLIENT.email);
  if (existing) return { user: existing, created: false };
  // Client signup REQUIRES an access_key (handle_new_user trigger raises otherwise).
  // Insert one, then pass it through user_metadata so the trigger consumes it
  // and wires this client to the dev advisor.
  const consumeKey = await insertAvailableKey(advisorUserId);
  const { data, error } = await admin.auth.admin.createUser({
    email: DEV_CLIENT.email,
    password: DEV_CLIENT.password,
    email_confirm: true,
    user_metadata: {
      display_name: DEV_CLIENT.display_name,
      profile_type: DEV_CLIENT.profile_type,
      access_key: consumeKey,
    },
  });
  if (error) {
    // Roll back the orphaned key so the next run starts clean.
    const { error: rbErr } = await admin
      .from("advisor_access_keys")
      .delete()
      .eq("access_key", consumeKey);
    if (rbErr) {
      console.error(
        `[seed-dev-users] orphan key NOT cleaned: ${consumeKey} (rollback err: ${rbErr.message}). ` +
          "Delete manually before re-running.",
      );
    }
    throw new Error(`createUser client: ${error.message}`);
  }
  if (!data.user) throw new Error("createUser client: no user returned");
  return { user: data.user, created: true, consumed_key: consumeKey };
}

async function ensureFreshAvailableKey(advisorUserId) {
  const { data: existing, error: selErr } = await admin
    .from("advisor_access_keys")
    .select("access_key")
    .eq("advisor_user_id", advisorUserId)
    .eq("status", "available")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selErr) throw new Error(`select available key: ${selErr.message}`);
  if (existing?.access_key) return { access_key: existing.access_key, created: false };
  const accessKey = await insertAvailableKey(advisorUserId);
  return { access_key: accessKey, created: true };
}

try {
  const advisor = await ensureAdvisor();
  const client = await ensureClient(advisor.user.id);
  const freshKey = await ensureFreshAvailableKey(advisor.user.id);

  const advisorTag = advisor.created
    ? "[created]"
    : advisor.phone_synced
      ? "[existing — phone synced]"
      : "[existing — reused]";
  const clientTag = client.created ? "[created + redeemed key]" : "[existing — reused]";
  const freshTag = freshKey.created ? "[created]" : "[existing — reused]";

  console.log("");
  console.log(`Dev advisor: ${advisor.user.id} (${DEV_ADVISOR.email})  ${advisorTag}`);
  console.log(`Dev client:  ${client.user.id} (${DEV_CLIENT.email})  ${clientTag}`);
  if (client.consumed_key) {
    console.log(`              consumed key during signup: ${client.consumed_key}`);
  }
  console.log(`Fresh key:   ${freshKey.access_key}   ${freshTag}  ← use for manual signup tests via /login`);
  console.log(`Coupon code: DEVPOC-UNLI  (100% off; from migration 20260521000000)`);
  console.log("");
} catch (err) {
  console.error(`[seed-dev-users] ${err.message}`);
  process.exit(1);
}
