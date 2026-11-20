import { Logger } from '@nestjs/common';

/**
 * Postgres serialization failures (SQLSTATE 40001 / 40P01) are reported by
 * Prisma either as `P2034`, on the error's `code`/`meta.code`, or as a
 * `RUNTIME.TRANSACTION_COMMIT_FAILED` with the SQLSTATE on `error.cause`.
 * They are safe to retry: the whole SERIALIZABLE transaction rolled back, so
 * re-running the callback re-reads fresh state. No other error is retried.
 */
const SERIALIZATION_FAILURE_CODES = new Set(['40001', '40P01', 'P2034']);

export interface SerializableTransactionOptions {
  /** Isolation level passed to Prisma. Defaults to Serializable. */
  isolationLevel?:
    | 'Serializable'
    | 'RepeatableRead'
    | 'ReadCommitted'
    | 'ReadUncommitted'
    | 'Snapshot';
  /** Total attempts (first run + retries). Defaults to 3. */
  maxAttempts?: number;
  /** Base delay in ms for linear backoff between attempts. Defaults to 25. */
  retryDelayMs?: number;
  /** Optional logger; receives a warning when a retry happens. */
  logger?: Logger;
  /** Optional label used in the warning message. */
  label?: string;
}

export interface TransactionRunner {
  $transaction<T>(
    fn: (tx: any) => Promise<T>,
    options?: { isolationLevel?: string },
  ): Promise<T>;
}

function hasRetryableCode(candidate: unknown): boolean {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const error = candidate as {
    code?: unknown;
    sqlState?: unknown;
    meta?: { code?: unknown };
    cause?: unknown;
  };
  return (
    SERIALIZATION_FAILURE_CODES.has(String(error.code)) ||
    SERIALIZATION_FAILURE_CODES.has(String(error.meta?.code)) ||
    SERIALIZATION_FAILURE_CODES.has(String(error.sqlState)) ||
    hasRetryableCode(error.cause)
  );
}

function isSerializationFailure(error: unknown): boolean {
  return hasRetryableCode(error);
}

/**
 * Run a Prisma interactive transaction, retrying only on Postgres
 * serialization failures. The callback must be pure with respect to external
 * side effects (no Stripe calls, no emails) because it can be executed more
 * than once. The number of attempts and the wait between them are bounded.
 */
export async function runSerializableTransaction<T>(
  prisma: TransactionRunner,
  fn: (tx: any) => Promise<T>,
  options: SerializableTransactionOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 25;
  const isolationLevel = options.isolationLevel ?? 'Serializable';

  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel });
    } catch (error: unknown) {
      if (!isSerializationFailure(error) || attempt >= maxAttempts) throw error;
      // Logging is best-effort and never affects retry semantics.
      try {
        options.logger?.warn(
          `${options.label ?? 'Transaction'} hit a serialization failure ` +
            `(attempt ${attempt}/${maxAttempts}); retrying: ${(error as Error).message}`,
        );
      } catch {
        // A logging failure must not mask the original database error.
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
}
