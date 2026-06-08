import { describe, expect, it } from "vitest";
import {
  isSupabaseSchemaError,
  toClientErrorMessage,
} from "@/lib/client-error";

describe("client error mapping", () => {
  it("hides PostgREST schema-cache missing-column errors", () => {
    const error = {
      code: "PGRST204",
      details: null,
      hint: null,
      message:
        "Could not find the 'buyers_stamp_duty' column of 'financial_housing_loans' in the schema cache",
    };

    expect(isSupabaseSchemaError(error)).toBe(true);
    expect(toClientErrorMessage(error)).toBe(
      "We couldn't save this right now because the app data model is still updating. Please try again later."
    );
  });

  it("maps database constraint errors to safe user messages", () => {
    expect(toClientErrorMessage({ code: "23505", message: "duplicate key" })).toBe(
      "That name is already in use. Please choose a different name."
    );
    expect(toClientErrorMessage({ code: "23503", message: "foreign key" })).toBe(
      "One of the linked records is no longer available. Refresh and try again."
    );
    expect(toClientErrorMessage({ code: "23514", message: "check failed" })).toBe(
      "Some saved values no longer match the required limits. Review the form and try again."
    );
  });

  it("does not expose arbitrary Error messages by default", () => {
    expect(
      toClientErrorMessage(new Error("insert into private_table failed"))
    ).toBe("Something went wrong while saving. Please try again.");
  });
});
