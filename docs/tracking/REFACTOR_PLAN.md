# Compliance + Transparency Refactor Plan

> Updated: 2026-02-28  
> Scope: Employer-grade compliance, transparency, consent, and data controls for Lock-in extension + backend/API/docs

## Decision

This refactor is the right direction for this repo and aligns with current architecture:

1. `extension` already owns Chrome glue and popup UX, so policy UI + consent + permission hardening belong there.
2. `api` + `backend` already own authenticated cloud data operations, so export/delete-account integration belongs there.
3. `core` can remain platform-agnostic by keeping policy/Chrome behavior out of domain logic.

## Current Repo Alignment (Verified)

- MV3 is already in place (`extension/manifest.json`).
- Popup is the settings surface (`popup.html` + `popup.js`), no separate options page.
- Storage is split across `chrome.storage.sync` and `chrome.storage.local`, plus `localStorage` in some UI hooks.
- Sentry scrubber exists (`extension/src/sentry/privacy.ts`) and already redacts transcript/note/prompt/chat-like keys.
- Permissions currently declared: `activeTab`, `scripting`, `storage`, `contextMenus`, `tabs`, `webNavigation`.
- Important storage-key inconsistency exists now and must be handled during centralization:
  - `lockin_selectedNoteId`
  - `lockin_sidebar_selectedNoteId`

## Non-Negotiables For Every Phase

1. Respect AGENTS layer boundaries (`extension` glue only, no backend internals in popup/content scripts).
2. Keep behavior-compatible slices and small, reviewable commits.
3. Add/adjust tests with each behavioral change.
4. At end of each phase: make sure `npm run validate` passes.

## Phase Order

### Phase 0: Discovery (Blocker, Required Before Implementation)

Create `docs/DISCOVERY.md` with:

1. Folder map:
   - `extension/`, `ui/extension/`, `backend/`, `api/`, `core/`, `integrations/`
2. Storage keys map:
   - Include key, storage area (`sync`/`local`/`localStorage`), owning module, purpose
   - Include known keys:
     - `lockin_sidebar_*`
     - `lockin_telemetry_disabled`
     - `lockin_session_*`
     - `lockin_transcript_show_timestamps`
     - `lockin_tasks_viewMode`
     - `lockinCurrentChatId`
     - `lockin_selectedNoteId`
     - `lockin_sidebar_selectedNoteId`
     - `lockin_sidebar_width`
     - `lockin_offline_notes_queue`
3. Permissions map:
   - permission -> concrete files/features requiring it
4. Existing state summary:
   - MV3, popup-as-settings, storage model, Supabase auth backend, Sentry scrubber coverage

Exit criteria:

- `docs/DISCOVERY.md` exists and is complete enough to drive implementation.
- Risks/deviations are explicitly called out in the doc.
- Make sure `npm run validate` passes.

### Phase 1: Link Constants + Host Detection Foundations

Implement config foundations first:

1. Add `extension/src/config/externalLinks.ts` with exact URLs provided.
2. Add `extension/src/config/hostRules.ts`:
   - `MONASH_MOODLE_HOSTS = ["learning.monash.edu", "lms.monash.edu", "moodle.monash.edu.au", "cpw-lms.monash.edu"]`
   - Host matcher supports exact host and constrained Monash suffix handling.
   - Active-tab URL is checked only when popup opens (no history capture).
3. Add policy URL config (for Terms/Privacy targets) with GitHub blob fallback when hosted URLs are unset.

Exit criteria:

- Constants are imported (not duplicated as literals).
- Host checks are centralized and unit-tested.
- Make sure `npm run validate` passes.

### Phase 2: Popup Compliance Surfaces (About, Responsible Use, Monash Banner, Signup Consent)

Add popup-first UX changes:

1. About section:
   - Version from `chrome.runtime.getManifest().version` (remove hardcoded `v1.0.0`).
   - Exact statements:
     - "Not affiliated with or endorsed by Monash University."
     - "Built independently by Matthew (Software Engineering student) as a learning project."
   - Add Privacy, Terms, Repo links.
2. Responsible Use accordion:
   - Unit AI rules from Chief Examiner
   - Learning support only, not assessment submission
   - Acknowledge AI use when required
   - Link buttons from `externalLinks.ts`
3. Monash Moodle contextual banner:
   - On popup mount query active tab, evaluate host rules, show dismissible reminder
   - Persist dismissal in `chrome.storage.local` (`dismissed.monashNotice` or equivalent documented key)
4. Signup consent checkbox:
   - Required checkbox for Terms + Privacy before enabling "Create account"

Exit criteria:

- Popup remains functional for login/help/privacy toggles.
- Signup cannot submit without consent checkbox in signup mode.
- Monash banner appears only on matching hosts and respects dismissal.
- Make sure `npm run validate` passes.

### Phase 3: Sidebar First-Use Consent Gate (Blocking)

Implement one-time consent gating in sidebar:

1. On first sidebar use, show blocking modal:
   - Title: "Welcome to Lock-in"
   - Include Terms/Privacy links and learning-only statement
