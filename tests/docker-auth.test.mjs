import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import Stripe from 'stripe';
import { createAccountStore } from '../docker/accounts.mjs';
import { createGateway } from '../docker/gateway.mjs';
import { createResetEmailSender } from '../docker/reset-email.mjs';

const password = 'correct horse battery staple', webhookSecret = 'whsec_local_fixture';
async function fixture(t, { googleEnabled = true, stripeEnabled = true, resetEnabled = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ownly-auth-'));
  const accounts = createAccountStore(dir), calls = [], emails = [], checkouts = new Map(), subscriptions = new Map();
  const signer = new Stripe('sk_test_fixture');
  let googleIdentity = { sub: 'google-person-1', email: 'google@example.test', email_verified: true, name: 'Google Person' }, oauthParams;
  const google = {
    generateAuthUrl(params) { oauthParams = params; return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(params); },
    async getToken(params) { assert.ok(params.codeVerifier); return { tokens: { id_token: 'verified-by-sdk' } }; },
    async verifyIdToken(params) { assert.equal(params.audience, 'google-test-client'); return { getPayload: () => ({ nonce: oauthParams.nonce, ...googleIdentity }) }; },
  };
  const stripe = {
    webhooks: signer.webhooks,
    checkout: { sessions: {
      async create(params, options) {
        calls.push({ params, options });
        const checkout = { ...params, id: 'cs_' + calls.length, status: 'open', url: 'https://checkout.stripe.com/test/' + calls.length };
        checkouts.set(checkout.id, checkout); return checkout;
      },
      async retrieve(id) { const value = checkouts.get(id); if (!value) throw Error('missing checkout'); return value; },
      async expire(id) { checkouts.get(id).status = 'expired'; },
    } },
    subscriptions: { async retrieve(id) { const value = subscriptions.get(id); if (!value) throw Error('missing subscription'); return value; } },
    billingPortal: { sessions: { async create({ customer }) { assert.ok(customer); return { url: 'https://billing.stripe.com/test/' + customer }; } } },
  };
  const forwarded = [];
  const runtime = { async dispatchFetch(url, init) { forwarded.push(init); return Response.json({ ok: true, identity: init.headers.get('oai-authenticated-user-id'), plan: init.headers.get('x-ownly-plan') }); } };
  const server = createGateway({ runtime, accounts, origin: 'http://ownly.test', adminEmail: 'owner@example.test', adminPassword: password, token: 'local-collector-secret-1234567890123456789',
    stripe: stripeEnabled ? stripe : null, webhookSecret, priceIds: { individual: 'price_individual', portfolio: 'price_portfolio' },
    googleClientId: 'google-test-client', googleClient: googleEnabled ? google : null,
    sendResetEmail: resetEnabled ? async message => { emails.push(message); } : null,
    queue: { list: () => ({ searches: [] }) },
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  function browser() {
    const cookies = new Map(); let csrf;
    async function request(route, { form, headers = {}, method, body } = {}) {
      const response = await fetch(base + route, { redirect: 'manual', method: method || (form ? 'POST' : 'GET'),
        headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...(form ? { Origin: 'http://ownly.test', 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...headers },
        body: form ? new URLSearchParams({ csrf, ...form }) : body });
      for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], index = pair.indexOf('='); cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
      const text = await response.text(); csrf = text.match(/name="csrf" value="([^"]+)"/)?.[1] || csrf;
      return { status: response.status, location: response.headers.get('location'), text, headers: response.headers };
    }
    return { request, cookies };
  }
  async function register(client, email = 'person@example.test') {
    await client.request('/register?plan=portfolio');
    const result = await client.request('/register', { form: { email, password, confirm_password: password, plan: 'portfolio' } });
    assert.equal(result.status, 303); assert.match(result.location, /^\/onboarding/);
    return accounts.byEmail(email);
  }
  async function webhook(type, object, badSignature = false) {
    const payload = JSON.stringify({ id: 'evt_local', type, data: { object } });
    const signature = signer.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    return browser().request('/stripe/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': badSignature ? 'bad' : signature } });
  }
  function completeCheckout(account, status = 'trialing') {
    const current = accounts.byId(account.id), checkout = checkouts.get(current.stripeCheckoutSessionId);
    checkout.status = 'complete'; checkout.payment_status = 'no_payment_required'; checkout.subscription = 'sub_' + account.id; checkout.customer = 'cus_' + account.id;
    subscriptions.set(checkout.subscription, { id: checkout.subscription, status, customer: checkout.customer, metadata: { account_id: account.id }, trial_start: Math.floor(Date.now() / 1000), trial_end: Math.floor(Date.now() / 1000) + 7 * 86400, items: { data: [{ price: { id: 'price_portfolio' } }] } });
    return checkout;
  }
  return { browser, accounts, calls, emails, checkouts, subscriptions, forwarded, register, webhook, completeCheckout, identity: value => { googleIdentity = value; } };
}

