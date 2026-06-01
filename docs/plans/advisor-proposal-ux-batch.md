# Advisor↔Client proposal flow — UX refinement batch

## Problem Statement

Five UX refinements on the existing (functionally-working) advisor↔client proposal flow. UI + one server-action-state change only. **No migrations, no schema, no RLS, no new dependency.**

1. Compose is only reachable from the Overview projection row; the **Proposals** sub-tab has no "Compose proposal" affordance.
2. On the advisor **Compose** view, the **Submit proposal** form (message + button) lives in the right-hand rail. It should be a **frozen action bar at the bottom of the left pane** (always visible, does not scroll away).
3. The client has no at-a-glance signal that an advisor proposal awaits action — the setup **Advisor proposals** tab label and the overview card need a circled **(N)** count badge.
4. On `/setup/advisor-proposals/[id]`, the **Accept changes** bottom bar is `sticky bottom-0`, which lifts off the viewport at page bottom ("moves when scrolling to the bottom"). It should be truly **frozen/fixed**.
5. Accepting is a one-click immediate apply. The client should get a **confirmation dialog** first, then on success a **"Proposal Approved. Head to 'Setup' tab to view?"** dialog with **Go to page** / **Stay on page**.

## Success Criteria

- Proposals sub-tab shows a "Compose proposal" button → `?view=compose` (full anchor nav, WebKit-safe).
- Compose: Submit form (message + button + status) is a frozen bottom bar of the left column, visible without scrolling; queued-suggestions summary stays in the right rail.
- Client setup: a circled count badge appears on the **Advisor proposals** tab label and the overview card whenever ≥1 proposal is **pending**; clears when none pending.
- `/setup/advisor-proposals/[id]` accept bar stays pinned to the viewport bottom at all scroll positions, including the very bottom; no content occluded.
- Accept → confirm dialog → on success, approval dialog with working **Go to page** (`/setup?tab=profile`) and **Stay on page** (closes, refreshes status). Applies on both client review surfaces (`/review/proposal/[id]` and `/setup/advisor-proposals/[id]`) since both share `ProposalReviewActions`.

## Proposed Solution / Key Changes

### Item 1 — Compose button on Proposals tab
- `src/features/advisor/AdvisorProposalsTable.tsx`: add a header row with a right-aligned "Compose proposal" button — plain `<a href={"/advisor/client/${clientId}?view=compose"}>` (NOT `<Link>`/`router.push` — the nav comment in `AdvisorClientDetailNav.tsx:18-24` documents WebKit soft-nav flakiness for same-pathname `?view=` changes). `clientId` is already a prop. Reuse the Overview button styling (`AdvisorClientOverview.tsx:54`).

### Item 2 — Frozen Submit bar on Compose left pane
- `src/features/advisor/AdvisorProposalDraftPanel.tsx`: split into two exports — `DraftSummaryPanel` (the queued-suggestions list + session-assist note, stays in the rail) and `SubmitProposalBar` (the `<form>` at lines 165-207: heading, `advisor_note` textarea, status, Submit button).
- `src/features/advisor/AdvisorClientCompose.tsx`: keep `DraftSummaryPanel` in the right `CollapsiblePaneRail`; render `SubmitProposalBar` as a **frozen action bar at the bottom of the left column** — `sticky bottom-0 z-20` with solid bg + top border + backdrop blur (mirror `OnboardingWizard.tsx:775` / the item-4 client bar pattern), and add `pb-*` to the left column so the last section isn't occluded. Render only when `draftProposalId` is set (unchanged condition). Verify in WebKit it stays put at the very bottom (the failure mode item 4 fixes).

### Item 3 — Pending-count badge (client)
- `src/data/repositories/advisor-proposals.ts`: add `countPendingProposalsForClient(supabase, clientId): Promise<number>` (head `count` on `advisor_proposals` where `client_user_id = clientId AND status = 'pending'`). Read-side RLS already scopes client reads.
- `src/app/(app)/setup/page.tsx`: fetch the count on every load (cheap, runs regardless of `activeTab`); pass to `SetupTabsNav` and the overview "Advisor proposals" `<Link>` card (lines 497-507).
- `src/features/setup/SetupTabsNav.tsx`: accept an optional `badges?: Record<string, number>` (or a single `advisorProposalsBadge?: number`); render a circled count pill beside the matching tab label when > 0.
- Overview card: render the same circled pill beside the "Advisor proposals" eyebrow when > 0.

