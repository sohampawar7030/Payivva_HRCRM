import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`[payivva-hrcrm] API running at http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[payivva-hrcrm] Frontend: run "npm run dev" in /frontend, then open http://localhost:5173`);
});