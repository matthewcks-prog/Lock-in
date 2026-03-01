# Extension Permissions

> Updated: 2026-02-28

This document maps `extension/manifest.json` permissions to concrete runtime use.

## Declared Permissions

| Permission      | Why It Is Required                                               | Primary Usage Areas                                                                          |
| --------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `scripting`     | Execute scripts in tab/frame contexts for supported integrations | `extension/background/handlers/seekHandlers.js`, `extension/src/panoptoResolverRuntime.js`   |
| `storage`       | Persist extension settings/session/UI state                      | `extension/src/storage.ts`, `extension/src/chromeStorage.ts`, popup privacy/compliance state |
| `contextMenus`  | Add right-click entry (`Lock-in: Explain`)                       | `extension/background/contextMenus.js`                                                       |
| `tabs`          | Query active tab and send tab-scoped messages                    | `extension/popup.js`, `extension/src/messaging.ts`, background lifecycle flows               |
| `webNavigation` | Observe top-frame navigations for per-tab cleanup logic          | `extension/background/lifecycle.js`                                                          |

## Host Permissions

| Host Pattern Group                                                                          | Why It Is Required                             |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `http://localhost:3000/*`                                                                   | Local backend development requests             |
| `https://*.supabase.co/*`                                                                   | Supabase auth and data/storage API calls       |
| `https://*.panopto.com/*`, `https://*.panopto.aarnet.edu.au/*`, `https://*.aarnet.edu.au/*` | Panopto transcript/media access and resolution |
| Echo360 domain patterns (`echo360*`)                                                        | Echo360 transcript/video flows                 |

## Guardrails

- Active tab URL checks are performed only when popup opens; Lock-in does not run background browsing history collection.
- Permission usage is expected to remain aligned with `docs/tracking/REFACTOR_PLAN.md` Phase 6 audit goals.
- If a permission is removed or added, update this file in the same change.

## Related Docs

- `docs/DISCOVERY.md` (full callsite map)
- `docs/data-handling.md`
- `SECURITY.md`
