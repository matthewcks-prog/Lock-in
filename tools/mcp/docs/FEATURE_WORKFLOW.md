# MCP Documentation Update Workflow

## Quick Reference: Feature Implementation Checklist

When implementing a new feature, use this checklist to ensure MCP configs stay in sync:

### Pre-Implementation Checklist

- [ ] **Database changes?** If adding new tables/columns → Will need to update `DATABASE.MD` → MCP config will update
- [ ] **New npm scripts?** If adding build/test/lint scripts → Already in `package.json` → MCP config will auto-detect
- [ ] **New file types/folders?** If adding new directories or file extensions → MCP config will auto-detect
- [ ] **New documentation?** If adding markdown files → MCP config will auto-index

### During Implementation

- [ ] Work in feature branch (iterate freely, MCP configs stay unchanged on main)
- [ ] Make code changes first (add table, script, file type, or doc)
- [ ] Update relevant documentation (`DATABASE.MD`, `CODE_OVERVIEW.md`, etc.)

### Before Committing

- [ ] Run `npm run mcp:docs:draft` (or `tools/mcp/scripts/update-mcp-docs.ps1 -Draft`) to preview MCP config changes
- [ ] Review generated configs in `tools/mcp/config/` - verify they look correct
- [ ] If configs are correct, run `npm run mcp:docs:publish` (or `-Publish` flag) to stage for commit
- [ ] Commit code + docs + MCP configs together in a single commit

### Things to Be Aware Of

**Critical Awareness Items:**

1. **MCP configs are auto-generated** - Never edit `*-server-config.json` files manually. They will be overwritten.

2. **Always run `-Draft` first** - Preview changes before committing. This lets you verify what will change without staging anything.

3. **Review generated configs** - Don't blindly commit. Check that:
   - Database tables match what you added to `DATABASE.MD`
   - NPM scripts match what's in `package.json` (only safe scripts are included)
   - File paths match your new files/folders
   - Documentation files are properly indexed

4. **Source of truth matters** - MCP configs are generated from:
   - `DATABASE.MD` → `db-server-config.json` (table names)
   - `package.json` → `build-server-config.json` (npm scripts)
   - Repository structure → `files-server-config.json` (file paths)
   - Markdown files → `docs-server-config.json` (documentation index)
   
   If configs are wrong, fix the source, not the config.

5. **Commit together** - MCP configs should be committed with the feature code, not separately. This keeps history clean and makes it clear what changed.

6. **Iteration is safe** - During development, you can iterate freely. Only update MCP configs when the feature is finalized and ready to merge.

7. **No changes needed?** - If you're just refactoring (moving code, no new files/tables), MCP configs won't change. Skip the update step.

8. **User-specific configs are gitignored** - `.cursor/mcp.json` and `.env.local` are not committed. Only the templates and auto-generated configs are in the repo.

---

## The Problem

When developing a feature, you iterate multiple times:

1. **Try approach A** → Doesn't work, revert
2. **Try approach B** → Better, but has issues
3. **Refine approach B** → Good, but needs polish
4. **Finalize approach B** → Ready to merge

**If MCP docs auto-update on every change**, you'd have 4 versions of outdated/incorrect documentation polluting your history.

**Solution**: Only update MCP docs when you're **satisfied** with the feature.

---

## Recommended Workflow

### Step 1: Create Feature Branch (Iterate Freely)

```powershell
# Create feature branch
git checkout -b feature/transcript-caching

# Work freely - iterate as much as needed
# - Try different approaches
# - Refactor multiple times
# - Break things and fix them
# - MCP docs in main branch stay unchanged ✓
```

**Key**: Your iterations don't affect the `main` branch or MCP docs until you're ready.

---

### Step 2: Finalize Your Feature

```powershell
# When feature works and you're satisfied:
# - All tests pass
# - Code is clean
# - Ready to merge
```

---

### Step 3: Update MCP Docs (Draft Mode First)

```powershell
# Preview what changes would be made (doesn't stage anything)
cd tools\mcp\scripts
.\update-mcp-docs.ps1 -Draft
```

**Output**:

