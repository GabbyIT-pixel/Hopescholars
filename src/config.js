'use strict';
const path = require('path');

const env = process.env;
const isProd = env.NODE_ENV === 'production';

module.exports = {
  isProd,
  port: Number(env.PORT) || 3000,
  dbPath: env.DB_PATH || path.join(__dirname, '..', 'data', 'hopescholar.db'),
  // Demo mode shows password-reset links on screen because no email service is wired up.
  // NEVER enable in a real deployment that handles real students.
  demoMode: env.DEMO_MODE === 'true',
  sessionIdleMinutes: 30,
  sessionMaxHours: 12,
  maxFailedLogins: 5,
  lockMinutes: 15,
  resetTokenMinutes: 30,
  bcryptRounds: isProd ? 12 : 10,
  pageSize: 9,
};