test('account is mandatory; registration persists without starting a trial; duplicate signup cannot reset a password', async t => {
  const f = await fixture(t), client = f.browser();
  assert.match((await client.request('/dashboard')).location, /^\/login/);
  assert.equal((await client.request('/api/properties', { headers: { 'oai-authenticated-user-id': 'fake', 'x-ownly-plan': 'portfolio' } })).status, 401);
  assert.equal((await client.request('/checkout', { form: { email: 'anonymous@example.test', password, plan: 'portfolio' } })).status, 401);
  const account = await f.register(client);
  assert.equal(account.status, 'pending'); assert.equal(account.trialStartedAt, null);
  assert.equal((await client.request('/api/properties')).status, 402);
  assert.match((await client.request('/dashboard')).location, /^\/onboarding/);
  const stranger = f.browser(); await stranger.request('/register');
  assert.equal((await stranger.request('/register', { form: { email: account.email, password: 'attacker-password-1234', confirm_password: 'attacker-password-1234' } })).status, 409);
  assert.ok(f.accounts.verify(f.accounts.byId(account.id), password));
  assert.equal(f.accounts.all().length, 1); assert.equal(f.forwarded.length, 0);
});

test('forms reject CSRF and offsite redirects; login works for unpaid and cancelled accounts', async t => {
  const f = await fixture(t), client = f.browser();
  await client.request('/register');
  assert.equal((await client.request('/register', { form: { email: 'csrf@example.test', password, csrf: 'forged' } })).status, 403);
  assert.equal((await client.request('/register', { form: { email: 'csrf@example.test', password }, headers: { Origin: 'https://evil.test' } })).status, 403);
  const account = await f.register(client); f.accounts.update(account.id, { status: 'canceled', stripeCustomerId: 'cus_existing', stripeSubscriptionId: 'sub_existing' });
  const other = f.browser(); await other.request('/login');
  const login = await other.request('/login', { form: { email: account.email, password, next: '//evil.test' } });
  assert.match(login.location, /^\/onboarding/); assert.ok(!login.location.includes('evil.test'));
  assert.equal((await other.request('/api/properties')).status, 402);
  assert.match((await other.request('/billing/portal')).location, /^https:\/\/billing.stripe.com/);
  await other.request('/account/access'); await other.request('/logout', { form: {} });
  assert.equal((await other.request('/api/properties')).status, 401);
});

