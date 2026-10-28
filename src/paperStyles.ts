import type { CSSProperties } from 'react';

/**
 * Small, self-contained paper tiles. Unlike SVG filter noise these render the
 * same way in a CSS preview and a Canvas 2D export (including Safari).
 * No remote assets, blob URLs or generated image bytes enter saved templates.
 */
export const PAPER_STYLES = [
  { id: 'grid', labelZh: '方格稿纸', labelEn: 'Grid paper', base: '#FDFBF7', ink: '#7182A1', density: 8 },
  { id: 'dot', labelZh: '点阵稿纸', labelEn: 'Dot paper', base: '#F8F4E9', ink: '#8A8176', density: 9 },
  { id: 'ivory', labelZh: '象牙素笺', labelEn: 'Ivory', base: '#FDFBF7', ink: '#9D8E75', density: 12 },
  { id: 'rice', labelZh: '手工宣纸', labelEn: 'Rice paper', base: '#F4EBD9', ink: '#A18864', density: 46 },
  { id: 'textured', labelZh: '细纹棉纸', labelEn: 'Textured cotton', base: '#F5F5F0', ink: '#8B8C80', density: 52 },
  { id: 'kraft', labelZh: '牛皮纸', labelEn: 'Kraft paper', base: '#D8BF98', ink: '#684A2C', density: 62 },
  { id: 'parchment', labelZh: '复古羊皮纸', labelEn: 'Parchment', base: '#EFE3CE', ink: '#A57952', density: 54 },
  { id: 'mist-cotton', labelZh: '雾蓝棉纸', labelEn: 'Mist-blue cotton', base: '#E7F0F2', ink: '#698E9D', density: 42 },
  { id: 'lined', labelZh: '手写信纸', labelEn: 'Writing paper', base: '#FCFAF4', ink: '#7C9AB7', density: 14 },
] as const;

export type PaperId = (typeof PAPER_STYLES)[number]['id'];
export const DEFAULT_PAPER_ID: PaperId = 'rice';

export function getPaperStyle(id: PaperId | string | undefined) {
  return PAPER_STYLES.find((paper) => paper.id === id) ?? PAPER_STYLES[1];
}

const tileCache = new Map<PaperId, string>();
const TILE_SIZE = 240;

function tileSvg(id: PaperId): string {
  const paper = getPaperStyle(id);
  let seed = PAPER_STYLES.findIndex((item) => item.id === id) + 137;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const lines: string[] = [];
  const count = paper.density;
  for (let i = 0; i < count; i++) {
    const x = Math.round(rand() * TILE_SIZE);
    const y = Math.round(rand() * TILE_SIZE);
    const length = 3 + Math.round(rand() * (id === 'rice' ? 22 : 12));
    const slope = id === 'textured' || id === 'mist-cotton' ? -2 + rand() * 4 : -5 + rand() * 10;
    const opacity = (0.045 + rand() * (id === 'ivory' ? 0.035 : 0.11)).toFixed(3);
    lines.push(`<path d="M${x} ${y}l${length} ${slope.toFixed(1)}" stroke="${paper.ink}" stroke-width=".8" stroke-opacity="${opacity}" stroke-linecap="round"/>`);
    if (i % 2 === 0) {
      const radius = (0.35 + rand() * 0.85).toFixed(2);
      lines.push(`<circle cx="${Math.round(rand() * TILE_SIZE)}" cy="${Math.round(rand() * TILE_SIZE)}" r="${radius}" fill="${paper.ink}" fill-opacity="${(Number(opacity) * 0.7).toFixed(3)}"/>`);
    }
  }
  if (id === 'grid') {
    for (let n = 0; n < TILE_SIZE; n += 30) {
      lines.push(`<path d="M${n} 0V240M0 ${n}H240" stroke="#7182A1" stroke-opacity=".12" stroke-width="1"/>`);
    }
  }
  if (id === 'dot') {
    for (let y = 12; y < TILE_SIZE; y += 24) {
      for (let x = 12; x < TILE_SIZE; x += 24) {
        lines.push(`<circle cx="${x}" cy="${y}" r="1.25" fill="#8A8176" fill-opacity=".28"/>`);
      }
    }
  }
  if (id === 'lined') {
    // Lines are repeated on exactly the same 240px grid as the export tile.
    for (let y = 40; y < TILE_SIZE; y += 40) {
      lines.push(`<path d="M0 ${y}H240" stroke="#7291AB" stroke-opacity=".23" stroke-width="1"/>`);
    }
    lines.push('<path d="M30 0V240" stroke="#B46D68" stroke-opacity=".18" stroke-width="1.5"/>');
  }
  if (id === 'parchment') {
    for (let i = 0; i < 7; i++) {
      lines.push(`<ellipse cx="${Math.round(rand() * TILE_SIZE)}" cy="${Math.round(rand() * TILE_SIZE)}" rx="${Math.round(8 + rand() * 22)}" ry="${Math.round(4 + rand() * 12)}" fill="#AD7E50" fill-opacity=".025"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}">${lines.join('')}</svg>`;
}

/** Shared by the browser preview and the exact same Canvas background tile. */
export function paperTextureUrl(id: PaperId | string | undefined): string {
  const paper = getPaperStyle(id);
  let cached = tileCache.get(paper.id);
  if (!cached) {
    cached = `data:image/svg+xml,${encodeURIComponent(tileSvg(paper.id))}`;
    tileCache.set(paper.id, cached);
  }
  return cached;
}

export function paperPreviewStyle(id: PaperId | string | undefined): CSSProperties {
  const paper = getPaperStyle(id);
  return {
    backgroundColor: paper.base,
    backgroundImage: `url("${paperTextureUrl(paper.id)}")`,
    backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
    backgroundRepeat: 'repeat',
    backgroundPosition: 'top left',
  };
}
