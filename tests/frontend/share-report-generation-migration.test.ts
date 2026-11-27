import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const migrationsPath = new URL('../../worker/migrations/', import.meta.url);

test('migration 0009 keeps open reports open and resolves those an earlier review already handled', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const names = readdirSync(migrationsPath).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
    const index = names.findIndex((name) => name.startsWith('0009_'));
    assert.ok(index > 0, 'migration 0009 exists');
    for (const name of names.slice(0, index)) db.exec(readFileSync(new URL(name, migrationsPath), 'utf8'));

    db.exec(`
      INSERT INTO shared_artworks (id, title, author, delete_token_hash, published_at, gallery_status, gallery_reviewed_at)
      VALUES ('AAAAAAAAAAAA', 'Reviewed', '', 'h', '2026-11-01 00:00:00', 'listed', '2026-11-10 00:00:00'),
             ('BBBBBBBBBBBB', 'Never reviewed', '', 'h', '2026-11-01 00:00:00', 'listed', NULL);
      INSERT INTO share_reports (share_id, reporter_hash, reason, created_at) VALUES
        ('AAAAAAAAAAAA', 'before', 'other', '2026-11-09 00:00:00'),
        ('AAAAAAAAAAAA', 'after', 'other', '2026-11-11 00:00:00'),
        ('BBBBBBBBBBBB', 'any', 'other', '2026-11-05 00:00:00');
    `);
    db.exec(readFileSync(new URL(names[index]!, migrationsPath), 'utf8'));

    const open = db.prepare(`
      SELECT r.reporter_hash AS reporter FROM share_reports r JOIN shared_artworks s ON s.id = r.share_id
      WHERE r.review_generation = s.gallery_review_generation ORDER BY reporter
    `).all() as { reporter: string }[];
    assert.deepEqual(open.map((row) => row.reporter), ['after', 'any']);
  } finally {
    db.close();
  }
});
