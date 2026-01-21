# Code Formatting Setup

This document explains the automatic code formatting setup to ensure consistent code style across the project.

## Overview

The project uses the following tools to enforce consistent formatting:

1. **EditorConfig** - Editor-agnostic settings
2. **Prettier** - Code formatter
3. **ESLint** - Linter with formatting rules
4. **Git Attributes** - Line ending normalization
5. **Husky + lint-staged** - Pre-commit hooks for automatic formatting

## Git Configuration (Important!)

Before starting work, ensure your local git is configured correctly:

```bash
# Set line endings to LF (required to match .gitattributes)
git config core.autocrlf false
git config core.eol lf

# Verify settings
git config --get core.autocrlf  # Should return: false
git config --get core.eol       # Should return: lf
```

> **Why?** Windows git defaults to `core.autocrlf=true` which converts LF→CRLF on checkout, conflicting with our LF-only policy. This causes phantom "changes" in version control.

## Automatic Formatting on Save

If you're using VS Code, formatting will happen automatically on save. The workspace settings (`.vscode/settings.json`) are configured to:

- Format on save using Prettier
- Fix ESLint issues on save
- Enforce LF line endings
- Add final newline to files
- Trim trailing whitespace

## Manual Formatting

### Format all files

```bash
npm run format
```

### Check formatting without changes

```bash
npm run format:check
```

### Fix lint issues

```bash
npm run lint:fix
```

### Before committing

The project uses **Husky** and **lint-staged** to automatically format staged files before each commit. This runs automatically - no manual step needed!

When you run `git commit`, the pre-commit hook will:

1. Run ESLint with auto-fix on `.js`, `.ts`, `.tsx`, `.jsx` files
2. Run Prettier on all staged files

If you want to manually run the precommit checks:

```bash
npm run precommit
```

This will format code and fix lint issues automatically.

## Configuration Files

### `.editorconfig`

Defines basic editor settings:

- Line endings: LF (Unix-style)
- Indent: 2 spaces
- Insert final newline: Yes
- Trim trailing whitespace: Yes
- Exception: PowerShell files use CRLF

### `.prettierrc`

Prettier configuration:

- Semi-colons: Yes
- Single quotes: Yes
- Trailing commas: All
- Tab width: 2
- Line endings: LF

### `.gitattributes`

Git normalization rules:

- All text files normalized to LF
- Binary files marked appropriately
- Exception: `.ps1` files use CRLF

## CI/CD Integration

The GitHub Actions workflow (`quality-gate.yml`) includes a formatting check step:

```yaml
- name: Check code formatting
  run: npm run format:check
```

This ensures all code merged to main and develop is properly formatted.

## Common Issues

### Line Ending Warnings

If you see warnings about CRLF being replaced by LF:

```
warning: in the working copy of 'file.ts', CRLF will be replaced by LF
```

This is expected on Windows. Git will automatically convert line endings to LF when committing.

### Missing Final Newline

Files should end with a newline character. This is automatically enforced by:

- EditorConfig: `insert_final_newline = true`
- VS Code: `files.insertFinalNewline: true`

### Emoji/Special Characters

Some files may show "Crashacter" warnings for emojis. These are informational only and won't block commits, but consider using ASCII alternatives for better compatibility.

## Best Practices

1. **Enable format on save** in your editor
2. **Run `npm run precommit`** before committing
3. **Don't commit unformatted code** - CI will catch it
4. **Use LF line endings** except for `.ps1` files
5. **Add final newlines** to all files

## Editor Setup

### VS Code (Recommended)

Workspace settings are pre-configured. Just install the recommended extensions:

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)

### Other Editors

Install EditorConfig plugin for your editor:

- JetBrains IDEs: Built-in support
- Sublime Text: Install EditorConfig package
- Atom: Install editorconfig package
- Vim: Install editorconfig-vim plugin

## Troubleshooting

### Prettier Not Working

1. Check if Prettier extension is installed
2. Verify `.prettierrc` exists in project root
3. Check if file type is supported by Prettier

### EditorConfig Not Applied

1. Install EditorConfig plugin for your editor
2. Restart editor after installing plugin
3. Check `.editorconfig` exists in project root

### Git Line Ending Issues

1. Ensure `.gitattributes` exists
2. Refresh line endings:
   ```bash
   git add --renormalize .
   git commit -m "Normalize line endings"
   ```
