# Prompt Log

## How to use this doc

This document tracks all prompts used during the refactoring process. Each row represents a prompt session with its tool, mode, purpose, and outcomes. Use this to understand the sequence of work and reference previous analysis or decisions.

---

## Prompt History

| Prompt ID | Tool    | Mode      | Purpose                                | Output Summary                                                                                                                                                                                 | Date       |
| --------- | ------- | --------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P1        | Cursor  | Read-only | Baseline repo map / flows / risks      | [To be filled: Repository structure mapped, key flows identified, risks documented]                                                                                                            |            |
| P2        | Cursor  | Read-only | Tooling + guardrails audit             | [To be filled: Key findings: build configs, type coverage, test setup, lint rules status]                                                                                                      |            |
| P3A       | Cursor  | Edit      | Create refactor tracking docs          | Created docs/REFACTOR_PLAN.md and docs/PROMPT_LOG.md to track phased refactor preparation                                                                                                      |            |
| P3B       | Cursor  | Edit      | Rationalize AGENTS documentation       | AGENTS.md refactored to canonical stable contract; AGENTS.\_LIVINGDOC.md deprecated; docs hierarchy established; refactor prep tracking added                                                  |            |
| P3E2      | Cursor  | Edit      | extension/src vs libs structure change | P3 complete                                                                                                                                                                                    |            |
| P4        | Copilot | Edit      | Create smoke test checklist (B4)       | Created `docs/SMOKE_CHECKLIST.md` with 6 test sections covering build/load, selection→AI, notes CRUD, assets, session restore, popup; added debug tips; marked B4 complete in REFACTOR_PLAN.md | 2024-12-14 |
