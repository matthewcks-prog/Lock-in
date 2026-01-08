# MCP Usage Guidelines for AI Assistants

**Best Practices for Using Lock-in MCP Servers**

This guide provides patterns, anti-patterns, and examples for AI assistants using Lock-in's MCP infrastructure. Follow these guidelines to ensure efficient, safe, and effective use of MCP servers.

---

## Core Principles

1. **Query with intent:** Know what you need before querying
2. **Limit result sets:** Use WHERE clauses, LIMIT, specific paths
3. **Respect rate limits:** Batch requests, avoid loops
4. **Understand boundaries:** Read-only for data, execute-only for builds
5. **Follow Lock-in architecture:** Extension-first, separation of concerns

---

## Database Server (`lockin-db`)

### What to Query

**✅ Recent notes for a specific course:**

```sql
SELECT id, title, content, created_at
FROM notes
WHERE course_code = 'FIT3170'
  AND user_id = 'current-user-id'
ORDER BY created_at DESC
LIMIT 10;
```

**✅ Chat history for context:**

```sql
SELECT c.id, c.title, c.created_at, cm.content
FROM chats c
JOIN chat_messages cm ON c.id = cm.chat_id
WHERE c.user_id = 'current-user-id'
  AND c.created_at > NOW() - INTERVAL '7 days'
ORDER BY c.created_at DESC
LIMIT 20;
```

**✅ Transcript metadata (not full content):**

```sql
SELECT id, video_url, provider, status, created_at
FROM transcripts
WHERE user_id = 'current-user-id'
  AND status = 'completed'
ORDER BY created_at DESC
LIMIT 10;
```

### What NOT to Query

**❌ Full table scans:**

```sql
-- DON'T: Queries entire notes table (may hit 1000 row limit)
SELECT * FROM notes;
```

**❌ Unbounded joins:**

```sql
-- DON'T: Joins all notes with all chats (Cartesian product)
SELECT * FROM notes n, chats c;
```

**❌ Complex aggregations without LIMIT:**

```sql
-- DON'T: Scans entire table to count (use WHERE to reduce scope)
SELECT course_code, COUNT(*) FROM notes GROUP BY course_code;
```

**❌ Auth tables (not granted SELECT):**

```sql
-- DON'T: No permission on auth schema
SELECT * FROM supabase.auth.users;
```

### Query Patterns

**Pattern 1: Paginated results**

```sql
-- Fetch 10 notes at a time
SELECT id, title, created_at
FROM notes
WHERE course_code = 'FIT3170'
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;  -- Change OFFSET for pagination
```

**Pattern 2: Filtered by date range**

```sql
-- Only recent notes (reduces result set)
SELECT id, title, content
FROM notes
WHERE user_id = 'current-user-id'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 50;
```

**Pattern 3: Specific fields only**

```sql
-- Don't SELECT *, pick only needed columns
SELECT id, title, course_code  -- Excludes large 'content' field
FROM notes
WHERE user_id = 'current-user-id';
```

### Security Boundaries

**RLS Enforcement:**

- All queries run through Row Level Security (RLS) policies
- Users can only see their own data (filtered by `user_id`)
- Even if you query `SELECT * FROM notes`, RLS adds `WHERE user_id = 'current-user-id'`

**Max Rows:**

- Server config limits results to 1000 rows
- Use LIMIT and WHERE clauses to stay under this
- If you hit the limit, refine your query (add filters)

**Timeout:**

- Queries timeout after 5 seconds
- Avoid complex joins or aggregations
- Break complex queries into multiple simpler ones

**Rate Limit:**

- 30 requests per minute
- Batch queries where possible (JOIN instead of multiple queries)
- Don't query in tight loops

---

## Files Server (`lockin-files`)

### What to Read

**✅ Source code for understanding types:**

```
Read: core/domain/types.ts
Purpose: Understand Note, Chat, CourseContext types
```

**✅ Service layer for business logic:**

```
Read: core/services/notesService.ts
Purpose: Understand how notes are created, updated
```

**✅ API client for backend integration:**

