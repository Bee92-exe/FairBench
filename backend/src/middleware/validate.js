/**
 * Zod Validation Middleware
 * Owner: Aranno (A-BE-1, FR-08)
 */

import { AppError } from './errors.js';

export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
    return next(new AppError('VALIDATION_ERROR', 'Validation failed for request body', details, 400));
  }
  req.body = result.data;
  next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const details = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
    return next(new AppError('VALIDATION_ERROR', 'Validation failed for query parameters', details, 400));
  }
  req.query = result.data;
  next();
};
