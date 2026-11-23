/**
 * Standard Error Handling Middleware & AppError Class
 * Owner: Aranno (A-BE-1, NFR-04, SYSTEM_DESIGN Section 7)
 * Error format: { "error": { "code": "...", "message": "...", "details": [ ... ] } }
 */

export class AppError extends Error {
  constructor(code, message, details = null, statusCode = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;

    if (statusCode) {
      this.statusCode = statusCode;
    } else {
      switch (code) {
        case 'VALIDATION_ERROR':
          this.statusCode = 400;
          break;
        case 'UNAUTHENTICATED':
          this.statusCode = 401;
          break;
        case 'FORBIDDEN':
        case 'ACCOUNT_INACTIVE':
          this.statusCode = 403;
          break;
        case 'NOT_FOUND':
          this.statusCode = 404;
          break;
        case 'SLOT_TAKEN':
        case 'PREVIEW_STALE':
        case 'BOOKING_STARTED':
          this.statusCode = 409;
          break;
        case 'QUOTA_EXCEEDED':
          this.statusCode = 422;
          break;
        default:
          this.statusCode = 500;
      }
    }
  }
}

export function errorHandler(err, req, res, next) {
  // If already AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {})
      }
    });
  }

  // If ZodError
  if (err.name === 'ZodError') {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details
      }
    });
  }

  // SyntaxError in JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON payload'
      }
    });
  }

  // Fallback internal error
  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'An unexpected internal error occurred'
    }
  });
}
