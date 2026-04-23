/**
 * Resolves BOT_ROOT from workspaces.json — single source of truth.
 * Works regardless of where bot/ lives relative to this project.
 *
 * Usage in scripts:
 *   const { botSrc } = await import('../bot-path.js');
 *   const { getNotifications } = await import(`${botSrc}/config.js`);
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Try workspaces.json first (bot project config)
function resolveBotRoot() {
  // Look for workspaces.json relative to common parent dirs
  const candidates = [
    join(__dirname, '../../bot/config/workspaces.json'), // bot/ sibling of English6/
    join(__dirname, '../bot/config/workspaces.json'),    // bot/ inside English6/ (legacy)
  ];

  for (const wsFile of candidates) {
    if (existsSync(wsFile)) {
      try {
        const data = JSON.parse(readFileSync(wsFile, 'utf-8'));
        const active = data.workspaces?.[data.active];
        if (active?.path) {
          // Return the bot root (parent of the workspace path's config)
          return dirname(dirname(wsFile)); // workspaces.json → config/ → bot/
        }
      } catch { /* continue */ }
    }
  }

  // Fallback: assume bot/ is sibling of English6/
  return join(__dirname, '../../bot');
}

export const BOT_ROOT = resolveBotRoot();
export const botSrc = join(BOT_ROOT, 'src');