```
ℹ Analyzing codebase structure...
✓ Analyzed 45 core, 12 api, 23 extension, 34 ui files
ℹ Extracting database schema...
✓ Found 5 database tables: notes, chats, chat_messages, note_assets, transcripts
ℹ Generating database server config...
✓ Generated db-server-config.json
ℹ Generating files server config...
✓ Generated files-server-config.json
ℹ Generating build server config...
✓ Found 8 safe npm scripts: build, test, lint, type-check, verify-build, check
✓ Generated build-server-config.json
ℹ Generating docs server config...
✓ Indexed 23 markdown files
✓ Generated docs-server-config.json

ℹ Draft mode - configs updated but not staged for commit

Generated configs in: tools\mcp\config\
  • db-server-config.json (5 tables)
  • files-server-config.json (114 files)
  • build-server-config.json (8 scripts)
  • docs-server-config.json (23 docs)

⚠ To publish these changes, run:
  .\tools\mcp\scripts\update-mcp-docs.ps1 -Publish
```

**Review the generated configs**:

```powershell
# Check what changed
Get-Content tools\mcp\config\db-server-config.json
Get-Content tools\mcp\config\files-server-config.json
```

---

### Step 4: Publish MCP Configs (When Ready)

```powershell
# Stage configs for commit
.\update-mcp-docs.ps1 -Publish -Feature "transcript caching"
```

**Output**:

```
ℹ Publish mode - staging configs for commit...
✓ MCP configs staged for commit

ℹ Changes staged:
 M tools/mcp/config/db-server-config.json
 M tools/mcp/config/files-server-config.json

ℹ Suggested commit message:
  git commit -m "Update MCP configs for transcript caching"

Or commit with code changes:
  git add .
  git commit -m "Add transcript caching + update MCP configs"
```

---

### Step 5: Update Living Documentation

Update related documentation files **in the same commit**:

```powershell
# If you added new files/folders, update CODE_OVERVIEW.md
notepad CODE_OVERVIEW.md
# Add: - `/core/transcripts/cache/` - In-memory LRU cache for transcripts

# If you changed database schema, update DATABASE.MD
notepad DATABASE.MD
# Add new table or columns

# If you changed folder conventions, update folder AGENTS.md
notepad extension\AGENTS.md
```

---

### Step 6: Commit Everything Together

```powershell
# Stage all changes (code + docs)
git add .

# Commit with descriptive message
git commit -m "Add transcript caching system

- Implement in-memory LRU cache for transcripts
- Add chrome.storage.local fallback for persistence
- Update MCP configs for new cache module
- Update CODE_OVERVIEW.md with cache architecture"
```

---

### Step 7: Merge to Main

```powershell
# Push feature branch
git push origin feature/transcript-caching

# Create pull request
# Review changes (code + docs)
# Merge when approved

# Now main branch has updated code AND updated MCP docs ✓
```

---

## Example Workflows

### Example 1: Adding a New Database Table

```powershell
# 1. Create feature branch
git checkout -b feature/starred-notes

# 2. Add migration: backend/migrations/005_starred_notes.sql
# 3. Update DATABASE.MD with new table schema
# 4. Implement feature code

# 5. Preview MCP config changes
cd tools\mcp\scripts
.\update-mcp-docs.ps1 -Draft
# Check: db-server-config.json now includes "starred_notes" in allowed_tables

# 6. Publish when ready
.\update-mcp-docs.ps1 -Publish -Feature "starred notes"

# 7. Commit everything
cd ..\..\..\
git add .
git commit -m "Add starred notes feature

- Add starred_notes table to database
- Implement starring/unstarring functionality
- Update DATABASE.MD with schema
- Update MCP configs (new table in db-server-config)"

# 8. Push and merge
git push origin feature/starred-notes
```

---

### Example 2: Adding New npm Scripts

