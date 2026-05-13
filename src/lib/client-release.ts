/**
 * Client web app **UI / IA generation** label (not the same as `package.json` semver unless you choose to align them).
 * Override at build time, e.g. `NEXT_PUBLIC_CLIENT_UI_VERSION=2.1` in `.env` or CI.
 */
export const CLIENT_UI_VERSION =
  typeof process.env.NEXT_PUBLIC_CLIENT_UI_VERSION === "string" &&
  process.env.NEXT_PUBLIC_CLIENT_UI_VERSION.trim() !== ""
    ? process.env.NEXT_PUBLIC_CLIENT_UI_VERSION.trim()
    : "2";

/** Short string for footers and the More page. */
export const CLIENT_UI_VERSION_LABEL = `Client UI v${CLIENT_UI_VERSION}`;
