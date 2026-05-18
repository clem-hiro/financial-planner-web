// Drift guard (O2): `supabase/tests/scratch_verify_phase2.sql` embeds the FULL
// `20260529000000_advisor_consent_phase2.sql` verbatim so the user can
// paste-and-run one script. If a future amendment edits the canonical
// migration but not the embedded copy, the scratch gate would validate STALE
// DDL and report a false `ship_gate = OK`. This asserts the canonical
// migration appears byte-identical and contiguous inside the scratch script
// (the assembly is a literal `cat`, so a verbatim-substring check is exact —
// no marker parsing to drift). Fails loudly with the re-sync recipe.

import { readFileSync } from "node:fs";

const MIG = "supabase/migrations/20260529000000_advisor_consent_phase2.sql";
const SCRATCH = "supabase/tests/scratch_verify_phase2.sql";

const mig = readFileSync(MIG, "utf8");
const scratch = readFileSync(SCRATCH, "utf8");

if (scratch.includes(mig)) {
  console.log(`OK: ${MIG} is embedded byte-identical in ${SCRATCH}`);
  process.exit(0);
}

// Drift: find how far the canonical migration matches starting at its first
// line inside the scratch script, to point at the first divergent line.
const firstLine = mig.slice(0, mig.indexOf("\n"));
const start = scratch.indexOf(firstLine);
let hint = "embedded migration block not found at all (markers/section moved?)";
if (start !== -1) {
  const tail = scratch.slice(start);
  let i = 0;
  while (i < mig.length && i < tail.length && mig[i] === tail[i]) i++;
  const line = mig.slice(0, i).split("\n").length;
  hint = `first divergence at ~migration line ${line}: ${JSON.stringify(
    mig.split("\n")[line - 1] ?? ""
  )}`;
}

console.error(
  `DRIFT: ${MIG} is NOT embedded verbatim in ${SCRATCH}.\n` +
    `  ${hint}\n` +
    `  Re-sync: replace the block between the "(b) BEGIN embedded" framing and\n` +
    `  the "-- END embedded 20260529000000." line in ${SCRATCH} with the current\n` +
    `  ${MIG} contents (it is a literal copy — keep it byte-identical), then\n` +
    `  re-run: npm run check:scratch-verify`
);
process.exit(1);
