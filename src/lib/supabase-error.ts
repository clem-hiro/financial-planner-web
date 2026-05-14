type SupabaseLikeError = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

function asRecord(error: unknown): SupabaseLikeError {
  return error && typeof error === "object" ? (error as SupabaseLikeError) : {};
}

export function formatSupabaseError(
  error: unknown,
  fallback = "Supabase request failed."
): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const record = asRecord(error);
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const code = typeof record.code === "string" ? record.code.trim() : "";

  if (message && code) return `${message} (${code})`;
  if (message) return message;
  if (code) return `Supabase returned error code ${code}.`;
  return fallback;
}

export function isMissingSupabaseObjectError(error: unknown): boolean {
  const record = asRecord(error);
  const code = typeof record.code === "string" ? record.code : "";
  const message =
    typeof record.message === "string" ? record.message.toLowerCase() : "";

  return (
    code === "42P01" ||
    code === "42883" ||
    message.includes("could not find the function") ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("schema cache")
  );
}
