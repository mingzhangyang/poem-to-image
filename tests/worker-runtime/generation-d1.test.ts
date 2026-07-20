import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DuplicateGenerationRequestError,
  InsufficientCreditsError,
  ensureUser,
  finalizeGenerationFailure,
  finalizeGenerationSuccess,
  getBalance,
  reserveGeneration,
} from '../../worker/db';

const USER_ID = 'user_generation_test';

async function resetGenerationData(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM credit_transactions'),
    env.DB.prepare('DELETE FROM generation_requests'),
    env.DB.prepare('DELETE FROM credit_accounts'),
    env.DB.prepare('DELETE FROM users'),
  ]);
  await ensureUser(env.DB, USER_ID, 'generation@example.test');
}

async function setBalance(balance: number): Promise<void> {
  await env.DB
    .prepare('UPDATE credit_accounts SET balance = ? WHERE user_id = ?')
    .bind(balance, USER_ID)
    .run();
}

beforeEach(resetGenerationData);

describe('generation credit reservations against D1', () => {
  it('reserves one debit and rejects a duplicate request without charging twice', async () => {
    await setBalance(5);
    const reservation = await reserveGeneration(env.DB, USER_ID, 'request_once', 'gemini', 12, 1);

    await expect(
      reserveGeneration(env.DB, USER_ID, 'request_once', 'gemini', 12, 1),
    ).rejects.toBeInstanceOf(DuplicateGenerationRequestError);
    expect(await getBalance(env.DB, USER_ID)).toBe(4);

    const count = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count FROM credit_transactions
         WHERE related_request_id = ? AND type = 'generate_debit'`,
      )
      .bind(reservation.requestId)
      .first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it('does not overdraw when concurrent requests compete for the last credits', async () => {
    await setBalance(3);
    const attempts = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) => (
        reserveGeneration(env.DB, USER_ID, `request_race_${index}`, 'gemini', 12, 1)
      )),
    );

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(3);
    expect(attempts.filter((attempt) => (
      attempt.status === 'rejected' && attempt.reason instanceof InsufficientCreditsError
    ))).toHaveLength(17);
    expect(await getBalance(env.DB, USER_ID)).toBe(0);
  });

  it('resumes only an identical interrupted reservation snapshot', async () => {
    await setBalance(5);
    await env.DB
      .prepare(
        `INSERT INTO generation_requests
          (id, user_id, provider, prompt_length, cost_credits, status)
         VALUES (?, ?, 'gemini', 12, 2, 'pending')`,
      )
      .bind('request_interrupted', USER_ID)
      .run();

    await expect(
      reserveGeneration(env.DB, USER_ID, 'request_interrupted', 'openai', 12, 1),
    ).rejects.toMatchObject({ requestStatus: 'conflict' });
    expect(await getBalance(env.DB, USER_ID)).toBe(5);

    const reservation = await reserveGeneration(
      env.DB,
      USER_ID,
      'request_interrupted',
      'gemini',
      12,
      2,
    );
    const debit = await env.DB
      .prepare('SELECT amount FROM credit_transactions WHERE id = ?')
      .bind(reservation.transactionId)
      .first<{ amount: number }>();
    expect(debit?.amount).toBe(-2);
    expect(await getBalance(env.DB, USER_ID)).toBe(3);

    await finalizeGenerationFailure(
      env.DB,
      USER_ID,
      reservation.requestId,
      reservation.transactionId,
      'provider failed',
    );
    expect(await getBalance(env.DB, USER_ID)).toBe(5);
  });

  it('refunds a failed generation exactly once', async () => {
    await setBalance(2);
    const reservation = await reserveGeneration(env.DB, USER_ID, 'request_failure', 'openai', 8, 2);

    await finalizeGenerationFailure(
      env.DB,
      USER_ID,
      reservation.requestId,
      reservation.transactionId,
      'provider failed',
    );
    await finalizeGenerationFailure(
      env.DB,
      USER_ID,
      reservation.requestId,
      reservation.transactionId,
      'provider failed again',
    );

    expect(await getBalance(env.DB, USER_ID)).toBe(2);
    const row = await env.DB
      .prepare(
        `SELECT r.status AS request_status, t.status AS transaction_status
         FROM generation_requests r
         JOIN credit_transactions t ON t.related_request_id = r.id
         WHERE r.id = ?`,
      )
      .bind(reservation.requestId)
      .first<{ request_status: string; transaction_status: string }>();
    expect(row).toEqual({ request_status: 'failed', transaction_status: 'failed' });
  });

  it('cannot refund a generation after success is finalized', async () => {
    await setBalance(2);
    const reservation = await reserveGeneration(env.DB, USER_ID, 'request_success', 'openai', 8, 2);

    await finalizeGenerationSuccess(env.DB, USER_ID, reservation.requestId, reservation.transactionId);
    await finalizeGenerationFailure(
      env.DB,
      USER_ID,
      reservation.requestId,
      reservation.transactionId,
      'late provider error',
    );

    expect(await getBalance(env.DB, USER_ID)).toBe(0);
    await expect(
      finalizeGenerationSuccess(env.DB, USER_ID, reservation.requestId, reservation.transactionId),
    ).resolves.toBe(0);
  });

  it('does not revive a failed generation as succeeded', async () => {
    await setBalance(2);
    const reservation = await reserveGeneration(env.DB, USER_ID, 'request_no_revive', 'gemini', 8, 1);
    await finalizeGenerationFailure(
      env.DB,
      USER_ID,
      reservation.requestId,
      reservation.transactionId,
      'provider failed',
    );

    await expect(
      finalizeGenerationSuccess(env.DB, USER_ID, reservation.requestId, reservation.transactionId),
    ).rejects.toThrow('could not be finalized');
    expect(await getBalance(env.DB, USER_ID)).toBe(2);
  });
});
