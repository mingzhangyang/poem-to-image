import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const schemaPath = new URL('../../worker/schema.sql', import.meta.url);
const migrationsPath = new URL('../../worker/migrations/', import.meta.url);

function schemaDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(schemaPath, 'utf8'));
  return db;
}

function migrationsDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const name of readdirSync(migrationsPath).filter((item) => /^\d+_.*\.sql$/.test(item)).sort()) {
    db.exec(readFileSync(new URL(name, migrationsPath), 'utf8'));
  }
  return db;
}

function columns(db: DatabaseSync, table: string): string[] {
  return (db.prepare("PRAGMA table_info('" + table + "')").all() as { name: string }[])
    .map((item) => item.name).sort();
}

test('standalone schema agrees with actual numbered D1 migrations for billing and published art', () => {
  const schema = schemaDatabase();
  const migration = migrationsDatabase();
  try {
    for (const table of ['orders', 'shared_artworks', 'shared_artwork_upload_attempts']) {
      assert.deepEqual(columns(schema, table), columns(migration, table),
        table + ' must have identical columns when initialized from schema.sql or migrations');
    }
    assert.ok(columns(schema, 'shared_artworks').includes('published_at'));
    assert.ok(!columns(schema, 'orders').includes('published_at'),
      'publication timestamp belongs to shared_artworks, never payment orders');
  } finally {
    schema.close();
    migration.close();
  }
});