test('authenticated checkout works without a separate form cookie and rejects forged or cross-site requests', async t => {
  const f = await fixture(t), client = f.browser();
  await f.register(client);
  const page = await client.request('/onboarding?plan=individual');
  assert.match(page.headers.get('content-security-policy'), /form-action 'self';/);
  client.cookies.delete('ownly_form');
  assert.equal((await client.request('/checkout', { form: { plan: 'individual', csrf: 'forged' } })).status, 403);
  await client.request('/onboarding?plan=individual');
  assert.equal((await client.request('/checkout', { form: { plan: 'individual' }, headers: { Origin: 'https://evil.test', 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  await client.request('/onboarding?plan=individual');
  const start = await client.request('/checkout', { form: { plan: 'individual' } });
  assert.equal(start.status, 200);
  assert.match(start.text, /<meta http-equiv="refresh" content="0;url=https:\/\/checkout\.stripe\.com\/test\/1">/);
  assert.match(start.text, /href="https:\/\/checkout\.stripe\.com\/test\/1">Continue to Stripe/);
  assert.equal(f.calls.length, 1);
});

test('pricing selection carries through email login and Google sign-up', async t => {
  const f = await fixture(t), first = f.browser();
  const account = await f.register(first);
  const returning = f.browser();
  const loginPage = await returning.request('/login?plan=individual');
  assert.match(loginPage.text, /Continue with Google/);
  assert.match(loginPage.text, /name="plan" value="individual"/);
  const login = await returning.request('/login', { form: { email: account.email, password, plan: 'individual' } });
  assert.equal(new URL(login.location, 'http://ownly.test').searchParams.get('plan'), 'individual');

  const newcomer = f.browser();
  const signupPage = await newcomer.request('/register?plan=portfolio');
  assert.match(signupPage.text, /Continue with Google/);
  assert.match(signupPage.text, /7-day free trial/);
  const googleStart = await newcomer.request('/auth/google?plan=portfolio&register=1');
  const state = new URL(googleStart.location).searchParams.get('state');
  const googleSignup = await newcomer.request('/auth/google/callback?code=ok&state=' + state);
  assert.equal(new URL(googleSignup.location, 'http://ownly.test').searchParams.get('plan'), 'portfolio');
  assert.equal(f.accounts.byEmail('google@example.test').plan, 'portfolio');
});

test('password reset is single use, validates confirmation, and expires existing sessions', async t => {
  const f = await fixture(t), client = f.browser();
  const account = await f.register(client);
  const session = await client.request('/auth/session');
  assert.equal(JSON.parse(session.text).email, account.email);
  const visitor = f.browser();
  await visitor.request('/forgot-password?plan=individual');
  assert.equal((await visitor.request('/forgot-password', { form: { email: 'unknown@example.test' } })).status, 200);
  assert.equal(f.emails.length, 0);
  assert.equal((await visitor.request('/forgot-password', { form: { email: account.email, plan: 'individual' } })).status, 200);
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].plan, 'individual');
  const token = f.emails[0].token, newPassword = 'a different secure password';
  assert.equal((await visitor.request('/reset-password?token=' + token)).status, 200);
  assert.match((await visitor.request('/reset-password', { form: { token, password: newPassword, confirm_password: 'mismatch password' } })).text, /Passwords do not match|make sure both passwords match/);
  const reset = await visitor.request('/reset-password', { form: { token, password: newPassword, confirm_password: newPassword, plan: 'individual' } });
  assert.equal(new URL(reset.location, 'http://ownly.test').searchParams.get('plan'), 'individual');
  assert.equal(JSON.parse((await client.request('/auth/session')).text).authenticated, false);
  assert.equal((await visitor.request('/reset-password?token=' + token)).status, 400);
  const fresh = f.browser(); await fresh.request('/login');
  assert.equal((await fresh.request('/login', { form: { email: account.email, password: newPassword } })).status, 303);
});

test('password reset email uses the configured sender and embeds the reset link', async () => {
  let request;
  const send = createResetEmailSender({ apiKey: 're_fixture', from: 'Ownly <accounts@example.test>', origin: 'https://ownly.test', fetcher: async (url, init) => { request = { url, init }; return { ok: true }; } });
  await send({ email: 'person@example.test', token: 'fixture-token', plan: 'portfolio', next: '/dashboard' });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.init.headers.Authorization, 'Bearer re_fixture');
  const body = JSON.parse(request.init.body);
  assert.equal(body.to[0], 'person@example.test');
  assert.match(body.html, /https:\/\/ownly\.test\/reset-password\?token=fixture-token/);
  assert.match(body.html, /plan=portfolio/);
});

test('authenticated checkout is reused; success URL cannot sign in; only signed webhook grants access; expired trial loses access', async t => {
  const f = await fixture(t), client = f.browser(), account = await f.register(client);
  await client.request('/onboarding');
  const start = await client.request('/checkout', { form: { plan: 'portfolio' } });
  assert.equal(start.status, 200);
  assert.match(start.text, /href="https:\/\/checkout\.stripe\.com\/test\/1">Continue to Stripe/);
  const reused = await client.request('/checkout', { form: { plan: 'portfolio' } });
  assert.match(reused.text, /href="https:\/\/checkout\.stripe\.com\/test\/1">Continue to Stripe/);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].params.subscription_data.trial_period_days, 7); assert.ok(f.calls[0].options.idempotencyKey);
  const checkout = f.completeCheckout(account);
  assert.equal((await f.browser().request('/billing/success?session_id=' + checkout.id)).location, '/login');
  assert.match((await client.request('/billing/success?session_id=' + checkout.id)).text, /Confirming your subscription/);
  assert.equal((await client.request('/api/properties')).status, 402);
  assert.equal((await f.webhook('checkout.session.completed', checkout, true)).status, 400);
  assert.equal((await f.webhook('checkout.session.completed', checkout)).status, 200);
  const access = await client.request('/api/properties', { headers: { 'x-ownly-plan': 'individual', 'oai-authenticated-user-id': 'intruder' } });
  assert.equal(access.status, 200); assert.equal(JSON.parse(access.text).identity, account.id); assert.equal(JSON.parse(access.text).plan, 'portfolio');
  assert.equal((await client.request('/api/admin/airbnb-jobs')).status, 403);
  assert.equal((await client.request('/billing/success?session_id=' + checkout.id)).location, '/dashboard');
  f.accounts.update(account.id, { trialEndsAt: Date.now() - 1000 });
  assert.equal((await client.request('/api/properties')).status, 402);
});

