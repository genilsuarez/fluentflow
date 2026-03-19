/**
 * Send a message to Telegram chat.
 * Usage: node scripts/utils/telegram-notify.js "message text"
 *
 * Reads TELEGRAM_BOT_TOKEN and ALLOWED_CHAT_ID from bot/.env
 * Sends to the first chat ID in ALLOWED_CHAT_ID.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../../bot/.env');

function loadEnv() {
  const content = readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function sendTelegram(token, chatId, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const message = process.argv[2];
if (!message) {
  console.error('Usage: node telegram-notify.js "message"');
  process.exit(1);
}

const env = loadEnv();
const token = env.TELEGRAM_BOT_TOKEN;
const chatIds = env.ALLOWED_CHAT_ID?.split(',').map(id => id.trim()).filter(Boolean) || [];

if (!token || chatIds.length === 0) {
  console.error('Missing TELEGRAM_BOT_TOKEN or ALLOWED_CHAT_ID in bot/.env');
  process.exit(1);
}

try {
  const results = await Promise.all(chatIds.map(id => sendTelegram(token, id, message)));
  const errors = results.filter(r => { try { return !JSON.parse(r).ok; } catch { return true; } });
  if (errors.length > 0) {
    console.error('❌ Some messages failed:', errors);
    process.exit(1);
  }
  console.log(`✅ Telegram message sent to ${chatIds.length} chat(s)`);
} catch (err) {
  console.error('⚠️ Failed to send:', err.message);
  process.exit(1);
}