### Item 4 — Freeze the client accept bar
- `src/features/proposals/ClientProposalReviewView.tsx:119-125`: replace `sticky bottom-0` with a **fixed/frozen** bottom bar (mirror `OnboardingWizard.tsx:775`: `fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 backdrop-blur`), inner `mx-auto max-w-3xl`. Add bottom padding to the page content (the outer `space-y-8` wrapper or `ProposalReviewView`'s `pb-16`) so the fixed bar never occludes the last content. Only while `isPending`.

### Item 5 — Confirm + approval dialogs on accept
- New `src/ui/ConfirmDialog.tsx` (or `Modal.tsx`): minimal accessible dialog — `createPortal` + backdrop + `role="dialog" aria-modal="true"` + ESC-to-close + focus trap-lite. **Reuse the existing portal/escape pattern from `src/features/help/MethodologySheet.tsx`** (no new dependency).
- `src/server/advisor-proposal-actions.ts`: extend `AcceptProposalState` with `ok?: boolean`; set `ok: true` on a successful accept (keep existing `revalidatePath` calls). Conflict/error paths leave `ok` falsy.
- `src/features/proposals/ProposalReviewView.tsx` (`ProposalReviewActions`): 
  - Accept button becomes `type="button"` that opens a **confirm dialog** ("Apply these changes to your plan? Your plan updates immediately." → Confirm / Cancel). Confirm submits the existing `acceptAction` (keep the `lockRef` guard + `BlockingSubmitOverlay`).
  - When `acceptState.ok` flips true → open the **approval dialog**: title "Proposal Approved", body "Head to \"Setup\" tab to view?", buttons **Go to page** (`useRouter().push("/setup?tab=profile")`) and **Stay on page** (close dialog + `router.refresh()` so the accepted status renders). Reject path unchanged.
  - Shared component ⇒ both client surfaces inherit the flow.

## Public Interfaces / Contracts
- **No migrations / schema / RLS / API route changes.**
- Server action: `AcceptProposalState` gains optional `ok?: boolean` (additive; existing `{error, conflicts?}` callers unaffected).
- New repo fn `countPendingProposalsForClient`. New UI primitive `ConfirmDialog`. `SetupTabsNav` gains an optional badge prop. `AdvisorProposalDraftPanel` splits its exports.

## Test Plan
- `npx tsc --noEmit`, `npx eslint` (touched), `npx vitest run` full suite.
- Update `src/features/proposals/ProposalReviewActions.test.tsx`: accept now routes through the confirm dialog (assert dialog opens, Confirm triggers the action, `ok` opens the approval dialog, Go-to-page navigates). Reject path unchanged.
- Unit: `countPendingProposalsForClient` (0 / 1 / many). Badge renders only when > 0.
- Manual smoke (WebKit, per item 2/4 caveat): Proposals-tab compose button navigates; Submit bar frozen at left-pane bottom; tab/card badge shows (1) after advisor submit, clears after accept/reject; client accept bar pinned at page bottom; confirm→approval dialog flow + both buttons.

## Assumptions (stated — redirect if wrong)
- **Badge = count of `pending` proposals** (advisor submitted, client hasn't accepted/rejected). This is the "something to click" signal; it clears on accept/reject. (Alternative — unseen-via-inbox-notification — not chosen; pending-count matches the stated trigger "when the advisor submits".)
- **Item 2 moves only the Submit form** to the frozen left-pane bar; the queued-suggestions summary stays in the right rail.
- Confirmation-dialog copy is ours to write (success-dialog copy is verbatim from the request).
- "Frozen/absolute" (items 2 & 4) = `fixed`/`sticky` action bar pinned to the viewport bottom, matching the existing onboarding-wizard bar pattern.

## Out of Scope
- The advisor-side proposal detail view (accept/reject is client-only).
- Any change to the master/category consent flow or the accept writer logic.
- Phase 2 cash-account work (separate, uncommitted on this branch; its smoke is still pending).

## Rollout / Rollback
No migrations or schema changes in this batch. Rollback = revert the commit. Layers additively on the uncommitted Phase 2 tree on branch `sandbox`; overlaps only `AdvisorClientCompose.tsx` (item 2) and `advisor-proposal-actions.ts` (item 5) with existing dirty work — same branch, no external conflict.
