#!/usr/bin/env node
/**
 * CI guard — fail if FluentFlow @media queries use non-canonical breakpoint values.
 * Canonical tiers defined in src/styles/design-system/breakpoints.css (@custom-media).
 *
 * Usage: node scripts/validation/check-breakpoints.js
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('../..', import.meta.url)));
const STYLES_DIR = join(ROOT, 'src/styles');
const PUBLIC_CSS = join(ROOT, 'public/lp-nav-active.css');

const SKIP_FILES = new Set([
  'src/styles/design-system/breakpoints.css',
  'src/styles/components/orientation-lock.css',
]);

const ALLOWED_CUSTOM_MEDIA = new Set([
  '--lp-mobile-sm',
  '--lp-from-sm',
  '--lp-mobile-md',
  '--lp-from-md',
  '--lp-below-lg',
  '--lp-from-lg',
  '--lp-nav-compact',
  '--lp-touch',
  '--lp-mobile-sm-touch',
  '--lp-mobile-md-touch',
  '--lp-from-sm-to-lg',
  '--lp-sm-only',
  '--lp-mobile-sm-touch-tablet',
  '--lp-from-modal',
]);

// Obsolete raw px values — none currently in codebase, kept as regression guard
// for the canonical tiers (639/640, 767/768, 1023/1024, 860, 401 covered by OFF_BY_ONE below).
const FORBIDDEN_WIDTH_PX = new Set([]);

const OFF_BY_ONE = [
  { re: /max-width:\s*768px/, fix: '--lp-mobile-md' },
  { re: /max-width:\s*640px/, fix: '--lp-mobile-sm' },
  { re: /min-width:\s*769px/, fix: '--lp-from-md' },
  { re: /min-width:\s*641px/, fix: '--lp-from-sm' },
];

function walkCssFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkCssFiles(full, acc);
    else if (entry.endsWith('.css')) acc.push(full);
  }
  return acc;
}

/** Extract @media (...) preambles (handles nested parens in hover queries). */
function extractMediaPreambles(content) {
  const preambles = [];
  const re = /@media\s/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const start = m.index + m[0].length;
    if (content[start] !== '(') continue;
    let depth = 0;
    let i = start;
    for (; i < content.length; i++) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') {
        depth--;
        if (depth === 0) {
          preambles.push({
            text: content.slice(start, i + 1),
            index: m.index,
          });
          break;
        }
      }
    }
  }
  return preambles;
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function checkFile(filePath) {
  const rel = relative(ROOT, filePath);
  if (SKIP_FILES.has(rel)) return [];

  const content = readFileSync(filePath, 'utf8');
  const issues = [];

  for (const { text, index } of extractMediaPreambles(content)) {
    const line = lineOf(content, index);

    // Must use @custom-media tokens for width tiers (not raw px)
    if (/\b(max|min)-width:\s*\d+px/.test(text)) {
      // Allow non-width queries mixed in (hover, height, orientation)
      const widthParts = text.match(/(max|min)-width:\s*\d+px/g) || [];
      for (const part of widthParts) {
        const px = Number(part.match(/\d+/)[0]);
        if (FORBIDDEN_WIDTH_PX.has(px)) {
          issues.push({
            line,
            msg: `Obsolete @media breakpoint ${px}px — use @custom-media from breakpoints.css`,
            text: `@media ${text}`,
          });
        } else if ([639, 640, 767, 768, 1023, 1024, 860, 401].includes(px)) {
          issues.push({
            line,
            msg: `Raw ${part} in @media — use @custom-media token instead`,
            text: `@media ${text}`,
          });
        }
      }
    }

    for (const { re, fix } of OFF_BY_ONE) {
      if (re.test(text)) {
        issues.push({
          line,
          msg: `Off-by-one in @media — use ${fix}`,
          text: `@media ${text}`,
        });
      }
    }

    // Custom media tokens should be from allowlist
    const tokens = text.match(/--lp-[a-z0-9-]+/g) || [];
    for (const token of tokens) {
      if (!ALLOWED_CUSTOM_MEDIA.has(token)) {
        issues.push({
          line,
          msg: `Unknown @custom-media token ${token}`,
          text: `@media ${text}`,
        });
      }
    }
  }

  return issues.map(issue => ({ file: rel, ...issue }));
}

const files = walkCssFiles(STYLES_DIR);
if (statSync(PUBLIC_CSS).isFile()) files.push(PUBLIC_CSS);

const allIssues = files.flatMap(checkFile);

if (allIssues.length === 0) {
  console.log('✅ Breakpoint check passed — all @media queries use canonical @custom-media tokens.');
  process.exit(0);
}

console.error(`❌ Breakpoint check failed — ${allIssues.length} issue(s):\n`);
for (const { file, line, msg, text } of allIssues) {
  console.error(`  ${file}:${line}  ${msg}`);
  console.error(`    ${text}\n`);
}
process.exit(1);
