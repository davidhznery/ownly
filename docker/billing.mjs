import { randomUUID } from 'node:crypto';
import { getPlan, createCheckout, hasProductAccess } from './accounts.mjs';
import { authPage, escapeHtml, readForm, redirect, safeNext, sendPage } from './auth-ui.mjs';

const id = value => typeof value === 'string' ? value : value?.id;
const paidCheckout = checkout => ['paid', 'no_payment_required'].includes(checkout.payment_status);

export function createBilling({ origin, stripe, stripeReady, webhookSecret, priceIds, accounts, sessions, auth }) {
  const busy = new Set();
  const message = (res, title, intro, body, status = 200) => sendPage(res, authPage({ title, intro, body, step: 2 }), status);
  function onboarding(req, res, account, { plan = account.plan, next = '/dashboard', error = '', notice = '', status = 200 } = {}) {
    const form = sessions.form(req), returning = Boolean(account.trialStartedAt || account.stripeSubscriptionId);
    const manage = account.stripeSubscriptionId && !['canceled', 'incomplete_expired'].includes(account.status);
    const options = ['individual', 'portfolio'].map(key => `<label class="plan"><input type="radio" name="plan" value="${key}" ${key === plan ? 'checked' : ''} required><span><strong>${key === 'individual' ? 'Individual' : 'Portfolio'}</strong><small>Up to ${getPlan(key).limit} properties</small></span><strong>€${getPlan(key).amount / 100}/mo</strong></label>`).join('');
    sendPage(res, authPage({ title: manage ? 'Manage your subscription' : returning ? 'Welcome back to Ownly' : 'Your account is ready', intro: manage ? 'Your account is safe. Update your payment details or manage your subscription to continue.' : returning ? 'Choose your monthly plan to return to your property dashboard.' : 'Choose a plan to activate your 7-day free trial. Your properties will be saved to this account.', step: 2, error, notice,
      body: `<p class="identity">Signed in as <strong>${escapeHtml(account.email)}</strong></p>${manage ? '<a class="button" href="/billing/portal">Manage subscription</a>' : !stripeReady ? '<p class="notice" role="status">Your account has been saved. Trial activation is temporarily unavailable. Please come back shortly — your free days have not started.</p>' : `<form method="post" action="/checkout"><input type="hidden" name="csrf" value="${escapeHtml(form.value)}"><input type="hidden" name="next" value="${escapeHtml(safeNext(next))}">${options}<button type="submit">${returning ? 'Continue to subscription' : 'Activate my 7-day free trial'} →</button></form><p class="note">${returning ? 'Your previous trial has already been used. Your selected monthly plan will be charged when you subscribe.' : 'Add a payment method securely with Stripe. No subscription fee during your trial. Your selected monthly price is charged after 7 days unless you cancel.'}</p>`}<p class="note">By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p><div class="actions"><a href="/account/access">Sign-in settings</a>${account.stripeCustomerId ? '<a href="/billing/portal">Billing settings</a>' : ''}</div>${auth.logoutForm(form.value)}` }), status, [form.cookie]);
  }

  async function syncSubscription(account, subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = id(subscription.customer);
    if (subscription.metadata?.account_id !== account.id && account.stripeSubscriptionId !== subscription.id) throw Error('Subscription account mismatch');
    if (account.stripeCustomerId && customerId !== account.stripeCustomerId) throw Error('Subscription customer mismatch');
    const priceId = id(subscription.items?.data?.[0]?.price);
    const plan = Object.keys(priceIds).find(key => priceIds[key] === priceId);
    if (!plan) throw Error('Unrecognized subscription price');
    const latest = accounts.byId(account.id);
    if (latest.stripeSubscriptionId !== account.stripeSubscriptionId && latest.stripeSubscriptionId !== subscription.id) return latest;
    return accounts.update(account.id, { stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, status: subscription.status, plan,
      trialStartedAt: account.trialStartedAt || (subscription.trial_start ? subscription.trial_start * 1000 : null),
      trialEndsAt: subscription.trial_end ? subscription.trial_end * 1000 : null });
  }

  return {
    async handle(req, res, url, json) {
      if (req.method === 'POST' && url.pathname === '/stripe/webhook') {
        if (!stripe || !webhookSecret) { json(503, { error: 'Stripe webhook is not configured' }); return true; }
        const chunks = []; let length = 0;
        for await (const chunk of req) { length += chunk.length; if (length > 1000000) { json(413, { error: 'Webhook too large' }); return true; } chunks.push(Buffer.from(chunk)); }
        let event;
        try { event = stripe.webhooks.constructEvent(Buffer.concat(chunks), req.headers['stripe-signature'], webhookSecret); }
        catch { json(400, { error: 'Invalid Stripe signature' }); return true; }
        try {
          const object = event.data?.object || {};
          if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
            const account = accounts.byId(object.client_reference_id || object.metadata?.account_id);
            if (account && account.stripeCheckoutSessionId === object.id) {
              const checkout = await stripe.checkout.sessions.retrieve(object.id);
              if (checkout.mode === 'subscription' && checkout.status === 'complete' && paidCheckout(checkout) && id(checkout.subscription)) await syncSubscription(account, id(checkout.subscription));
            }
          } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
            const subscriptionEvent = event.type.startsWith('customer.subscription.');
            const subscriptionId = subscriptionEvent ? object.id : id(object.parent?.subscription_details?.subscription || object.subscription);
            const account = accounts.bySubscription(subscriptionId) || (subscriptionEvent ? accounts.byId(object.metadata?.account_id) : null);
            // Read current Stripe state. A replay or an old invoice cannot reactivate a cancelled account.
            if (account && subscriptionId && (!account.stripeSubscriptionId || account.stripeSubscriptionId === subscriptionId)) await syncSubscription(account, subscriptionId);
          }
          json(200, { received: true });
        } catch { json(500, { error: 'Subscription update could not be applied. Please retry.' }); }
        return true;
      }
      if (!['/onboarding', '/checkout', '/billing/success', '/billing/cancel', '/billing/portal'].includes(url.pathname)) return false;
      const account = sessions.get(req.headers.cookie);
      if (!account) {
        if (req.method === 'POST') json(401, { error: 'Sign in before activating a plan.', redirect: '/login' });
        else redirect(res, '/login');
        return true;
      }
      if (account.owner) { redirect(res, '/dashboard'); return true; }
      if (req.method === 'GET' && url.pathname === '/onboarding') {
        if (hasProductAccess(account)) redirect(res, safeNext(url.searchParams.get('next')));
        else onboarding(req, res, account, { plan: getPlan(url.searchParams.get('plan')) ? url.searchParams.get('plan') : account.plan, next: url.searchParams.get('next') });
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/checkout') {
        const input = await readForm(req), planId = input.get('plan'), next = safeNext(input.get('next'));
        if (!sessions.verifyForm(req, input)) { onboarding(req, res, account, { plan: getPlan(planId) ? planId : account.plan, error: 'We refreshed this form. Your plan is still selected; click the button again to continue.', status: 403, next }); return true; }
        if (hasProductAccess(account)) { redirect(res, next); return true; }
        if (account.stripeSubscriptionId && !['canceled', 'incomplete_expired'].includes(account.status)) { redirect(res, '/billing/portal'); return true; }
        if (!stripeReady || !getPlan(planId)) { onboarding(req, res, account, { error: 'This plan is currently unavailable. Your account is saved.', status: 503, next }); return true; }
        if (busy.has(account.id)) { onboarding(req, res, account, { notice: 'Your checkout is being prepared. Please try again in a moment.', next }); return true; }
        busy.add(account.id);
        try {
          if (account.stripeCheckoutSessionId) {
            const previous = await stripe.checkout.sessions.retrieve(account.stripeCheckoutSessionId);
            if (previous.status === 'open' && previous.metadata?.plan === planId) { redirect(res, previous.url); return true; }
            if (previous.status === 'complete' && (!account.stripeSubscriptionId || id(previous.subscription) !== account.stripeSubscriptionId)) { redirect(res, '/billing/success?session_id=' + encodeURIComponent(previous.id)); return true; }
            if (previous.status === 'open') await stripe.checkout.sessions.expire(previous.id);
          }
          const attempt = account.checkoutAttempt && account.checkoutAttemptPlan === planId && !account.stripeCheckoutSessionId ? account.checkoutAttempt : randomUUID();
          accounts.update(account.id, { checkoutAttempt: attempt, checkoutAttemptPlan: planId, checkoutReturnTo: next, stripeCheckoutSessionId: null });
          const checkout = await createCheckout(stripe, { account, planId, priceIds, origin, idempotencyKey: `ownly:${account.id}:${attempt}` });
          accounts.update(account.id, { stripeCheckoutSessionId: checkout.id, plan: planId });
          redirect(res, checkout.url);
        } catch { onboarding(req, res, account, { plan: planId, next, error: 'We could not open checkout. Your account is saved. Please try again.', status: 502 }); }
        finally { busy.delete(account.id); }
        return true;
      }
      if (req.method === 'GET' && url.pathname === '/billing/success') {
        const sessionId = url.searchParams.get('session_id');
        // A Checkout URL is not a login credential. Require the original authenticated account.
        if (!stripe || !sessionId || account.stripeCheckoutSessionId !== sessionId) { message(res, 'Checkout not found', 'Sign in with the account you used to activate your plan.', '<a href="/onboarding">Back to your account</a>', 403); return true; }
        try {
          const checkout = await stripe.checkout.sessions.retrieve(sessionId);
          if (checkout.client_reference_id !== account.id || checkout.mode !== 'subscription' || checkout.status !== 'complete' || !paidCheckout(checkout)) { message(res, 'Activation is not complete', 'Finish your checkout to activate your plan.', '<a href="/onboarding">Continue activation</a>'); return true; }
          // Subscription fulfillment happens only in the signed webhook, never in this browser return.
          const current = accounts.byId(account.id);
          if (hasProductAccess(current)) redirect(res, safeNext(current.checkoutReturnTo));
          else message(res, 'Confirming your subscription', 'Your checkout is complete. We are waiting for confirmation before opening your dashboard. This usually takes a few seconds.', `<a class="button" href="/billing/success?session_id=${encodeURIComponent(sessionId)}">Check activation</a><p><a href="/onboarding">Back to your account</a></p>`);
        } catch { message(res, 'Confirmation temporarily unavailable', 'Your account is saved. Please check again in a moment.', `<a href="/billing/success?session_id=${encodeURIComponent(sessionId)}">Check again</a>`, 502); }
        return true;
      }
      if (req.method === 'GET' && url.pathname === '/billing/cancel') {
        onboarding(req, res, account, { notice: 'You left checkout. Your account is saved, and you can continue activation here.' }); return true;
      }
      if (req.method === 'GET' && url.pathname === '/billing/portal') {
        if (!stripe || !account.stripeCustomerId) { onboarding(req, res, account, { error: 'There is no billing profile available yet.', status: 503 }); return true; }
        try { const portal = await stripe.billingPortal.sessions.create({ customer: account.stripeCustomerId, return_url: origin + '/onboarding' }); redirect(res, portal.url); }
        catch { message(res, 'Billing temporarily unavailable', 'Please try again shortly to manage your subscription.', '<a href="/onboarding">Back to your account</a>', 502); }
        return true;
      }
      json(405, { error: 'Method not allowed' }); return true;
    },
  };
}
