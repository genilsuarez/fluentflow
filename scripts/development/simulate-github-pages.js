#!/usr/bin/env node

/**
 * GitHub Pages Simulation Server
 * Simulates exactly how GitHub Pages serves the built files
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { colors, log } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create GitHub Pages simulation server
 */
function createGitHubPagesServer() {
  const app = express();
  const port = 4174; // Different from vite preview (4173)
  const distPath = path.resolve(__dirname, '../../dist');

  // Check if dist exists
  if (!fs.existsSync(distPath)) {
    log('❌ dist/ directory not found. Run "npm run build" first.', colors.red);
    process.exit(1);
  }

  // Middleware to log requests (like GitHub Pages)
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    log(`[${timestamp}] ${req.method} ${req.url}`, colors.blue);
    next();
  });

  // Simulate GitHub Pages base path behavior
  app.use('/fluentflow', express.static(distPath, {
    // GitHub Pages headers simulation
    setHeaders: (res, filePath) => {
      // Simulate GitHub Pages cache headers
      if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }

      // CORS headers (GitHub Pages allows CORS)
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Security headers (similar to GitHub Pages)
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }
  }));

  // Root redirect (like GitHub Pages)
  app.get('/', (req, res) => {
    res.redirect('/fluentflow/');
  });

  // Handle SPA routing (GitHub Pages behavior for 404s)
  app.use((req, res, next) => {
    // Only handle requests that start with /fluentflow
    if (!req.path.startsWith('/fluentflow')) {
      return next();
    }

    // Skip if this is a static file request that should be handled by express.static
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      return next();
    }

    const filePath = path.join(distPath, req.path.replace('/fluentflow', ''));

    // If file exists, serve it
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return next();
    }

    // Otherwise serve index.html (SPA fallback)
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Not Found');
    }
  });

  // Error handling
  app.use((err, req, res, next) => {
    log(`❌ Error serving ${req.url}: ${err.message}`, colors.red);
    res.status(500).send('Internal Server Error');
  });

  return { app, port };
}

/**
 * Start the simulation server
 */
function startServer() {
  const { app, port } = createGitHubPagesServer();

  const server = app.listen(port, () => {
    console.log('');
    log('🚀 GitHub Pages Simulation Server', colors.cyan);
    log('='.repeat(50), colors.cyan);
    log(`📍 Local URL:    http://localhost:${port}/fluentflow/`, colors.green);
    log(`🌐 Simulates:    https://genilsuarez.github.io/fluentflow/`, colors.blue);
    log(`📁 Serving:      dist/`, colors.yellow);
    log('='.repeat(50), colors.cyan);
    log('');
    log('💡 This server simulates GitHub Pages exactly:', colors.blue);
    log('  • Same base path (/fluentflow/)', colors.blue);
    log('  • Same static file serving', colors.blue);
    log('  • Same cache headers', colors.blue);
    log('  • Same SPA fallback behavior', colors.blue);
    log('');
    log('🔍 Use this to debug production issues locally!', colors.yellow);
    log('');
    log('Press Ctrl+C to stop', colors.cyan);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('\n👋 Shutting down GitHub Pages simulation server...', colors.yellow);
    server.close(() => {
      log('✅ Server stopped', colors.green);
      process.exit(0);
    });
  });

  return server;
}

/**
 * Analyze the built files
 */
function analyzeBuiltFiles() {
  const distPath = path.resolve(__dirname, '../../dist');
  const indexPath = path.join(distPath, 'index.html');

  if (!fs.existsSync(indexPath)) {
    log('❌ index.html not found in dist/', colors.red);
    return;
  }

  const html = fs.readFileSync(indexPath, 'utf8');

  log('📋 Built Files Analysis:', colors.cyan);
  log('='.repeat(30), colors.cyan);

  // Extract script tags
  const scriptMatches = html.match(/<script[^>]*src="[^"]*"[^>]*>/g) || [];
  const scripts = scriptMatches.map(script => {
    const srcMatch = script.match(/src="([^"]*)"/);
    return srcMatch ? srcMatch[1] : null;
  }).filter(Boolean);

  log(`📜 Scripts (${scripts.length}):`, colors.blue);
  scripts.forEach((script, index) => {
    const filename = path.basename(script);
    const isMain = script.includes('index-');
    const isVendor = script.includes('vendor-');
    const marker = isMain ? '🎯' : isVendor ? '📦' : '🧩';
    log(`  ${index + 1}. ${marker} ${filename}`, colors.green);
  });

  // Extract preload links
  const preloadMatches = html.match(/<link[^>]*rel="modulepreload"[^>]*>/g) || [];
  const preloads = preloadMatches.map(link => {
    const hrefMatch = link.match(/href="([^"]*)"/);
    return hrefMatch ? hrefMatch[1] : null;
  }).filter(Boolean);

  if (preloads.length > 0) {
    log(`🔗 Preloads (${preloads.length}):`, colors.blue);
    preloads.forEach((preload, index) => {
      const filename = path.basename(preload);
      log(`  ${index + 1}. ⚡ ${filename}`, colors.yellow);
    });
  }

  log('');
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'analyze') {
    analyzeBuiltFiles();
    return;
  }

  // Analyze first, then start server
  analyzeBuiltFiles();
  startServer();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createGitHubPagesServer, analyzeBuiltFiles };