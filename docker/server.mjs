import fs from 'node:fs';
import path from 'node:path';
import { createRuntime, identityHeaders } from './runtime.mjs';
import { JobQueue } from './jobs.mjs';
import { createAccountStore, createStripeClient } from './accounts.mjs';
import { createGateway } from './gateway.mjs';

const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD, token = process.env.MARKET_COLLECTOR_TOKEN;
if (!email || !password || password.length < 16 || !token || token.length < 32) throw Error('Run the Docker setup script first. Credentials are missing or too short.');
const origin = new URL(process.env.PUBLIC_ORIGIN || 'http://localhost:3001').origin;
if (!origin.startsWith('https://') && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw Error('PUBLIC_ORIGIN must use HTTPS outside local development.');
const dataDir = process.env.DATA_DIR || '/data';
fs.mkdirSync(dataDir, { recursive: true });
const mf = await createRuntime({ dataDir, adminEmail: email });
const accounts = createAccountStore(dataDir), idHeaders = identityHeaders(email);
const queue = new JobQueue(path.join(dataDir, 'jobs.sqlite'), {
  collect: async query => {
    const response = await fetch((process.env.COLLECTOR_URL || 'http://collector:8080') + '/collect', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(query), signal: AbortSignal.timeout(150000) });
    const data = await response.json(); if (!response.ok) throw Error(data.errors?.join(' ') || data.error || `Collector error ${response.status}`); return data;
  },
  save: async captures => {
    const response = await mf.dispatchFetch('http://ownly.internal/api/admin/airbnb', { method: 'POST', headers: { ...idHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'import', captures }) });
    const data = await response.json(); if (!response.ok) throw Error(data.error || 'Could not save prices'); return data;
  },
});
const interval = setInterval(() => queue.tick().catch(error => console.error('Scheduler:', error.message)), 2000);
const publicAssets = new Set(fs.readdirSync('dist/client', { recursive: true }).filter(file => fs.statSync(path.join('dist/client', file)).isFile()).map(file => '/' + file.split(path.sep).join('/')));
const server = createGateway({ runtime: mf, accounts, queue, publicAssets, origin, adminEmail: email, adminPassword: password, token,
  stripe: createStripeClient(process.env.STRIPE_SECRET_KEY || ''), webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  priceIds: { individual: process.env.STRIPE_INDIVIDUAL_PRICE_ID || '', portfolio: process.env.STRIPE_PORTFOLIO_PRICE_ID || '' },
  googleClientId: process.env.GOOGLE_CLIENT_ID || '', googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Ownly ready. Automatic search queue is running.'));
async function stop() { clearInterval(interval); server.close(); while (queue.busy) await new Promise(resolve => setTimeout(resolve, 100)); queue.close(); await mf.dispose(); process.exit(0); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
