import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(null, true);
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true, limit: '8mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Payivva HRCRM API is running', timestamp: new Date().toISOString() });
  });

  app.use('/api', apiRateLimiter, routes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}