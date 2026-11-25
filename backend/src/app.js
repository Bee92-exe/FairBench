/**
 * Express Application Skeleton
 * Owner: Aranno (A-BE-1, NFR-04)
 * Coordinates routes from Aranno and Sirat with standard error handling.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { USE_POSTGRES } from './config/dataSource.js';
import { errorHandler, AppError } from './middleware/errors.js';

// Route imports
import healthRouter from './routes/health.js';
import settingsRouter from './routes/settings.js';
import notificationsRouter from './routes/notifications.js';
import meRouter from './routes/me.js';
import machinesRouter from './routes/machines.js';
import requestsRouter from './routes/requests.js';
import scheduleRouter from './routes/schedule.js';
import bookingsRouter from './routes/bookings.js';
import adminRouter from './routes/admin.js';
import adminPgRouter from './routes/adminPg.js';

const app = express();

// Behind a hosting proxy the client IP arrives in X-Forwarded-For; without this
// every caller would share the proxy's address and one rate-limit bucket.
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers (NFR-04)
app.use(helmet());

// Security & standard middlewares
// In development any localhost port is allowed: Vite silently moves to 5174
// when 5173 is taken, and a CORS rejection looks like a failed login in the
// browser. Production stays pinned to CORS_ORIGIN.
const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);                       // curl, same-origin
    if (origin === env.CORS_ORIGIN) return callback(null, true);
    if (env.NODE_ENV !== 'production' && localOrigin.test(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Rate limiting on write routes. Reads stay unlimited so the calendar and the
// notification poller can refetch on their 30 second interval.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => env.NODE_ENV === 'test' ||
    ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
        details: []
      }
    });
  }
});
app.use('/api', writeLimiter);

// Request logger for development / audit tracing
if (env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Mount routes
app.use('/api/health', healthRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/me', meRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/bookings', bookingsRouter);
// Admin console: two implementations, one contract. The in-memory one keeps
// the test suite independent of a database.
app.use('/api/admin', USE_POSTGRES ? adminPgRouter : adminRouter);

// 404 Handler
app.use((req, res, next) => {
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`, null, 404));
});

// Centralized standard error handler (SYSTEM_DESIGN Section 7)
app.use(errorHandler);

export default app;
