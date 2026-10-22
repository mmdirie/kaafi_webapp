import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { businessesRouter } from './routes/businesses.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter } from './routes/products.js';
import { suppliersRouter } from './routes/suppliers.js';
import { purchasesRouter } from './routes/purchases.js';
import { inventoryRouter } from './routes/inventory.js';
import { posRouter } from './routes/pos.js';
import { salesRouter } from './routes/sales.js';
import { expensesRouter } from './routes/expenses.js';
import { reportsRouter } from './routes/reports.js';
import { auditRouter } from './routes/audit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https:", "http:"]
      }
    }
  }));

  app.use(pinoHttp({
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    }
  }));

  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.FRONTEND_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed'));
    },
    credentials: false
  }));

  app.use(express.json({ limit: '1mb', strict: true }));

  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler(_req, res) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' }
      });
    }
  }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  // Business sub-routes
  app.use('/api/businesses/:businessId/categories', categoriesRouter);
  app.use('/api/businesses/:businessId/products', productsRouter);
  app.use('/api/businesses/:businessId/suppliers', suppliersRouter);
  app.use('/api/businesses/:businessId/purchases', purchasesRouter);
  app.use('/api/businesses/:businessId/inventory', inventoryRouter);
  app.use('/api/businesses/:businessId/pos', posRouter);
  app.use('/api/businesses/:businessId/sales', salesRouter);
  app.use('/api/businesses/:businessId/expenses', expensesRouter);
  app.use('/api/businesses/:businessId/reports', reportsRouter);
  app.use('/api/businesses/:businessId/audit-logs', auditRouter);

  // Top level API routes
  app.use('/api/businesses', businessesRouter);
  app.use('/api/auth', authRouter);

  // Serve static frontend assets
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const frontendPath = path.resolve(__dirname, '../../frontend');
  app.use(express.static(frontendPath));

  // Fallback to index.html for client-side navigation
  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
