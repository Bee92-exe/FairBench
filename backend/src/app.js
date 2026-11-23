/**
 * Express Application Skeleton
 * Owner: Aranno (A-BE-1, NFR-04)
 * Coordinates routes from Aranno and Sirat with standard error handling.
 */

import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
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

const app = express();

// Security & standard middlewares
app.use(cors({
  origin: env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

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
app.use('/api/admin', adminRouter);

// 404 Handler
app.use((req, res, next) => {
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`, null, 404));
});

// Centralized standard error handler (SYSTEM_DESIGN Section 7)
app.use(errorHandler);

export default app;
