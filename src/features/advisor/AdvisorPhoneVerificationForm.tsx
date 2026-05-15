"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/data/supabase/browser";
import { PhoneInputField } from "@/features/auth/PhoneInputField";
import { normalizeE164 } from "@/lib/phone-format";
import { PageSection } from "@/ui/PageSection";

export function AdvisorPhoneVerificationForm({ user }: { user: User }) {
  const router = useRouter();
  const [phone, setPhone] = useState(user.phone ? `+${user.phone}` : "");
  const [sentToPhone, setSentToPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const verified =
    user.phone_confirmed_at != null &&
    (sentToPhone == null || user.phone === sentToPhone.replace(/^\+/, ""));

  async function sendCode() {
    if (pending) return;
    setError(null);
    setInfo(null);
    const normalized = normalizeE164(phone);
    if (!normalized) {
      setError("Enter a valid phone number with country code.");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        phone: normalized,
      });
      if (updateErr) {
        setError(
          `Could not send verification code. Check that Supabase Auth Phone is enabled with an SMS provider. Supabase returned: ${updateErr.message}`
        );
        return;
      }

      setPhone(normalized);
      setSentToPhone(normalized);
      setInfo("Verification code sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send verification code.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setInfo(null);
    if (sentToPhone == null) {
      setError("Send a verification code first.");
      return;
    }
    if (!otp.trim()) {
      setError("Enter the verification code.");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        phone: sentToPhone,
        token: otp.trim(),
        type: "phone_change",
      });
      if (verifyErr) {
        setError(verifyErr.message);
        return;
      }

      // router.refresh() re-runs the parent server component, which re-reads
      // auth.getUser() and feeds a fresh `user` prop in with phone_confirmed_at set.
      setOtp("");
      setInfo("Phone number verified.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify phone number.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageSection
      id="advisor-phone"
      title="Advisor contact"
      description="Verified WhatsApp contact is exposed to linked clients through the app only."
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
          <p className="font-medium text-slate-900">
            Status:{" "}
            <span className={verified ? "text-emerald-800" : "text-amber-800"}>
              {verified ? "Verified" : "Verification required"}
            </span>
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950" role="status">
            {info}
          </p>
        ) : null}

        <form
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-1.5 block">Phone number</span>
            <PhoneInputField
              value={phone}
              onChange={(next) => {
                setPhone(next);
                setSentToPhone(null);
              }}
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[#0c192f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-[#152a45] disabled:opacity-60"
          >
            Send code
          </button>
        </form>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end">
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-1.5 block">Verification code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>
          <button
            type="button"
            onClick={verifyCode}
            disabled={pending}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-900 disabled:opacity-60"
          >
            Verify
          </button>
        </div>
      </div>
    </PageSection>
  );
}