```powershell
# 1. Create feature branch
git checkout -b feature/performance-tests

# 2. Add to package.json:
#    "test:perf": "vitest --run --config vitest.config.perf.ts"

# 3. Implement performance tests

# 4. Preview MCP config changes
cd tools\mcp\scripts
.\update-mcp-docs.ps1 -Draft
# Check: build-server-config.json now includes "test:perf" command

# 5. Publish when ready
.\update-mcp-docs.ps1 -Publish -Feature "performance tests"

# 6. Commit everything
cd ..\..\..\
git add .
git commit -m "Add performance test suite

- Add vitest.config.perf.ts for perf tests
- Add test:perf npm script
- Update MCP configs (new command in build-server-config)"

# 7. Push and merge
git push origin feature/performance-tests
```

---

### Example 3: Refactoring (No MCP Changes Needed)

```powershell
# 1. Create feature branch
git checkout -b refactor/extract-transcript-utils

# 2. Refactor code (move functions around, no new files/tables)

# 3. Check if MCP configs changed
cd tools\mcp\scripts
.\update-mcp-docs.ps1 -Draft
# Output: "No changes to MCP configs (already up to date)"

# 4. Since no changes, skip publish step

# 5. Commit code only (no MCP config changes)
cd ..\..\..\
git add core/transcripts/
git commit -m "Refactor: Extract transcript utility functions

- Move parsing logic to utils/
- Improve code organization
- No API changes"

# 6. Push and merge
git push origin refactor/extract-transcript-utils
```

---

## When to Update MCP Docs

### ✅ Update MCP Docs When:

- **New database tables** → `db-server-config.json` updates `allowed_tables`
  - **Action**: Update `DATABASE.MD` first, then run `npm run mcp:docs:draft`
  - **Check**: Verify new table appears in `allowed_tables` array

- **New file types/folders** → `files-server-config.json` updates `allowed_paths`
  - **Action**: Add files/folders to repo, then run `npm run mcp:docs:draft`
  - **Check**: Verify new paths match your file structure

- **New npm scripts** → `build-server-config.json` updates `allowed_commands`
  - **Action**: Add script to `package.json`, then run `npm run mcp:docs:draft`
  - **Note**: Only scripts matching safe patterns (build, test, lint, type-check, verify, check) are included
  - **Check**: Verify new script appears in `allowed_commands` array

- **New documentation files** → `docs-server-config.json` updates `indexed_files`
  - **Action**: Add markdown files, then run `npm run mcp:docs:draft`
  - **Check**: Verify new docs appear in `indexed_files` array

### ❌ Don't Update MCP Docs When:

- **Refactoring** (moving code around, no new files)
  - **Why**: File paths don't change, just code organization
  - **Action**: Skip MCP update step

- **Bug fixes** (changing logic, not structure)
  - **Why**: No structural changes to database, files, or scripts
  - **Action**: Skip MCP update step

- **Still iterating** (feature not finalized)
  - **Why**: Don't pollute history with intermediate states
  - **Action**: Wait until feature is ready to merge

- **Temporary changes** (debugging, experiments)
  - **Why**: These are temporary and shouldn't affect configs
  - **Action**: Skip MCP update step

### ⚠️ Edge Cases

- **Renaming files/folders**: This changes file paths → Run `npm run mcp:docs:draft` to update
- **Removing tables/scripts**: Configs will update automatically, but verify they're correct
- **Changing script names**: Old script removed, new one added → Configs update automatically

---

## Script Reference

### Draft Mode (Safe Preview)

```powershell
.\tools\mcp\scripts\update-mcp-docs.ps1 -Draft
```

- Generates MCP configs from current codebase
- **Does NOT stage files for commit**
- Safe to run anytime during development
- Use this to preview what changes would be made

### Publish Mode (Stage for Commit)

```powershell
.\tools\mcp\scripts\update-mcp-docs.ps1 -Publish
```

- Generates MCP configs from current codebase
- **Stages files for commit** (`git add`)
- Provides suggested commit message
- Use this when feature is finalized

### Publish with Feature Name

```powershell
.\tools\mcp\scripts\update-mcp-docs.ps1 -Publish -Feature "transcript caching"
```

- Same as `-Publish`
- Includes feature name in suggested commit message

---

## What Gets Auto-Generated?

### Database Config (`db-server-config.json`)

