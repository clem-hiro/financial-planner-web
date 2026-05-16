/**
 * Maps raw Supabase/trigger signup error messages to user-facing copy. Kept
 * pure (no React/Supabase imports) so it is unit-testable under the node test
 * env and reusable outside the form.
 */
export function formatSignupError(message: string): string {
  // handle_new_user RAISEs 'qr_token_invalid' for an expired/consumed/invalid
  // QR token. This project's Supabase surfaces raw trigger RAISE text to the
  // client (same mechanism the "Invalid, already used" branch below relies on);
  // match the substring whether bare or Supabase-wrapped.
  if (message.includes("qr_token_invalid")) {
    return "This invite link has expired or was already used — ask your advisor for a new QR code.";
  }
  if (message.includes("Invalid, already used")) return message;
  if (message.includes("expired access key")) return message;
  if (message.includes("Client signup requires")) return message;
  if (/database error/i.test(message)) {
    return "Could not complete signup. If you are a client, confirm your access key with your advisor and try again.";
  }
  return message;
}
