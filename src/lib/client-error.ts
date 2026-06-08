type ErrorLike = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

const GENERIC_SAVE_ERROR = "Something went wrong while saving. Please try again.";
const SCHEMA_UPDATE_ERROR =
  "We couldn't save this right now because the app data model is still updating. Please try again later.";

function asErrorLike(error: unknown): ErrorLike {
  return error && typeof error === "object" ? (error as ErrorLike) : {};
}

function errorCode(error: unknown): string {
  const code = asErrorLike(error).code;
  return typeof code === "string" ? code.trim() : "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  const message = asErrorLike(error).message;
  return typeof message === "string" ? message.trim() : "";
}

function lowerErrorText(error: unknown): string {
  const record = asErrorLike(error);
  return [record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

export function isSupabaseSchemaError(error: unknown): boolean {
  const code = errorCode(error);
  const text = lowerErrorText(error);
  return (
    code === "PGRST204" ||
    code === "42P01" ||
    code === "42703" ||
    code === "42883" ||
    text.includes("schema cache") ||
    text.includes("could not find the function") ||
    (text.includes("relation") && text.includes("does not exist")) ||
    (text.includes("column") && text.includes("does not exist"))
  );
}

function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === "23505";
}

function isForeignKeyViolation(error: unknown): boolean {
  return errorCode(error) === "23503";
}

function isCheckViolation(error: unknown): boolean {
  return errorCode(error) === "23514";
}

function isSafeDomainError(error: unknown): boolean {
  const message = errorMessage(error);
  if (!message) return false;
  return (
    message === "Category is required" ||
    message === "calendar_year is required for annual budget lines" ||
    message === "Proposal is no longer open for review" ||
    message.startsWith("Advanced investment planning requires newer database columns.")
  );
}

export function toClientErrorMessage(
  error: unknown,
  fallback = GENERIC_SAVE_ERROR
): string {
  if (isSupabaseSchemaError(error)) return SCHEMA_UPDATE_ERROR;
  if (isUniqueViolation(error)) {
    return "That name is already in use. Please choose a different name.";
  }
  if (isForeignKeyViolation(error)) {
    return "One of the linked records is no longer available. Refresh and try again.";
  }
  if (isCheckViolation(error)) {
    return "Some saved values no longer match the required limits. Review the form and try again.";
  }
  if (isSafeDomainError(error)) return errorMessage(error);
  return fallback;
}
