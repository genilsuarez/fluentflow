#!/usr/bin/env node
/**
 * Mark a bot prompt as done with a summary.
 * Usage: node scripts/mark-prompt-done.js <folder> <status> "<summary>"
 * Example: node scripts/mark-prompt-done.js 2026-03-19T17-00-19 ok "Fixed locked modules"
 */
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const [folder, status, summary] = process.argv.slice(2);
if (!folder || !status) {
  console.error('Usage: node scripts/mark-prompt-done.js <folder> <status> "<summary>"');
  process.exit(1);
}

const dir = join('bot/prompts', folder);
if (!existsSync(dir)) {
  console.error(`❌ Folder not found: ${dir}`);
  process.exit(1);
}

writeFileSync(join(dir, '.done'), JSON.stringify({
  status,
  ts: new Date().toISOString(),
  summary: (summary || '').slice(0, 500),
}, null, 2), 'utf-8');

writeFileSync(join(dir, 'output.log'), summary || '', 'utf-8');

console.log(`✅ ${folder}/ marked as ${status}`);
