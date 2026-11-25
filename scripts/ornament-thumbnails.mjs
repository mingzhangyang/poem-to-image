import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const thumbnailDirectory = 'public/ornaments/thumbs';

export async function generateOrnamentThumbnails() {
  const manifest = JSON.parse(await readFile('src/ornaments/manifest.json', 'utf8'));
  await mkdir(thumbnailDirectory, { recursive: true });
  for (const item of manifest) {
    const original = sharp('public' + item.file);
    const { width, height, hasAlpha } = await original.metadata();
    if (!hasAlpha || Math.min(width, height) < 1024) {
      throw new Error(`Ornament ${item.id} requires an alpha channel and dimensions of at least 1024 × 1024.`);
    }
    await original.resize(144, 144, { fit: 'inside' })
      .webp()
      .toFile(`${thumbnailDirectory}/${item.id}.webp`);
  }
}
