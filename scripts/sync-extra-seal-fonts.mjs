import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFontBytes } from './fetch-font.mjs';

/** Unmodified upstream bytes. CC BY-ND faces must not be subset or rewritten. */
const FACES = [
  {
    name: 'Chongxi Seal',
    url: 'https://xiaoxue.iis.sinica.edu.tw/chongxi/files/chongxi_seal.zip',
    entry: 'chongxi_seal.otf',
    file: '../public/fonts/Chongxi-Seal.otf',
    size: 21817868,
    sha256: 'b5f52fe62e84b2b18ff4b586d9838d157e05925eca847ecd48c915ba4dcd735a',
  },
  {
    name: 'MOE Clerical',
    url: 'https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/MoeLI-3.0.zip',
    entry: null,
    file: '../public/fonts/MOE-Li.ttf',
    size: 5243908,
    sha256: 'f0ba5eda31727ad89cc0b1f6b9a7dfda02f061fa101c18548b6f8ea0145c108b',
  },
  {
    name: 'Chine-Culture Jinwen',
    url: 'https://chine-culture.com/sites/default/files/polices/chine-culture/Chine-Culture-Jinwen-1.000.zip',
    entry: 'Chine-Culture-Jinwen-1.000/Chine-Culture-Jinwen.otf',
    file: '../public/fonts/Chine-Culture-Jinwen.otf',
    size: 713208,
    sha256: '2cc032e29e5ac9d40a91b5f02390996e446e06733eebe48c4ce3df0aee582363',
  },
];

function verify(face, bytes) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== face.size || sha256 !== face.sha256) {
    throw new Error(`${face.name} integrity mismatch: bytes=${bytes.length}, sha256=${sha256}`);
  }
}

function unzipEntry(zip, wanted) {
  let offset = 0;
  while (offset + 30 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const flags = zip.readUInt16LE(offset + 6);
    const method = zip.readUInt16LE(offset + 8);
    const compressed = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extraLength;
    if (flags & 0x8) throw new Error(`Zip entry ${name} has a data descriptor`);
    const raw = zip.subarray(start, start + compressed);
    const match = wanted ? name === wanted : name.toLowerCase().endsWith('.ttf') || name.toLowerCase().endsWith('.otf');
    if (match) {
      if (method === 0) return Buffer.from(raw);
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`Unsupported zip method ${method} for ${name}`);
    }
    offset = start + compressed;
  }
  throw new Error(`Missing font entry${wanted ? `: ${wanted}` : ''}`);
}

async function install(face) {
  const destination = fileURLToPath(new URL(face.file, import.meta.url));
  try {
    verify(face, await readFile(destination));
    console.log(`${face.name}: verified cached font (same-origin)`);
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT' && !String(error?.message).includes('integrity mismatch')) throw error;
  }
  const zip = await fetchFontBytes(face.url, face.name);
  const bytes = unzipEntry(zip, face.entry);
  verify(face, bytes);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(`${face.name}: verified original font (same-origin)`);
}

for (const face of FACES) await install(face);
