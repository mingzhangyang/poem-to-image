/** Download a pinned font. Cloudflare builds often reach .tw hosts slowly. */
export async function fetchFontBytes(url, label, timeoutMs = 240000, attempts = 2) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    console.log(`${label}: downloading attempt ${attempt}/${attempts}`);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'inkpoem-font-sync' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`${label}: received ${bytes.length} bytes in ${seconds}s`);
      return bytes;
    } catch (error) {
      last = error;
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      const detail = error?.cause?.message || error?.message || String(error);
      console.error(`${label}: attempt ${attempt} failed after ${seconds}s (${error?.name || 'Error'}: ${detail})`);
    }
  }
  throw new Error(`${label} could not be downloaded`, { cause: last });
}

/** First use the original bytes already shipped by our sites, then the official source.
 * Mirrors serve raw fonts even when the official source is a ZIP archive.
 * Never accept a mirror (or an SPA HTML response) without the pinned integrity check.
 */
export async function fetchPinnedFontBytes({ name, file, url, decode, verify, download = fetchFontBytes }) {
  const sources = [
    { url: `https://seal.orangely.xyz/fonts/${file}`, timeout: 90000, attempts: 1 },
    { url: `https://inkpoem.com/fonts/${file}`, timeout: 90000, attempts: 1 },
    { url, decode, timeout: 240000, attempts: 2 },
  ];
  const failures = [];
  for (const source of sources) {
    const label = `${name} (${source.url})`;
    try {
      const raw = await download(source.url, label, source.timeout, source.attempts);
      const bytes = source.decode ? source.decode(raw) : raw;
      verify(bytes);
      console.log(`${label}: verified pinned font`);
      return bytes;
    } catch (error) {
      const detail = error?.cause?.message || error?.message || String(error);
      failures.push(`${source.url}: ${detail}`);
      console.warn(`${label}: rejected source (${detail})`);
    }
  }
  throw new Error(`${name}: no verified font source succeeded:\n${failures.join('\n')}`);
}
