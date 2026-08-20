import { createApp } from './app.js';
import { env } from './config/env.js';
import { emailService } from './services/emailService.js';

const app = createApp();

app.listen(env.port, async () => {
  console.log(`[payivva-hrcrm] API Server running at http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[payivva-hrcrm] Frontend: Vite Dev Server starting at http://localhost:5173`);

  // Verify SMTP Connection on Startup
  try {
    const transporter = await emailService.getTransporter();
    if (transporter) {
      console.log(`[payivva-hrcrm] SMTP Protocol Service: CONNECTED to Gmail (sohamsp1030@gmail.com)`);
    } else {
      console.log(`[payivva-hrcrm] SMTP Protocol Service: Not configured`);
    }
  } catch (err) {
    console.warn(`[payivva-hrcrm] SMTP Verification Notice: ${err.message}`);
  }
});