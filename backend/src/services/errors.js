/**
 * Service errors and database error mapping
 * Owner: Sabbir (SYSTEM_DESIGN section 7)
 */

export class AppError extends Error {
  constructor(code, message, details = [], status = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export function mapDbError(error) {
  if (error?.code === '23P01') {
    return new AppError(
      'SLOT_TAKEN',
      'That slot was just taken by another request. Please try again.',
      [],
      409
    );
  }
  return error;
}

/** Run a transactional unit and retry once when the exclusion constraint fires. */
export async function runWithRetry(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error?.code === '23P01') {
      try {
        return await fn();
      } catch (second) {
        throw mapDbError(second);
      }
    }
    throw error instanceof AppError ? error : mapDbError(error);
  }
}