2. Storage key:
   - `lockin_acceptedTermsAt` in `chrome.storage.local` (ISO string or null)
3. Behavior:
   - `I Accept`: set timestamp and unlock app
   - `Decline`: block study/chat/notes interactions and close or keep blocked state
   - Reopen sidebar => modal shown again until accepted
4. Legacy logged-in users:
   - Treat as consented if valid session already exists (backward compatibility)

Exit criteria:

- Sidebar interaction is blocked until accepted for first-use users.
- Decline flow is repeatable and does not corrupt state.
- Legacy signed-in users are not forced through a broken loop.
- Make sure `npm run validate` passes.

### Phase 4: Policy + Security Documentation Pack

Create and wire policy documentation:

1. Create:
   - `PRIVACY.md`
   - `TERMS.md`
   - `SECURITY.md`
   - `docs/data-handling.md`
   - `docs/permissions.md`
   - `docs/retention.md`
2. Add required AI provider disclosure in Privacy/data-handling docs:
   - What is sent
   - What is not sent
3. Add exact academic integrity statements to `TERMS.md` and root `README.md`:
   - "Lock-in does not provide answers intended to be submitted as assessment."
   - "Lock-in supports comprehension, summarisation, self-testing, and study planning."
4. Ensure popup/settings link to Terms/Privacy docs.

Exit criteria:

- All new docs are linked and discoverable from `docs/README.md`.
- Popup links resolve correctly in development and production packaging.
- Make sure `npm run validate` passes.

### Phase 5: Data Export + Clear Local Data + Delete Account Path

Implement user data controls with minimal architecture churn:

1. Centralize client storage key ownership:
   - Single source for keys + compatibility aliases for legacy key names.
2. Add app repository interface for local export/clear paths when direct storage calls are fragmented.
3. Export JSON button:
   - Schema:
     - `schemaVersion: 1`
     - `exportedAt`
     - `appVersion`
     - `data` object (local + cloud slices)
   - Cloud data fetched via authenticated API for notes/tasks/chats
   - Filename: `lockin-export-YYYYMMDD-HHMM.json`
4. Clear local data:
   - Confirm dialog and explicit scope text
   - Local browser data only (cloud unchanged)
5. Delete account:
   - If backend endpoint exists/addable safely, implement `DELETE /api/users/me` + popup action.
   - If not available in this phase, hide action and present explicit fallback message.

Exit criteria:

- Export contains valid schema and includes both cloud and local sections where available.
- Clear local data works without deleting cloud records.
- Delete-account behavior is explicit (working endpoint or clearly hidden with rationale).
- Make sure `npm run validate` passes.

### Phase 6: Permissions Audit + Logging Safety Hardening

Harden privacy and least-privilege posture:

1. Permissions:
   - Audit each manifest permission and host permission against actual callsites.
   - Remove only proven-unused permissions.
   - If a permission remains, document exact reason in `docs/permissions.md`.
2. Logging safety:
   - Add/extend logger utilities to redact transcript chunks, chat prompts, and sensitive URLs/query params.
   - Replace risky raw logging paths in transcript/media flows and popup/content error logs.
   - Ensure error logs keep code/context, not payload bodies.
3. Sentry:
   - Verify `beforeSendScrubber` coverage and no bypass paths.
4. Clean up misleading examples that normalize unsafe logging patterns.

Exit criteria:

- No transcript/chat content appears in routine logs.
- Manifest permissions match documented usage.
- Make sure `npm run validate` passes.

### Phase 7: README + Release Readiness

Finalize release-facing docs and checks:

1. Update `README.md`:
   - Non-affiliation
   - Learning-support-only messaging
   - Academic integrity statements
   - Privacy/Terms links
   - Responsible use section
2. Add `docs/release-checklist.md` with manual checks:
   - Monash Moodle banner behavior
   - First-use consent blocking behavior
   - Export JSON
   - Clear local data
   - Permissions/doc parity
   - `npm run validate`
3. Add CI badge reference after pipeline is confirmed stable.

Exit criteria:

- README and release checklist match shipped behavior.
- CI badge reference points to active workflow.
- Make sure `npm run validate` passes.

## Risks and Guardrails

1. Storage-key drift risk:
   - Mitigate with compatibility mapping during key centralization.
2. Consent-flow regressions risk:
   - Mitigate with targeted unit tests + manual first-run smoke tests.
3. Permissions false-positive removals risk:
   - Mitigate by proving callsite absence before removal.
4. Delete-account backend complexity risk:
   - Treat as conditional slice with explicit fallback if endpoint cannot be safely shipped in-phase.

## Definition of Done (Program-Level)

1. All phases completed with `npm run validate` passing at each phase boundary.
2. Compliance UI and docs are present, linked, and consistent.
3. Consent is enforced for first-use users and handled safely for existing users.
4. Data controls (export/clear/delete path) are explicit and tested.
5. Logging and permissions posture is hardened and documented.
