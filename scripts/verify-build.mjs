import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { stdout } from 'node:process';
import { previewBudgets } from './asset-budgets.mjs';
import { MANIFEST_FILE } from './asset-carryover.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const indexPath = path.join(distDir, 'index.html');
const headersPath = path.join(distDir, '_headers');
const previewDir = path.join(distDir, 'template-previews');

const limits = {
  initialJavaScriptGzip: 210 * 1024,
  initialCssGzip: 20 * 1024,
};

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function gzipBytes(filePath) {
  return gzipSync(await readFile(filePath)).byteLength;
}

const [indexHtml, headers] = await Promise.all([
  readFile(indexPath, 'utf8'),
  readFile(headersPath, 'utf8'),
]);

const requiredHeaderRules = [
  'Cache-Control: public, max-age=0, must-revalidate',
  'X-Content-Type-Options: nosniff',
  'X-Frame-Options: DENY',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy: same-origin',
  "Content-Security-Policy: base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  '/assets/*',
  '/template-previews/*',
  'Cache-Control: public, max-age=31536000, immutable',
];

for (const rule of requiredHeaderRules) {
  invariant(headers.includes(rule), `dist/_headers is missing: ${rule}`);
}

const eagerJavaScript = new Set(
  [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.js)"/g)].map((match) => match[1]),
);
const eagerCss = new Set(
  [...indexHtml.matchAll(/href="(\/assets\/[^"?]+\.css)"/g)].map((match) => match[1]),
);

invariant(eagerJavaScript.size > 0, 'No eager JavaScript entry was found in dist/index.html.');
invariant(eagerCss.size > 0, 'No eager stylesheet was found in dist/index.html.');

const initialJavaScriptGzip = (
  await Promise.all([...eagerJavaScript].map((asset) => gzipBytes(path.join(distDir, asset))))
).reduce((total, size) => total + size, 0);
const initialCssGzip = (
  await Promise.all([...eagerCss].map((asset) => gzipBytes(path.join(distDir, asset))))
).reduce((total, size) => total + size, 0);

invariant(
  initialJavaScriptGzip <= limits.initialJavaScriptGzip,
  `Initial JavaScript is ${formatKiB(initialJavaScriptGzip)} gzip; budget is ${formatKiB(limits.initialJavaScriptGzip)}.`,
);
invariant(
  initialCssGzip <= limits.initialCssGzip,
  `Initial CSS is ${formatKiB(initialCssGzip)} gzip; budget is ${formatKiB(limits.initialCssGzip)}.`,
);

// After `npm run deploy`, dist also holds previews carried over from the
// previous deployment; budgets apply only to the current build.
let retiredPaths = new Set();
try {
  const manifest = JSON.parse(await readFile(path.join(distDir, MANIFEST_FILE), 'utf8'));
  retiredPaths = new Set(Object.keys(manifest.retired ?? {}));
} catch {
  // No manifest: a plain build without carried-over files.
}

const previewFiles = (await readdir(previewDir))
  .filter((name) => name.endsWith('.webp') && !retiredPaths.has(`/template-previews/${name}`));
invariant(previewFiles.length > 0, 'No WebP template previews were emitted.');

const previewSizes = await Promise.all(
  previewFiles.map(async (name) => ({ name, size: (await stat(path.join(previewDir, name))).size })),
);
for (const preview of previewSizes) {
  invariant(
    preview.size <= previewBudgets.maxFileBytes,
    `${preview.name} is ${formatKiB(preview.size)}; per-preview budget is ${formatKiB(previewBudgets.maxFileBytes)}.`,
  );
}

const previewTotal = previewSizes.reduce((total, preview) => total + preview.size, 0);
const previewAverage = previewTotal / previewSizes.length;
invariant(
  previewAverage <= previewBudgets.maxAverageBytes,
  `Template previews average ${formatKiB(previewAverage)}; budget is ${formatKiB(previewBudgets.maxAverageBytes)}.`,
);

stdout.write(`${[
  `Initial JavaScript: ${formatKiB(initialJavaScriptGzip)} gzip / ${formatKiB(limits.initialJavaScriptGzip)}`,
  `Initial CSS: ${formatKiB(initialCssGzip)} gzip / ${formatKiB(limits.initialCssGzip)}`,
  `Template previews: ${previewFiles.length} files, ${formatKiB(previewTotal)} total, `
    + `${formatKiB(previewAverage)} average / ${formatKiB(previewBudgets.maxAverageBytes)}`,
  'Security and immutable-cache header rules: present',
].join('\n')}\n`);
