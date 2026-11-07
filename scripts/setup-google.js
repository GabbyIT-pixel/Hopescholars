'use strict';
// Guided setup for "Sign in with Google": asks for the two values Google gives you and writes them to .env.
//   npm run setup:google
const fs = require('node:fs');
const readline = require('node:readline/promises');

const ENV = '.env';
(async () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nHope Scholar: Sign in with Google setup');
  console.log('You need a Client ID and Client secret from https://console.cloud.google.com/apis/credentials');
  console.log('(see docs/GOOGLE_SIGNIN.md for the 6 clicks). The redirect address to register there is shown below.\n');
  const site = (await rl.question('Site address [http://localhost:3000]: ')).trim().replace(/\/$/, '') || 'http://localhost:3000';
  console.log(`\nRegister this exact "Authorized redirect URI" in Google:\n  ${site}/auth/google/callback\n`);
  const id = (await rl.question('Client ID: ')).trim();
  const secret = (await rl.question('Client secret: ')).trim();
  rl.close();
  if (!/\.apps\.googleusercontent\.com$/.test(id) || secret.length < 10) {
    console.error('\nThat does not look right. The Client ID ends with .apps.googleusercontent.com. Nothing was saved.');
    process.exit(1);
  }
  const set = { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, PUBLIC_URL: site };
  let lines = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8').split(/\r?\n/) : [];
  for (const [k, v] of Object.entries(set)) {
    const i = lines.findIndex((l) => l.startsWith(k + '='));
    if (i >= 0) lines[i] = `${k}=${v}`; else lines.push(`${k}=${v}`);
  }
  fs.writeFileSync(ENV, lines.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n', { mode: 0o600 });
  console.log('\nSaved to .env (this file is private and is not uploaded to GitHub).');
  console.log('Now stop the server (Ctrl+C) and run: npm run dev');
})();
