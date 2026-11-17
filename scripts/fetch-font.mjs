/** Download a pinned font. Cloudflare builds often reach .tw hosts slowly. */
export async function fetchFontBytes(url, label, timeoutMs = 240000) {
  const attempts = 2;
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
