import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = path.resolve(import.meta.dirname, '..');
const publicDirectory = path.join(projectRoot, 'public');
const manifestPath = path.join(projectRoot, 'src/ornaments/manifest.json');
const thumbnailDirectory = path.join(publicDirectory, 'ornaments/thumbs');

async function modifiedAt(file) {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return null;
  }
}

export async function generateOrnamentThumbnails() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await mkdir(thumbnailDirectory, { recursive: true });

  // Drop thumbnails of ornaments that were removed or renamed in the manifest.
  const expected = new Set(manifest.map(item => `${item.id}.webp`));
  for (const name of await readdir(thumbnailDirectory)) {
    if (!expected.has(name)) await rm(path.join(thumbnailDirectory, name), { recursive: true, force: true });
  }

  for (const item of manifest) {
    const source = path.join(publicDirectory, item.file);
    const target = path.join(thumbnailDirectory, `${item.id}.webp`);
    const original = sharp(source);
    const { width, height, hasAlpha } = await original.metadata();
    if (!hasAlpha || Math.min(width, height) < 1024) {
      throw new Error(`Ornament ${item.id} requires an alpha channel and dimensions of at least 1024 × 1024.`);
    }
    const targetModified = await modifiedAt(target);
    if (targetModified !== null && targetModified >= (await stat(source)).mtimeMs) continue;
    await original.resize(144, 144, { fit: 'inside' })
      .webp()
      .toFile(target);
  }
}
