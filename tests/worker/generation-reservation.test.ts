import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DuplicateGenerationRequestError,
  InsufficientCreditsError,
  reserveGeneration,
  type D1Database,
  type D1PreparedStatement,
  type D1Result,
} from '../../worker/db';

function result(changes: number): D1Result {
  return {
    results: [],
    success: true,
    meta: { changes, last_row_id: 0, duration: 0 },
  };
}

class FakeStatement implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(private readonly db: FakeD1Database, private readonly sql: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  async first<T = unknown>(): Promise<T | null> {
    if (this.sql.startsWith('SELECT user_id, status FROM generation_requests')) {
      const request = this.db.requests.get(this.values[0] as string);
      return (request ? { user_id: request.userId, status: request.status } : null) as T | null;
    }

    if (this.sql.startsWith('SELECT balance FROM credit_accounts')) {
      return { balance: this.db.balance } as T;
    }

    return null;
  }

  async run(): Promise<D1Result> {
    if (this.sql.startsWith('INSERT OR IGNORE INTO generation_requests')) {
      const [id, userId, , , , status] = this.values as string[];
      if (this.db.requests.has(id)) return result(0);
      this.db.requests.set(id, { userId, status });
      return result(1);
    }

    if (this.sql.startsWith('UPDATE credit_accounts SET balance = balance -')) {
      const [costCredits, , minimumBalance] = this.values as number[];
      if (this.db.balance < minimumBalance) return result(0);
      this.db.balance -= costCredits;
      return result(1);
    }

    if (this.sql.startsWith('UPDATE credit_accounts SET balance = balance +')) {
      const [costCredits] = this.values as number[];
      this.db.balance += costCredits;
      return result(1);
    }

    if (this.sql.startsWith('UPDATE generation_requests SET status = ?')) {
      const [status, , id] = this.values as string[];
      const request = this.db.requests.get(id);
      if (!request) return result(0);
      request.status = status;
      return result(1);
    }

    if (this.sql.startsWith('INSERT INTO credit_transactions')) {
      const [id, userId, , amount] = this.values as [string, string, string, number];
      this.db.transactions.push({ id, userId, amount });
      return result(1);
    }

    return result(0);
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    return { ...result(0), results: [] };
  }
}

class FakeD1Database implements D1Database {
  requests = new Map<string, { userId: string; status: string }>();
  transactions: Array<{ id: string; userId: string; amount: number }> = [];

  constructor(public balance: number) {}

  prepare(sql: string): D1PreparedStatement {
    return new FakeStatement(this, sql);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const statement of statements) {
      results.push((await statement.run()) as D1Result<T>);
    }
    return results;
  }

  async exec(): Promise<{ count: number; duration: number }> {
    return { count: 0, duration: 0 };
  }
}

test('reserveGeneration uses the client request ID and deducts once', async () => {
  const db = new FakeD1Database(5);

  const reserved = await reserveGeneration(db, 'user_1', 'req_1', 'openai', 20, 1);

  assert.equal(reserved.requestId, 'req_1');
  assert.equal(db.balance, 4);
  assert.equal(db.transactions.length, 1);
});

test('reserveGeneration rejects duplicate request IDs without another deduction', async () => {
  const db = new FakeD1Database(5);

  await reserveGeneration(db, 'user_1', 'req_1', 'openai', 20, 1);
  await assert.rejects(
    () => reserveGeneration(db, 'user_1', 'req_1', 'openai', 20, 1),
    DuplicateGenerationRequestError,
  );

  assert.equal(db.balance, 4);
  assert.equal(db.transactions.length, 1);
});

test('reserveGeneration marks insufficient-credit requests failed without deducting', async () => {
  const db = new FakeD1Database(0);

  await assert.rejects(
    () => reserveGeneration(db, 'user_1', 'req_1', 'openai', 20, 1),
    InsufficientCreditsError,
  );

  assert.equal(db.balance, 0);
  assert.equal(db.requests.get('req_1')?.status, 'failed');
  assert.equal(db.transactions.length, 0);
});
