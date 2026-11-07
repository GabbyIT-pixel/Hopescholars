'use strict';
const path = require('path');

// Load a local .env file if present (never overrides real environment variables; not used in tests).
if (process.env.NODE_ENV !== 'test') { try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* no .env file: fine */ } }
const env = process.env;
const isProd = env.NODE_ENV === 'production';

module.exports = {
  isProd,
  port: Number(env.PORT) || 3000,
  smtpHost: env.SMTP_HOST || '', smtpPort: parseInt(env.SMTP_PORT || '465', 10), smtpUser: env.SMTP_USER || '', smtpPass: env.SMTP_PASS || '', mailFrom: env.MAIL_FROM || '',
  dbPath: env.DB_PATH || path.join(__dirname, '..', 'data', 'hopescholar.db'),
  // Demo mode shows password-reset links on screen because no email service is wired up.
  // NEVER enable in a real deployment that handles real students.
  demoMode: env.DEMO_MODE === 'true',
  sessionIdleMinutes: 30,
  sessionMaxHours: 12,
  maxFailedLogins: 5,
  lockMinutes: 15,
  resetTokenMinutes: 30,
  // Public address of the site (used for the Google redirect URI). Render provides RENDER_EXTERNAL_URL automatically.
  publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${Number(env.PORT) || 3000}`).replace(/\/+$/, ''),
  // Google sign-in is switched on only when both values are set.
  googleClientId: env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: env.GOOGLE_CLIENT_SECRET || '',
  // Optional: let the help desk use the Claude API. Without a key it uses the built-in knowledge base.
  helpdeskApiKey: env.ANTHROPIC_API_KEY || '',
  helpdeskModel: env.HELPDESK_MODEL || 'claude-sonnet-5-5',
  bcryptRounds: isProd ? 12 : 10,
  pageSize: 9,
};
