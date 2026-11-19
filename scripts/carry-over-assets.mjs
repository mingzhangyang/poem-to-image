// Run between `vite build` and `wrangler deploy` (see `npm run deploy`).
// Downloads hashed files that the previous deployment served but this build
// no longer contains, so tabs still running the previous bundle keep working,
// and writes dist/asset-manifest.json for the next deploy.
//
// Environment:
//   ASSET_CARRYOVER_ORIGIN         deployment to carry files over from
//                                  (default https://inkpoem.com)
//   ASSET_CARRYOVER_ALLOW_MISSING  set to 1 to deploy even when the previous
//                                  manifest or a retired file cannot be fetched
//                                  (needed once, for the first deploy with this
//                                  script); those files are then not carried over
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exit, env, stderr, stdout } from 'node:process';
import {
  CARRYOVER_DIRECTORIES,
  MANIFEST_FILE,
  RETENTION_DAYS,
  isCarryoverPath,
  parseManifest,
  planCarryover,
} from './asset-carryover.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const origin = (env.ASSET_CARRYOVER_ORIGIN || 'https://inkpoem.com').replace(/\/+$/, '');
const allowMissing = env.ASSET_CARRYOVER_ALLOW_MISSING === '1';
const today = new Date().toISOString().slice(0, 10);
const DOWNLOAD_CONCURRENCY = 8;

function fail(message) {
  stderr.write(`${message}\n`);
  exit(1);
}

function warn(message) {
  stderr.write(`warning: ${message}\n`);
}

async function listCurrentPaths() {
  const paths = [];
  for (const directory of CARRYOVER_DIRECTORIES) {
    let entries;
    try {
      entries = await readdir(path.join(distDir, directory), { withFileTypes: true });
    } catch {
      fail(`dist/${directory} is missing. Run the build before carrying assets over.`);
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const servedPath = `/${directory}/${entry.name}`;
      if (!isCarryoverPath(servedPath)) fail(`Unexpected file name in the build: ${servedPath}`);
      paths.push(servedPath);
    }
  }
  return paths;
}

// The SPA fallback answers missing paths with index.html and status 200, so a
// response only counts if it is not HTML.
function isServedFile(response) {
  const type = response.headers.get('content-type') || '';
  return response.ok && !type.includes('text/html');
}

async function fetchPreviousManifest() {
  const url = `${origin}/${MANIFEST_FILE}`;
  let response;
  try {
    response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
  } catch (error) {
    return { error: `Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!isServedFile(response)) {
    return { error: `${url} is not deployed (status ${response.status}, ${response.headers.get('content-type') || 'no content type'}).` };
  }
  try {
    return { manifest: parseManifest(await response.json()) };
  } catch (error) {
    fail(`${url} is not a valid asset manifest: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function download(servedPath) {
  const response = await fetch(`${origin}${servedPath}`);
  if (!isServedFile(response)) {
    throw new Error(`status ${response.status}, ${response.headers.get('content-type') || 'no content type'}`);
  }
  const target = path.join(distDir, servedPath.slice(1));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}

async function downloadAll(paths) {
  const failures = [];
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const servedPath = paths[next++];
      try {
        await download(servedPath);
      } catch (error) {
        failures.push(`${servedPath} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, paths.length) }, worker));
  return failures;
}

const currentPaths = await listCurrentPaths();
const previous = await fetchPreviousManifest();
if (previous.error) {
  if (!allowMissing) {
    fail(`${previous.error}\nSet ASSET_CARRYOVER_ALLOW_MISSING=1 to deploy without carrying files over `
      + '(expected only for the first deploy with this script).');
  }
  warn(`${previous.error} Deploying without carried-over files.`);
}

const plan = planCarryover({ currentPaths, previous: previous.manifest, today });
const failures = await downloadAll(plan.download);
if (failures.length > 0) {
  const list = failures.map((entry) => `  ${entry}`).join('\n');
  if (!allowMissing) {
    fail(`Could not carry over ${failures.length} retired file(s) from ${origin}:\n${list}\n`
      + 'Set ASSET_CARRYOVER_ALLOW_MISSING=1 to deploy without them.');
  }
  warn(`Skipping ${failures.length} retired file(s) that could not be fetched:\n${list}`);
  const skipped = new Set(failures.map((entry) => entry.split(' ')[0]));
  for (const servedPath of skipped) delete plan.manifest.retired[servedPath];
}

await writeFile(path.join(distDir, MANIFEST_FILE), `${JSON.stringify(plan.manifest, null, 2)}\n`);
stdout.write(`${[
  `Asset carry-over from ${origin} (retention ${RETENTION_DAYS} days):`,
  `  current files: ${plan.manifest.current.length}`,
  `  carried over: ${Object.keys(plan.manifest.retired).length}`,
  `  expired: ${plan.expired.length}`,
].join('\n')}\n`);