```
Read: api/client.ts
Purpose: Understand API surface, available endpoints
```

**✅ Documentation for architecture:**

```
Read: AGENTS.md
Purpose: Understand Lock-in's architecture principles
```

**✅ Configuration files:**

```
Read: package.json, tsconfig.json, vite.config.ts
Purpose: Understand build setup, dependencies
```

### What NOT to Read

**❌ Minified files:**

```
DON'T Read: extension/dist/ui/index.js (minified, unreadable)
```

**❌ Vendor code:**

```
DON'T Read: node_modules/** (too large, not project code)
```

**❌ Build outputs:**

```
DON'T Read: dist/**, build/** (generated, not source)
```

**❌ Environment files:**

```
DON'T Read: .env, .env.local (credentials, excluded by server)
```

**❌ Binary files:**

```
DON'T Read: *.jpg, *.png, *.pdf (binary, can't parse)
```

### File Access Patterns

**Pattern 1: Read related files together**

```
Read in one batch:
- core/domain/Note.ts (type definition)
- core/services/notesService.ts (business logic)
- api/resources/notesClient.ts (API client)
```

**Pattern 2: Start with high-level docs**

```
Read order:
1. AGENTS.md (architecture principles)
2. CODE_OVERVIEW.md (implementation patterns)
3. Specific source files (types, services)
```

**Pattern 3: Check folder-level AGENTS.md first**

```
Before reading extension code:
1. Read: extension/AGENTS.md (folder-specific conventions)
2. Then: extension/background.js, extension/contentScript.js
```

### Security Boundaries

**Path Restrictions:**

- Only allowed paths (via glob patterns) can be read
- `.env*` files are excluded (credentials)
- `node_modules` is excluded (too large)

**File Size Limit:**

- Max 1MB per file
- Large files (e.g., full transcripts) may be rejected
- Read metadata instead of full content

**Rate Limit:**

- 60 requests per minute
- 100 files read per minute
- Batch file reads where possible

**Binary Rejection:**

- Server rejects binary files (images, PDFs)
- Only text files (`.ts`, `.js`, `.md`, `.json`) can be read

---

## Build Server (`lockin-build`)

### What to Run

**✅ Type checking:**

```
Command: type-check
Purpose: Verify TypeScript types after code changes
Timeout: 60 seconds
```

**✅ Linting:**

```
Command: lint
Purpose: Check code style, catch common errors
Timeout: 60 seconds
```

**✅ Testing:**

```
Command: test
Purpose: Run unit/integration tests
Timeout: 120 seconds
```

**✅ Build verification:**

```
Command: verify-build
Purpose: Full build validation (type-check + lint + test + build)
Timeout: 180 seconds
```

**✅ Build:**

```
Command: build
Purpose: Build extension and libraries
Timeout: 180 seconds
```

### What NOT to Run

**❌ Install commands:**

```
DON'T: npm install, npm ci
Reason: Modifies node_modules, too slow
```

**❌ Format commands:**

```
DON'T: npm run format
Reason: Modifies source files
```

**❌ Clean commands:**

```
DON'T: npm run clean, rm -rf dist
Reason: Deletes files
```

**❌ Publish commands:**

```
DON'T: npm publish
Reason: Deploys to npm registry
```

**❌ Arbitrary shell commands:**

```
DON'T: git commit, powershell scripts
Reason: Security risk, modifies repo state
```

### Build Command Patterns

**Pattern 1: Validate after changes**

```
Workflow:
1. Make code changes
2. Run: type-check (verify types)
3. Run: lint (check style)
4. If both pass, commit changes
```

**Pattern 2: Pre-commit validation**

```
Before commit:
1. Run: verify-build (full validation)
2. If passes, commit
3. If fails, fix errors and re-run
```

**Pattern 3: Incremental validation**

```
During development:
1. Edit types → Run: type-check
2. Edit styles → Run: lint
3. Edit logic → Run: test
(Don't run full build for small changes)
```

### Security Boundaries

**Allowed Commands Only:**

- Server has allow-list of safe commands
- Only npm scripts in package.json can run
- No arbitrary shell commands

