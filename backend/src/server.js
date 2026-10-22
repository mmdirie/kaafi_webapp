import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.info(`Kaafi Business API listening on port ${env.PORT}`);
});

function shutdown(signal) {
  console.info(`Received ${signal}; shutting down API server.`);
  server.close((error) => {
    if (error) {
      console.error('API server shutdown failed.', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