test('webhook replay reads current status; cancellation keeps billing access and does not grant another trial', async t => {
  const f = await fixture(t), client = f.browser(), account = await f.register(client);
  await client.request('/onboarding'); await client.request('/checkout', { form: { plan: 'portfolio' } });
  const checkout = f.completeCheckout(account); await f.webhook('checkout.session.completed', checkout);
  f.subscriptions.get(checkout.subscription).status = 'canceled';
  await f.webhook('invoice.paid', { parent: { subscription_details: { subscription: checkout.subscription } }, customer: checkout.customer });
  assert.equal(f.accounts.byId(account.id).status, 'canceled'); assert.equal((await client.request('/api/properties')).status, 402);
  await client.request('/onboarding'); await client.request('/checkout', { form: { plan: 'portfolio' } });
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].params.subscription_data.trial_period_days, undefined);
});

test('Google requires matching browser state, verified email and nonce; callbacks cannot be replayed', async t => {
  const f = await fixture(t), client = f.browser();
  let response = await client.request('/auth/google?plan=portfolio&next=//evil.test');
  let state = new URL(response.location).searchParams.get('state');
  assert.match((await f.browser().request('/auth/google/callback?code=ok&state=' + state)).location, /google_expired/);
  response = await client.request('/auth/google/callback?code=ok&state=' + state);
  assert.match(response.location, /^\/onboarding/); assert.ok(!response.location.includes('evil.test'));
  assert.equal(f.accounts.all().length, 1); assert.equal(f.accounts.all()[0].googleId, 'google-person-1'); assert.equal(f.accounts.all()[0].status, 'pending');
  assert.match((await client.request('/auth/google/callback?code=ok&state=' + state)).location, /google_expired/);
  const other = f.browser(); f.identity({ sub: 'bad', email: 'unverified@example.test', email_verified: false });
  response = await other.request('/auth/google'); state = new URL(response.location).searchParams.get('state');
  assert.match((await other.request('/auth/google/callback?code=ok&state=' + state)).location, /google_failed/);
  f.identity({ sub: 'bad', email: 'nonce@example.test', email_verified: true, nonce: 'wrong' });
  response = await other.request('/auth/google'); state = new URL(response.location).searchParams.get('state');
  assert.match((await other.request('/auth/google/callback?code=ok&state=' + state)).location, /google_failed/);
  assert.equal(f.accounts.all().length, 1);
});

test('verified Google email signs into the existing account without a duplicate', async t => {
  const f = await fixture(t), emailUser = f.browser(), account = await f.register(emailUser, 'google@example.test'), googleUser = f.browser();
  let result = await googleUser.request('/auth/google'), state = new URL(result.location).searchParams.get('state');
  assert.match((await googleUser.request('/auth/google/callback?code=ok&state=' + state)).location, /^\/onboarding/);
  assert.equal(f.accounts.byId(account.id).googleId, 'google-person-1');
  assert.equal(f.accounts.all().length, 1);
  await googleUser.request('/account/access'); await googleUser.request('/logout', { form: {} });
  result = await googleUser.request('/auth/google'); state = new URL(result.location).searchParams.get('state');
  assert.match((await googleUser.request('/auth/google/callback?code=ok&state=' + state)).location, /^\/onboarding/);
  assert.equal(f.accounts.all().length, 1); assert.equal(f.accounts.byGoogleId('google-person-1').id, account.id);
});

test('missing provider configuration keeps email registration usable and never starts a trial', async t => {
  const f = await fixture(t, { googleEnabled: false, stripeEnabled: false }), client = f.browser();
  const page = await client.request('/register'); assert.ok(!page.text.includes('Continue with Google'));
  const account = await f.register(client);
  assert.match((await client.request('/onboarding')).text, /free days have not started/);
  assert.equal((await client.request('/checkout', { form: { plan: 'individual' } })).status, 503);
  assert.equal(f.accounts.byId(account.id).trialStartedAt, null);
});

test('owner login remains available and cannot be impersonated by Google or email signup', async t => {
  const f = await fixture(t), owner = f.browser(); await owner.request('/register');
  assert.equal((await owner.request('/register', { form: { email: 'owner@example.test', password, confirm_password: password } })).status, 409);
  await owner.request('/login'); assert.equal((await owner.request('/login', { form: { email: 'owner@example.test', password, next: '/admin/airbnb' } })).location, '/admin/airbnb');
  assert.equal((await owner.request('/api/admin/airbnb-jobs')).status, 200);
  f.identity({ sub: 'google-owner', email: 'owner@example.test', email_verified: true });
  const stranger = f.browser(), result = await stranger.request('/auth/google'), state = new URL(result.location).searchParams.get('state');
  assert.match((await stranger.request('/auth/google/callback?code=ok&state=' + state)).location, /error=owner/);
  assert.equal(f.accounts.all().length, 0);
});
