import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PAPER_ID, getPaperStyle, PAPER_STYLES, paperPreviewStyle, paperTextureUrl } from '../../src/paperStyles';

test('all nine paper types have distinct, valid identifiers and readable colors', () => {
  assert.equal(PAPER_STYLES.length, 9);
  assert.equal(new Set(PAPER_STYLES.map((paper) => paper.id)).size, PAPER_STYLES.length);
  for (const paper of PAPER_STYLES) {
    assert.match(paper.base, /^#[0-9A-F]{6}$/i);
    assert.ok(paper.labelZh && paper.labelEn);
  }
});

test('paper texture is deterministic, local, and identical in the preview style', () => {
  for (const paper of PAPER_STYLES) {
    const url = paperTextureUrl(paper.id);
    const style = paperPreviewStyle(paper.id);
    assert.equal(url, paperTextureUrl(paper.id));
    assert.equal(style.backgroundImage, `url("${url}")`);
    assert.equal(style.backgroundColor, paper.base);
    assert.equal(style.backgroundSize, '240px 240px');

    const svg = decodeURIComponent(url.slice('data:image/svg+xml,'.length));
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.endsWith('</svg>'));
    assert.doesNotMatch(svg, /<image|<foreignObject|<filter|<script|(?:xlink:)?href=|url\(/);
  }
});

test('older saved templates without a paper ID safely default to rice paper', () => {
  assert.equal(getPaperStyle(undefined).id, DEFAULT_PAPER_ID);
  assert.equal(getPaperStyle('unknown').id, DEFAULT_PAPER_ID);
});
