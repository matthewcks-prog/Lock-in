import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function getMarkdownFiles() {
  try {
    const output = execSync('git ls-files "*.md"', {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (error) {
    // Fallback: simple recursive scan that skips common large folders.
    const results = [];
    const skip = new Set(['.git', 'node_modules', 'coverage', 'dist', 'build']);

    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (skip.has(entry.name)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          results.push(path.relative(repoRoot, fullPath));
        }
      }
    }

    walk(repoRoot);
    return results;
  }
}

function stripCode(content) {
  // Remove fenced code blocks first, then inline code.
  const withoutFences = content.replace(/```[\s\S]*?```/g, '');
  return withoutFences.replace(/`[^`\n]*`/g, '');
}

function extractLinks(content) {
  const sanitized = stripCode(content);
  const links = [];
  const linkRegex = /!?\[[^\]]*]\(([^)]+)\)/g;

  let match;
  while ((match = linkRegex.exec(sanitized)) !== null) {
    links.push(match[1]);
  }

  return links;
}

function normalizeTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Remove optional title by taking the first token or <...> block.
  const angleMatch = trimmed.match(/^<([^>]+)>/);
  const firstToken = angleMatch ? angleMatch[1] : trimmed.split(/\s+/)[0];
  if (!firstToken) {
    return null;
  }

  // Ignore anchors and external protocols.
  if (firstToken.startsWith('#')) {
    return null;
  }

  const lower = firstToken.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:')
  ) {
    return null;
  }

  // Strip query and anchor fragments for file existence checks.
  const [withoutQuery] = firstToken.split('?');
  const [withoutHash] = withoutQuery.split('#');

  try {
    return decodeURIComponent(withoutHash);
  } catch {
    return withoutHash;
  }
}

function candidatePaths(fromFile, targetPath) {
  const fromDir = path.dirname(path.join(repoRoot, fromFile));

  const repoRelative = targetPath.startsWith('/')
    ? path.join(repoRoot, targetPath.slice(1))
    : path.resolve(fromDir, targetPath);

  const candidates = new Set();
  candidates.add(repoRelative);

  const ext = path.extname(repoRelative);
  if (!ext) {
    candidates.add(`${repoRelative}.md`);
    candidates.add(path.join(repoRelative, 'README.md'));
  } else if (ext.toLowerCase() !== '.md') {
    // Allow linking to other file types directly.
    candidates.add(repoRelative);
  }

  return Array.from(candidates);
}

function pathExistsAny(candidates) {
  return candidates.some((candidate) => fs.existsSync(candidate));
}

const markdownFiles = getMarkdownFiles();
const errors = [];

for (const file of markdownFiles) {
  const fullPath = path.join(repoRoot, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  const rawLinks = extractLinks(content);

  for (const rawTarget of rawLinks) {
    const target = normalizeTarget(rawTarget);
    if (!target) {
      continue;
    }

    const candidates = candidatePaths(file, target);
    if (!pathExistsAny(candidates)) {
      errors.push({
        file,
        target,
        checked: candidates.map((c) => path.relative(repoRoot, c)),
      });
    }
  }
}

if (errors.length > 0) {
  console.error('Broken markdown links detected:\n');
  for (const error of errors) {
    console.error(`- ${error.file}: ${error.target}`);
  }
  console.error(`\nTotal broken links: ${errors.length}`);
  process.exit(1);
}

console.log(`Doc link check passed (${markdownFiles.length} markdown files).`);
