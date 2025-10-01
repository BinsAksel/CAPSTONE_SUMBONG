#!/usr/bin/env node
/**
 * Audit external origins referenced in the built frontend.
 * Usage: node scripts/auditExternalOrigins.js [buildDir]
 * Default buildDir: ./build
 */
const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(process.argv[2] || 'build');
if (!fs.existsSync(buildDir)) {
  console.error('Build directory not found:', buildDir);
  process.exit(1);
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}

const exts = ['.html', '.js', '.css'];
const files = walk(buildDir).filter(f => exts.includes(path.extname(f)));

const originRegex = /(https?:\/\/[^"'\s)]+)|url\((https?:[^)]+)\)/g;
const origins = new Set();

files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = originRegex.exec(content)) !== null) {
      const raw = (m[1] || m[2] || '').replace(/['"()]/g, '');
      if (!raw) continue;
      try {
        const u = new URL(raw);
        // Ignore same-origin placeholders
        origins.add(u.origin);
      } catch (_) {}
    }
  } catch (e) {
    console.warn('Read failed', file, e.message);
  }
});

const sorted = Array.from(origins).sort();
console.log('\nExternal origins found (' + sorted.length + '):');
console.log(sorted.join('\n'));
console.log('\nReview these: ensure all are expected and whitelisted in CSP.');
