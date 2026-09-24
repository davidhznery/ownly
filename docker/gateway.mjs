import http from 'node:http';
import { accountHeaders, hasProductAccess } from './accounts.mjs';
import { createSessions, equal } from './sessions.mjs';
import { createAuth } from './auth.mjs';
import { createBilling } from './billing.mjs';
import { redirect, safeNext } from './auth-ui.mjs';

export function createGateway({ runtime, accounts, queue, publicAssets = new Set(), origin, adminEmail, adminPassword, token, stripe, webhookSecret, priceIds, googleClientId, googleClientSecret, googleClient }) {
  const sessions = createSessions({ password: adminPassword, token, email: adminEmail, origin, accounts });
  const auth = createAuth({ accounts, sessions, origin, adminEmail, adminPassword, googleClientId, googleClientSecret, googleClient });
  const billing = createBilling({ origin, stripe, webhookSecret, priceIds, accounts, sessions, auth, stripeReady: Boolean(stripe && webhookSecret && priceIds.individual && priceIds.portfolio) });
  const ownerHeaders = { 'oai-authenticated-user-id': 'docker-owner', 'oai-authenticated-user-email': adminEmail, 'oai-authenticated-user-full-name': 'Ownly Owner' };
  return http.createServer(async (req, res) => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, origin);
      if (url.pathname === '/health') { json(200, { ok: true }); return; }
      if (await auth.handle(req, res, url)) return;
      if (await billing.handle(req, res, url, json)) return;
      const basicOwner = equal(req.headers.authorization, 'Basic ' + Buffer.from(`${adminEmail}:${adminPassword}`).toString('base64'));
      const session = sessions.get(req.headers.cookie), owner = basicOwner || session?.owner;
      const authenticated = Boolean(owner || session);
      if (url.pathname === '/signin-with-chatgpt') { redirect(res, authenticated ? auth.destination(session || { owner: true }, url.searchParams.get('return_to')) : '/login?next=' + encodeURIComponent(safeNext(url.searchParams.get('return_to')))); return; }
      const publicRequest = ['GET', 'HEAD'].includes(req.method) && (['/', '/terms', '/privacy'].includes(url.pathname) || publicAssets.has(url.pathname));
      if (!publicRequest && !authenticated) {
        if (req.method === 'GET' && !url.pathname.startsWith('/api/')) redirect(res, '/login?next=' + encodeURIComponent(safeNext(req.url)));
        else json(401, { error: 'Sign in required', redirect: '/login' });
        return;
      }
      if (!publicRequest && !owner && !hasProductAccess(session)) {
        if (req.method === 'GET' && !url.pathname.startsWith('/api/')) redirect(res, '/onboarding?next=' + encodeURIComponent(safeNext(req.url)));
        else json(402, { error: 'Activate your trial or manage your subscription to continue.', redirect: '/onboarding' });
        return;
      }
      if (!publicRequest && /^\/(api\/)?admin(\/|$)/.test(url.pathname) && !owner) { json(403, { error: 'Owner access required' }); return; }
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin && req.headers.origin !== origin) { json(403, { error: 'Invalid origin' }); return; }
      let body;
      if (!['GET', 'HEAD'].includes(req.method)) {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 2000000) { json(413, { error: 'Maximum request size is 2 MB' }); return; } chunks.push(Buffer.from(chunk)); }
        body = Buffer.concat(chunks);
      }
      if (url.pathname === '/api/admin/airbnb-jobs') {
        if (req.method === 'GET') json(200, queue.list());
        else if (req.method === 'POST') { const value = JSON.parse(body.toString()); if (value.action === 'create') json(201, { id: queue.add(value) }); else { queue.update(value.id, value.action); json(200, { ok: true }); } }
        else json(405, { error: 'Method not allowed' });
        return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value && !key.startsWith('oai-') && !key.startsWith('x-ownly-') && !['host', 'authorization', 'connection', 'content-length', 'origin'].includes(key)) headers.set(key, Array.isArray(value) ? value.join(',') : value);
      }
      if (authenticated) for (const [key, value] of Object.entries(owner ? ownerHeaders : accountHeaders(session))) headers.set(key, value);
      const response = await runtime.dispatchFetch(url.href, { method: req.method, headers, body });
      res.statusCode = response.status; response.headers.forEach((value, key) => res.setHeader(key, value));
      if (authenticated || !publicRequest) res.setHeader('Cache-Control', 'no-store');
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { if (!res.headersSent) json(500, { error: 'We could not complete this request. Please try again.' }); else res.end(); }
  });
}