**Timeout:**

- Each command has a timeout (60s - 180s)
- If command hangs, it's killed
- Prevents infinite builds

**Rate Limit:**

- 20 commands per hour
- 1 concurrent command (no parallel builds)
- Prevents abuse, ensures resources available

**Output Size Limit:**

- Max 1MB of output per command
- Large outputs are truncated
- Prevents log spam

---

## Docs Server (`lockin-docs`)

### What to Search

**✅ Architecture principles:**

```
Query: "separation of concerns"
Files: AGENTS.md, docs/ARCHITECTURE.md
Purpose: Understand project structure
```

**✅ Current implementation patterns:**

```
Query: "notes editing flow"
Files: CODE_OVERVIEW.md
Purpose: Understand how notes are implemented
```

**✅ Database schema:**

```
Query: "notes table schema"
Files: DATABASE.MD
Purpose: Understand database structure
```

**✅ Folder-specific conventions:**

```
Query: "extension widget component"
Files: extension/AGENTS.md
Purpose: Understand extension-specific rules
```

### What NOT to Search

**❌ Overly broad queries:**

```
DON'T Query: "react"
Reason: Too many results, not specific enough
```

**❌ Code snippets:**

```
DON'T Query: "function createNote"
Reason: Docs search is for documentation, not code
Use: Files server to read source code instead
```

**❌ Implementation details:**

```
DON'T Query: "how to implement feature X"
Reason: Docs have architecture, not step-by-step guides
Use: AGENTS.md for principles, CODE_OVERVIEW.md for patterns
```

### Search Patterns

**Pattern 1: Start with architecture**

```
Search order:
1. AGENTS.md (core principles)
2. docs/ARCHITECTURE.md (stable invariants)
3. CODE_OVERVIEW.md (current implementation)
4. Specific docs (e.g., DATABASE.MD)
```

**Pattern 2: Check folder conventions**

```
Before editing code in a folder:
1. Search: "extension folder conventions"
2. Read: extension/AGENTS.md
3. Follow patterns described
```

**Pattern 3: Look up specific topics**

```
Queries:
- "database migrations" → DATABASE.MD
- "site adapter pattern" → AGENTS.md
- "transcript system" → docs/TRANSCRIPT_REVIEW.md
```

### Security Boundaries

**Indexed Paths Only:**

- Only markdown files are indexed
- Source code is NOT indexed (use Files server)
- Binary files are excluded

**Max Results:**

- 50 results per search
- Sorted by relevance
- Use specific queries to reduce results

**Context Size:**

- Max 5000 characters per result
- Enough for a few paragraphs of context
- Link to full file if more needed

**Rate Limit:**

- 30 searches per minute
- Don't search in tight loops
- Cache results if possible

---

## Integration Patterns

### Workflow: Understanding a Feature

**Step 1: Read architecture docs**

```
Server: lockin-docs
Query: "notes editing flow"
Output: Understand high-level pattern
```

**Step 2: Read type definitions**

```
Server: lockin-files
File: core/domain/Note.ts
Output: Understand Note type structure
```

**Step 3: Read service layer**

```
Server: lockin-files
File: core/services/notesService.ts
Output: Understand business logic
```

**Step 4: Read API client**

```
Server: lockin-files
File: api/resources/notesClient.ts
Output: Understand backend integration
```

### Workflow: Making Changes

**Step 1: Check current state**

```
Server: lockin-db
Query: SELECT id, title FROM notes LIMIT 10
Output: Understand current data
```

**Step 2: Read relevant code**

```
Server: lockin-files
Files: core/domain/Note.ts, core/services/notesService.ts
Output: Understand implementation
```

**Step 3: Make changes**

```
(Use editor/IDE, not MCP)
```

**Step 4: Validate changes**

```
Server: lockin-build
Commands: type-check, lint, test
Output: Verify changes are correct
```

### Workflow: Debugging

**Step 1: Reproduce issue**

```
Server: lockin-db
Query: SELECT id, content FROM notes WHERE id = 'problematic-id'
Output: Get problematic data
```

