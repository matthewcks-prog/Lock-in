# Release Checklist

> Updated: 2026-02-28
> Scope: Phase 7 release-readiness checks for compliance and transparency features

## Manual Validation

- [ ] Monash Moodle banner behavior
  - Confirm popup banner appears only on configured Monash Moodle hosts.
  - Confirm no banner is shown on non-matching hosts.
  - Confirm dismissal persists via `chrome.storage.local` and does not reappear until reset.

- [ ] First-use consent blocking behavior
  - Confirm first sidebar open blocks interaction until consent is accepted.
  - Confirm accepting sets `lockin_acceptedTermsAt` to a valid ISO timestamp.
  - Confirm declining keeps the app blocked and prompts again on reopen.
  - Confirm legacy users with a valid existing session are not trapped in a consent loop.

- [ ] Export JSON
  - Confirm exported file name format: `lockin-export-YYYYMMDD-HHMM.json`.
  - Confirm payload includes `schemaVersion`, `exportedAt`, `appVersion`, and `data`.
  - Confirm cloud slices are included when authenticated and available.

- [ ] Clear local data
  - Confirm clear flow includes explicit scope text and a confirmation step.
  - Confirm local browser data is cleared.
  - Confirm cloud data remains unchanged after local clear.

- [ ] Permissions and docs parity
  - Confirm `extension/manifest.json` permissions match `docs/permissions.md`.
  - Confirm each retained permission has a concrete documented callsite/feature reason.

- [ ] Quality gate
  - Run `npm run validate` and confirm all checks pass.

## Release Sign-Off

- [ ] README and policy links match shipped behavior.
- [ ] `docs/README.md` includes this checklist for discoverability.
- [ ] CI badge in root `README.md` points to active quality workflow.
