import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(import.meta.dirname, '..');
const publicDirectory = path.join(projectRoot, 'public');
const manifestPath = path.join(projectRoot, 'src/ornaments/manifest.json');

/** Pixels fainter than this alpha (out of 255) are haze, not visible ink. */
const VISIBLE_ALPHA = 16;

/**
 * The visible part of an ornament as [left, top, right, bottom] fractions of
 * its square layout box. Preview and export both fit the image into a
 * size × size square, centred, so non-square images are letterboxed. Edges
 * are rounded outward so the box never cuts into visible pixels.
 */
export async function measureOrnamentContent(file) {
  const { data, info } = await sharp(path.join(publicDirectory, file))
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[y * width + x] < VISIBLE_ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error(`Ornament ${file} has no visible pixels.`);
  const side = Math.max(width, height);
  const offsetX = (side - width) / 2;
  const offsetY = (side - height) / 2;
  const floor = value => Math.max(0, Math.floor(value * 1000) / 1000);
  const ceil = value => Math.min(1, Math.ceil(value * 1000) / 1000);
  return [
    floor((offsetX + minX) / side),
    floor((offsetY + minY) / side),
    ceil((offsetX + maxX + 1) / side),
    ceil((offsetY + maxY + 1) / side),
  ];
}

/** Rewrites every manifest entry's `content` box from its image. */
export async function updateManifestContent() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const item of manifest) item.content = await measureOrnamentContent(item.file);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await updateManifestContent();
}
