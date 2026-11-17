import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFontBytes } from './fetch-font.mjs';
const destination = fileURLToPath(new URL('../public/fonts/CNS-Seal.ttf', import.meta.url));
const source = 'https://www.cns11643.gov.tw/download/%E5%AD%97%E5%9E%8B%E4%B8%8B%E8%BC%89%601q%60%E8%AA%AA%E6%96%87%E8%A7%A3%E5%AD%97True%60w%60Type%E5%AD%97%E5%9E%8B/name/ebas927.ttf';
const verify = bytes => {
  if (bytes.length !== 10381759 || createHash('sha256').update(bytes).digest('hex') !== 'e8501dc9747190936a222576c9b0b6f918ff335afa5696c3fda3acba1a9574e2') throw Error('CNS Seal integrity mismatch');
};
let cached = false;
try { verify(await readFile(destination)); cached = true; } catch (error) {
  if (error.code !== 'ENOENT' && error.message !== 'CNS Seal integrity mismatch') throw error;
}
if (!cached) {
  const bytes = await fetchFontBytes(source, 'CNS Seal');
  verify(bytes);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  try { await writeFile(temporary, bytes); await rename(temporary, destination); }
  finally { await rm(temporary, { force: true }); }
}
console.log('CNS Seal: verified original official font (same-origin)');
