## Description

<!-- Provide a brief description of your changes -->

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test update

## Related Issues

<!-- Link to related issues using #issue-number -->

Closes #

## Changes Made

<!-- List the main changes in this PR -->

-
-
-

## Testing

### Test Coverage

- [ ] Unit tests added/updated
- [ ] All tests pass locally (`npm test`)
- [ ] Backend tests pass (`cd backend && npm test`)
- [ ] Integration tests pass (if applicable)

### Test File Naming (Backend)

If you added new backend test files, confirm:

- [ ] Test files end with `.test.js` (e.g., `myFeature.test.js`)
- [ ] Utility scripts don't start with `test-` (use `verify-*`, `check-*`, etc.)
- [ ] Tests are placed next to the code or in `__tests__/` subdirectory

**📚 See:** [docs/testing/BACKEND_TESTING.md](docs/testing/BACKEND_TESTING.md)

### Manual Testing

<!-- Describe how you tested your changes -->

- [ ] Tested on Chrome extension
- [ ] Tested backend API endpoints
- [ ] Tested on multiple learning platforms (list below)

**Platforms tested:**

- [ ] Moodle
- [ ] Edstem
- [ ] Panopto
- [ ] Echo360
- [ ] Other:

## Code Quality

- [ ] Code follows project style guidelines
- [ ] No new ESLint warnings/errors
- [ ] Type checking passes (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if needed)

## Architecture Compliance

- [ ] Chrome-specific code is in `/extension` only
- [ ] Business logic is in `/core` (no Chrome dependencies)
- [ ] Site-specific logic uses adapter pattern
- [ ] No duplication of widget components

**📚 See:** [AGENTS.md](AGENTS.md) for architecture rules

## Deployment

- [ ] Environment variables documented (if new ones added)
- [ ] Database migrations included (if schema changes)
- [ ] Deployment steps documented (if manual steps needed)

## Screenshots/Videos

<!-- Add screenshots or videos demonstrating your changes -->

## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Additional Notes

<!-- Any additional information that reviewers should know -->