**Source**: Extracted from `DATABASE.MD`

```json
{
  "allowed_tables": ["notes", "chats", "chat_messages", "note_assets", "transcripts"]
}
```

### Files Config (`files-server-config.json`)

**Source**: Scanned from repository structure

```json
{
  "metadata": {
    "total_files": 114
  }
}
```

### Build Config (`build-server-config.json`)

**Source**: Extracted from `package.json` scripts

```json
{
  "allowed_commands": [
    { "name": "build", "command": "npm run build" },
    { "name": "test", "command": "npm run test" },
    { "name": "lint", "command": "npm run lint" }
  ]
}
```

### Docs Config (`docs-server-config.json`)

**Source**: Indexed from markdown files

```json
{
  "metadata": {
    "indexed_file_count": 23,
    "indexed_files": ["AGENTS.md", "CODE_OVERVIEW.md", "DATABASE.MD", "docs/STATUS.md"]
  }
}
```

---

## Troubleshooting

### "I forgot to update MCP docs before merging"

```powershell
# On main branch after merge
git checkout main
git pull

# Update MCP docs
cd tools\mcp\scripts
.\update-mcp-docs.ps1 -Publish -Feature "catch-up update"

# Commit separately
cd ..\..\..\
git commit -m "Update MCP configs (missed in previous merge)"
git push
```

### "MCP configs have merge conflicts"

```powershell
# Regenerate from current codebase (auto-resolves conflicts)
cd tools\mcp\scripts
.\update-mcp-docs.ps1 -Publish

# Configs now match current codebase state
cd ..\..\..\
git add tools/mcp/config/*.json
git commit -m "Resolve MCP config merge conflicts"
```

### "Script says 'No changes' but I added a new table"

```powershell
# Check if DATABASE.MD is updated
Get-Content DATABASE.MD | Select-String "new_table_name"

# If not found, update DATABASE.MD first
notepad DATABASE.MD
# Add: ### `new_table_name`

# Then re-run
.\update-mcp-docs.ps1 -Draft
# Should now include new_table_name
```

---

## Best Practices

1. **Use feature branches** - Isolate your work from main
2. **Run `-Draft` first** - Preview changes before committing
3. **Update docs together** - MCP configs + CODE_OVERVIEW.md + DATABASE.MD in same commit
4. **Meaningful commit messages** - Explain what changed and why
5. **Review generated configs** - Don't blindly commit auto-generated files

---

## Integration with Lock-in Workflow

This MCP workflow integrates seamlessly with Lock-in's existing conventions:

**Lock-in's Documentation Hierarchy**:

- `/AGENTS.md` - Stable contract (update rarely)
- `CODE_OVERVIEW.md` - Living snapshot (update with file changes)
- `DATABASE.MD` - Schema reference (update with migrations)
- `docs/STATUS.md` - Current status (update with feature completion)

**MCP Workflow**:

- MCP configs are **auto-generated** from these docs
- Update those docs (manually) → Run `update-mcp-docs.ps1` → MCP configs stay in sync
- Follows Lock-in's principle: **Manual and deliberate documentation updates**

---

## Summary

**Key Principle**: MCP documentation updates are **manual and deliberate**, not automatic on every change.

**Workflow**:

1. ✅ Work in feature branch (iterate freely)
2. ✅ When satisfied, run `update-mcp-docs.ps1 -Draft` (preview)
3. ✅ Run `update-mcp-docs.ps1 -Publish` (stage for commit)
4. ✅ Update CODE_OVERVIEW.md / DATABASE.MD manually
5. ✅ Commit everything together
6. ✅ Merge to main when ready

**Result**: MCP docs stay accurate while preserving your ability to iterate quickly without pollution.

---

## Next Steps

- **Try it**: Run `.\tools\mcp\scripts\update-mcp-docs.ps1 -Draft` right now to see current state
- **Add to workflow**: Include `-Publish` step before committing features
- **Review configs**: Check `tools/mcp/config/*.json` to see what's generated
- **Read guides**: See [README.md](README.md), [USAGE_GUIDELINES.md](USAGE_GUIDELINES.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
