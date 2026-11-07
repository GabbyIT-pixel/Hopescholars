'use strict';
// Cross-platform "npm run dev": sets NODE_ENV and restarts the server when files change (works on Windows, macOS, Linux).
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['--watch', 'server.js'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } });
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