**Step 2: Check implementation**

```
Server: lockin-files
File: core/services/notesService.ts
Output: Find bug in business logic
```

**Step 3: Fix and test**

```
(Edit code)
Server: lockin-build
Command: test
Output: Verify fix works
```

---

## Error Handling

### Database Errors

**"Max rows exceeded":**

```
Cause: Query returned > 1000 rows
Fix: Add WHERE clause or LIMIT
Example: SELECT * FROM notes WHERE course_code = 'FIT3170' LIMIT 100
```

**"Query timeout":**

```
Cause: Query took > 5 seconds
Fix: Simplify query, add indexes, reduce joins
Example: Break complex JOIN into multiple queries
```

**"Permission denied":**

```
Cause: Tried to INSERT/UPDATE/DELETE
Fix: Use backend API for writes (via api/client.ts)
```

**"Rate limit exceeded":**

```
Cause: > 30 requests/min
Fix: Batch queries, add delays between requests
```

### Files Errors

**"Path not allowed":**

```
Cause: Tried to read excluded path (e.g., node_modules)
Fix: Read from allowed paths (core, api, docs)
```

**"File too large":**

```
Cause: File > 1MB
Fix: Read metadata instead of full content
Example: Read transcript metadata, not full transcript text
```

**"Binary file rejected":**

```
Cause: Tried to read image, PDF, etc.
Fix: Read text files only (.ts, .js, .md, .json)
```

**"Rate limit exceeded":**

```
Cause: > 60 requests/min or > 100 files/min
Fix: Batch file reads, reduce frequency
```

### Build Errors

**"Command not allowed":**

```
Cause: Tried to run non-allowed command (e.g., npm install)
Fix: Use allowed commands only (type-check, lint, test, build)
```

**"Command timeout":**

```
Cause: Command took > timeout limit
Fix: Break into smaller tasks, optimize build
Example: Run type-check first (60s), then test (120s)
```

**"Rate limit exceeded":**

```
Cause: > 20 commands/hour
Fix: Reduce build frequency, batch validations
```

### Docs Errors

**"Too many results":**

```
Cause: Query too broad, > 50 results
Fix: Be more specific in query
Example: "notes editing" → "notes Lexical editor integration"
```

**"Context too large":**

```
Cause: Result > 5000 chars
Fix: Query returns truncated context + link to full file
Action: Use Files server to read full file if needed
```

**"Rate limit exceeded":**

```
Cause: > 30 searches/min
Fix: Cache results, reduce search frequency
```

---

## Best Practices Summary

### DO

- ✅ Use WHERE clauses in database queries
- ✅ Limit result sets (LIMIT 10, LIMIT 100)
- ✅ Read architecture docs before code
- ✅ Batch file reads (related files together)
- ✅ Validate changes with type-check, lint, test
- ✅ Search docs with specific queries
- ✅ Respect rate limits (batch requests)

### DON'T

- ❌ Query full tables (SELECT \* FROM notes)
- ❌ Read binary files (images, PDFs)
- ❌ Read vendor code (node_modules)
- ❌ Run install/format/clean commands
- ❌ Search docs with overly broad queries
- ❌ Query/read in tight loops (rate limits)
- ❌ Try to write data via database (use API)

---

## Security Checklist

Before using MCP servers, verify:

- ✅ `.env.local` has read-only connection string (not admin)
- ✅ Server configs enforce security boundaries (readonly: true)
- ✅ Rate limits are configured (prevent abuse)
- ✅ Timeouts are set (prevent hanging requests)
- ✅ Allowed/denied lists are correct (minimal permissions)
- ✅ RLS is enabled on database tables (user isolation)
- ✅ Path restrictions prevent reading credentials (.env excluded)

---

## Next Steps

- **Setup:** [README.md](README.md) - Full MCP setup guide
- **Database:** [SUPABASE_READONLY_SETUP.md](SUPABASE_READONLY_SETUP.md) - Create read-only user
- **Troubleshoot:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and fixes
- **Lock-in Docs:** [../../AGENTS.md](../../AGENTS.md) - Architecture principles
